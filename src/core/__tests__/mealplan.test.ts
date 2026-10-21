import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FOODS, FOOD_BY_ID, getFood, matchFoodsFromText } from '../data/foods.ts';
import { RECIPES } from '../data/recipes.ts';
import {
  generateWeekPlan,
  isFoodAllowed,
  nutrientsFor,
  restrictionsOf,
  substituteIngredient,
  substitutionOptions,
  replaceMealRecipe,
  alternativeRecipes,
  sumNutrients,
  type WeekPlan,
} from '../mealplan.ts';
import { buildShoppingList, shoppingListToText } from '../shopping.ts';
import { computeTargets } from '../targets.ts';
import type { UserProfile } from '../types.ts';
import { profile } from './helpers.ts';

function planFor(p: UserProfile): WeekPlan {
  const r = computeTargets(p);
  assert.ok(r.ok);
  if (!r.ok) throw new Error();
  return generateWeekPlan({ profile: p, targets: r.targets });
}

test('base de alimentos: energía coherente con Atwater (detecta errores de captura)', () => {
  for (const f of FOODS) {
    const atwater = f.per100.protein * 4 + f.per100.carbs * 4 + f.per100.fat * 9;
    const diff = Math.abs(atwater - f.per100.kcal);
    assert.ok(diff <= Math.max(20, f.per100.kcal * 0.12), `${f.id}: ${f.per100.kcal} vs ${atwater.toFixed(0)}`);
    assert.match(f.usda.ndb, /^\d{5}$/);
  }
});

test('recetas: todos los ingredientes existen y los rangos son válidos', () => {
  for (const r of RECIPES) {
    for (const i of r.ingredients) {
      assert.ok(FOOD_BY_ID[i.foodId], `${r.id}: ${i.foodId}`);
      assert.ok(i.minG <= i.baseG && i.baseG <= i.maxG, `${r.id}/${i.foodId} rangos`);
      for (const a of i.alternatives ?? []) assert.ok(FOOD_BY_ID[a], `${r.id}: alternativa ${a}`);
    }
    assert.ok(r.steps.es.length === r.steps.en.length && r.steps.es.length > 0, `${r.id} pasos`);
  }
});

test('el cálculo nutricional de un ingrediente es exacto', () => {
  const n = nutrientsFor(getFood('chicken_breast'), 180);
  assert.equal(n.kcal, 216);
  assert.equal(Math.round(n.protein * 100) / 100, 40.5);
});

test('las sumas de cada comida y de cada día son consistentes', () => {
  const plan = planFor(profile());
  for (const day of plan.days) {
    for (const meal of day.meals) {
      const sum = sumNutrients(meal.ingredients.map((i) => nutrientsFor(getFood(i.foodId), i.grams)));
      assert.ok(Math.abs(sum.kcal - meal.totals.kcal) < 1e-6);
      for (const i of meal.ingredients) {
        assert.ok(i.grams > 0);
        if (getFood(i.foodId).unit && i.role !== 'V') {
          const step = getFood(i.foodId).unit!.grams;
          assert.equal(i.grams % step, 0, `${i.foodId} en unidades enteras`);
        }
      }
    }
    const daySum = sumNutrients(day.meals.map((m) => m.totals));
    assert.ok(Math.abs(daySum.kcal - day.totals.kcal) < 1e-6);
  }
});

test('omnívoro: los días quedan dentro de ±7 % de calorías y ≥90 % de proteína', () => {
  let ok = 0;
  let total = 0;
  for (const goal of ['fat_loss', 'muscle_gain', 'maintenance', 'recomposition'] as const) {
    for (const mealsPerDay of [3, 4, 5]) {
      for (const weightKg of [60, 80, 100]) {
        const plan = planFor(profile({ goal, mealsPerDay, weightKg }));
        for (const d of plan.days) {
          total++;
          if (d.check.ok) ok++;
        }
      }
    }
  }
  assert.ok(ok / total >= 0.97, `${ok}/${total}`);
});

test('todas las dietas: calorías del día dentro de ±10 %', () => {
  for (const diet of ['vegan', 'vegetarian', 'pescatarian'] as const) {
    for (const mealsPerDay of [3, 4, 5]) {
      const plan = planFor(profile({ diet, mealsPerDay }));
      for (const d of plan.days) assert.ok(Math.abs(d.check.kcalDeviationPct) <= 0.1, `${diet} ${mealsPerDay}: ${d.check.kcalDeviationPct}`);
    }
  }
});

test('respeta alergias, dieta y alimentos excluidos', () => {
  const cases: Partial<UserProfile>[] = [
    { diet: 'vegan' },
    { diet: 'vegetarian', allergens: ['egg'] },
    { allergens: ['dairy', 'gluten'] },
    { allergens: ['fish', 'shellfish', 'peanut', 'tree_nut'] },
    { excludedFoods: ['chicken_breast', 'white_rice', 'oats'] },
    { diet: 'pescatarian', allergens: ['soy', 'lactose'] },
  ];
  for (const c of cases) {
    const p = profile(c);
    const r = restrictionsOf(p);
    const plan = planFor(p);
    let meals = 0;
    for (const d of plan.days)
      for (const m of d.meals) {
        meals++;
        for (const i of m.ingredients) assert.ok(isFoodAllowed(getFood(i.foodId), r), `${JSON.stringify(c)} → ${i.foodId}`);
      }
    assert.ok(meals >= 7 * 3, `${JSON.stringify(c)}: faltan comidas (${meals})`);
  }
});

test('vegano: nunca recibe productos animales', () => {
  const plan = planFor(profile({ diet: 'vegan' }));
  for (const d of plan.days) for (const m of d.meals) for (const i of m.ingredients) assert.equal(getFood(i.foodId).origin, 'plant');
});

test('planes distintos para perfiles distintos', () => {
  const a = planFor(profile({ goal: 'fat_loss', weightKg: 70 }));
  const b = planFor(profile({ goal: 'muscle_gain', weightKg: 70 }));
  assert.ok(b.days[0].totals.kcal - a.days[0].totals.kcal > 300);
});

test('lista de compras: suma correctamente ingredientes repetidos', () => {
  const plan = planFor(profile({ mealsPerDay: 4 }));
  const expected = new Map<string, number>();
  for (const d of plan.days) for (const m of d.meals) for (const i of m.ingredients) expected.set(i.foodId, (expected.get(i.foodId) ?? 0) + i.grams);
  const list = buildShoppingList(plan);
  assert.equal(list.length, expected.size);
  for (const it of list) {
    assert.ok(Math.abs(it.grams - (expected.get(it.foodId) ?? 0)) < 1e-6, it.foodId);
    assert.ok(it.buyGrams >= it.grams);
    const f = getFood(it.foodId);
    if (f.unit) assert.equal(it.units, Math.ceil(it.grams / f.unit.grams - 1e-9));
  }
  const three = buildShoppingList(plan, 3);
  const g3 = three.reduce((a, b) => a + b.grams, 0);
  const g7 = list.reduce((a, b) => a + b.grams, 0);
  assert.ok(g3 < g7);
  const txt = shoppingListToText(list, 'es', { removed: [list[0].foodId], checked: { [list[1].foodId]: true } });
  assert.ok(!txt.includes(getFood(list[0].foodId).name.es + ':'));
  assert.ok(txt.includes('☑'));
});

test('sustitución: pollo → tofu recalcula cantidades y mantiene el objetivo', () => {
  const p = profile();
  const plan = planFor(p);
  const r = restrictionsOf(p);
  const meal = plan.days.flatMap((d) => d.meals).find((m) => m.recipeId === 'chicken_rice_broccoli') ??
    replaceMealRecipe(plan.days[0].meals.find((m) => m.type === 'main')!, 'chicken_rice_broccoli', r);
  const opts = substitutionOptions(meal, 'chicken_breast', r).map((o) => o.foodId);
  assert.ok(opts.includes('tofu'));
  const swapped = substituteIngredient(meal, 'chicken_breast', 'tofu', r);
  assert.ok(swapped.ingredients.some((i) => i.foodId === 'tofu'));
  assert.ok(!swapped.ingredients.some((i) => i.foodId === 'chicken_breast'));
  assert.ok(Math.abs(swapped.totals.kcal - meal.target.kcal) / meal.target.kcal < 0.15);
  assert.throws(() => substituteIngredient(meal, 'chicken_breast', 'salmon', restrictionsOf(profile({ allergens: ['fish'] }))));
});

test('cambio de receta conserva el objetivo de la comida', () => {
  const p = profile();
  const plan = planFor(p);
  const meal = plan.days[0].meals.find((m) => m.type === 'main')!;
  const alts = alternativeRecipes(meal, restrictionsOf(p));
  assert.ok(alts.length >= 3);
  const re = replaceMealRecipe(meal, alts[0], restrictionsOf(p));
  assert.deepEqual(re.target, meal.target);
});

test('texto libre: "no como cerdo ni atún" identifica los alimentos', () => {
  const ids = matchFoodsFromText('No como cerdo ni atún');
  assert.ok(ids.includes('pork_tenderloin'));
  assert.ok(ids.includes('tuna_canned_water'));
  assert.ok(!ids.includes('chicken_breast'));
});

test('el plan es determinista para el mismo perfil y semilla', () => {
  const p = profile();
  const r = computeTargets(p);
  assert.ok(r.ok);
  if (!r.ok) return;
  const a = generateWeekPlan({ profile: p, targets: r.targets, seed: 42 });
  const b = generateWeekPlan({ profile: p, targets: r.targets, seed: 42 });
  assert.deepEqual(a.days, b.days);
});
