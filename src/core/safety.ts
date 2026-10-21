// Evaluación de seguridad. Decide qué partes del plan se pueden generar
// automáticamente y cuáles requieren orientación profesional.
import type { Goal, UserProfile } from './types.ts';
import { bmi } from './units.ts';

/**
 * - full: objetivos numéricos completos.
 * - conservative: objetivos numéricos, pero sin déficits agresivos (máx. 15 %).
 * - none: no se generan calorías ni macronutrientes; se orienta a un profesional.
 */
export type NutritionMode = 'full' | 'conservative' | 'none';
export type TrainingMode = 'full' | 'conservative' | 'none';

export type SafetyFlagCode =
  | 'minor'
  | 'pregnancy'
  | 'eating_disorder_history'
  | 'eating_disorder_unanswered'
  | 'kidney'
  | 'medical_condition'
  | 'underweight'
  | 'target_underweight'
  | 'older_adult'
  | 'injury'
  | 'exercise_restriction';

export interface SafetyFlag {
  code: SafetyFlagCode;
  severity: 'info' | 'caution' | 'block';
}

export interface SafetyAssessment {
  allowed: boolean; // false => no se genera ningún plan
  nutritionMode: NutritionMode;
  trainingMode: TrainingMode;
  /** Objetivo efectivo (p. ej., pérdida de grasa con IMC bajo se convierte en mantenimiento). */
  effectiveGoal: Goal;
  maxDeficitFraction: number; // fracción máxima del gasto que se puede restar
  flags: SafetyFlag[];
  recommendProfessional: boolean;
}

export const MIN_AGE = 18;

export function assessSafety(p: UserProfile): SafetyAssessment {
  const flags: SafetyFlag[] = [];
  let nutritionMode: NutritionMode = 'full';
  let trainingMode: TrainingMode = 'full';
  let effectiveGoal: Goal = p.goal;
  let maxDeficitFraction = 0.25;

  const downgradeNutrition = (m: NutritionMode) => {
    const order: NutritionMode[] = ['full', 'conservative', 'none'];
    if (order.indexOf(m) > order.indexOf(nutritionMode)) nutritionMode = m;
  };
  const downgradeTraining = (m: TrainingMode) => {
    const order: TrainingMode[] = ['full', 'conservative', 'none'];
    if (order.indexOf(m) > order.indexOf(trainingMode)) trainingMode = m;
  };

  if (!Number.isFinite(p.age) || p.age < MIN_AGE) {
    flags.push({ code: 'minor', severity: 'block' });
    return {
      allowed: false,
      nutritionMode: 'none',
      trainingMode: 'none',
      effectiveGoal: 'maintenance',
      maxDeficitFraction: 0,
      flags,
      recommendProfessional: true,
    };
  }

  const h = p.health;
  if (h.pregnantOrBreastfeeding === 'yes') {
    flags.push({ code: 'pregnancy', severity: 'caution' });
    downgradeNutrition('none');
    downgradeTraining('conservative');
  }
  if (h.eatingDisorderHistory === 'yes') {
    flags.push({ code: 'eating_disorder_history', severity: 'caution' });
    downgradeNutrition('none');
  } else if (h.eatingDisorderHistory === 'prefer_not') {
    flags.push({ code: 'eating_disorder_unanswered', severity: 'info' });
    downgradeNutrition('conservative');
  }
  if (h.conditions.includes('kidney')) {
    flags.push({ code: 'kidney', severity: 'caution' });
    downgradeNutrition('none');
  }
  if (h.conditions.some((c) => c !== 'kidney')) {
    flags.push({ code: 'medical_condition', severity: 'caution' });
    downgradeNutrition('conservative');
    downgradeTraining('conservative');
  }
  if (h.advisedToAvoidExercise) {
    flags.push({ code: 'exercise_restriction', severity: 'block' });
    downgradeTraining('none');
  }
  if (h.injuries.length > 0) {
    flags.push({ code: 'injury', severity: 'info' });
  }
  if (p.age >= 65) {
    flags.push({ code: 'older_adult', severity: 'info' });
    downgradeTraining('conservative');
    downgradeNutrition('conservative');
  }

  const currentBmi = bmi(p.weightKg, p.heightCm);
  if (currentBmi < 18.5) {
    flags.push({ code: 'underweight', severity: 'caution' });
    if (effectiveGoal === 'fat_loss' || effectiveGoal === 'toning' || effectiveGoal === 'recomposition') {
      effectiveGoal = 'maintenance';
    }
    maxDeficitFraction = 0;
  }
  if (p.targetWeightKg !== undefined && bmi(p.targetWeightKg, p.heightCm) < 18.5) {
    flags.push({ code: 'target_underweight', severity: 'caution' });
  }

  // (las funciones auxiliares modifican nutritionMode; se relee para TypeScript)
  const finalMode = nutritionMode as NutritionMode;
  if (finalMode === 'conservative') maxDeficitFraction = Math.min(maxDeficitFraction, 0.15);
  if (finalMode === 'none') maxDeficitFraction = 0;

  const recommendProfessional = flags.some((f) => f.severity !== 'info') || finalMode !== 'full';

  return {
    allowed: true,
    nutritionMode: finalMode,
    trainingMode: trainingMode as TrainingMode,
    effectiveGoal,
    maxDeficitFraction,
    flags,
    recommendProfessional,
  };
}

// --- Detección de señales de riesgo en texto libre (chat) -------------------
// Lista deliberadamente amplia: ante la duda, el coach no da consejos dietéticos
// y orienta a ayuda profesional.
const RISK_PATTERNS: RegExp[] = [
  /vomit/i,
  /purg/i,
  /laxante|laxative/i,
  /diur[eé]tic/i,
  /no\s+com(er|o)\s+(nada|en\s+\d+\s+d[ií]as)/i,
  /dejar\s+de\s+comer|stop\s+eating/i,
  /stop\s+eating|not\s+eat(ing)?\s+(anything|for\s+\d+\s+days)/i,
  /ayun(o|ar)\s+(de\s+)?\d+\s+d[ií]as/i,
  /fast(ing)?\s+for\s+\d+\s+days/i,
  /(500|600|700|800)\s*(kcal|calor)/i,
  /me\s+odio|i\s+hate\s+(myself|my\s+body)/i,
  /atrac[oó]n|binge/i,
  /deshidrat|dehydrat/i,
  /esteroid|steroid|clenbuterol|sarm/i,
  /hacerme\s+da[ñn]o|hurt\s+myself|suicid|self[-\s]?harm|autolesi/i,
];

export function detectRiskSignals(text: string): boolean {
  return RISK_PATTERNS.some((r) => r.test(text));
}
