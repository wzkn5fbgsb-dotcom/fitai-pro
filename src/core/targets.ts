// Objetivos diarios de energía y macronutrientes. Todo cálculo es determinista
// y explicable; la IA nunca inventa estas cifras.
import type { Goal, Level, UserProfile } from './types.ts';
import { estimateEnergy, type EnergyBreakdown } from './energy.ts';
import { assessSafety, type SafetyAssessment } from './safety.ts';
import { bmi, clamp, round, weightAtBmi } from './units.ts';

export type StrategyCode =
  | 'deficit_rate'
  | 'deficit_capped'
  | 'deficit_floor'
  | 'surplus'
  | 'surplus_skipped_bmi'
  | 'recomp_small_deficit'
  | 'recomp_maintenance'
  | 'toning_deficit'
  | 'toning_maintenance'
  | 'strength_small_surplus'
  | 'maintenance'
  | 'endurance_fuel'
  | 'goal_changed_underweight'
  | 'conservative_cap';

export interface MacroTargets {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  waterMl: number;
}

export interface NutritionTargets extends MacroTargets {
  energy: EnergyBreakdown;
  adjustmentKcal: number; // negativo = déficit
  strategy: StrategyCode[];
  proteinPerKg: number;
  proteinReferenceKg: number;
  floorKcal: number;
  macroKcal: number; // 4P + 4C + 9F
  macroDeviationPct: number;
  manualOffsetKcal: number;
}

export type TargetsResult =
  | { ok: true; targets: NutritionTargets; safety: SafetyAssessment }
  | { ok: false; reason: 'blocked' | 'nutrition_professional'; safety: SafetyAssessment };

const PROTEIN_PER_KG: Record<Goal, number> = {
  fat_loss: 2.0,
  muscle_gain: 1.8,
  recomposition: 2.0,
  toning: 1.8,
  strength: 1.8,
  endurance: 1.4,
  maintenance: 1.6,
};

const FAT_PCT: Record<Goal, number> = {
  fat_loss: 0.27,
  muscle_gain: 0.27,
  recomposition: 0.27,
  toning: 0.28,
  strength: 0.28,
  endurance: 0.25,
  maintenance: 0.3,
};

const SURPLUS_BY_LEVEL: Record<Level, number> = {
  beginner: 300,
  intermediate: 250,
  advanced: 150,
};

export function calorieFloor(sex: UserProfile['sex'], bmr: number): number {
  const sexFloor = sex === 'male' ? 1500 : sex === 'female' ? 1200 : 1350;
  return Math.max(sexFloor, Math.round(bmr));
}

/**
 * Calcula los objetivos diarios.
 * @param manualOffsetKcal ajuste aceptado por el usuario tras una revisión (positivo o negativo).
 */
export function computeTargets(p: UserProfile, manualOffsetKcal = 0): TargetsResult {
  const safety = assessSafety(p);
  if (!safety.allowed) return { ok: false, reason: 'blocked', safety };
  if (safety.nutritionMode === 'none') return { ok: false, reason: 'nutrition_professional', safety };

  const energy = estimateEnergy(p);
  const tdee = energy.tdee;
  const currentBmi = bmi(p.weightKg, p.heightCm);
  const floorKcal = calorieFloor(p.sex, energy.bmr);
  const strategy: StrategyCode[] = [];
  const goal = safety.effectiveGoal;
  if (goal !== p.goal) strategy.push('goal_changed_underweight');

  let adj = 0;
  switch (goal) {
    case 'fat_loss': {
      // 0.5 % del peso por semana (0.75 % si IMC ≥ 30). 7700 kcal ≈ 1 kg de tejido.
      const rate = currentBmi >= 30 ? 0.0075 : 0.005;
      const byRate = (p.weightKg * rate * 7700) / 7;
      const cap = Math.min(tdee * safety.maxDeficitFraction, 750);
      adj = -Math.max(250, Math.min(byRate, cap));
      if (cap < byRate) strategy.push('deficit_capped');
      else strategy.push('deficit_rate');
      if (safety.nutritionMode === 'conservative') strategy.push('conservative_cap');
      break;
    }
    case 'muscle_gain': {
      if (currentBmi >= 27) {
        adj = 0;
        strategy.push('surplus_skipped_bmi');
      } else {
        adj = SURPLUS_BY_LEVEL[p.level];
        strategy.push('surplus');
      }
      break;
    }
    case 'recomposition': {
      if (currentBmi >= 25) {
        adj = -Math.min(tdee * 0.1, 300);
        strategy.push('recomp_small_deficit');
      } else {
        adj = 0;
        strategy.push('recomp_maintenance');
      }
      break;
    }
    case 'toning': {
      if (currentBmi >= 25) {
        adj = -Math.min(tdee * 0.15, 500);
        strategy.push('toning_deficit');
      } else {
        adj = 0;
        strategy.push('toning_maintenance');
      }
      break;
    }
    case 'strength': {
      adj = currentBmi >= 27 ? 0 : 150;
      strategy.push(adj > 0 ? 'strength_small_surplus' : 'maintenance');
      break;
    }
    case 'endurance':
      adj = 0;
      strategy.push('endurance_fuel');
      break;
    case 'maintenance':
      adj = 0;
      strategy.push('maintenance');
      break;
  }

  // El déficit nunca supera el máximo permitido por la evaluación de seguridad.
  if (adj < 0) adj = -Math.min(-adj, tdee * safety.maxDeficitFraction);
  // El ajuste manual (revisión semanal) se suma, pero respetando los límites.
  const offset = clamp(manualOffsetKcal, -500, 500);
  let kcal = tdee + adj + offset;
  if (kcal < floorKcal) {
    kcal = floorKcal;
    strategy.push('deficit_floor');
  }
  // Nunca más de 20 % por encima del gasto estimado.
  kcal = Math.min(kcal, tdee * 1.2);
  kcal = round(kcal, 10);

  // Proteína: con IMC ≥ 30 se calcula sobre el peso de referencia a IMC 25
  // para no producir cifras excesivas.
  const proteinPerKg = PROTEIN_PER_KG[goal];
  const proteinReferenceKg = currentBmi >= 30 ? weightAtBmi(25, p.heightCm) : p.weightKg;
  let proteinG = Math.min(proteinPerKg * proteinReferenceKg, 2.4 * p.weightKg);
  // La proteína no debería superar ~35 % de la energía.
  proteinG = Math.min(proteinG, (kcal * 0.35) / 4);
  proteinG = Math.round(proteinG);

  let fatG = Math.max((kcal * FAT_PCT[goal]) / 9, 0.6 * proteinReferenceKg);
  fatG = Math.max(fatG, (kcal * 0.2) / 9);
  fatG = Math.round(fatG);

  let carbsG = Math.round((kcal - proteinG * 4 - fatG * 9) / 4);
  if (carbsG < 50) {
    // Muy poca energía restante: se reduce la grasa hasta 20 % de la energía.
    fatG = Math.round((kcal * 0.2) / 9);
    carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));
  }

  const fiberG = Math.max(25, Math.round((kcal / 1000) * 14));
  const trainingHoursPerDay = (p.daysPerWeek * p.sessionMinutes + p.cardioMinutesPerWeek) / 60 / 7;
  const waterMl = round(35 * p.weightKg + 500 * trainingHoursPerDay, 50);

  const macroKcal = proteinG * 4 + carbsG * 4 + fatG * 9;
  const macroDeviationPct = Math.abs(macroKcal - kcal) / kcal;

  return {
    ok: true,
    safety,
    targets: {
      kcal,
      proteinG,
      carbsG,
      fatG,
      fiberG,
      waterMl,
      energy,
      adjustmentKcal: Math.round(kcal - tdee),
      strategy,
      proteinPerKg,
      proteinReferenceKg: Math.round(proteinReferenceKg),
      floorKcal,
      macroKcal,
      macroDeviationPct,
      manualOffsetKcal: offset,
    },
  };
}

/** Comprueba que unas cifras de macros son coherentes con la energía (±tolerance). */
export function macrosConsistent(t: MacroTargets, tolerance = 0.03): boolean {
  const k = t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9;
  return Math.abs(k - t.kcal) / t.kcal <= tolerance;
}
