// Revisión semanal: cuestionario, propuesta basada en la tendencia del peso
// y decisión del usuario (aceptar, rechazar o modificar).
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { Stack } from 'expo-router';
import { useApp } from '../src/data/store';
import type { CheckinRecord } from '../src/data/types';
import { useI18n } from '../src/i18n';
import { useTheme, space } from '../src/theme';
import {
  Body,
  Button,
  Card,
  Divider,
  Field,
  H2,
  H3,
  Label,
  LockCard,
  Notice,
  NumberField,
  Row,
  Screen,
  Segmented,
  Small,
  Stepper,
  Switch,
} from '../src/components';
import { can, weeklyReview, type CheckIn, type ReviewProposal } from '../src/core';
import { targetsFor } from '../src/lib/derive';
import { todayStr, weekStart } from '../src/lib/dates';
import { fmtNum, fmtWeight } from '../src/lib/format';

type Scale = 1 | 2 | 3 | 4 | 5;
const SCALE_OPTIONS = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }));

function ScaleQuestion({
  label,
  value,
  onChange,
  low,
  high,
}: {
  label: string;
  value: Scale;
  onChange: (v: Scale) => void;
  low: string;
  high: string;
}) {
  return (
    <View style={{ gap: space.xs }}>
      <Body style={{ fontWeight: '600' }}>{label}</Body>
      <Segmented options={SCALE_OPTIONS} value={String(value)} onChange={(v) => onChange(Number(v) as Scale)} />
      <Row style={{ justifyContent: 'space-between' }}>
        <Small>{`1 · ${low}`}</Small>
        <Small>{`${high} · 5`}</Small>
      </Row>
    </View>
  );
}

export default function ReviewScreen() {
  const { state, actions, plan } = useApp();
  const { t } = useI18n();
  const { c } = useTheme();
  const profile = state.profile;
  const units = profile?.units ?? 'metric';
  const planned = state.workoutPlan?.days.length ?? 0;
  const ws = weekStart();
  const existing = state.checkins.find((x) => x.weekStart === ws) ?? null;
  const canAdjust = can(plan, 'weekly_review_adjustments');

  const [redo, setRedo] = useState(false);
  const [workouts, setWorkouts] = useState(0);
  const [adherence, setAdherence] = useState<Scale>(4);
  const [energy, setEnergy] = useState<Scale>(3);
  const [recovery, setRecovery] = useState<Scale>(3);
  const [hunger, setHunger] = useState<Scale>(3);
  const [discomfort, setDiscomfort] = useState(false);
  const [discomfortNote, setDiscomfortNote] = useState('');
  const [proposal, setProposal] = useState<ReviewProposal | null>(null);
  const [answers, setAnswers] = useState<CheckIn | null>(null);
  const [modifying, setModifying] = useState(false);
  const [modAbs, setModAbs] = useState<number | undefined>(undefined);
  const [modSign, setModSign] = useState<1 | -1>(1);
  const [modError, setModError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ kind: 'ok' | 'info' | 'danger'; text: string } | null>(null);
  const [daysMsg, setDaysMsg] = useState<string | null>(null);

  // Último ajuste aplicado (para no encadenar cambios en menos de 2 semanas).
  const lastAdjustmentDate = useMemo(() => {
    const applied = state.checkins
      .filter((x) => (x.decision === 'accepted' || x.decision === 'modified') && x.appliedDeltaKcal !== 0 && x.decidedAt)
      .map((x) => (x.decidedAt as string).slice(0, 10))
      .sort();
    return applied.length ? applied[applied.length - 1] : undefined;
  }, [state.checkins]);

  const header = <Stack.Screen options={{ title: t('review.title') }} />;

  if (!profile) {
    return (
      <Screen>
        {header}
        <Notice kind="info" text={t('sc.review.noProfile')} />
      </Screen>
    );
  }

  const tr = targetsFor(state);
  const inDeficit = !!(tr && tr.ok && tr.targets.adjustmentKcal < 0);

  const analyze = () => {
    const checkIn: CheckIn = {
      weekStart: ws,
      workoutsCompleted: workouts,
      workoutsPlanned: planned,
      dietAdherence: adherence,
      energy,
      recovery,
      hunger,
      discomfort,
      discomfortNote: discomfort && discomfortNote.trim() ? discomfortNote.trim() : undefined,
    };
    const p = weeklyReview({
      goal: profile.goal,
      level: profile.level,
      inDeficit,
      weights: state.weights,
      checkIn,
      lastAdjustmentDate,
      today: todayStr(),
    });
    setAnswers(checkIn);
    setProposal(p);
    setResult(null);
    setModifying(false);
    setModAbs(undefined);
    setModSign(1);
    setModError(null);
  };

  const save = async (decision: CheckinRecord['decision'], appliedDeltaKcal: number) => {
    if (!answers || !proposal) return;
    setSaving(true);
    try {
      await actions.saveCheckin({
        weekStart: ws,
        answers,
        proposal,
        decision,
        appliedDeltaKcal,
        decidedAt: new Date().toISOString(),
      });
      setRedo(false);
      setProposal(null);
      setAnswers(null);
      if ((decision === 'accepted' || decision === 'modified') && appliedDeltaKcal !== 0) {
        setResult({ kind: 'ok', text: t('review.applied') });
      } else if (decision === 'rejected' && canAdjust) {
        setResult({ kind: 'info', text: t('review.rejected') });
      } else {
        setResult({ kind: 'ok', text: t('sc.review.saved') });
      }
    } catch {
      setResult({ kind: 'danger', text: t('sc.review.saveError') });
    } finally {
      setSaving(false);
    }
  };

  const applyModified = () => {
    if (modAbs === undefined || !Number.isInteger(modAbs) || modAbs > 300) {
      setModError(t('sc.review.modifyRange'));
      return;
    }
    void save('modified', modAbs === 0 ? 0 : modSign * modAbs);
  };

  const fewerDays = () => {
    const n = Math.max(1, profile.daysPerWeek - 1);
    Alert.alert(t('sc.review.fewerDaysConfirmTitle'), t('sc.review.fewerDaysConfirmBody', { n }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.continue'),
        onPress: () => {
          actions
            .saveProfile({ ...profile, daysPerWeek: n, updatedAt: new Date().toISOString() })
            .then(() => setDaysMsg(t('sc.review.fewerDaysDone', { n })))
            .catch(() => setDaysMsg(t('common.error')));
        },
      },
    ]);
  };

  const showForm = !existing || redo;
  const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmtNum(Math.abs(n))}`;
  const trend = proposal?.trend;

  return (
    <Screen keyboard>
      {header}
      <Small>{t('review.intro')}</Small>

      {result ? <Notice kind={result.kind} text={result.text} /> : null}
      {daysMsg ? <Notice kind="ok" text={daysMsg} /> : null}

      {existing && !redo ? (
        <Card>
          <Notice kind="ok" text={t('sc.review.alreadyDone')} />
          <Small>
            {t('sc.review.lastDecision', {
              d: t(`sc.review.decision.${existing.decision}`),
              delta: signed(existing.appliedDeltaKcal),
            })}
          </Small>
          <Button
            title={t('sc.review.redo')}
            variant="secondary"
            icon="refresh"
            onPress={() => {
              setRedo(true);
              setResult(null);
            }}
          />
        </Card>
      ) : null}

      {showForm ? (
        <Card>
          {planned > 0 ? (
            <Stepper
              label={t('review.workouts')}
              value={Math.min(workouts, Math.max(planned, 7))}
              min={0}
              max={Math.max(planned, 7)}
              onChange={setWorkouts}
              suffix={t('review.of', { n: planned })}
            />
          ) : (
            <>
              <Stepper label={t('review.workouts')} value={workouts} min={0} max={7} onChange={setWorkouts} />
              <Small>{t('sc.review.noPlanned')}</Small>
            </>
          )}
          <Divider />
          <ScaleQuestion label={t('review.adherence')} value={adherence} onChange={setAdherence} low={t('review.scaleLow')} high={t('review.scaleHigh')} />
          <ScaleQuestion label={t('review.energy')} value={energy} onChange={setEnergy} low={t('review.scaleLow')} high={t('review.scaleHigh')} />
          <ScaleQuestion label={t('review.recovery')} value={recovery} onChange={setRecovery} low={t('review.scaleLow')} high={t('review.scaleHigh')} />
          <ScaleQuestion label={t('review.hunger')} value={hunger} onChange={setHunger} low={t('review.hungerLow')} high={t('review.hungerHigh')} />
          <Divider />
          <Switch label={t('review.discomfort')} value={discomfort} onChange={setDiscomfort} />
          {discomfort ? (
            <Field label={t('review.discomfortNote')} value={discomfortNote} onChangeText={setDiscomfortNote} autoCapitalize="sentences" />
          ) : null}
          <Button title={t('review.analyze')} icon="chart" onPress={analyze} />
        </Card>
      ) : null}

      {proposal && trend ? (
        <>
          <H2 style={{ marginTop: space.sm }}>{t('review.proposal')}</H2>

          {/* Tendencia */}
          <Card>
            <Label>{t('progress.trend')}</Label>
            {trend.sufficient ? (
              <Body>
                {t('review.weightTrend', {
                  v: t('progress.trendValue', {
                    v: `${trend.slopeKgPerWeek > 0 ? '+' : trend.slopeKgPerWeek < 0 ? '−' : ''}${fmtWeight(Math.abs(trend.slopeKgPerWeek), units, 2)}`,
                  }),
                })}
              </Body>
            ) : (
              <Small>{t('sc.review.trendNone', { n: trend.entries })}</Small>
            )}
          </Card>

          {/* Calorías */}
          <Card>
            <Label>{t('sc.review.calories')}</Label>
            <H3 color={proposal.calorieDeltaKcal === 0 ? c.text : c.accent}>
              {proposal.calorieDeltaKcal === 0 ? t('review.noChange') : t('review.change', { delta: signed(proposal.calorieDeltaKcal) })}
            </H3>
            <Body style={{ fontSize: 14 }}>{t(`review.reasons.${proposal.calorieReason}`)}</Body>
          </Card>

          {/* Entrenamiento */}
          <Card>
            <Label>{t('sc.review.trainingTitle')}</Label>
            {proposal.training.map((r) => (
              <Body key={r} style={{ fontSize: 14 }}>{`• ${t(`review.training.${r}`)}`}</Body>
            ))}
            {proposal.suggestDeload ? <Notice kind="info" text={t('review.deload')} /> : null}
            {proposal.suggestFewerDays && profile.daysPerWeek > 1 ? (
              <Button title={t('review.fewerDays')} variant="secondary" onPress={fewerDays} />
            ) : null}
          </Card>

          {/* Decisión */}
          {canAdjust ? (
            <Card>
              <Row gap={space.sm}>
                <Button
                  title={t('review.accept')}
                  icon="check"
                  onPress={() => void save('accepted', proposal.calorieDeltaKcal)}
                  loading={saving}
                  style={{ flex: 1 }}
                />
                <Button title={t('review.reject')} variant="secondary" onPress={() => void save('rejected', 0)} disabled={saving} style={{ flex: 1 }} />
              </Row>
              <Button
                title={t('review.modify')}
                variant="ghost"
                onPress={() => {
                  setModifying((v) => !v);
                  setModAbs(Math.abs(proposal.calorieDeltaKcal));
                  setModSign(proposal.calorieDeltaKcal < 0 ? -1 : 1);
                  setModError(null);
                }}
              />
              {modifying ? (
                <View style={{ gap: space.sm }}>
                  <NumberField
                    label={t('review.modifyLabel')}
                    value={modAbs}
                    onChange={(n) => {
                      setModAbs(n);
                      setModError(null);
                    }}
                    suffix="kcal"
                    error={modError ?? undefined}
                  />
                  <Segmented
                    options={[
                      { value: 'minus', label: '−' },
                      { value: 'plus', label: '+' },
                    ]}
                    value={modSign < 0 ? 'minus' : 'plus'}
                    onChange={(v) => setModSign(v === 'minus' ? -1 : 1)}
                  />
                  <Button title={t('sc.review.modifyApply')} onPress={applyModified} loading={saving} />
                </View>
              ) : null}
            </Card>
          ) : (
            <>
              <LockCard text={t('review.locked')} />
              <Button title={t('sc.review.save')} variant="secondary" onPress={() => void save('rejected', 0)} loading={saving} />
            </>
          )}
        </>
      ) : null}

      <Small>{t('common.estimateNote')}</Small>
    </Screen>
  );
}
