import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weeklyReview, weightTrend, type CheckIn, type WeightEntry } from '../review.ts';
import { applyStoreEvent, can, checkAiUsage, effectivePlan, annualPrice, minimumPlanFor, type SubscriptionState } from '../plans.ts';
import { answerLocally, detectIntent, type CoachContext } from '../coach.ts';
import { detectRiskSignals, assessSafety } from '../safety.ts';
import { generateWorkoutPlan } from '../routine.ts';
import { generateWeekPlan } from '../mealplan.ts';
import { computeTargets } from '../targets.ts';
import { validateProfile } from '../profile.ts';
import { profile } from './helpers.ts';

function series(days: number, start: number, perWeek: number, noise = 0): WeightEntry[] {
  const out: WeightEntry[] = [];
  for (let d = 0; d <= days; d += 1) {
    const date = new Date(Date.UTC(2026, 8, 1 + d)).toISOString().slice(0, 10);
    out.push({ date, weightKg: start + (perWeek / 7) * d + (d % 2 ? noise : -noise) });
  }
  return out;
}

const ci = (over: Partial<CheckIn> = {}): CheckIn => ({
  weekStart: '2026-09-15',
  workoutsCompleted: 4,
  workoutsPlanned: 4,
  dietAdherence: 5,
  energy: 4,
  recovery: 4,
  hunger: 3,
  discomfort: false,
  ...over,
});

test('tendencia de peso por regresión lineal', () => {
  const t = weightTrend(series(21, 90, -0.7, 0.4), 21);
  assert.ok(t.sufficient);
  assert.ok(Math.abs(t.slopeKgPerWeek + 0.7) < 0.1, String(t.slopeKgPerWeek));
});

test('no ajusta calorías con una sola medición o pocas semanas', () => {
  const r = weeklyReview({ goal: 'fat_loss', level: 'beginner', inDeficit: true, weights: series(5, 90, 0), checkIn: ci(), today: '2026-09-06' });
  assert.equal(r.calorieDeltaKcal, 0);
  assert.equal(r.calorieReason, 'insufficient_data');
});

test('pérdida demasiado lenta con buena adherencia: -150 kcal', () => {
  const r = weeklyReview({ goal: 'fat_loss', level: 'beginner', inDeficit: true, weights: series(21, 90, 0), checkIn: ci(), today: '2026-09-22' });
  assert.equal(r.calorieDeltaKcal, -150);
  assert.equal(r.calorieReason, 'too_slow_loss');
});

test('con baja adherencia no se cambian calorías', () => {
  const r = weeklyReview({ goal: 'fat_loss', level: 'beginner', inDeficit: true, weights: series(21, 90, 0), checkIn: ci({ dietAdherence: 2 }), today: '2026-09-22' });
  assert.equal(r.calorieDeltaKcal, 0);
  assert.equal(r.calorieReason, 'low_adherence');
});

test('pérdida demasiado rápida: sube calorías', () => {
  const r = weeklyReview({ goal: 'fat_loss', level: 'beginner', inDeficit: true, weights: series(21, 90, -1.5), checkIn: ci(), today: '2026-09-22' });
  assert.equal(r.calorieDeltaKcal, 150);
});

test('hambre extrema y poca energía en déficit: nunca baja calorías', () => {
  const r = weeklyReview({ goal: 'fat_loss', level: 'beginner', inDeficit: true, weights: series(21, 90, 0), checkIn: ci({ hunger: 5, energy: 1 }), today: '2026-09-22' });
  assert.ok(r.calorieDeltaKcal > 0);
});

test('respeta 14 días desde el último ajuste', () => {
  const r = weeklyReview({ goal: 'fat_loss', level: 'beginner', inDeficit: true, weights: series(21, 90, 0), checkIn: ci(), lastAdjustmentDate: '2026-09-15', today: '2026-09-22' });
  assert.equal(r.calorieReason, 'recent_adjustment');
});

test('molestias y baja recuperación generan propuestas de entrenamiento', () => {
  const r = weeklyReview({ goal: 'muscle_gain', level: 'beginner', inDeficit: false, weights: [], checkIn: ci({ discomfort: true, recovery: 1, energy: 2, workoutsCompleted: 1 }), today: '2026-09-22' });
  assert.ok(r.training.includes('discomfort'));
  assert.ok(r.training.includes('low_recovery'));
  assert.ok(r.suggestFewerDays);
});

// --------------------------------------------------------------- membresías
test('acceso por plan', () => {
  assert.equal(can('free', 'weekly_meal_plan'), false);
  assert.equal(can('pro', 'weekly_meal_plan'), true);
  assert.equal(can('pro', 'photo_comparison'), false);
  assert.equal(can('elite', 'photo_comparison'), true);
  assert.equal(minimumPlanFor('shopping_list'), 'pro');
});

test('límites de IA: un usuario gratuito no genera costo ilimitado', () => {
  assert.equal(checkAiUsage('free', 3, 3).allowed, false);
  assert.equal(checkAiUsage('free', 0, 30).allowed, false);
  assert.equal(checkAiUsage('pro', 3, 3).allowed, true);
});

test('precio anual con descuento configurable', () => {
  assert.equal(annualPrice('pro'), 83.99);
  assert.equal(annualPrice('elite'), 167.99);
  assert.equal(annualPrice('pro', { monthlyUsd: { pro: 9.99, elite: 19.99 }, annualDiscountPct: 20 }), 95.99);
});

test('eventos de la tienda → estado de suscripción', () => {
  const now = Date.parse('2026-10-01T00:00:00Z');
  const exp = Date.parse('2026-11-01T00:00:00Z');
  let s: SubscriptionState = { plan: 'free', status: 'expired', expiresAt: null, willRenew: false };
  s = applyStoreEvent(s, { type: 'INITIAL_PURCHASE', entitlementIds: ['pro'], expirationAtMs: exp, nowMs: now });
  assert.equal(effectivePlan(s, now), 'pro');
  s = applyStoreEvent(s, { type: 'CANCELLATION', entitlementIds: ['pro'], expirationAtMs: exp, nowMs: now });
  assert.equal(effectivePlan(s, now), 'pro', 'cancelada conserva acceso hasta expirar');
  assert.equal(s.willRenew, false);
  assert.equal(effectivePlan(s, exp + 1000), 'free', 'después de expirar pasa a gratis');
  s = applyStoreEvent(s, { type: 'PRODUCT_CHANGE', entitlementIds: ['elite'], expirationAtMs: exp, nowMs: now });
  assert.equal(effectivePlan(s, now), 'elite');
  s = applyStoreEvent(s, { type: 'EXPIRATION', entitlementIds: [], expirationAtMs: exp, nowMs: exp });
  assert.equal(effectivePlan(s, now), 'free');
  assert.equal(effectivePlan(null, now), 'free');
});

// ------------------------------------------------------------- seguridad/coach
test('detección de señales de riesgo', () => {
  assert.ok(detectRiskSignals('quiero vomitar después de comer'));
  assert.ok(detectRiskSignals('can I eat 800 kcal a day'));
  assert.ok(detectRiskSignals('ayunar 5 días'));
  assert.ok(!detectRiskSignals('qué entreno hoy'));
});

test('validación del perfil', () => {
  assert.deepEqual(validateProfile(profile()), []);
  assert.ok(validateProfile(profile({ heightCm: 50 })).includes('height_range'));
  assert.ok(validateProfile(profile({ daysPerWeek: 9 })).includes('days_range'));
  assert.equal(assessSafety(profile({ age: 17 })).allowed, false);
});

function ctx(): CoachContext {
  const p = profile();
  const t = computeTargets(p);
  if (!t.ok) throw new Error();
  return {
    lang: 'es',
    profile: p,
    workoutPlan: generateWorkoutPlan(p),
    nextWorkoutDayIndex: 0,
    weekPlan: generateWeekPlan({ profile: p, targets: t.targets }),
    todayPlanDay: 0,
    consumedToday: { kcal: 900, protein: 70 },
    proteinTargetG: t.targets.proteinG,
    kcalTarget: t.targets.kcal,
    weights: [],
    lastChange: null,
    today: '2026-10-20',
  };
}

test('coach: intenciones reconocidas', () => {
  assert.equal(detectIntent('¿Qué entreno hoy?'), 'today_workout');
  assert.equal(detectIntent('¿Cuántas proteínas llevo consumidas?'), 'protein_today');
  assert.equal(detectIntent('¿Qué puedo comer si no tengo pollo?'), 'substitute_food');
  assert.equal(detectIntent('¿Qué hago si no puedo ir al gimnasio?'), 'no_gym');
  assert.equal(detectIntent('¿Qué ingredientes necesito para mañana?'), 'ingredients_tomorrow');
  assert.equal(detectIntent('¿Cómo voy respecto a mi objetivo?'), 'progress');
  assert.equal(detectIntent('¿Por qué cambió mi rutina?'), 'why_changed');
  assert.equal(detectIntent('¿Qué cocino con lo que tengo en el refrigerador? huevo y arroz'), 'fridge');
  assert.equal(detectIntent('What should I train today?'), 'today_workout');
  assert.equal(detectIntent('Cuéntame un chiste'), 'unknown');
});

test('coach: responde con datos reales y no inventa', () => {
  const c = ctx();
  const prot = answerLocally('¿Cuántas proteínas llevo?', c);
  assert.ok(prot.text.includes('70 g'));
  const none = answerLocally('¿Cuántas proteínas llevo?', { ...c, consumedToday: null });
  assert.ok(none.text.includes('no has marcado'));
  const sub = answerLocally('No tengo pollo', c);
  assert.ok(sub.handled && !sub.text.toLowerCase().includes('pechuga de pollo sin piel,'));
  const risk = answerLocally('quiero dejar de comer por 5 días', c);
  assert.equal(risk.intent, 'risk');
  assert.ok(risk.text.includes('988'));
  assert.equal(answerLocally('Cuéntame un chiste', c).handled, false);
});
