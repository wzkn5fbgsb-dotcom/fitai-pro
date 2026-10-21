// Inicio: resumen del día (próxima sesión, comidas, objetivos, semana y revisión).
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import {
  Body,
  Button,
  Card,
  Divider,
  Empty,
  H1,
  H2,
  H3,
  Icon,
  Label,
  MacroBar,
  Notice,
  ProgressBar,
  Ring,
  Row,
  Screen,
  Small,
} from '../../src/components';
import { EXERCISE_BY_ID, RECIPE_BY_ID, type PlannedMeal } from '../../src/core';
import { useApp } from '../../src/data/store';
import type { MealLog } from '../../src/data/types';
import { useI18n } from '../../src/i18n';
import { formatDate, todayStr } from '../../src/lib/dates';
import { consumedOn, nextWorkoutDayIndex, reviewDue, targetsFor, todayMealDay, weekWorkoutsDone } from '../../src/lib/derive';
import { fmtNum } from '../../src/lib/format';
import { radius, space, useTheme } from '../../src/theme';

export default function HomeScreen() {
  const { state, actions } = useApp();
  const { t, lang } = useI18n();
  const { c } = useTheme();
  const today = todayStr();
  const profile = state.profile;

  if (!profile) {
    return (
      <Screen>
        <Empty title={t('sb.home.noProfile')} />
      </Screen>
    );
  }

  // ---- Próxima sesión ----
  const plan = state.workoutPlan;
  const nextIdx = nextWorkoutDayIndex(state);
  const nextDay = plan && nextIdx !== null ? plan.days[nextIdx] ?? null : null;
  const exName = (id: string) => EXERCISE_BY_ID[id]?.name[lang] ?? id;

  // ---- Comidas de hoy ----
  const mealDayIdx = todayMealDay(state);
  const mealDay = state.weekPlan?.days[mealDayIdx] ?? null;
  const todayLogs = state.mealLogs[today] ?? {};

  const toggleMeal = (meal: PlannedMeal) => {
    const eaten = todayLogs[meal.slotId]?.eaten === true;
    const log: MealLog | null = eaten
      ? null
      : {
          eaten: true,
          recipeId: meal.recipeId,
          kcal: Math.round(meal.totals.kcal),
          protein: Math.round(meal.totals.protein),
          carbs: Math.round(meal.totals.carbs),
          fat: Math.round(meal.totals.fat),
        };
    void actions.setMealEaten(today, meal.slotId, log);
  };

  // ---- Objetivos ----
  const targets = targetsFor(state);
  const consumed = consumedOn(state, today);

  // ---- Semana y revisión ----
  const week = weekWorkoutsDone(state);
  const review = reviewDue(state);
  const firstSteps = state.weights.length === 0 && state.sessions.length === 0;

  return (
    <Screen>
      {/* Saludo y objetivo */}
      <View style={{ gap: 2, marginBottom: space.xs }}>
        <Label>{formatDate(today, lang)}</Label>
        <H1>{t('home.hello')}</H1>
        <Row gap={space.xs}>
          <Small>{t('home.goal')}:</Small>
          <Small color={c.accent} style={{ fontWeight: '700' }}>
            {t(`goals.${profile.goal}.name`)}
          </Small>
        </Row>
      </View>

      {/* Primeros pasos */}
      {firstSteps ? (
        <Card>
          <H3>{t('home.firstSteps')}</H3>
          <StepRow n={1} text={t('home.step1')} action={t('sb.home.logWeight')} onPress={() => router.push('/progress')} />
          <Divider />
          <StepRow
            n={2}
            text={t('home.step2')}
            action={nextDay ? t('home.start') : t('sb.home.goTraining')}
            onPress={() => (nextDay && nextIdx !== null ? router.push(`/session/${nextIdx}`) : router.push('/training'))}
          />
          <Divider />
          <StepRow n={3} text={t('home.step3')} action={t('sb.home.goNutrition')} onPress={() => router.push('/nutrition')} />
        </Card>
      ) : null}

      {/* Próxima sesión */}
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Label>{t('home.nextWorkout')}</Label>
          {nextDay ? (
            <Row gap={4}>
              <Icon name="clock" size={14} color={c.muted} />
              <Small>{t('training.estMin', { min: nextDay.estMinutes })}</Small>
            </Row>
          ) : null}
        </Row>
        {nextDay && nextIdx !== null ? (
          <>
            <H2>{t(`training.day.${nextDay.dayType}`)}</H2>
            {nextDay.cardio && nextDay.exercises.length === 0 ? (
              <Body>{t('home.cardioDay', { min: nextDay.cardio.minutes })}</Body>
            ) : (
              <View style={{ gap: 4 }}>
                {nextDay.exercises.slice(0, 4).map((pe) => (
                  <Row key={pe.exerciseId} style={{ justifyContent: 'space-between' }}>
                    <Body numberOfLines={1} style={{ flex: 1 }}>
                      {exName(pe.exerciseId)}
                    </Body>
                    <Small>
                      {pe.sets} × {pe.repsMin}–{pe.repsMax}
                    </Small>
                  </Row>
                ))}
                {nextDay.exercises.length > 4 ? <Small>{t('sb.home.moreExercises', { n: nextDay.exercises.length - 4 })}</Small> : null}
              </View>
            )}
            <Button title={t('home.start')} icon="dumbbell" onPress={() => router.push(`/session/${nextIdx}`)} style={{ marginTop: space.xs }} />
          </>
        ) : (
          <>
            <Body color={c.muted}>{t('sb.home.noWorkoutPlan')}</Body>
            <Button title={t('sb.home.goTraining')} variant="secondary" onPress={() => router.push('/training')} />
          </>
        )}
      </Card>

      {/* Objetivos de hoy */}
      <Card>
        <Label>{t('home.targets')}</Label>
        {targets?.ok ? (
          <>
            <Row gap={space.lg} style={{ alignItems: 'center' }}>
              <Ring
                value={consumed ? Math.min(1, consumed.kcal / targets.targets.kcal) : 0}
                size={88}
                stroke={9}
                color={c.accent}
                label={fmtNum(consumed?.kcal ?? 0)}
                sublabel={t('common.kcal')}
              />
              <View style={{ flex: 1, gap: space.sm }}>
                <Small>{t('sb.home.consumed', { n: fmtNum(consumed?.kcal ?? 0), target: fmtNum(targets.targets.kcal) })}</Small>
                {consumed ? (
                  <Body style={{ fontWeight: '700' }}>
                    {consumed.kcal <= targets.targets.kcal
                      ? t('sb.home.kcalLeft', { n: fmtNum(targets.targets.kcal - consumed.kcal) })
                      : t('sb.home.kcalOver', { n: fmtNum(consumed.kcal - targets.targets.kcal) })}
                  </Body>
                ) : null}
                <MacroBar label={t('home.protein')} value={Math.round(consumed?.protein ?? 0)} target={targets.targets.proteinG} unit="g" color={c.protein} />
              </View>
            </Row>
            {!consumed ? <Small>{t('sb.home.noMealsLogged')}</Small> : null}
          </>
        ) : (
          <Notice kind="info" text={t('home.nutritionProfessional')} />
        )}
      </Card>

      {/* Comidas de hoy */}
      <Card>
        <Label>{t('home.meals')}</Label>
        {mealDay && mealDay.meals.length ? (
          mealDay.meals.map((meal, i) => {
            const eaten = todayLogs[meal.slotId]?.eaten === true;
            const recipe = RECIPE_BY_ID[meal.recipeId];
            return (
              <View key={meal.slotId}>
                {i > 0 ? <Divider /> : null}
                <Row gap={space.md} style={{ minHeight: 52 }}>
                  <Pressable
                    onPress={() => toggleMeal(meal)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: eaten }}
                    accessibilityLabel={t('nutrition.markEaten')}
                    hitSlop={8}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: radius.pill,
                      borderWidth: 2,
                      borderColor: eaten ? c.accent : c.border,
                      backgroundColor: eaten ? c.accent : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {eaten ? <Icon name="check" size={16} color={c.accentText} /> : null}
                  </Pressable>
                  <Pressable
                    onPress={() => router.push(`/meal/${mealDayIdx}/${meal.slotId}`)}
                    accessibilityRole="button"
                    style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, opacity: pressed ? 0.7 : 1 })}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Small>{t(`nutrition.slots.${meal.slotId}`)}</Small>
                      <Body numberOfLines={1} style={{ fontWeight: '600', textDecorationLine: eaten ? 'line-through' : 'none' }}>
                        {recipe ? recipe.name[lang] : meal.recipeId}
                      </Body>
                      <Small>
                        {fmtNum(meal.totals.kcal)} {t('common.kcal')} · {fmtNum(meal.totals.protein)} {t('common.g')} {t('home.protein').toLowerCase()}
                      </Small>
                    </View>
                    <Icon name="chevron-right" size={18} color={c.muted} />
                  </Pressable>
                </Row>
              </View>
            );
          })
        ) : (
          <>
            <Body color={c.muted}>{t('home.noMeals')}</Body>
            <Button title={t('sb.home.goNutrition')} variant="secondary" onPress={() => router.push('/nutrition')} />
          </>
        )}
      </Card>

      {/* Semana */}
      {week.planned > 0 ? (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Label>{t('home.week')}</Label>
            <Small>{t('home.workoutsDone', { done: week.done, planned: week.planned })}</Small>
          </Row>
          <ProgressBar value={Math.min(1, week.done / week.planned)} color={c.accent} />
        </Card>
      ) : null}

      {/* Revisión semanal */}
      {review.due ? (
        <Card onPress={() => router.push('/review')} style={{ borderColor: c.accent }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Label>{t('home.review')}</Label>
              <H3>{t('home.reviewDue')}</H3>
            </View>
            <Icon name="chevron-right" size={20} color={c.accent} />
          </Row>
          <Button title={t('sb.home.openReview')} small onPress={() => router.push('/review')} />
        </Card>
      ) : (
        <Card>
          <Label>{t('home.review')}</Label>
          <Small>{t('home.reviewNext', { date: formatDate(review.next, lang) })}</Small>
        </Card>
      )}

      {/* Coach */}
      <Button title={t('home.askCoach')} icon="chat" variant="secondary" onPress={() => router.push('/coach')} />
    </Screen>
  );
}

// Fila numerada de "primeros pasos" con su acción.
function StepRow({ n, text, action, onPress }: { n: number; text: string; action: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: radius.pill,
          backgroundColor: c.surface2,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 2,
        }}
      >
        <Small style={{ fontWeight: '800' }} color={c.text}>
          {n}
        </Small>
      </View>
      <View style={{ flex: 1, gap: space.xs }}>
        <Body>{text}</Body>
        <Pressable onPress={onPress} accessibilityRole="button" hitSlop={6}>
          <Small color={c.accent} style={{ fontWeight: '700' }}>
            {action} →
          </Small>
        </Pressable>
      </View>
    </Row>
  );
}
