// Genera y modifica el plan de comidas EN EL SERVIDOR, según la membresía.
// - free: objetivos + vista previa (una comida de ejemplo)
// - pro / elite: menú semanal completo, sustituciones y cambios de receta
import {
  can,
  computeTargets,
  generateWeekPlan,
  hashString,
  replaceMealInDay,
  replaceMealRecipe,
  restrictionsOf,
  substituteIngredient,
  type WeekPlan,
} from '../_shared/core/index.ts';
import { adminClient, cors, currentPlan, json, logError, requireUser } from '../_shared/http.ts';
import { loadUserData } from '../_shared/context.ts';

type Body =
  | { action: 'generate'; seed?: number }
  | { action: 'substitute'; dayIndex: number; slotId: string; fromFoodId: string; toFoodId: string }
  | { action: 'replace_recipe'; dayIndex: number; slotId: string; recipeId: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const auth = await requireUser(req);
  if ('error' in auth) return auth.error;
  const userId = auth.user.id;
  const admin = adminClient();

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const today = new Date().toISOString().slice(0, 10);
  const data = await loadUserData(admin, userId, today);
  if (!data) return json({ error: 'no_profile' }, 409);
  const targets = computeTargets(data.profile, data.offsetKcal);
  if (!targets.ok) return json({ error: targets.reason }, 422);
  const plan = await currentPlan(admin, userId);
  const r = restrictionsOf(data.profile);

  try {
    let week: WeekPlan;
    let kind: 'week' | 'preview';
    if (body.action === 'generate') {
      const seed = Number.isInteger(body.seed) ? (body.seed as number) : hashString(`${userId}|${today}`);
      if (can(plan, 'weekly_meal_plan')) {
        week = generateWeekPlan({ profile: data.profile, targets: targets.targets, seed });
        kind = 'week';
      } else {
        const one = generateWeekPlan({ profile: data.profile, targets: targets.targets, seed, days: 1 });
        week = { ...one, days: [{ ...one.days[0], meals: one.days[0].meals.slice(0, 1) }] };
        kind = 'preview';
      }
    } else {
      if (!can(plan, 'meal_substitution')) return json({ error: 'upgrade_required', feature: 'meal_substitution' }, 403);
      if (!data.weekPlan) return json({ error: 'no_plan' }, 409);
      const day = data.weekPlan.days[body.dayIndex];
      const meal = day?.meals.find((m) => m.slotId === body.slotId);
      if (!day || !meal) return json({ error: 'not_found' }, 404);
      const next =
        body.action === 'substitute'
          ? substituteIngredient(meal, body.fromFoodId, body.toFoodId, r)
          : replaceMealRecipe(meal, body.recipeId, r);
      week = { ...data.weekPlan, days: data.weekPlan.days.map((d) => (d.dayIndex === day.dayIndex ? replaceMealInDay(d, meal.slotId, next, targets.targets) : d)) };
      kind = 'week';
    }
    await admin.from('nutrition_plans').update({ active: false }).eq('user_id', userId).eq('active', true);
    const { error } = await admin.from('nutrition_plans').insert({ user_id: userId, kind, targets: targets.targets, week, active: true });
    if (error) throw error;
    return json({ kind, plan, week });
  } catch (e) {
    await logError(admin, userId, 'nutrition-plan', e instanceof Error ? e.message.slice(0, 60) : 'unknown');
    return json({ error: 'invalid_request' }, 400);
  }
});
