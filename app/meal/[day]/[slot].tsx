// Detalle de una comida del menú: ingredientes con cantidades exactas,
// sustituciones, cambio de receta e instrucciones.
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useApp } from '../../../src/data/store';
import { useI18n } from '../../../src/i18n';
import { useTheme, space } from '../../../src/theme';
import {
  Body,
  Button,
  Card,
  Divider,
  Empty,
  H1,
  H3,
  Icon,
  Label,
  ListItem,
  LockCard,
  MacroBar,
  ModalSheet,
  Notice,
  Row,
  Screen,
  Small,
} from '../../../src/components';
import {
  FOOD_BY_ID,
  RECIPE_BY_ID,
  alternativeRecipes,
  can,
  restrictionsOf,
  substitutionOptions,
  type PlannedIngredient,
} from '../../../src/core';
import { todayMealDay } from '../../../src/lib/derive';
import { todayStr } from '../../../src/lib/dates';
import { fmtNum } from '../../../src/lib/format';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default function MealDetailScreen() {
  const params = useLocalSearchParams<{ day: string; slot: string }>();
  const dayIndex = Number(one(params.day));
  const slotId = one(params.slot) ?? '';
  const { state, actions, plan } = useApp();
  const { t, lang } = useI18n();
  const { c } = useTheme();
  const [subFor, setSubFor] = useState<string | null>(null);
  const [showRecipes, setShowRecipes] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meal = state.weekPlan?.days[dayIndex]?.meals.find((m) => m.slotId === slotId);
  const recipe = meal ? RECIPE_BY_ID[meal.recipeId] : undefined;
  const profile = state.profile;
  const canSub = can(plan, 'meal_substitution');
  const today = todayStr();
  const isToday = state.weekPlanKind === 'week' && dayIndex === todayMealDay(state);
  const eaten = !!state.mealLogs[today]?.[slotId]?.eaten;

  const restrictions = useMemo(() => (profile ? restrictionsOf(profile) : null), [profile]);
  const subOptions = useMemo(
    () => (meal && subFor && restrictions ? substitutionOptions(meal, subFor, restrictions) : []),
    [meal, subFor, restrictions],
  );
  const altRecipes = useMemo(
    () => (meal && restrictions && showRecipes ? alternativeRecipes(meal, restrictions) : []),
    [meal, restrictions, showRecipes],
  );

  const errText = (e?: string) => {
    if (!e) return t('common.error');
    const tr = t(e);
    if (tr !== e) return tr;
    return /\s/.test(e) ? e : t('common.error');
  };

  if (!meal || !recipe || !profile || !Number.isFinite(dayIndex)) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('nutrition.title') }} />
        <Empty
          title={t('sc.meal.notFound')}
          action={{ title: t('sc.meal.backToMenu'), onPress: () => (router.canGoBack() ? router.back() : router.replace('/nutrition')) }}
        />
      </Screen>
    );
  }

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true);
    setError(null);
    try {
      const r = await fn();
      if (!r.ok) setError(errText(r.error));
      return r.ok;
    } catch {
      setError(t('common.error'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const doSubstitute = async (toFoodId: string) => {
    if (!subFor) return;
    const ok = await run(() => actions.substituteIngredient(dayIndex, slotId, subFor, toFoodId));
    if (ok) setSubFor(null);
  };

  const doReplace = async (recipeId: string) => {
    const ok = await run(() => actions.replaceRecipe(dayIndex, slotId, recipeId));
    if (ok) setShowRecipes(false);
  };

  const toggleEaten = () => {
    void actions.setMealEaten(
      today,
      slotId,
      eaten
        ? null
        : {
            eaten: true,
            recipeId: meal.recipeId,
            kcal: meal.totals.kcal,
            protein: meal.totals.protein,
            carbs: meal.totals.carbs,
            fat: meal.totals.fat,
          },
    );
  };

  const onIngredient = (ing: PlannedIngredient) => {
    if (ing.role === 'V') return;
    setError(null);
    setSubFor(ing.foodId);
  };

  const subFood = subFor ? FOOD_BY_ID[subFor] : undefined;
  const steps = recipe.steps[lang];
  const tierLabel = (n: number) => '$'.repeat(n);

  return (
    <Screen>
      <Stack.Screen options={{ title: t(`nutrition.slots.${slotId}`) }} />

      <View style={{ gap: space.xs }}>
        <Label>{t(`nutrition.slots.${slotId}`)}</Label>
        <H1>{recipe.name[lang]}</H1>
        <Small>{t('nutrition.forGoal', { goal: t(`goals.${profile.goal}.name`) })}</Small>
        <Row gap={space.md} wrap>
          <Row gap={4}>
            <Icon name="clock" size={16} color={c.muted} />
            <Small>{t('nutrition.prep', { min: recipe.prepMinutes })}</Small>
          </Row>
          <Small>{t('nutrition.servings')}</Small>
        </Row>
      </View>

      {error ? <Notice kind="danger" text={error} /> : null}

      {/* Ingredientes */}
      <Card>
        <Label>{t('nutrition.ingredients')}</Label>
        {canSub ? <Small>{t('nutrition.perIngredient')}</Small> : null}
        {meal.ingredients.map((ing, i) => {
          const food = FOOD_BY_ID[ing.foodId];
          if (!food) return null;
          const tappable = ing.role !== 'V';
          const content = (
            <View style={{ gap: 2, paddingVertical: space.xs }}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }} gap={space.sm}>
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: '600' }}>{food.name[lang]}</Body>
                  <Small>
                    {`${fmtNum(ing.grams)} g · ${t(`nutrition.states.${food.state}`)}`}
                    {food.unit && ing.units !== undefined
                      ? ` · ${t('nutrition.units', { n: fmtNum(ing.units, 1), unit: food.unit[lang] })}`
                      : ''}
                  </Small>
                </View>
                <Row gap={4}>
                  <Body style={{ fontVariant: ['tabular-nums'], fontWeight: '700' }}>{`${fmtNum(ing.nutrients.kcal)} kcal`}</Body>
                  {tappable && canSub ? <Icon name="swap" size={16} color={c.accent} /> : null}
                </Row>
              </Row>
              <Row gap={space.md}>
                <Small color={c.protein}>{`${t('sc.macro.p')} ${fmtNum(ing.nutrients.protein, 1)}`}</Small>
                <Small color={c.carbs}>{`${t('sc.macro.c')} ${fmtNum(ing.nutrients.carbs, 1)}`}</Small>
                <Small color={c.fat}>{`${t('sc.macro.f')} ${fmtNum(ing.nutrients.fat, 1)}`}</Small>
              </Row>
            </View>
          );
          return (
            <View key={`${ing.foodId}-${i}`}>
              {i > 0 ? <Divider /> : null}
              {tappable ? (
                <Pressable
                  onPress={() => onIngredient(ing)}
                  accessibilityRole="button"
                  accessibilityLabel={`${food.name[lang]}, ${t('nutrition.substitute')}`}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  {content}
                </Pressable>
              ) : (
                content
              )}
            </View>
          );
        })}
      </Card>

      {/* Totales vs objetivo */}
      <Card>
        <Label>{t('sc.meal.totals')}</Label>
        <Small>{t('nutrition.target')}</Small>
        <MacroBar label={t('nutrition.calories')} value={meal.totals.kcal} target={meal.target.kcal} unit="kcal" color={c.accent} />
        <MacroBar label={t('nutrition.protein')} value={meal.totals.protein} target={meal.target.protein} color={c.protein} />
        <MacroBar label={t('nutrition.carbs')} value={meal.totals.carbs} target={meal.target.carbs} color={c.carbs} />
        <MacroBar label={t('nutrition.fat')} value={meal.totals.fat} target={meal.target.fat} color={c.fat} />
        <Row style={{ justifyContent: 'space-between' }}>
          <Small>{t('nutrition.fiber')}</Small>
          <Body>{`${meal.totals.fiberApprox ? '≈ ' : ''}${fmtNum(meal.totals.fiber, 1)} g`}</Body>
        </Row>
        {meal.totals.fiberApprox ? <Small>{t('nutrition.approxFiber')}</Small> : null}
      </Card>

      {/* Condimentos e instrucciones */}
      <Card>
        <Label>{t('nutrition.seasonings')}</Label>
        <Body>{recipe.seasonings[lang]}</Body>
        <Divider />
        <Label>{t('nutrition.instructions')}</Label>
        {steps.map((s, i) => (
          <Row key={i} style={{ alignItems: 'flex-start' }} gap={space.sm}>
            <H3 color={c.accent} style={{ width: 22 }}>{`${i + 1}`}</H3>
            <Body style={{ flex: 1 }}>{s}</Body>
          </Row>
        ))}
      </Card>

      {/* Acciones */}
      {isToday ? (
        <Button
          title={eaten ? t('sc.meal.unmark') : t('nutrition.markEaten')}
          icon="check"
          variant={eaten ? 'secondary' : 'primary'}
          onPress={toggleEaten}
        />
      ) : null}
      {isToday && eaten ? <Small center>{t('sc.meal.eatenToday')}</Small> : null}

      {canSub ? (
        <Button
          title={t('nutrition.otherRecipes')}
          icon="refresh"
          variant="secondary"
          onPress={() => {
            setError(null);
            setShowRecipes(true);
          }}
        />
      ) : (
        <LockCard text={t('sc.meal.subLocked')} />
      )}

      <Small>{t('nutrition.source')}</Small>

      {/* Hoja: sustituir ingrediente */}
      <ModalSheet visible={subFor !== null} onClose={() => setSubFor(null)} title={t('nutrition.substitute')}>
        {subFood ? <Small>{t('sc.meal.current', { food: subFood.name[lang] })}</Small> : null}
        {!canSub ? (
          <LockCard text={t('sc.meal.subLocked')} />
        ) : subOptions.length === 0 ? (
          <Empty title={t('nutrition.noSubs')} />
        ) : (
          <View style={{ gap: space.xs }}>
            {error ? <Notice kind="danger" text={error} /> : null}
            {subOptions.map((o) => {
              const f = FOOD_BY_ID[o.foodId];
              if (!f) return null;
              return (
                <ListItem
                  key={o.foodId}
                  title={f.name[lang]}
                  subtitle={`${t('sc.meal.costTier')}: ${tierLabel(o.costTier)}`}
                  icon="swap"
                  onPress={busy ? undefined : () => void doSubstitute(o.foodId)}
                  right={<Icon name="chevron-right" size={18} color={c.muted} />}
                />
              );
            })}
          </View>
        )}
      </ModalSheet>

      {/* Hoja: cambiar receta */}
      <ModalSheet visible={showRecipes} onClose={() => setShowRecipes(false)} title={t('nutrition.otherRecipes')}>
        {altRecipes.length === 0 ? (
          <Empty title={t('sc.meal.noAlternatives')} />
        ) : (
          <View style={{ gap: space.xs }}>
            {error ? <Notice kind="danger" text={error} /> : null}
            {altRecipes.map((id) => {
              const r = RECIPE_BY_ID[id];
              if (!r) return null;
              return (
                <ListItem
                  key={id}
                  title={r.name[lang]}
                  subtitle={t('nutrition.prep', { min: r.prepMinutes })}
                  icon="food"
                  onPress={busy ? undefined : () => void doReplace(id)}
                  right={<Icon name="chevron-right" size={18} color={c.muted} />}
                />
              );
            })}
          </View>
        )}
      </ModalSheet>
    </Screen>
  );
}
