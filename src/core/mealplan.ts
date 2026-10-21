// Generador de menús. Escala recetas con un solucionador determinista de
// mínimos cuadrados acotados y comprueba las sumas de cada comida y del día.
import { FOOD_BY_ID, getFood, type Food, type FoodOrigin } from './data/foods.ts';
import { RECIPES, RECIPE_BY_ID, type MealType, type RecipeIngredient, type RecipeTemplate, type Role } from './data/recipes.ts';
import type { MacroTargets } from './targets.ts';
import type { Allergen, DietStyle, UserProfile } from './types.ts';
import { clamp } from './units.ts';

export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  fiberApprox: boolean; // algún alimento sin dato de fibra
}

export interface PlannedIngredient {
  foodId: string;
  role: Role;
  grams: number;
  units?: number; // p. ej. 2 huevos
  nutrients: Nutrients;
}

export interface MealTarget {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface PlannedMeal {
  slotId: string;
  type: MealType;
  recipeId: string;
  ingredients: PlannedIngredient[];
  totals: Nutrients;
  target: MealTarget;
}

export interface DayCheck {
  kcalDeviationPct: number;
  proteinPctOfTarget: number;
  ok: boolean;
}

export interface DayPlan {
  dayIndex: number; // 0 = lunes
  meals: PlannedMeal[];
  totals: Nutrients;
  check: DayCheck;
}

export interface WeekPlan {
  version: 1;
  generatedAt: string;
  targets: MacroTargets;
  days: DayPlan[];
}

export interface MealSlot {
  id: string;
  type: MealType;
  share: number;
}

export function mealSlots(mealsPerDay: number): MealSlot[] {
  const n = clamp(Math.round(mealsPerDay), 3, 5);
  if (n === 3)
    return [
      { id: 'breakfast', type: 'breakfast', share: 0.3 },
      { id: 'lunch', type: 'main', share: 0.4 },
      { id: 'dinner', type: 'main', share: 0.3 },
    ];
  if (n === 4)
    return [
      { id: 'breakfast', type: 'breakfast', share: 0.25 },
      { id: 'lunch', type: 'main', share: 0.32 },
      { id: 'snack_pm', type: 'snack', share: 0.13 },
      { id: 'dinner', type: 'main', share: 0.3 },
    ];
  return [
    { id: 'breakfast', type: 'breakfast', share: 0.22 },
    { id: 'snack_am', type: 'snack', share: 0.1 },
    { id: 'lunch', type: 'main', share: 0.3 },
    { id: 'snack_pm', type: 'snack', share: 0.1 },
    { id: 'dinner', type: 'main', share: 0.28 },
  ];
}

// ------------------------------------------------------------------ nutrientes
export function nutrientsFor(food: Food, grams: number): Nutrients {
  const k = grams / 100;
  return {
    kcal: food.per100.kcal * k,
    protein: food.per100.protein * k,
    carbs: food.per100.carbs * k,
    fat: food.per100.fat * k,
    fiber: (food.per100.fiber ?? 0) * k,
    fiberApprox: food.per100.fiber === null && grams > 0,
  };
}

export function sumNutrients(items: Nutrients[]): Nutrients {
  return items.reduce<Nutrients>(
    (a, b) => ({
      kcal: a.kcal + b.kcal,
      protein: a.protein + b.protein,
      carbs: a.carbs + b.carbs,
      fat: a.fat + b.fat,
      fiber: a.fiber + b.fiber,
      fiberApprox: a.fiberApprox || b.fiberApprox,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, fiberApprox: false },
  );
}

// ------------------------------------------------------------- restricciones
const DIET_ORIGINS: Record<DietStyle, FoodOrigin[]> = {
  vegan: ['plant'],
  vegetarian: ['plant', 'dairy', 'egg', 'honey'],
  pescatarian: ['plant', 'dairy', 'egg', 'honey', 'fish', 'shellfish'],
  omnivore: ['plant', 'dairy', 'egg', 'honey', 'fish', 'shellfish', 'meat', 'poultry'],
};

export interface FoodRestrictions {
  diet: DietStyle;
  allergens: Allergen[];
  excludedFoods: string[];
}

export function restrictionsOf(p: Pick<UserProfile, 'diet' | 'allergens' | 'excludedFoods'>): FoodRestrictions {
  return { diet: p.diet, allergens: p.allergens, excludedFoods: p.excludedFoods };
}

export function isFoodAllowed(food: Food, r: FoodRestrictions): boolean {
  if (!DIET_ORIGINS[r.diet].includes(food.origin)) return false;
  if (food.allergens.some((a) => r.allergens.includes(a))) return false;
  // Quien declara alergia a la leche tampoco debe recibir alimentos con lactosa.
  if (r.allergens.includes('dairy') && food.origin === 'dairy') return false;
  if (r.excludedFoods.includes(food.id)) return false;
  return true;
}

/**
 * Adapta una receta a las restricciones: sustituye ingredientes no permitidos por
 * alternativas válidas y elimina verduras no permitidas. Devuelve null si la receta
 * no se puede adaptar.
 */
export function adaptRecipe(recipe: RecipeTemplate, r: FoodRestrictions, keepHeadline = true): RecipeIngredient[] | null {
  const out: RecipeIngredient[] = [];
  const headline = headlineFoodId(recipe);
  for (const ingredient of recipe.ingredients) {
    const food = getFood(ingredient.foodId);
    if (isFoodAllowed(food, r)) {
      out.push(ingredient);
      continue;
    }
    // Si el ingrediente que da nombre al plato no está permitido, el plato sería
    // otro: no se ofrece con un nombre engañoso.
    if (keepHeadline && ingredient.foodId === headline) return null;
    const alt = (ingredient.alternatives ?? []).map((id) => FOOD_BY_ID[id]).find((x) => x && isFoodAllowed(x, r));
    if (alt) {
      out.push(rebaseIngredient(ingredient, alt.id));
      continue;
    }
    if (ingredient.role === 'V') continue; // una verdura se puede omitir
    return null;
  }
  // Debe quedar al menos un ingrediente escalable.
  if (!out.some((i) => i.role !== 'V')) return null;
  // No repetir el mismo alimento en dos roles (p. ej., pollo por sustitución).
  const ids = out.map((i) => i.foodId);
  if (new Set(ids).size !== ids.length) return null;
  return out;
}

/** Ingrediente principal que da nombre al plato (primer ingrediente de proteína). */
export function headlineFoodId(recipe: RecipeTemplate): string | null {
  return recipe.ingredients.find((i) => i.role === 'P')?.foodId ?? null;
}

/** Reconstruye la lista escalable a partir de una comida ya planificada (con sus sustituciones). */
export function ingredientsFromMeal(meal: PlannedMeal): RecipeIngredient[] {
  const recipe = RECIPE_BY_ID[meal.recipeId];
  const used = new Set<RecipeIngredient>();
  const out: RecipeIngredient[] = [];
  for (const pi of meal.ingredients) {
    const same = recipe.ingredients.find((t) => t.foodId === pi.foodId && !used.has(t));
    if (same) {
      used.add(same);
      out.push(same);
      continue;
    }
    const slot =
      recipe.ingredients.find((t) => !used.has(t) && t.role === pi.role && (t.alternatives ?? []).includes(pi.foodId)) ??
      recipe.ingredients.find((t) => !used.has(t) && t.role === pi.role);
    if (!slot) continue;
    used.add(slot);
    out.push(rebaseIngredient(slot, pi.foodId));
  }
  return out;
}

/** Cambia el alimento de un ingrediente conservando aproximadamente su aporte principal. */
export function rebaseIngredient(ingredient: RecipeIngredient, newFoodId: string): RecipeIngredient {
  const oldF = getFood(ingredient.foodId).per100;
  const newF = getFood(newFoodId).per100;
  const key = ingredient.role === 'P' ? 'protein' : ingredient.role === 'C' ? 'carbs' : ingredient.role === 'F' ? 'fat' : 'kcal';
  const ratio = newF[key] > 0 && oldF[key] > 0 ? oldF[key] / newF[key] : oldF.kcal / Math.max(newF.kcal, 1);
  const newFood = getFood(newFoodId);
  const step = newFood.unit ? newFood.unit.grams : ingredient.role === 'F' && newFoodId === 'olive_oil' ? 1 : 5;
  const scale = (g: number) => Math.max(0, Math.round((g * ratio) / step) * step);
  return {
    foodId: newFoodId,
    role: ingredient.role,
    baseG: Math.max(step, scale(ingredient.baseG)),
    minG: scale(ingredient.minG),
    maxG: Math.max(step, scale(ingredient.maxG)),
    stepG: step,
    alternatives: ingredient.alternatives?.filter((id) => id !== newFoodId).concat(ingredient.foodId),
  };
}

// ---------------------------------------------------------------- solucionador
const WEIGHTS = { kcal: 4, protein: 2, carbs: 1, fat: 1 };
type Metric = keyof typeof WEIGHTS;
const METRICS: Metric[] = ['kcal', 'protein', 'carbs', 'fat'];

function objective(n: Nutrients, t: MealTarget): number {
  let s = 0;
  for (const m of METRICS) {
    const target = Math.max(t[m], m === 'kcal' ? 50 : 3);
    const e = (n[m] - target) / target;
    s += WEIGHTS[m] * e * e;
  }
  return s;
}

function mealNutrients(ings: RecipeIngredient[], grams: number[]): Nutrients {
  return sumNutrients(ings.map((ing, i) => nutrientsFor(getFood(ing.foodId), grams[i])));
}

/** Resuelve las cantidades de una receta adaptada para una comida objetivo. */
export function solveQuantities(ings: RecipeIngredient[], target: MealTarget): number[] {
  const groups: Role[] = (['P', 'C', 'F'] as Role[]).filter((g) => ings.some((i) => i.role === g));
  // Matriz A (métrica × grupo): aporte de cada grupo con multiplicador 1.
  const fixed = sumNutrients(ings.filter((i) => i.role === 'V').map((i) => nutrientsFor(getFood(i.foodId), i.baseG)));
  const contrib = groups.map((g) =>
    sumNutrients(ings.filter((i) => i.role === g).map((i) => nutrientsFor(getFood(i.foodId), i.baseG))),
  );
  const lo = groups.map((g) => Math.max(...ings.filter((i) => i.role === g).map((i) => i.minG / i.baseG)));
  const hi = groups.map((g) => Math.min(...ings.filter((i) => i.role === g).map((i) => i.maxG / i.baseG)));

  // Normal equations with weights normalised by target.
  const k = groups.length;
  const H = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const gv = new Array<number>(k).fill(0);
  for (const m of METRICS) {
    const tm = Math.max(target[m], m === 'kcal' ? 50 : 3);
    const w = WEIGHTS[m] / (tm * tm);
    const resid = target[m] - fixed[m];
    for (let a = 0; a < k; a++) {
      gv[a] += w * contrib[a][m] * resid;
      for (let b = 0; b < k; b++) H[a][b] += w * contrib[a][m] * contrib[b][m];
    }
  }
  const mult = groups.map((_, j) => clamp(1, lo[j], hi[j]));
  for (let iter = 0; iter < 300; iter++) {
    let delta = 0;
    for (let j = 0; j < k; j++) {
      if (H[j][j] <= 0) continue;
      let s = gv[j];
      for (let i = 0; i < k; i++) if (i !== j) s -= H[j][i] * mult[i];
      const next = clamp(s / H[j][j], lo[j], hi[j]);
      delta = Math.max(delta, Math.abs(next - mult[j]));
      mult[j] = next;
    }
    if (delta < 1e-7) break;
  }

  // Cantidades continuas → redondeo práctico.
  let grams = ings.map((ing) => {
    if (ing.role === 'V') return ing.baseG;
    const j = groups.indexOf(ing.role);
    return snap(ing, ing.baseG * mult[j]);
  });

  // Búsqueda local discreta: ±1 paso mientras mejore el objetivo.
  let best = objective(mealNutrients(ings, grams), target);
  for (let pass = 0; pass < 25; pass++) {
    let improved = false;
    for (let i = 0; i < ings.length; i++) {
      if (ings[i].role === 'V') continue;
      for (const dir of [-1, 1]) {
        const g = snap(ings[i], grams[i] + dir * ings[i].stepG);
        if (g === grams[i]) continue;
        const trial = grams.slice();
        trial[i] = g;
        const score = objective(mealNutrients(ings, trial), target);
        if (score < best - 1e-9) {
          best = score;
          grams = trial;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return grams;
}

function snap(ing: RecipeIngredient, g: number): number {
  const stepped = Math.round(g / ing.stepG) * ing.stepG;
  const minStepped = Math.ceil(ing.minG / ing.stepG - 1e-9) * ing.stepG;
  const maxStepped = Math.floor(ing.maxG / ing.stepG + 1e-9) * ing.stepG;
  return clamp(stepped, minStepped, maxStepped);
}

export function buildMeal(slot: MealSlot, recipeId: string, ings: RecipeIngredient[], target: MealTarget): PlannedMeal {
  const grams = solveQuantities(ings, target);
  const ingredients: PlannedIngredient[] = ings
    .map((ing, i) => {
      const food = getFood(ing.foodId);
      return {
        foodId: ing.foodId,
        role: ing.role,
        grams: grams[i],
        units: food.unit ? Math.round((grams[i] / food.unit.grams) * 10) / 10 : undefined,
        nutrients: nutrientsFor(food, grams[i]),
      };
    })
    .filter((x) => x.grams > 0);
  return {
    slotId: slot.id,
    type: slot.type,
    recipeId,
    ingredients,
    totals: sumNutrients(ingredients.map((x) => x.nutrients)),
    target,
  };
}

// ----------------------------------------------------------------- generación
/** Generador pseudoaleatorio determinista (mulberry32): mismo perfil → mismo plan. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface PlanOptions {
  profile: UserProfile;
  targets: MacroTargets;
  seed?: number;
  days?: number; // 1..7
}

const MAX_PREP: Record<UserProfile['cookingTime'], number> = { minimal: 15, some: 30, plenty: 90 };

function candidateRecipes(type: MealType, r: FoodRestrictions): { recipe: RecipeTemplate; ings: RecipeIngredient[] }[] {
  const out: { recipe: RecipeTemplate; ings: RecipeIngredient[] }[] = [];
  for (const recipe of RECIPES) {
    if (!recipe.mealTypes.includes(type)) continue;
    const ings = adaptRecipe(recipe, r);
    if (ings) out.push({ recipe, ings });
  }
  return out;
}

export function mealError(meal: PlannedMeal): number {
  return objective(meal.totals, meal.target);
}

/**
 * Objetivo de una comida. Las calorías arrastran todo lo que falta del día; la
 * proteína arrastra como máximo +30 % de su cuota (para no pedir imposibles a la
 * última comida) y carbohidratos/grasas completan la energía en la proporción del día.
 */
export function mealTargetFor(targets: MacroTargets, done: Nutrients, share: number, f: number): MealTarget {
  const kcal = Math.max(0, (targets.kcal - done.kcal) * f);
  const protein = Math.max(0, Math.min((targets.proteinG - done.protein) * f, targets.proteinG * share * 1.3, (kcal * 0.6) / 4));
  const rest = Math.max(0, kcal - protein * 4);
  const cK = targets.carbsG * 4;
  const fK = targets.fatG * 9;
  const cShare = cK + fK > 0 ? cK / (cK + fK) : 0.5;
  return { kcal, protein, carbs: (rest * cShare) / 4, fat: (rest * (1 - cShare)) / 9 };
}

export function generateWeekPlan(opts: PlanOptions): WeekPlan {
  const { profile, targets } = opts;
  const days = clamp(opts.days ?? 7, 1, 7);
  const rnd = seededRandom(opts.seed ?? hashString(`${profile.createdAt}|${profile.goal}|${profile.diet}`));
  const slots = mealSlots(profile.mealsPerDay);
  const r = restrictionsOf(profile);
  const usage = new Map<string, number>();
  const batchLunch: { recipeId: string; ings: RecipeIngredient[]; left: number } = { recipeId: '', ings: [], left: 0 };
  const plan: DayPlan[] = [];

  for (let d = 0; d < days; d++) {
    const meals: PlannedMeal[] = [];
    const usedToday = new Set<string>();
    for (let s = 0; s < slots.length; s++) {
      const slot = slots[s];
      // Objetivo con arrastre: lo que falta del día se reparte entre las comidas restantes.
      const done = sumNutrients(meals.map((m) => m.totals));
      const remainingShare = slots.slice(s).reduce((a, x) => a + x.share, 0);
      const f = slot.share / remainingShare;
      const target = mealTargetFor(targets, done, slot.share, f);

      let chosen: PlannedMeal | null = null;
      if (profile.prepStyle === 'batch' && slot.id === 'lunch' && batchLunch.left > 0 && !usedToday.has(batchLunch.recipeId)) {
        chosen = buildMeal(slot, batchLunch.recipeId, batchLunch.ings, target);
        batchLunch.left -= 1;
      } else {
        const cands = candidateRecipes(slot.type, r).filter((c) => !usedToday.has(c.recipe.id));
        if (cands.length === 0) continue;
        const scored = cands.map((c) => {
          let score = rnd() * 0.6;
          score -= (usage.get(c.recipe.id) ?? 0) * 0.8;
          if (c.recipe.prepMinutes > MAX_PREP[profile.cookingTime]) score -= 1.2;
          const tiers = c.ings.filter((i) => i.role === 'P').map((i) => getFood(i.foodId).costTier);
          const tier = tiers.length ? Math.max(...tiers) : 1;
          if (profile.budget === 'low') score -= (tier - 1) * 0.5;
          if (profile.budget === 'high') score += 0.1;
          if (c.ings.some((i) => profile.favoriteFoods.includes(i.foodId))) score += 0.7;
          if (profile.prepStyle === 'batch' && c.recipe.batchFriendly && slot.id === 'lunch') score += 0.4;
          return { c, score };
        });
        // Se evalúan todas las candidatas: gana el mejor equilibrio entre ajuste a
        // los macros (prioritario) y preferencias/variedad.
        let bestCost = Infinity;
        for (const { c, score } of scored) {
          const meal = buildMeal(slot, c.recipe.id, c.ings, target);
          const cost = mealError(meal) * 8 - score;
          if (cost < bestCost) {
            bestCost = cost;
            chosen = meal;
          }
        }
        if (chosen && profile.prepStyle === 'batch' && slot.id === 'lunch') {
          const rec = RECIPE_BY_ID[chosen.recipeId];
          if (rec.batchFriendly) {
            batchLunch.recipeId = rec.id;
            batchLunch.ings = adaptRecipe(rec, r) ?? [];
            batchLunch.left = 2; // se cocina para 3 días
          }
        }
      }
      if (chosen) {
        meals.push(chosen);
        usedToday.add(chosen.recipeId);
        usage.set(chosen.recipeId, (usage.get(chosen.recipeId) ?? 0) + 1);
      }
    }
    plan.push(makeDay(d, meals, targets));
  }
  return { version: 1, generatedAt: new Date().toISOString(), targets, days: plan };
}

export function makeDay(dayIndex: number, meals: PlannedMeal[], targets: MacroTargets): DayPlan {
  const totals = sumNutrients(meals.map((m) => m.totals));
  const kcalDeviationPct = targets.kcal > 0 ? (totals.kcal - targets.kcal) / targets.kcal : 0;
  const proteinPctOfTarget = targets.proteinG > 0 ? totals.protein / targets.proteinG : 1;
  return {
    dayIndex,
    meals,
    totals,
    check: {
      kcalDeviationPct,
      proteinPctOfTarget,
      ok: Math.abs(kcalDeviationPct) <= 0.07 && proteinPctOfTarget >= 0.9,
    },
  };
}

// ------------------------------------------------------------- sustituciones
export interface SubstitutionOption {
  foodId: string;
  costTier: 1 | 2 | 3;
}

/** Alternativas válidas para un ingrediente, ordenadas por costo relativo. */
export function substitutionOptions(meal: PlannedMeal, ingredientFoodId: string, r: FoodRestrictions): SubstitutionOption[] {
  const recipe = RECIPE_BY_ID[meal.recipeId];
  const current = meal.ingredients.find((i) => i.foodId === ingredientFoodId);
  if (!current) return [];
  const original =
    recipe.ingredients.find((i) => i.foodId === ingredientFoodId || i.alternatives?.includes(ingredientFoodId)) ??
    recipe.ingredients.find((i) => i.role === current.role);
  if (!original) return [];
  const pool = new Set<string>([original.foodId, ...(original.alternatives ?? [])]);
  pool.delete(ingredientFoodId);
  const inMeal = new Set(meal.ingredients.map((i) => i.foodId));
  return [...pool]
    .map((id) => FOOD_BY_ID[id])
    .filter((food): food is Food => !!food && isFoodAllowed(food, r) && !inMeal.has(food.id))
    .map((food) => ({ foodId: food.id, costTier: food.costTier }))
    .sort((a, b) => a.costTier - b.costTier);
}

/** Sustituye un ingrediente y recalcula todas las cantidades para el mismo objetivo. */
export function substituteIngredient(meal: PlannedMeal, fromFoodId: string, toFoodId: string, r: FoodRestrictions): PlannedMeal {
  const adapted = ingredientsFromMeal(meal);
  const idx = adapted.findIndex((i) => i.foodId === fromFoodId);
  if (idx < 0) throw new Error('Ingrediente no encontrado');
  if (!isFoodAllowed(getFood(toFoodId), r)) throw new Error('Alimento no permitido por tus restricciones');
  const ings = adapted.slice();
  ings[idx] = rebaseIngredient(adapted[idx], toFoodId);
  return buildMeal({ id: meal.slotId, type: meal.type, share: 0 }, meal.recipeId, ings, meal.target);
}

/** Recetas alternativas para el mismo tipo de comida. */
export function alternativeRecipes(meal: PlannedMeal, r: FoodRestrictions): string[] {
  return candidateRecipes(meal.type, r)
    .map((c) => c.recipe.id)
    .filter((id) => id !== meal.recipeId);
}

/** Cambia la receta de una comida manteniendo su objetivo nutricional. */
export function replaceMealRecipe(meal: PlannedMeal, recipeId: string, r: FoodRestrictions): PlannedMeal {
  const recipe = RECIPE_BY_ID[recipeId];
  if (!recipe) throw new Error('Receta desconocida');
  const ings = adaptRecipe(recipe, r);
  if (!ings) throw new Error('La receta no es compatible con tus restricciones');
  return buildMeal({ id: meal.slotId, type: meal.type, share: 0 }, recipeId, ings, meal.target);
}

export function replaceMealInDay(day: DayPlan, slotId: string, meal: PlannedMeal, targets: MacroTargets): DayPlan {
  return makeDay(
    day.dayIndex,
    day.meals.map((m) => (m.slotId === slotId ? meal : m)),
    targets,
  );
}
