// Lista de compras consolidada a partir del plan semanal.
import { getFood, type FoodState } from './data/foods.ts';
import type { WeekPlan } from './mealplan.ts';
import type { Lang } from './types.ts';
import { roundUp } from './units.ts';

export interface ShoppingItem {
  foodId: string;
  grams: number; // suma exacta
  buyGrams: number; // redondeada hacia arriba para comprar
  units?: number; // unidades enteras para alimentos contables
  state: FoodState;
  category: string;
}

export function buildShoppingList(plan: WeekPlan, days?: number): ShoppingItem[] {
  const n = days === undefined ? plan.days.length : Math.max(1, Math.min(days, plan.days.length));
  const totals = new Map<string, number>();
  for (const day of plan.days.slice(0, n)) {
    for (const meal of day.meals) {
      for (const ing of meal.ingredients) {
        totals.set(ing.foodId, (totals.get(ing.foodId) ?? 0) + ing.grams);
      }
    }
  }
  const order = ['protein', 'dairy', 'legume', 'carb', 'vegetable', 'fruit', 'fat'];
  return [...totals.entries()]
    .map(([foodId, grams]) => {
      const food = getFood(foodId);
      const units = food.unit ? Math.ceil(grams / food.unit.grams - 1e-9) : undefined;
      const buyGrams = food.unit ? (units as number) * food.unit.grams : roundUp(grams, grams < 100 ? 5 : 10);
      return { foodId, grams, buyGrams, units, state: food.state, category: food.category };
    })
    .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.foodId.localeCompare(b.foodId));
}

const STATE_LABEL: Record<Lang, Record<FoodState, string>> = {
  es: { raw: 'crudo', dry: 'en seco', cooked: 'cocido', drained: 'escurrido', ready: 'listo para consumir' },
  en: { raw: 'raw', dry: 'dry', cooked: 'cooked', drained: 'drained', ready: 'ready to eat' },
};

export function stateLabel(state: FoodState, lang: Lang): string {
  return STATE_LABEL[lang][state];
}

/** Texto plano para compartir/exportar la lista. */
export function shoppingListToText(
  items: ShoppingItem[],
  lang: Lang,
  opts: { checked?: Record<string, boolean>; overrides?: Record<string, number>; removed?: string[]; title?: string } = {},
): string {
  const lines: string[] = [opts.title ?? (lang === 'es' ? 'Lista de compras — FITAI PRO' : 'Shopping list — FITAI PRO'), ''];
  for (const it of items) {
    if (opts.removed?.includes(it.foodId)) continue;
    const food = getFood(it.foodId);
    const grams = opts.overrides?.[it.foodId] ?? it.buyGrams;
    const qty = food.unit && opts.overrides?.[it.foodId] === undefined
      ? `${it.units} × ${food.unit[lang]} (~${grams} g)`
      : `${grams} g (${stateLabel(it.state, lang)})`;
    const mark = opts.checked?.[it.foodId] ? '☑' : '☐';
    lines.push(`${mark} ${food.name[lang]}: ${qty}`);
  }
  return lines.join('\n');
}
