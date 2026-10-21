// Entreno: rutina semanal, notas, calentamiento, cardio y volumen por músculo.
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import {
  BarChart,
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
  Row,
  Screen,
  Small,
} from '../../src/components';
import { EXERCISE_BY_ID, assessSafety, type Muscle, type SafetyFlagCode, type WorkoutDay } from '../../src/core';
import { useApp } from '../../src/data/store';
import { useI18n } from '../../src/i18n';
import { space, useTheme } from '../../src/theme';

export default function TrainingScreen() {
  const { state, actions } = useApp();
  const { t, lang } = useI18n();
  const { c } = useTheme();
  const [busy, setBusy] = useState(false);
  const profile = state.profile;
  if (!profile) return null;

  // Mismas condiciones con las que generateWorkoutPlan devuelve null.
  const safety = assessSafety(profile);
  if (!safety.allowed || safety.trainingMode === 'none') {
    const codes: SafetyFlagCode[] = safety.flags.filter((f) => f.severity === 'block').map((f) => f.code);
    return (
      <Screen>
        <Notice kind="warn" title={t('training.blocked')} text={codes.length ? codes.map((k) => t(`safety.${k}`)).join('\n\n') : t('safety.professional')} />
      </Screen>
    );
  }

  const regenerate = async () => {
    setBusy(true);
    try {
      await actions.regenerateWorkout();
    } finally {
      setBusy(false);
    }
  };

  const plan = state.workoutPlan;
  if (!plan) {
    return (
      <Screen>
        <Empty title={t('training.noPlan')} action={{ title: t('training.create'), onPress: () => void regenerate() }} />
      </Screen>
    );
  }

  const confirmRegenerate = () =>
    Alert.alert(t('training.regenerate'), t('training.regenerateConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('training.regenerate'), onPress: () => void regenerate().then(() => Alert.alert(t('sb.training.regenerated'))) },
    ]);

  const muscleData = (Object.entries(plan.weeklySets) as [Muscle, number | undefined][])
    .filter((e): e is [Muscle, number] => typeof e[1] === 'number' && e[1] > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([m, v]) => ({ label: t(`training.muscles.${m}`), value: v }));

  const exName = (id: string) => EXERCISE_BY_ID[id]?.name[lang] ?? id;

  return (
    <Screen>
      {/* Cabecera: división */}
      <View style={{ gap: 2 }}>
        <Label>{t('training.title')}</Label>
        <H2>{t(`training.split.${plan.split}`)}</H2>
        <Small>{t('sb.training.daysPerWeek', { n: plan.days.length })}</Small>
      </View>

      {/* Notas */}
      {plan.notes.length ? (
        <Card>
          <Label>{t('sb.training.notesTitle')}</Label>
          {plan.notes.map((n) => (
            <Row key={n} gap={space.sm} style={{ alignItems: 'flex-start' }}>
              <View style={{ marginTop: 2 }}>
                <Icon name="info" size={16} color={n === 'not_treatment' || n === 'injury_modified' ? c.warn : c.muted} />
              </View>
              <Small style={{ flex: 1 }} color={c.text}>
                {n === 'deload' ? t('training.notes.deload', { weeks: plan.deloadEveryWeeks ?? '' }) : t(`training.notes.${n}`)}
              </Small>
            </Row>
          ))}
        </Card>
      ) : null}

      {/* Días */}
      <H3 style={{ marginTop: space.sm }}>{t('sb.training.days')}</H3>
      {plan.days.map((day) => (
        <DayCard key={day.index} day={day} exName={exName} />
      ))}

      {/* Calentamiento y recuperación */}
      <Card>
        <Row gap={space.sm}>
          <Icon name="flame" size={18} color={c.accent} />
          <H3>{t('sb.training.warmupTitle')}</H3>
        </Row>
        <Small color={c.text}>{t('training.warmup')}</Small>
        <Divider />
        <Row gap={space.sm}>
          <Icon name="refresh" size={18} color={c.accent} />
          <H3>{t('sb.training.recoveryTitle')}</H3>
        </Row>
        <Small color={c.text}>{t('training.recovery')}</Small>
      </Card>

      {/* Cardio */}
      <Card>
        <H3>{t('sb.training.cardioPlanTitle')}</H3>
        <Small color={c.text}>
          {t('training.cardioPlan', {
            sessions: plan.cardio.sessionsPerWeek,
            min: plan.cardio.minutesPerSession,
            intensity: t(`intensity.${plan.cardio.intensity}`).toLowerCase(),
          })}
        </Small>
        {plan.cardio.weeklyProgressionPct > 0 ? <Small>{t('training.cardioProgression', { pct: plan.cardio.weeklyProgressionPct })}</Small> : null}
      </Card>

      {/* Series semanales por músculo */}
      {muscleData.length ? (
        <Card>
          <H3>{t('training.weeklySets')}</H3>
          <BarChart data={muscleData} color={c.accent} />
        </Card>
      ) : null}

      <Small>{t('training.rirHelp')}</Small>
      <Button title={t('training.regenerate')} icon="refresh" variant="secondary" loading={busy} onPress={confirmRegenerate} />
    </Screen>
  );
}

// Tarjeta de un día de la rutina con sus ejercicios.
function DayCard({ day, exName }: { day: WorkoutDay; exName: (id: string) => string }) {
  const { t } = useI18n();
  const { c } = useTheme();
  const isCardio = day.exercises.length === 0;
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Label>{t('training.dayN', { n: day.index + 1 })}</Label>
          <H3>{t(`training.day.${day.dayType}`)}</H3>
        </View>
        <Row gap={4}>
          <Icon name="clock" size={14} color={c.muted} />
          <Small>{t('training.estMin', { min: day.estMinutes })}</Small>
        </Row>
      </Row>

      {isCardio ? (
        <Body color={c.muted}>
          {day.dayType === 'mobility'
            ? t('sb.session.mobilityIntro', { min: day.cardio?.minutes ?? day.estMinutes })
            : t('training.cardioDay', {
                min: day.cardio?.minutes ?? day.estMinutes,
                intensity: t(`intensity.${day.cardio?.intensity ?? 'light'}`).toLowerCase(),
              })}
        </Body>
      ) : (
        day.exercises.map((pe, i) => (
          <View key={`${pe.exerciseId}-${i}`}>
            {i > 0 ? <Divider /> : null}
            <Pressable
              onPress={() => router.push(`/exercise/${pe.exerciseId}?day=${day.index}`)}
              accessibilityRole="button"
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xs, opacity: pressed ? 0.7 : 1 })}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Row gap={space.xs}>
                  <Body style={{ fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>
                    {exName(pe.exerciseId)}
                  </Body>
                  {pe.main ? (
                    <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, backgroundColor: c.surface2 }}>
                      <Small color={c.accent} style={{ fontSize: 11, fontWeight: '700' }}>
                        {t('sb.training.mainLift')}
                      </Small>
                    </View>
                  ) : null}
                </Row>
                <Small>
                  {t('sb.training.setsReps', { sets: pe.sets, min: pe.repsMin, max: pe.repsMax })} · {t('sb.training.restSec', { s: pe.restSec })} ·{' '}
                  {t('training.rir', { min: pe.rirMin, max: pe.rirMax })}
                </Small>
              </View>
              <Icon name="chevron-right" size={18} color={c.muted} />
            </Pressable>
          </View>
        ))
      )}

      <Button title={t('training.start')} icon="dumbbell" small onPress={() => router.push(`/session/${day.index}`)} style={{ marginTop: space.xs }} />
    </Card>
  );
}
