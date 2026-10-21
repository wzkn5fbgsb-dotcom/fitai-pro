// Pestaña de Nutrición: objetivos diarios explicados, menú semanal por día,
// registro de comidas hechas (sólo hoy) y accesos a la lista de compras.
import { useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../src/data/store';
import { useI18n } from '../../src/i18n';
import { useTheme, space, radius } from '../../src/theme';
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
  LockCard,
  MacroBar,
  Notice,
  Num,
  Row,
  Screen,
  Segmented,
  Small,
} from '../../src/components';
import {
  FOOD_BY_ID,
  RECIPE_BY_ID,
  can,
  headlineFoodId,
  type DayPlan,
  type PlannedMeal,
  type SafetyFlagCode,
} from '../../src/core';
import { consumedOn, targetsFor, todayMealDay } from '../../src/lib/derive';
import { todayStr } from '../../src/lib/dates';
import { fmtNum } from '../../src/lib/format';

// Avisos de seguridad que afectan a la nutrición.
const NUTRITION_FLAGS: SafetyFlagCode[] = [
  'pregnancy',
  'eating_disorder_history',
  'kidney',
  'medical_condition',
  'underweight',
  'target_underweight',
];

/** Alimento que sustituye al ingrediente principal de la receta (si el usuario lo cambió). */
function swappedHeadline(meal: PlannedMeal): string | null {
  const recipe = RECIPE_BY_ID[meal.recipeId];
  if (!recipe) return null;
  const headline = headlineFoodId(recipe);
  if (!headline || meal.ingredients.some((i) => i.foodId === headline)) return null;
  const templateP = new Set(recipe.ingredients.filter((i) => i.role === 'P').map((i) => i.foodId));
  const replacement = meal.ingredients.find((i) => i.role === 'P' && !templateP.has(i.foodId));
  return replacement?.foodId ?? null;
}

export default function NutritionScreen() {
  const { state, actions, plan } = useApp();
  const { t, tx, lang } = useI18n();
  const { c } = useTheme();
  const [showHow, setShowHow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const todayIdx = todayMealDay(state);
  const [selDay, setSelDay] = useState<number>(todayIdx);

  const result = targetsFor(state);
  const today = todayStr();
  const consumed = consumedOn(state, today);
  const dayNames = tx<string[]>('nutrition.dayNames') ?? [];

  const errText = (e?: string) => {
    if (!e) return t('common.error');
    const tr = t(e);
    if (tr !== e) return tr;
    return /\s/.test(e) ? e : t('common.error');
  };

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await actions.generateMealPlan();
      if (!r.ok) setError(errText(r.error));
    } catch {
      setError(t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const confirmRegenerate = () => {
    Alert.alert(t('sc.nutr.regenTitle'), t('sc.nutr.regenBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('sc.nutr.regenConfirm'), onPress: () => void generate() },
    ]);
  };

  // --- Sin perfil ---
  if (!result) {
    return (
      <Screen>
        <H1>{t('nutrition.title')}</H1>
        <Empty title={t('progress.noData')} />
      </Screen>
    );
  }

  // --- Sin objetivos automáticos por seguridad ---
  if (!result.ok) {
    const flags = result.safety.flags.filter((f) => NUTRITION_FLAGS.includes(f.code));
    return (
      <Screen>
        <H1>{t('nutrition.title')}</H1>
        {result.reason === 'blocked' ? (
          <Notice kind="warn" text={t('safety.minor')} />
        ) : (
          <>
            {flags.map((f) => (
              <Notice key={f.code} kind="warn" text={t(`safety.${f.code}`)} />
            ))}
            <Notice kind="info" title={t('nutrition.professionalTitle')} text={t('safety.professional')} />
          </>
        )}
        <Small>{t('common.disclaimer')}</Small>
      </Screen>
    );
  }

  const tg = result.targets;
  const e = tg.energy;
  const week = state.weekPlan;
  const kind = state.weekPlanKind;
  const days: DayPlan[] = week?.days ?? [];
  const activeIdx = days.length ? Math.min(Math.max(0, selDay), days.length - 1) : 0;
  const day: DayPlan | undefined = days[activeIdx];
  const isTodayDay = activeIdx === todayIdx;
  const goalAdj = tg.adjustmentKcal - tg.manualOffsetKcal;

  const energyRows: { label: string; value: string }[] = [
    { label: t('nutrition.bmr'), value: `${fmtNum(e.bmr)} kcal` },
    {
      label: t('nutrition.activity', { f: fmtNum(e.activityFactor, 2) }),
      value: `+${fmtNum(e.nonExerciseKcal - e.bmr)} kcal`,
    },
    { label: t('nutrition.strengthKcal'), value: `+${fmtNum(e.strengthKcalPerDay)} kcal` },
    { label: t('nutrition.cardioKcal'), value: `+${fmtNum(e.cardioKcalPerDay)} kcal` },
    { label: t('nutrition.tdee'), value: `${fmtNum(e.tdee)} kcal` },
    { label: t('nutrition.adjustment'), value: `${goalAdj > 0 ? '+' : ''}${fmtNum(goalAdj)} kcal` },
  ];
  if (tg.manualOffsetKcal !== 0) {
    energyRows.push({
      label: t('nutrition.manualOffset'),
      value: `${tg.manualOffsetKcal > 0 ? '+' : ''}${fmtNum(tg.manualOffsetKcal)} kcal`,
    });
  }

  return (
    <Screen>
      <H1>{t('nutrition.title')}</H1>

      {result.safety.flags
        .filter((f) => NUTRITION_FLAGS.includes(f.code))
        .map((f) => (
          <Notice key={f.code} kind="info" text={t(`safety.${f.code}`)} />
        ))}

      {/* --- Objetivos --- */}
      <Card>
        <Label>{t('nutrition.targets')}</Label>
        <Row style={{ alignItems: 'baseline' }} gap={space.xs}>
          <Num>{fmtNum(tg.kcal)}</Num>
          <Small>{t('common.kcal')}</Small>
        </Row>
        {consumed ? (
          <Small>{t('sc.nutr.consumed', { kcal: fmtNum(consumed.kcal), p: fmtNum(consumed.protein) })}</Small>
        ) : null}
        <View style={{ gap: space.md, marginTop: space.xs }}>
          <MacroBar label={t('nutrition.protein')} value={consumed?.protein ?? 0} target={tg.proteinG} color={c.protein} />
          <MacroBar label={t('nutrition.carbs')} value={consumed?.carbs ?? 0} target={tg.carbsG} color={c.carbs} />
          <MacroBar label={t('nutrition.fat')} value={consumed?.fat ?? 0} target={tg.fatG} color={c.fat} />
        </View>
        <Row style={{ justifyContent: 'space-between', marginTop: space.xs }}>
          <Small>{t('nutrition.fiber')}</Small>
          <Body>{`${fmtNum(tg.fiberG)} g`}</Body>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Small>{t('nutrition.water')}</Small>
          <Body>{`${fmtNum(tg.waterMl)} ml`}</Body>
        </Row>

        <Pressable
          onPress={() => setShowHow((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showHow }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 44 }}
        >
          <Icon name="info" size={18} color={c.accent} />
          <Body color={c.accent} style={{ fontWeight: '600' }}>
            {showHow ? t('sc.nutr.hideHow') : t('nutrition.how')}
          </Body>
        </Pressable>

        {showHow ? (
          <View style={{ gap: space.sm }}>
            <Divider />
            <Label>{t('sc.nutr.energyTitle')}</Label>
            {energyRows.map((r) => (
              <Row key={r.label} style={{ justifyContent: 'space-between' }}>
                <Small style={{ flex: 1 }}>{r.label}</Small>
                <Body style={{ fontVariant: ['tabular-nums'] }}>{r.value}</Body>
              </Row>
            ))}
            <Row style={{ justifyContent: 'space-between' }}>
              <H3>{t('sc.nutr.targetKcal')}</H3>
              <H3>{`${fmtNum(tg.kcal)} kcal`}</H3>
            </Row>
            {e.sexUnspecified ? <Small>{t('nutrition.sexNote')}</Small> : null}
            <Divider />
            <Label>{t('sc.nutr.strategyTitle')}</Label>
            {tg.strategy.map((s) => (
              <Body key={s} style={{ fontSize: 14 }}>
                {`• ${t(`strategy.${s}`)}`}
              </Body>
            ))}
            {tg.strategy.includes('deficit_floor') ? (
              <Small>{t('sc.nutr.floorNote', { kcal: fmtNum(tg.floorKcal) })}</Small>
            ) : null}
            <Small>{t('sc.nutr.proteinRef', { g: fmtNum(tg.proteinPerKg, 1), kg: fmtNum(tg.proteinReferenceKg) })}</Small>
            <Small>{t('common.estimateNote')}</Small>
          </View>
        ) : null}
      </Card>

      {/* --- Menú --- */}
      <H2 style={{ marginTop: space.sm }}>{kind === 'preview' ? t('nutrition.preview') : t('sc.nutr.menuTitle')}</H2>

      {error ? <Notice kind="danger" text={error} /> : null}

      {!week ? (
        <Card>
          <H3>{t('sc.nutr.noMenuTitle')}</H3>
          <Small>{t('sc.nutr.noMenuBody')}</Small>
          <Button title={t('nutrition.generate')} icon="food" onPress={() => void generate()} loading={busy} />
        </Card>
      ) : (
        <>
          {kind === 'week' && days.length > 1 ? (
            <Segmented
              options={days.map((d, i) => ({
                value: String(i),
                label: dayNames[d.dayIndex] ?? String(d.dayIndex + 1),
              }))}
              value={String(activeIdx)}
              onChange={(v) => setSelDay(Number(v))}
            />
          ) : null}

          {kind === 'week' && isTodayDay ? <Small>{t('sc.nutr.todayTag')}</Small> : null}

          {!day || day.meals.length === 0 ? (
            <Empty title={t('sc.nutr.noMeals')} />
          ) : (
            day.meals.map((meal) => (
              <MealRow
                key={meal.slotId}
                meal={meal}
                dayIndex={activeIdx}
                canMark={kind === 'week' && isTodayDay}
                eaten={!!state.mealLogs[today]?.[meal.slotId]?.eaten}
                onToggle={() => {
                  const isEaten = !!state.mealLogs[today]?.[meal.slotId]?.eaten;
                  void actions.setMealEaten(
                    today,
                    meal.slotId,
                    isEaten
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
                }}
                lang={lang}
                t={t}
              />
            ))
          )}

          {kind === 'week' && day && day.meals.length > 0 ? (
            <Card>
              <Label>{t('nutrition.dayTotal')}</Label>
              <MacroBar label={t('nutrition.calories')} value={day.totals.kcal} target={week.targets.kcal} unit="kcal" color={c.accent} />
              <MacroBar label={t('nutrition.protein')} value={day.totals.protein} target={week.targets.proteinG} color={c.protein} />
              <MacroBar label={t('nutrition.carbs')} value={day.totals.carbs} target={week.targets.carbsG} color={c.carbs} />
              <MacroBar label={t('nutrition.fat')} value={day.totals.fat} target={week.targets.fatG} color={c.fat} />
              {!day.check.ok ? (
                <Notice
                  kind="warn"
                  text={t('nutrition.dayWarn', {
                    kcal: Math.round((1 + day.check.kcalDeviationPct) * 100),
                    protein: Math.round(day.check.proteinPctOfTarget * 100),
                  })}
                />
              ) : null}
            </Card>
          ) : null}

          {kind === 'preview' ? <LockCard text={t('nutrition.previewLock')} /> : null}

          {kind === 'week' ? (
            can(plan, 'shopping_list') ? (
              <Button title={t('nutrition.shopping')} icon="cart" variant="secondary" onPress={() => router.push('/shopping')} />
            ) : (
              <LockCard text={t('sc.shopping.locked')} />
            )
          ) : null}

          <Button title={t('nutrition.regenerate')} icon="refresh" variant="ghost" onPress={confirmRegenerate} loading={busy} />
        </>
      )}

      {/* --- Pie --- */}
      <View style={{ gap: space.xs, marginTop: space.sm }}>
        <Small>{t('nutrition.source')}</Small>
        <Small>{t('nutrition.noCost')}</Small>
        {state.mode === 'cloud' && week ? <Small>{t('nutrition.cloudPlan')}</Small> : null}
      </View>
    </Screen>
  );
}

// ---------------------------------------------------------------- fila de comida
interface MealRowProps {
  meal: PlannedMeal;
  dayIndex: number;
  canMark: boolean;
  eaten: boolean;
  onToggle: () => void;
  lang: 'es' | 'en';
  t: (k: string, v?: Record<string, string | number>) => string;
}

function MealRow({ meal, dayIndex, canMark, eaten, onToggle, lang, t }: MealRowProps) {
  const { c } = useTheme();
  const recipe = RECIPE_BY_ID[meal.recipeId];
  const swapped = useMemo(() => swappedHeadline(meal), [meal]);
  const swappedFood = swapped ? FOOD_BY_ID[swapped] : undefined;
  const open = () => router.push(`/meal/${dayIndex}/${meal.slotId}`);

  return (
    <Card onPress={open} accessibilityLabel={`${t(`nutrition.slots.${meal.slotId}`)}: ${recipe?.name[lang] ?? ''}`}>
      <Row style={{ alignItems: 'flex-start' }} gap={space.md}>
        <View style={{ flex: 1, gap: 2 }}>
          <Label>{t(`nutrition.slots.${meal.slotId}`)}</Label>
          <H3 numberOfLines={2}>{recipe?.name[lang] ?? meal.recipeId}</H3>
          {swappedFood ? <Small color={c.accent}>{t('nutrition.swapNote', { food: swappedFood.name[lang] })}</Small> : null}
          <Row gap={space.md} style={{ marginTop: space.xs }} wrap>
            <Body style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}>{`${fmtNum(meal.totals.kcal)} kcal`}</Body>
            <Small color={c.protein}>{`${t('sc.macro.p')} ${fmtNum(meal.totals.protein)} g`}</Small>
            <Small color={c.carbs}>{`${t('sc.macro.c')} ${fmtNum(meal.totals.carbs)} g`}</Small>
            <Small color={c.fat}>{`${t('sc.macro.f')} ${fmtNum(meal.totals.fat)} g`}</Small>
          </Row>
        </View>
        {canMark ? (
          <Pressable
            onPress={onToggle}
            hitSlop={8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: eaten }}
            accessibilityLabel={t('nutrition.markEaten')}
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.pill,
              borderWidth: 2,
              borderColor: eaten ? c.ok : c.border,
              backgroundColor: eaten ? c.ok : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {eaten ? <Icon name="check" size={22} color="#FFFFFF" /> : null}
          </Pressable>
        ) : (
          <Icon name="chevron-right" size={20} color={c.muted} />
        )}
      </Row>
    </Card>
  );
}
