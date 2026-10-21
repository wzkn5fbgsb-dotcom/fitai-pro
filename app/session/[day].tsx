// Registro de una sesión de la rutina: series con peso, repeticiones y RIR,
// dolor/técnica por ejercicio, recuperación y esfuerzo. Guarda un SessionLog.
import { useMemo, useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import {
  Body,
  Button,
  Card,
  Divider,
  Empty,
  H2,
  H3,
  Icon,
  Label,
  Notice,
  ProgressBar,
  Row,
  Screen,
  Small,
  Stepper,
  Switch,
} from '../../src/components';
import {
  EXERCISE_BY_ID,
  suggestProgression,
  type ExerciseLog,
  type PlannedExercise,
  type ProgressionSuggestion,
  type SessionLog,
  type SetLog,
  type UnitSystem,
} from '../../src/core';
import { useApp } from '../../src/data/store';
import { useI18n } from '../../src/i18n';
import { lastExerciseLog } from '../../src/lib/derive';
import { displayWeightToKg, fmtWeight, kgToDisplay, weightUnit } from '../../src/lib/format';
import { font, radius, space, useTheme } from '../../src/theme';

type Translate = (path: string, vars?: Record<string, string | number>) => string;

interface SetDraft {
  weight: number | undefined; // en unidades de visualización
  reps: number | undefined;
  rir: number | undefined;
  completed: boolean;
}

interface ExerciseDraft {
  planned: PlannedExercise;
  usesLoad: boolean; // false para peso corporal o banda (se guarda null)
  suggestion: ProgressionSuggestion;
  lastText: string | null;
  sets: SetDraft[];
  pain: boolean;
  techniqueOk: boolean;
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function describeSets(sets: SetLog[], units: UnitSystem, t: Translate): string {
  return sets
    .filter((s) => s.completed)
    .map((s) =>
      s.weightKg === null ? t('sb.exercise.bodyweightSet', { reps: s.reps }) : t('sb.exercise.weightSet', { w: fmtWeight(s.weightKg, units), reps: s.reps }),
    )
    .join(', ');
}

export default function SessionScreen() {
  const params = useLocalSearchParams<{ day: string }>();
  const dayIndex = Number(params.day);
  const { state, actions } = useApp();
  const { t, lang } = useI18n();
  const { c } = useTheme();
  const units: UnitSystem = state.profile?.units ?? 'metric';
  const day = Number.isInteger(dayIndex) ? state.workoutPlan?.days[dayIndex] ?? null : null;

  // Borrador inicial: se calcula una vez a partir del plan y del último registro.
  const initial = useMemo<ExerciseDraft[]>(() => {
    if (!day) return [];
    return day.exercises
      .filter((pe) => pe.exerciseId in EXERCISE_BY_ID)
      .map((pe) => {
        const ex = EXERCISE_BY_ID[pe.exerciseId];
        const usesLoad = ex.load !== 'bodyweight' && ex.load !== 'band';
        const last = lastExerciseLog(state, pe.exerciseId);
        const suggestion = suggestProgression(pe, last?.log, last ? { recoveryOk: last.recoveryOk } : undefined, units);
        const lastText = last ? describeSets(last.log.sets, units, t) || null : null;
        const w = usesLoad && suggestion.nextWeightKg !== null ? Number(kgToDisplay(suggestion.nextWeightKg, units).toFixed(1)) : undefined;
        return {
          planned: pe,
          usesLoad,
          suggestion,
          lastText,
          sets: Array.from({ length: pe.sets }, () => ({ weight: w, reps: undefined, rir: undefined, completed: false })),
          pain: false,
          techniqueOk: true,
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day?.index, state.workoutPlan?.generatedAt]);

  const [drafts, setDrafts] = useState<ExerciseDraft[]>(initial);
  const [recoveryOk, setRecoveryOk] = useState(true);
  const [effort, setEffort] = useState(7);
  const [effortTouched, setEffortTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!day) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('session.title') }} />
        <Empty title={t('sb.session.notFound')} action={{ title: t('sb.session.goTraining'), onPress: () => router.back() }} />
      </Screen>
    );
  }

  const title = t(`training.day.${day.dayType}`);

  const save = async (log: SessionLog) => {
    setSaving(true);
    try {
      await actions.addSession(log);
      router.back();
    } catch {
      Alert.alert(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  // ---- Día de cardio o movilidad ----
  if (day.exercises.length === 0) {
    const min = day.cardio?.minutes ?? day.estMinutes;
    return (
      <Screen>
        <Stack.Screen options={{ title }} />
        <View style={{ gap: 2 }}>
          <Label>{t('training.dayN', { n: day.index + 1 })}</Label>
          <H2>{title}</H2>
        </View>
        <Card>
          <Row gap={space.sm}>
            <Icon name="clock" size={18} color={c.accent} />
            <H3>{t('training.estMin', { min })}</H3>
          </Row>
          <Body>
            {day.dayType === 'mobility'
              ? t('sb.session.mobilityIntro', { min })
              : t('sb.session.cardioIntro', { min, intensity: t(`intensity.${day.cardio?.intensity ?? 'light'}`).toLowerCase() })}
          </Body>
        </Card>
        <Button
          title={t('sb.session.markDone')}
          icon="check"
          loading={saving}
          onPress={() =>
            void save({ id: newId(), date: new Date().toISOString(), dayIndex: day.index, exercises: [], recoveryOk: true, completedPct: 1 })
          }
        />
      </Screen>
    );
  }

  // ---- Edición del borrador ----
  const updateSet = (ei: number, si: number, patch: Partial<SetDraft>) =>
    setDrafts((prev) => prev.map((d, i) => (i !== ei ? d : { ...d, sets: d.sets.map((s, j) => (j !== si ? s : { ...s, ...patch })) })));
  const updateEx = (ei: number, patch: Partial<Pick<ExerciseDraft, 'pain' | 'techniqueOk'>>) =>
    setDrafts((prev) => prev.map((d, i) => (i !== ei ? d : { ...d, ...patch })));

  const toggleSet = (ei: number, si: number) => {
    const d = drafts[ei];
    const s = d.sets[si];
    // Al marcar una serie sin repeticiones escritas, se toman las del objetivo.
    updateSet(ei, si, { completed: !s.completed, reps: !s.completed && s.reps === undefined ? d.suggestion.targetReps : s.reps });
  };

  const totalSets = drafts.reduce((a, d) => a + d.planned.sets, 0);
  const doneSets = drafts.reduce((a, d) => a + d.sets.filter((s) => s.completed).length, 0);

  const buildLog = (): SessionLog => {
    const exercises: ExerciseLog[] = drafts.map((d) => ({
      exerciseId: d.planned.exerciseId,
      pain: d.pain,
      techniqueOk: d.techniqueOk,
      sets: d.sets.map((s) => ({
        weightKg: d.usesLoad && s.weight !== undefined ? Math.round(displayWeightToKg(s.weight, units) * 100) / 100 : null,
        reps: s.reps ?? 0,
        ...(s.rir !== undefined ? { rir: s.rir } : {}),
        completed: s.completed && (s.reps ?? 0) > 0,
      })),
    }));
    const completed = exercises.reduce((a, e) => a + e.sets.filter((s) => s.completed).length, 0);
    return {
      id: newId(),
      date: new Date().toISOString(),
      dayIndex: day.index,
      exercises,
      ...(effortTouched ? { perceivedEffort: effort } : {}),
      recoveryOk,
      completedPct: totalSets > 0 ? Math.min(1, completed / totalSets) : 0,
    };
  };

  const finish = () => {
    if (doneSets === 0) {
      Alert.alert(t('sb.session.noneCompletedTitle'), t('sb.session.noneCompleted'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.save'), onPress: () => void save(buildLog()) },
      ]);
      return;
    }
    void save(buildLog());
  };

  const discard = () =>
    Alert.alert(t('session.discard'), t('sb.session.discardConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('session.discard'), style: 'destructive', onPress: () => router.back() },
    ]);

  const suggestionText = (s: ProgressionSuggestion): string => {
    if (s.action === 'no_data') return t('session.actions.no_data');
    const w = s.nextWeightKg !== null ? fmtWeight(s.nextWeightKg, units) : '';
    const action =
      (s.action === 'increase_load' || s.action === 'reduce_load') && s.nextWeightKg === null
        ? t('session.actions.hold')
        : t(`session.actions.${s.action}`, { w, reps: s.targetReps });
    return `${action} · ${t(`session.reasons.${s.reason}`)}`;
  };

  return (
    <Screen keyboard>
      <Stack.Screen options={{ title }} />
      <View style={{ gap: space.xs }}>
        <Label>{t('training.dayN', { n: day.index + 1 })}</Label>
        <H2>{title}</H2>
        <Small>{t('sb.session.progress', { done: doneSets, total: totalSets })}</Small>
        <ProgressBar value={totalSets ? doneSets / totalSets : 0} color={c.accent} />
      </View>

      {drafts.map((d, ei) => {
        const ex = EXERCISE_BY_ID[d.planned.exerciseId];
        return (
          <Card key={`${d.planned.exerciseId}-${ei}`}>
            <Pressable onPress={() => router.push(`/exercise/${d.planned.exerciseId}?day=${day.index}`)} accessibilityRole="button">
              <Row style={{ justifyContent: 'space-between' }}>
                <H3 style={{ flex: 1 }}>{ex.name[lang]}</H3>
                <Icon name="info" size={18} color={c.muted} />
              </Row>
            </Pressable>
            <Small>
              {t('sb.session.target', {
                sets: d.planned.sets,
                min: d.planned.repsMin,
                max: d.planned.repsMax,
                rmin: d.planned.rirMin,
                rmax: d.planned.rirMax,
              })}
            </Small>
            {d.lastText ? <Small>{t('sb.session.lastTime', { sets: d.lastText })}</Small> : null}
            <View style={{ flexDirection: 'row', gap: space.xs, alignItems: 'flex-start' }}>
              <Icon name="flame" size={14} color={c.accent} />
              <Small color={c.text} style={{ flex: 1 }}>
                <Small color={c.accent} style={{ fontWeight: '700' }}>
                  {t('session.suggestion')}:{' '}
                </Small>
                {suggestionText(d.suggestion)}
              </Small>
            </View>

            {/* Encabezado de columnas */}
            <Row gap={space.sm} style={{ marginTop: space.xs }}>
              <Label style={{ width: 40 }}>{t('sb.session.setCol')}</Label>
              <Label style={{ flex: 1.3 }}>
                {t('session.weight')}
                {d.usesLoad ? ` (${weightUnit(units)})` : ''}
              </Label>
              <Label style={{ flex: 1 }}>{t('session.reps')}</Label>
              <Label style={{ flex: 1 }}>{t('session.rir')}</Label>
              <View style={{ width: 40 }} />
            </Row>
            {d.sets.map((s, si) => (
              <Row key={si} gap={space.sm}>
                <Body style={{ width: 40, fontWeight: '700' }} color={s.completed ? c.accent : c.muted}>
                  {si + 1}
                </Body>
                <View style={{ flex: 1.3 }}>
                  {d.usesLoad ? (
                    <CompactNum
                      value={s.weight}
                      decimals={1}
                      onChange={(n) => updateSet(ei, si, { weight: n })}
                      label={`${t('session.set', { n: si + 1 })} ${t('session.weight')}`}
                    />
                  ) : (
                    <Small numberOfLines={1}>{t('session.bodyweight')}</Small>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <CompactNum
                    value={s.reps}
                    placeholder={String(d.suggestion.targetReps)}
                    onChange={(n) => updateSet(ei, si, { reps: n })}
                    label={`${t('session.set', { n: si + 1 })} ${t('session.reps')}`}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <CompactNum
                    value={s.rir}
                    placeholder={`${d.planned.rirMin}–${d.planned.rirMax}`}
                    onChange={(n) => updateSet(ei, si, { rir: n === undefined ? undefined : Math.min(10, n) })}
                    label={`${t('session.set', { n: si + 1 })} ${t('session.rir')}`}
                  />
                </View>
                <Pressable
                  onPress={() => toggleSet(ei, si)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: s.completed }}
                  accessibilityLabel={`${t('session.set', { n: si + 1 })} ${t('sb.session.done')}`}
                  hitSlop={6}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.sm,
                    borderWidth: 2,
                    borderColor: s.completed ? c.accent : c.border,
                    backgroundColor: s.completed ? c.accent : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {s.completed ? <Icon name="check" size={20} color={c.accentText} /> : null}
                </Pressable>
              </Row>
            ))}

            <Divider />
            <Switch label={t('session.pain')} value={d.pain} onChange={(v) => updateEx(ei, { pain: v })} />
            {d.pain ? <Notice kind="warn" text={t('session.painWarning')} /> : null}
            <Switch label={t('session.technique')} value={d.techniqueOk} onChange={(v) => updateEx(ei, { techniqueOk: v })} />
          </Card>
        );
      })}

      <Card>
        <H3>{t('sb.session.sessionSection')}</H3>
        <Switch label={t('session.recovery')} value={recoveryOk} onChange={setRecoveryOk} />
        <Stepper
          label={t('session.effort')}
          value={effort}
          min={1}
          max={10}
          onChange={(n) => {
            setEffort(n);
            setEffortTouched(true);
          }}
        />
      </Card>

      <Button title={t('session.finish')} icon="check" loading={saving} onPress={finish} />
      <Button title={t('session.discard')} variant="ghost" disabled={saving} onPress={discard} />
    </Screen>
  );
}

// Campo numérico compacto para la tabla de series (acepta coma o punto decimal).
function CompactNum({
  value,
  onChange,
  decimals = 0,
  placeholder,
  label,
}: {
  value: number | undefined;
  onChange: (n: number | undefined) => void;
  decimals?: number;
  placeholder?: string;
  label: string;
}) {
  const { c } = useTheme();
  const [text, setText] = useState<string>(value === undefined ? '' : String(value));
  const [last, setLast] = useState<number | undefined>(value);
  // Sincroniza si el valor cambia desde fuera (p. ej., al marcar la serie).
  if (value !== last) {
    setLast(value);
    setText(value === undefined ? '' : String(value));
  }
  const handle = (raw: string) => {
    let clean = raw.replace(decimals > 0 ? /[^0-9.,]/g : /[^0-9]/g, '');
    if (decimals > 0) {
      const i = clean.search(/[.,]/);
      if (i >= 0) clean = clean.slice(0, i + 1) + clean.slice(i + 1).replace(/[.,]/g, '').slice(0, decimals);
    }
    setText(clean);
    const n = clean === '' ? undefined : Number(clean.replace(',', '.'));
    const parsed = n !== undefined && Number.isFinite(n) ? n : undefined;
    setLast(parsed);
    onChange(parsed);
  };
  return (
    <TextInput
      value={text}
      onChangeText={handle}
      keyboardType={decimals > 0 ? 'decimal-pad' : 'number-pad'}
      placeholder={placeholder}
      placeholderTextColor={c.muted}
      accessibilityLabel={label}
      selectTextOnFocus
      style={[
        font.body,
        {
          color: c.text,
          backgroundColor: c.surface2,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: c.border,
          paddingHorizontal: space.sm,
          height: 40,
          textAlign: 'center',
          fontWeight: '600',
        },
      ]}
    />
  );
}
