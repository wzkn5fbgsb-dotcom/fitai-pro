// GENERADO desde src/core por scripts/sync-functions.ts — no editar aquí.
// Sobrecarga progresiva por doble progresión (repeticiones → carga).
import { getExercise, type LoadType } from './data/exercises.ts';
import type { PlannedExercise } from './routine.ts';
import type { UnitSystem } from './types.ts';

export interface SetLog {
  weightKg: number | null; // null para peso corporal / banda
  reps: number;
  rir?: number; // repeticiones en reserva declaradas (0 = al fallo)
  completed: boolean;
}

export interface ExerciseLog {
  exerciseId: string;
  sets: SetLog[];
  pain: boolean;
  techniqueOk: boolean;
}

export interface SessionLog {
  id: string;
  date: string; // ISO
  dayIndex: number;
  exercises: ExerciseLog[];
  perceivedEffort?: number; // 1..10 de toda la sesión
  recoveryOk: boolean; // el usuario se sentía recuperado
  completedPct: number; // 0..1
  notes?: string;
}

export type ProgressionAction = 'increase_load' | 'add_reps' | 'hold' | 'reduce_load' | 'review_exercise' | 'no_data';

export interface ProgressionSuggestion {
  exerciseId: string;
  action: ProgressionAction;
  nextWeightKg: number | null;
  targetReps: number;
  reason:
    | 'top_of_range'
    | 'within_range'
    | 'below_range'
    | 'pain'
    | 'technique'
    | 'recovery'
    | 'too_hard'
    | 'incomplete'
    | 'first_time'
    | 'bodyweight_progression';
}

/** Incremento práctico de carga según el implemento (por lado en mancuernas). */
export function loadIncrementKg(load: LoadType, lowerBody: boolean, units: UnitSystem): number {
  if (units === 'imperial') {
    const lb = load === 'dumbbell' ? 5 : load === 'barbell' ? (lowerBody ? 10 : 5) : 5;
    return lb * 0.45359237;
  }
  if (load === 'dumbbell') return 2;
  if (load === 'barbell') return lowerBody ? 5 : 2.5;
  return 2.5;
}

const LOWER: string[] = ['squat', 'hinge', 'lunge', 'knee_flex', 'knee_ext', 'glute', 'calf'];

export function suggestProgression(
  planned: PlannedExercise,
  last: ExerciseLog | undefined,
  session: Pick<SessionLog, 'recoveryOk'> | undefined,
  units: UnitSystem = 'metric',
): ProgressionSuggestion {
  const base = { exerciseId: planned.exerciseId };
  if (!last || last.sets.length === 0) {
    return { ...base, action: 'no_data', nextWeightKg: null, targetReps: planned.repsMin, reason: 'first_time' };
  }
  const done = last.sets.filter((s) => s.completed);
  const lastWeight = done.length ? done[done.length - 1].weightKg : null;
  // La seguridad va primero: nunca se sube la carga con dolor, mala técnica o mala recuperación.
  if (last.pain) {
    return {
      ...base,
      action: 'review_exercise',
      nextWeightKg: lastWeight !== null ? round(lastWeight * 0.85) : null,
      targetReps: planned.repsMin,
      reason: 'pain',
    };
  }
  if (!last.techniqueOk) return { ...base, action: 'hold', nextWeightKg: lastWeight, targetReps: planned.repsMin, reason: 'technique' };
  if (session && !session.recoveryOk) return { ...base, action: 'hold', nextWeightKg: lastWeight, targetReps: planned.repsMin, reason: 'recovery' };
  if (done.length < planned.sets) return { ...base, action: 'hold', nextWeightKg: lastWeight, targetReps: planned.repsMin, reason: 'incomplete' };

  const minReps = Math.min(...done.map((s) => s.reps));
  const rirs = done.map((s) => s.rir).filter((r): r is number => typeof r === 'number');
  const minRir = rirs.length ? Math.min(...rirs) : planned.rirMin;
  const e = getExercise(planned.exerciseId);

  if (minReps < planned.repsMin) {
    const tooHard = minRir === 0 && minReps < planned.repsMin - 2;
    return {
      ...base,
      action: tooHard ? 'reduce_load' : 'hold',
      nextWeightKg: lastWeight !== null && tooHard ? round(lastWeight * 0.9) : lastWeight,
      targetReps: planned.repsMin,
      reason: tooHard ? 'too_hard' : 'below_range',
    };
  }
  if (minReps >= planned.repsMax && minRir >= planned.rirMin - 1) {
    if (lastWeight === null || e.load === 'bodyweight' || e.load === 'band') {
      return { ...base, action: 'add_reps', nextWeightKg: lastWeight, targetReps: planned.repsMax + 2, reason: 'bodyweight_progression' };
    }
    const inc = loadIncrementKg(e.load, LOWER.includes(e.pattern), units);
    return { ...base, action: 'increase_load', nextWeightKg: round(lastWeight + inc), targetReps: planned.repsMin, reason: 'top_of_range' };
  }
  return { ...base, action: 'add_reps', nextWeightKg: lastWeight, targetReps: Math.min(planned.repsMax, minReps + 1), reason: 'within_range' };
}

function round(x: number): number {
  return Math.round(x * 100) / 100;
}

/** Estimación de 1RM (Epley) para mostrar tendencia de fuerza; es una estimación. */
export function estimatedOneRm(weightKg: number, reps: number): number {
  if (reps <= 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export function bestSetE1rm(log: ExerciseLog): number | null {
  const vals = log.sets.filter((s) => s.completed && s.weightKg !== null && s.reps > 0).map((s) => estimatedOneRm(s.weightKg as number, s.reps));
  return vals.length ? Math.max(...vals) : null;
}
