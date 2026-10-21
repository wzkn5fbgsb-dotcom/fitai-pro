// Creación y validación del perfil. Devuelve códigos de error traducibles.
import type { UserProfile } from './types.ts';

export type ProfileError =
  | 'age_range'
  | 'height_range'
  | 'weight_range'
  | 'target_weight_range'
  | 'days_range'
  | 'session_range'
  | 'meals_range'
  | 'steps_range'
  | 'cardio_range'
  | 'sleep_range';

export function validateProfile(p: UserProfile): ProfileError[] {
  const e: ProfileError[] = [];
  const num = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
  if (!num(p.age) || p.age < 13 || p.age > 100) e.push('age_range');
  if (!num(p.heightCm) || p.heightCm < 120 || p.heightCm > 230) e.push('height_range');
  if (!num(p.weightKg) || p.weightKg < 30 || p.weightKg > 300) e.push('weight_range');
  if (p.targetWeightKg !== undefined && (!num(p.targetWeightKg) || p.targetWeightKg < 30 || p.targetWeightKg > 300)) e.push('target_weight_range');
  if (!num(p.daysPerWeek) || p.daysPerWeek < 1 || p.daysPerWeek > 7) e.push('days_range');
  if (!num(p.sessionMinutes) || p.sessionMinutes < 20 || p.sessionMinutes > 120) e.push('session_range');
  if (!num(p.mealsPerDay) || p.mealsPerDay < 3 || p.mealsPerDay > 5) e.push('meals_range');
  if (p.dailySteps !== undefined && (!num(p.dailySteps) || p.dailySteps < 0 || p.dailySteps > 50000)) e.push('steps_range');
  if (!num(p.cardioMinutesPerWeek) || p.cardioMinutesPerWeek < 0 || p.cardioMinutesPerWeek > 1500) e.push('cardio_range');
  if (p.sleepHours !== undefined && (!num(p.sleepHours) || p.sleepHours < 2 || p.sleepHours > 14)) e.push('sleep_range');
  return e;
}

export function defaultProfile(now = new Date().toISOString()): UserProfile {
  return {
    version: 1,
    lang: 'es',
    units: 'imperial',
    country: 'US',
    age: 30,
    sex: 'unspecified',
    heightCm: 170,
    weightKg: 75,
    goal: 'fat_loss',
    level: 'beginner',
    monthsTraining: 0,
    daysPerWeek: 3,
    sessionMinutes: 60,
    location: 'gym',
    equipment: [],
    preferredExercises: [],
    excludedExercises: [],
    job: 'sedentary',
    cardioMinutesPerWeek: 0,
    cardioIntensity: 'moderate',
    diet: 'omnivore',
    allergens: [],
    excludedFoods: [],
    favoriteFoods: [],
    budget: 'medium',
    cookingTime: 'some',
    mealsPerDay: 3,
    prepStyle: 'daily',
    health: {
      pregnantOrBreastfeeding: 'no',
      eatingDisorderHistory: 'no',
      conditions: [],
      injuries: [],
      advisedToAvoidExercise: false,
    },
    createdAt: now,
    updatedAt: now,
  };
}
