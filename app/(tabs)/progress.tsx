// Pestaña de Progreso: peso y tendencia, medidas, fuerza estimada, constancia,
// adherencia a la alimentación y accesos a fotos y revisión semanal.
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../src/data/store';
import { useI18n } from '../../src/i18n';
import { useTheme, space } from '../../src/theme';
import {
  BarChart,
  Body,
  Button,
  Card,
  Empty,
  H1,
  H3,
  Label,
  LineChart,
  ListItem,
  LockCard,
  Notice,
  Num,
  NumberField,
  Row,
  Screen,
  Segmented,
  Small,
} from '../../src/components';
import { EXERCISE_BY_ID, LIMITS, bestSetE1rm, can, weightTrend } from '../../src/core';
import type { Measurement } from '../../src/data/types';
import { consumedOn, reviewDue } from '../../src/lib/derive';
import { addDays, formatDate, todayStr, weekStart, weekdayIndex } from '../../src/lib/dates';
import {
  cmToDisplay,
  displayToCm,
  displayWeightToKg,
  fmtNum,
  fmtWeight,
  kgToDisplay,
  lengthUnit,
  weightUnit,
} from '../../src/lib/format';

type MeasureKey = 'waistCm' | 'chestCm' | 'armCm' | 'hipCm' | 'thighCm';
const MEASURES: { key: MeasureKey; label: string }[] = [
  { key: 'waistCm', label: 'progress.waist' },
  { key: 'chestCm', label: 'progress.chest' },
  { key: 'armCm', label: 'progress.arm' },
  { key: 'hipCm', label: 'progress.hip' },
  { key: 'thighCm', label: 'progress.thigh' },
];

const dateFromStr = (d: string) => {
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(y, m - 1, dd);
};

export default function ProgressScreen() {
  const { state, actions, plan } = useApp();
  const { t, lang } = useI18n();
  const { c } = useTheme();
  const units = state.profile?.units ?? 'metric';
  const today = todayStr();
  const fullProgress = can(plan, 'full_progress');
  const historyDays = LIMITS[plan].progressHistoryDays;

  // ------------------------------------------------------------------ peso
  const [range, setRange] = useState<'week' | 'month'>('month');
  const [weightInput, setWeightInput] = useState<number | undefined>(undefined);
  const [weightMsg, setWeightMsg] = useState<{ kind: 'ok' | 'danger'; text: string } | null>(null);

  const weights = useMemo(() => [...state.weights].sort((a, b) => a.date.localeCompare(b.date)), [state.weights]);
  const visibleWeights = useMemo(
    () => (historyDays === null ? weights : weights.filter((w) => w.date >= addDays(today, -historyDays))),
    [weights, historyDays, today],
  );
  const windowDays = range === 'week' ? 7 : 30;
  const chartData = visibleWeights
    .filter((w) => w.date >= addDays(today, -windowDays))
    .map((w) => ({ x: w.date, y: kgToDisplay(w.weightKg, units) }));
  const trend = useMemo(() => weightTrend(visibleWeights, 21, today), [visibleWeights, today]);
  const latest = weights.length ? weights[weights.length - 1] : null;

  const logWeight = async () => {
    const kg = weightInput !== undefined ? displayWeightToKg(weightInput, units) : NaN;
    if (!Number.isFinite(kg) || kg < 25 || kg > 350) {
      setWeightMsg({ kind: 'danger', text: t('sc.progress.invalidWeight') });
      return;
    }
    try {
      await actions.logWeight(today, Math.round(kg * 100) / 100);
      setWeightInput(undefined);
      setWeightMsg({ kind: 'ok', text: t('sc.progress.weightSaved') });
    } catch {
      setWeightMsg({ kind: 'danger', text: t('common.error') });
    }
  };

  // ------------------------------------------------------------- medidas
  const lastMeasure: Measurement | null = useMemo(() => {
    const sorted = [...state.measurements].sort((a, b) => b.date.localeCompare(a.date));
    return sorted[0] ?? null;
  }, [state.measurements]);
  const [measureDraft, setMeasureDraft] = useState<Partial<Record<MeasureKey, number | undefined>>>({});
  const [measureMsg, setMeasureMsg] = useState<{ kind: 'ok' | 'danger'; text: string } | null>(null);

  const saveMeasures = async () => {
    const m: Measurement = { date: today };
    let any = false;
    for (const { key } of MEASURES) {
      const v = measureDraft[key];
      if (v !== undefined && Number.isFinite(v) && v > 0) {
        m[key] = Math.round(displayToCm(v, units) * 10) / 10;
        any = true;
      }
    }
    if (!any) {
      setMeasureMsg({ kind: 'danger', text: t('sc.progress.measuresEmpty') });
      return;
    }
    try {
      await actions.saveMeasurement(m);
      setMeasureDraft({});
      setMeasureMsg({ kind: 'ok', text: t('sc.progress.measuresSaved') });
    } catch {
      setMeasureMsg({ kind: 'danger', text: t('common.error') });
    }
  };

  // --------------------------------------------------------------- fuerza
  const strength = useMemo(() => {
    const mainIds = new Set<string>();
    for (const d of state.workoutPlan?.days ?? []) for (const e of d.exercises) if (e.main) mainIds.add(e.exerciseId);
    const isMain = (id: string) => (mainIds.size ? mainIds.has(id) : !!EXERCISE_BY_ID[id]?.compound);
    const byEx = new Map<string, Map<string, number>>(); // ejercicio -> fecha -> mejor e1RM
    const sessions = historyDays === null ? state.sessions : state.sessions.filter((s) => s.date.slice(0, 10) >= addDays(today, -historyDays));
    for (const s of sessions) {
      const date = s.date.slice(0, 10);
      for (const log of s.exercises) {
        if (!isMain(log.exerciseId)) continue;
        const e1 = bestSetE1rm(log);
        if (e1 === null) continue;
        const m = byEx.get(log.exerciseId) ?? new Map<string, number>();
        m.set(date, Math.max(m.get(date) ?? 0, e1));
        byEx.set(log.exerciseId, m);
      }
    }
    return [...byEx.entries()]
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, 3)
      .map(([id, m]) => ({
        id,
        sessions: m.size,
        data: [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([x, y]) => ({ x, y: kgToDisplay(y, units) })),
      }));
  }, [state.sessions, state.workoutPlan, historyDays, today, units]);

  // ------------------------------------------------------ sesiones / semana
  const weekBars = useMemo(() => {
    const ws = weekStart(today);
    return Array.from({ length: 6 }, (_, i) => {
      const start = addDays(ws, -7 * (5 - i));
      const end = addDays(start, 7);
      const n = state.sessions.filter((s) => {
        const d = s.date.slice(0, 10);
        return d >= start && d < end;
      }).length;
      return { label: formatDate(start, lang), value: n };
    });
  }, [state.sessions, today, lang]);
  const anySessions = weekBars.some((b) => b.value > 0);

  // ------------------------------------------------------------ adherencia
  const adherence = useMemo(() => {
    const wp = state.weekPlanKind === 'week' ? state.weekPlan : null;
    let planned = 0;
    let eaten = 0;
    let proteinSum = 0;
    let proteinDays = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(today, -i);
      if (wp && wp.days.length) {
        const day = wp.days[weekdayIndex(dateFromStr(d)) % wp.days.length];
        planned += day?.meals.length ?? 0;
      }
      const cons = consumedOn(state, d);
      if (cons) {
        eaten += cons.meals;
        proteinSum += cons.protein;
        proteinDays += 1;
      }
    }
    return { planned, eaten: Math.min(eaten, planned || eaten), hasPlan: !!wp, proteinAvg: proteinDays ? proteinSum / proteinDays : null, proteinDays };
  }, [state, today]);

  const review = reviewDue(state);

  return (
    <Screen keyboard>
      <H1>{t('progress.title')}</H1>

      {/* --- Peso --- */}
      <Card>
        <Label>{t('progress.weight')}</Label>
        {latest ? (
          <>
            <Row style={{ alignItems: 'baseline' }} gap={space.xs}>
              <Num>{fmtNum(kgToDisplay(latest.weightKg, units), 1)}</Num>
              <Small>{weightUnit(units)}</Small>
            </Row>
            <Small>{t('sc.progress.latest', { v: fmtWeight(latest.weightKg, units), date: formatDate(latest.date, lang) })}</Small>
          </>
        ) : null}

        <Row gap={space.sm} style={{ alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <NumberField
              label={t('sc.progress.newWeight')}
              value={weightInput}
              onChange={(n) => {
                setWeightInput(n);
                setWeightMsg(null);
              }}
              decimals={1}
              suffix={weightUnit(units)}
            />
          </View>
          <Button title={t('progress.logWeight')} icon="plus" onPress={() => void logWeight()} disabled={weightInput === undefined} />
        </Row>
        {weightMsg ? <Notice kind={weightMsg.kind} text={weightMsg.text} /> : null}

        {weights.length === 0 ? (
          <Empty title={t('sc.progress.noWeightsTitle')} body={t('sc.progress.noWeightsBody')} />
        ) : (
          <>
            <Segmented
              options={[
                { value: 'week', label: t('progress.week') },
                { value: 'month', label: t('progress.month') },
              ]}
              value={range}
              onChange={(v) => setRange(v === 'week' ? 'week' : 'month')}
            />
            <LineChart data={chartData} formatY={(n) => fmtNum(n, 1)} />
            <Label>{t('progress.trend')}</Label>
            {trend.sufficient ? (
              <Body>
                {t('progress.trendValue', {
                  v: `${trend.slopeKgPerWeek > 0 ? '+' : trend.slopeKgPerWeek < 0 ? '−' : ''}${fmtWeight(Math.abs(trend.slopeKgPerWeek), units, 2)}`,
                })}
              </Body>
            ) : (
              <Small>{t('progress.trendInsufficient')}</Small>
            )}
          </>
        )}
        {historyDays !== null ? <Notice kind="info" text={t('progress.historyLimit')} /> : null}
      </Card>

      {/* --- Medidas --- */}
      <Card>
        <Label>{t('progress.measurements')}</Label>
        {!fullProgress ? (
          <LockCard text={t('sc.progress.measuresLocked')} />
        ) : (
          <>
            {lastMeasure ? (
              <View style={{ gap: 2 }}>
                <Small>{t('sc.progress.lastMeasures', { date: formatDate(lastMeasure.date, lang) })}</Small>
                <Row wrap gap={space.md}>
                  {MEASURES.filter((m) => lastMeasure[m.key] !== undefined).map((m) => (
                    <Body key={m.key} style={{ fontSize: 14 }}>
                      {`${t(m.label)}: ${fmtNum(cmToDisplay(lastMeasure[m.key] as number, units), 1)} ${lengthUnit(units)}`}
                    </Body>
                  ))}
                </Row>
              </View>
            ) : null}
            {MEASURES.map((m) => (
              <NumberField
                key={m.key}
                label={t(m.label)}
                value={measureDraft[m.key]}
                onChange={(n) => {
                  setMeasureDraft((d) => ({ ...d, [m.key]: n }));
                  setMeasureMsg(null);
                }}
                decimals={1}
                suffix={lengthUnit(units)}
              />
            ))}
            <Button title={t('progress.saveMeasures')} onPress={() => void saveMeasures()} />
            {measureMsg ? <Notice kind={measureMsg.kind} text={measureMsg.text} /> : null}
          </>
        )}
      </Card>

      {/* --- Fuerza --- */}
      <Card>
        <Label>{t('progress.strength')}</Label>
        {!fullProgress ? (
          <LockCard text={t('sc.progress.strengthLocked')} />
        ) : strength.length === 0 ? (
          <Empty
            title={t('sc.progress.noStrengthTitle')}
            body={t('sc.progress.noStrengthBody')}
            action={{ title: t('sc.progress.startTraining'), onPress: () => router.push('/training') }}
          />
        ) : (
          <>
            {strength.map((s) => (
              <View key={s.id} style={{ gap: space.xs }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <H3 style={{ flex: 1 }} numberOfLines={1}>
                    {EXERCISE_BY_ID[s.id]?.name[lang] ?? s.id}
                  </H3>
                  <Small>{t('sc.progress.sessionsCount', { n: s.sessions })}</Small>
                </Row>
                <LineChart data={s.data} height={120} color={c.protein} formatY={(n) => `${fmtNum(n)} ${weightUnit(units)}`} />
              </View>
            ))}
            <Small>{t('progress.strengthNote')}</Small>
          </>
        )}
      </Card>

      {/* --- Sesiones por semana --- */}
      <Card>
        <Label>{t('progress.sessions')}</Label>
        {anySessions ? (
          <>
            <Small>{t('sc.progress.sessionsWeeks')}</Small>
            <BarChart data={weekBars} highlightIndex={weekBars.length - 1} />
          </>
        ) : (
          <Empty
            title={t('sc.progress.noSessionsTitle')}
            body={t('sc.progress.noSessionsBody')}
            action={{ title: t('sc.progress.startTraining'), onPress: () => router.push('/training') }}
          />
        )}
      </Card>

      {/* --- Adherencia --- */}
      <Card>
        <Label>{t('progress.adherence')}</Label>
        {adherence.hasPlan && adherence.planned > 0 ? (
          <Body>{t('sc.progress.adherenceValue', { eaten: adherence.eaten, planned: adherence.planned })}</Body>
        ) : (
          <Small>{t('sc.progress.adherenceNoPlan')}</Small>
        )}
        <Label style={{ marginTop: space.sm }}>{t('progress.proteinAvg')}</Label>
        {adherence.proteinAvg !== null ? (
          <>
            <Body>{`${fmtNum(adherence.proteinAvg)} g`}</Body>
            <Small>{t('sc.progress.proteinDays', { n: adherence.proteinDays })}</Small>
          </>
        ) : (
          <Empty title={t('progress.noData')} body={t('sc.progress.noMealLogs')} />
        )}
      </Card>

      {/* --- Accesos --- */}
      <Card style={{ paddingVertical: space.sm }}>
        <ListItem title={t('progress.photos')} icon="camera" onPress={() => router.push('/photos')} />
        <ListItem
          title={t('progress.review')}
          subtitle={review.due ? t('common.today') : undefined}
          icon="check"
          onPress={() => router.push('/review')}
        />
      </Card>

      <Small>{t('progress.resultsNote')}</Small>
    </Screen>
  );
}
