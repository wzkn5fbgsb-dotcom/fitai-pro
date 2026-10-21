// GENERADO desde src/core por scripts/sync-functions.ts — no editar aquí.
// Estimación del gasto energético. Fórmulas transparentes; los resultados son
// ESTIMACIONES, no mediciones.
import type { CardioIntensity, JobActivity, Sex, UserProfile } from './types.ts';

/** Mifflin-St Jeor (1990). Sin sexo declarado se usa el promedio de ambas constantes. */
export function mifflinStJeor(weightKg: number, heightCm: number, age: number, sex: Sex): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const s = sex === 'male' ? 5 : sex === 'female' ? -161 : (5 - 161) / 2;
  return base + s;
}

/** Factor de actividad no deportiva (incluye efecto térmico de los alimentos). */
export const JOB_FACTOR: Record<JobActivity, number> = {
  sedentary: 1.2,
  moderate: 1.35,
  demanding: 1.5,
};

export function stepsFactor(steps: number): number {
  if (steps < 5000) return 1.2;
  if (steps < 7500) return 1.3;
  if (steps < 10000) return 1.4;
  if (steps < 12500) return 1.5;
  return 1.6;
}

/** METs aproximados (Compendium of Physical Activities). */
export const STRENGTH_MET = 5.0;
export const CARDIO_MET: Record<CardioIntensity, number> = {
  light: 4.0,
  moderate: 6.0,
  vigorous: 8.0,
};

/** Energía NETA del ejercicio: (MET - 1) × kg × horas. Evita contar dos veces el basal. */
export function netExerciseKcal(met: number, weightKg: number, minutes: number): number {
  return Math.max(0, (met - 1) * weightKg * (minutes / 60));
}

export interface EnergyBreakdown {
  bmr: number;
  activityFactor: number;
  activitySource: 'steps' | 'job';
  nonExerciseKcal: number; // bmr × factor
  strengthKcalPerDay: number;
  cardioKcalPerDay: number;
  tdee: number;
  sexUnspecified: boolean;
}

export function estimateEnergy(p: UserProfile): EnergyBreakdown {
  const bmr = mifflinStJeor(p.weightKg, p.heightCm, p.age, p.sex);
  const hasSteps = typeof p.dailySteps === 'number' && p.dailySteps > 0;
  const activityFactor = hasSteps ? stepsFactor(p.dailySteps as number) : JOB_FACTOR[p.job];
  const nonExerciseKcal = bmr * activityFactor;
  const strengthWeekly = netExerciseKcal(STRENGTH_MET, p.weightKg, p.daysPerWeek * p.sessionMinutes);
  const cardioWeekly = netExerciseKcal(CARDIO_MET[p.cardioIntensity], p.weightKg, p.cardioMinutesPerWeek);
  const strengthKcalPerDay = strengthWeekly / 7;
  const cardioKcalPerDay = cardioWeekly / 7;
  return {
    bmr,
    activityFactor,
    activitySource: hasSteps ? 'steps' : 'job',
    nonExerciseKcal,
    strengthKcalPerDay,
    cardioKcalPerDay,
    tdee: nonExerciseKcal + strengthKcalPerDay + cardioKcalPerDay,
    sexUnspecified: p.sex === 'unspecified',
  };
}
