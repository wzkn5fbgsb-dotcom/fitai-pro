// Detalle de un ejercicio: músculos, equipo, técnica, errores, último registro y alternativas.
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import {
  Body,
  Button,
  Card,
  Chip,
  Divider,
  Empty,
  H1,
  H3,
  Icon,
  Label,
  ListItem,
  LockCard,
  Notice,
  Row,
  Screen,
  Small,
} from '../../src/components';
import { EXERCISE_BY_ID, alternativesFor, can, filterFor, swapExercise, type SetLog, type UnitSystem } from '../../src/core';
import { useApp } from '../../src/data/store';
import { useI18n } from '../../src/i18n';
import { formatDate } from '../../src/lib/dates';
import { lastExerciseLog } from '../../src/lib/derive';
import { fmtWeight } from '../../src/lib/format';
import { space, useTheme } from '../../src/theme';

type Translate = (path: string, vars?: Record<string, string | number>) => string;

/** Resume series registradas: "60 kg × 8, 60 kg × 7" o "12 reps, 10 reps". */
function describeSets(sets: SetLog[], units: UnitSystem, t: Translate): string {
  return sets
    .filter((s) => s.completed)
    .map((s) =>
      s.weightKg === null ? t('sb.exercise.bodyweightSet', { reps: s.reps }) : t('sb.exercise.weightSet', { w: fmtWeight(s.weightKg, units), reps: s.reps }),
    )
    .join(', ');
}

export default function ExerciseScreen() {
  const params = useLocalSearchParams<{ id: string; day?: string }>();
  const id = String(params.id ?? '');
  const dayParam = params.day !== undefined && params.day !== '' ? Number(params.day) : null;
  const { state, actions, plan } = useApp();
  const { t, lang } = useI18n();
  const { c } = useTheme();
  const [swapping, setSwapping] = useState<string | null>(null);

  const exercise = EXERCISE_BY_ID[id];
  const profile = state.profile;
  const units: UnitSystem = profile?.units ?? 'metric';

  if (!exercise) {
    return (
      <Screen>
        <Stack.Screen options={{ title: '' }} />
        <Empty title={t('sb.exercise.notFound')} action={{ title: t('common.back'), onPress: () => router.back() }} />
      </Screen>
    );
  }

  const workoutPlan = state.workoutPlan;
  // Día de la rutina donde está este ejercicio: el indicado por parámetro o el primero que lo contenga.
  const dayFromParam =
    workoutPlan && dayParam !== null && Number.isInteger(dayParam) && workoutPlan.days[dayParam]?.exercises.some((e) => e.exerciseId === id)
      ? dayParam
      : null;
  const routineDay = dayFromParam ?? workoutPlan?.days.find((d) => d.exercises.some((e) => e.exerciseId === id))?.index ?? null;
  const planned = routineDay !== null ? workoutPlan?.days[routineDay]?.exercises.find((e) => e.exerciseId === id) ?? null : null;

  // Alternativas: las del plan si venimos de un día; si no, calculadas con el filtro del perfil.
  const altIds: string[] = (
    dayFromParam !== null && planned ? planned.alternatives : profile ? alternativesFor(id, filterFor(profile)) : []
  ).filter((a) => a in EXERCISE_BY_ID);

  const last = lastExerciseLog(state, id);
  const lastText = last ? describeSets(last.log.sets, units, t) : '';
  const canCustom = can(plan, 'custom_routine');

  const doSwap = async (toId: string) => {
    if (!workoutPlan || routineDay === null || !profile) return;
    setSwapping(toId);
    try {
      const next = swapExercise(workoutPlan, routineDay, id, toId, filterFor(profile));
      const summary = t('sb.exercise.swapSummary', { from: exercise.name[lang], to: EXERCISE_BY_ID[toId]?.name[lang] ?? toId });
      await actions.setWorkoutPlan(next, summary);
      Alert.alert(t('training.swapped'));
      router.replace(`/exercise/${toId}?day=${routineDay}`);
    } catch {
      Alert.alert(t('sb.exercise.swapError'));
    } finally {
      setSwapping(null);
    }
  };

  const confirmSwap = (toId: string) => {
    const toName = EXERCISE_BY_ID[toId]?.name[lang] ?? toId;
    Alert.alert(t('training.swap'), `${exercise.name[lang]} → ${toName}`, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('training.swap'), onPress: () => void doSwap(toId) },
    ]);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: exercise.name[lang] }} />

      <View style={{ gap: space.xs }}>
        <H1>{exercise.name[lang]}</H1>
        {planned ? (
          <Small>
            {t('sb.exercise.planned', {
              detail: `${t('sb.training.setsReps', { sets: planned.sets, min: planned.repsMin, max: planned.repsMax })} · ${t('training.rir', {
                min: planned.rirMin,
                max: planned.rirMax,
              })}`,
            })}
          </Small>
        ) : null}
      </View>

      {/* Músculos y equipo */}
      <Card>
        <Label>{t('training.primary')}</Label>
        <Row wrap>
          <Chip label={t(`training.muscles.${exercise.primary}`)} selected />
        </Row>
        {exercise.secondary.length ? (
          <>
            <Label style={{ marginTop: space.xs }}>{t('training.secondary')}</Label>
            <Row wrap>
              {exercise.secondary.map((m) => (
                <Chip key={m} label={t(`training.muscles.${m}`)} />
              ))}
            </Row>
          </>
        ) : null}
        <Label style={{ marginTop: space.xs }}>{t('sb.exercise.equipment')}</Label>
        <Row wrap>
          {exercise.equipment.map((e) => (
            <Chip key={e} label={t(`equipment.${e}`)} />
          ))}
        </Row>
      </Card>

      {/* Técnica */}
      <Card>
        <H3>{t('training.technique')}</H3>
        {exercise.cues[lang].map((cue, i) => (
          <Row key={i} gap={space.sm} style={{ alignItems: 'flex-start' }}>
            <Small color={c.accent} style={{ fontWeight: '800', minWidth: 16 }}>
              {i + 1}
            </Small>
            <Body style={{ flex: 1 }}>{cue}</Body>
          </Row>
        ))}
        <Divider />
        <H3>{t('training.mistakes')}</H3>
        {exercise.mistakes[lang].map((m, i) => (
          <Row key={i} gap={space.sm} style={{ alignItems: 'flex-start' }}>
            <View style={{ marginTop: 2 }}>
              <Icon name="close" size={14} color={c.danger} />
            </View>
            <Body style={{ flex: 1 }}>{m}</Body>
          </Row>
        ))}
        <Divider />
        <Row gap={space.sm}>
          <Icon name="info" size={16} color={c.muted} />
          <Small>{t('training.noVideo')}</Small>
        </Row>
      </Card>

      {/* Historial */}
      <Card>
        <H3>{t('training.history')}</H3>
        {last && lastText ? (
          <>
            <Body>{t('training.lastTime', { sets: lastText })}</Body>
            <Small>{t('sb.exercise.lastDate', { date: formatDate(last.date.slice(0, 10), lang) })}</Small>
          </>
        ) : (
          <Small>{t('sb.exercise.lastNone')}</Small>
        )}
      </Card>

      {/* Alternativas */}
      <Card>
        <H3>{t('training.alternatives')}</H3>
        {altIds.length === 0 ? (
          <Small>{t('sb.exercise.noAlternatives')}</Small>
        ) : (
          altIds.map((altId, i) => {
            const alt = EXERCISE_BY_ID[altId];
            return (
              <View key={altId} style={{ gap: space.xs }}>
                {i > 0 ? <Divider /> : null}
                <ListItem
                  title={alt.name[lang]}
                  subtitle={alt.equipment.map((e) => t(`equipment.${e}`)).join(' · ')}
                  onPress={() => router.push(routineDay !== null ? `/exercise/${altId}?day=${routineDay}` : `/exercise/${altId}`)}
                />
                {canCustom && routineDay !== null && planned ? (
                  <Button
                    title={t('training.swap')}
                    icon="swap"
                    variant="secondary"
                    small
                    loading={swapping === altId}
                    disabled={swapping !== null}
                    onPress={() => confirmSwap(altId)}
                  />
                ) : null}
              </View>
            );
          })
        )}
        {altIds.length > 0 && !canCustom ? <LockCard text={t('training.lockedCustom')} /> : null}
        {altIds.length > 0 && canCustom && !planned ? <Notice kind="info" text={t('sb.exercise.notInRoutine')} /> : null}
      </Card>
    </Screen>
  );
}
