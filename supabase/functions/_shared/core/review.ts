// GENERADO desde src/core por scripts/sync-functions.ts — no editar aquí.
// Revisión semanal y ajustes basados en TENDENCIAS de varias semanas.
// Nunca se cambian las calorías por una medición aislada; el usuario acepta,
// rechaza o modifica cada propuesta.
import type { Goal, Level } from './types.ts';

export interface WeightEntry {
  date: string; // YYYY-MM-DD
  weightKg: number;
}

export interface CheckIn {
  weekStart: string; // YYYY-MM-DD
  workoutsCompleted: number;
  workoutsPlanned: number;
  dietAdherence: 1 | 2 | 3 | 4 | 5;
  energy: 1 | 2 | 3 | 4 | 5;
  recovery: 1 | 2 | 3 | 4 | 5;
  hunger: 1 | 2 | 3 | 4 | 5; // 5 = hambre excesiva
  discomfort: boolean;
  discomfortNote?: string;
}

export interface Trend {
  days: number; // días cubiertos
  entries: number;
  slopeKgPerWeek: number;
  pctPerWeek: number; // relativo al peso medio
  meanKg: number;
  sufficient: boolean;
}

const DAY_MS = 86400000;

/** Regresión lineal sobre las últimas `windowDays` jornadas. */
export function weightTrend(entries: WeightEntry[], windowDays = 21, today?: string): Trend {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const end = today ? Date.parse(today) : sorted.length ? Date.parse(sorted[sorted.length - 1].date) : Date.now();
  const recent = sorted.filter((e) => end - Date.parse(e.date) <= windowDays * DAY_MS && Date.parse(e.date) <= end);
  if (recent.length < 2) {
    return { days: 0, entries: recent.length, slopeKgPerWeek: 0, pctPerWeek: 0, meanKg: recent[0]?.weightKg ?? 0, sufficient: false };
  }
  const t0 = Date.parse(recent[0].date);
  const xs = recent.map((e) => (Date.parse(e.date) - t0) / DAY_MS);
  const ys = recent.map((e) => e.weightKg);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slopePerDay = den > 0 ? num / den : 0;
  const days = xs[xs.length - 1];
  return {
    days,
    entries: recent.length,
    slopeKgPerWeek: slopePerDay * 7,
    pctPerWeek: my > 0 ? (slopePerDay * 7) / my : 0,
    meanKg: my,
    // Mínimo dos semanas y 6 pesajes para considerar la tendencia.
    sufficient: days >= 14 && recent.length >= 6,
  };
}

/** Rango esperado de cambio semanal (fracción del peso) según el objetivo. */
export function expectedRange(goal: Goal, level: Level, inDeficit: boolean): [number, number] {
  switch (goal) {
    case 'fat_loss':
      return [-0.01, -0.0025];
    case 'muscle_gain':
      return level === 'beginner' ? [0.001, 0.005] : level === 'intermediate' ? [0.0005, 0.0035] : [0.0, 0.0025];
    case 'toning':
    case 'recomposition':
      return inDeficit ? [-0.0075, -0.001] : [-0.0025, 0.0025];
    default:
      return [-0.0025, 0.0025];
  }
}

export type CalorieReason =
  | 'insufficient_data'
  | 'low_adherence'
  | 'on_track'
  | 'too_slow_loss'
  | 'too_fast_loss'
  | 'too_slow_gain'
  | 'too_fast_gain'
  | 'drifting_up'
  | 'drifting_down'
  | 'low_energy_hunger'
  | 'recent_adjustment';

export type TrainingReason = 'none' | 'discomfort' | 'low_recovery' | 'low_completion';

export interface ReviewProposal {
  calorieDeltaKcal: number; // 0 = sin cambio
  calorieReason: CalorieReason;
  training: TrainingReason[];
  suggestFewerDays: boolean;
  suggestDeload: boolean;
  trend: Trend;
  expected: [number, number];
}

export interface ReviewInput {
  goal: Goal;
  level: Level;
  inDeficit: boolean;
  weights: WeightEntry[];
  checkIn: CheckIn;
  lastAdjustmentDate?: string; // YYYY-MM-DD
  today: string; // YYYY-MM-DD
}

export function weeklyReview(input: ReviewInput): ReviewProposal {
  const trend = weightTrend(input.weights, 21, input.today);
  const expected = expectedRange(input.goal, input.level, input.inDeficit);
  const ci = input.checkIn;
  const training: TrainingReason[] = [];
  if (ci.discomfort) training.push('discomfort');
  if (ci.recovery <= 2) training.push('low_recovery');
  const completion = ci.workoutsPlanned > 0 ? ci.workoutsCompleted / ci.workoutsPlanned : 1;
  if (completion < 0.6) training.push('low_completion');
  const base = {
    training: training.length ? training : (['none'] as TrainingReason[]),
    suggestFewerDays: completion < 0.6,
    suggestDeload: ci.recovery <= 2 && ci.energy <= 2 && completion >= 0.6,
    trend,
    expected,
  };

  const daysSinceAdj = input.lastAdjustmentDate ? (Date.parse(input.today) - Date.parse(input.lastAdjustmentDate)) / DAY_MS : Infinity;

  // Señales de energía muy baja y hambre excesiva en déficit: nunca bajar más.
  if (input.inDeficit && ci.hunger >= 5 && ci.energy <= 2) {
    return { ...base, calorieDeltaKcal: 150, calorieReason: 'low_energy_hunger' };
  }
  if (!trend.sufficient) return { ...base, calorieDeltaKcal: 0, calorieReason: 'insufficient_data' };
  if (ci.dietAdherence <= 3) return { ...base, calorieDeltaKcal: 0, calorieReason: 'low_adherence' };
  if (daysSinceAdj < 14) return { ...base, calorieDeltaKcal: 0, calorieReason: 'recent_adjustment' };

  const r = trend.pctPerWeek;
  const [lo, hi] = expected;
  if (r >= lo && r <= hi) return { ...base, calorieDeltaKcal: 0, calorieReason: 'on_track' };

  switch (input.goal) {
    case 'fat_loss':
      return r > hi ? { ...base, calorieDeltaKcal: -150, calorieReason: 'too_slow_loss' } : { ...base, calorieDeltaKcal: 150, calorieReason: 'too_fast_loss' };
    case 'muscle_gain':
      return r < lo ? { ...base, calorieDeltaKcal: 150, calorieReason: 'too_slow_gain' } : { ...base, calorieDeltaKcal: -100, calorieReason: 'too_fast_gain' };
    default:
      return r > hi ? { ...base, calorieDeltaKcal: -100, calorieReason: 'drifting_up' } : { ...base, calorieDeltaKcal: 100, calorieReason: 'drifting_down' };
  }
}
