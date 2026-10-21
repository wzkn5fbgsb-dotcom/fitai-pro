// GENERADO desde src/core por scripts/sync-functions.ts — no editar aquí.
// Generador de rutinas. Reglas explícitas (no aleatorias): división según días
// disponibles y nivel, patrones de movimiento por sesión, filtros por equipo y
// lesiones, presupuesto de tiempo y volumen semanal por músculo.
import { EXERCISES, getExercise, type Exercise, type Muscle, type Pattern } from './data/exercises.ts';
import { assessSafety } from './safety.ts';
import { ALL_EQUIPMENT, type Equipment, type Goal, type Level, type UserProfile } from './types.ts';
import { clamp } from './units.ts';

export type DayType = 'full_a' | 'full_b' | 'full_c' | 'upper' | 'lower' | 'push' | 'pull' | 'legs' | 'cardio' | 'mobility';
export type SplitCode = 'full_body' | 'upper_lower' | 'upper_lower_ppl' | 'ppl' | 'full_body_cardio' | 'upper_lower_cardio';

export type RoutineNote =
  | 'beginner_capped'
  | 'seven_days_rest'
  | 'injury_modified'
  | 'missing_equipment'
  | 'conservative'
  | 'deload'
  | 'not_treatment'
  | 'endurance_focus'
  | 'short_sessions';

export interface PlannedExercise {
  exerciseId: string;
  pattern: Pattern;
  main: boolean;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSec: number;
  rirMin: number;
  rirMax: number;
  alternatives: string[];
}

export interface WorkoutDay {
  index: number;
  dayType: DayType;
  exercises: PlannedExercise[];
  estMinutes: number;
  cardio?: { minutes: number; intensity: 'light' | 'moderate' };
}

export interface CardioPlan {
  sessionsPerWeek: number;
  minutesPerSession: number;
  intensity: 'light' | 'moderate' | 'vigorous';
  weeklyProgressionPct: number; // 0 si no hay progresión
}

export interface WorkoutPlan {
  version: 1;
  generatedAt: string;
  split: SplitCode;
  days: WorkoutDay[];
  weeklySets: Partial<Record<Muscle, number>>;
  cardio: CardioPlan;
  notes: RoutineNote[];
  deloadEveryWeeks: number | null;
}

type Slot = { pattern: Pattern; main: boolean };

const DAY_SLOTS: Record<Exclude<DayType, 'cardio' | 'mobility'>, Slot[]> = {
  full_a: [
    { pattern: 'squat', main: true },
    { pattern: 'h_push', main: true },
    { pattern: 'h_pull', main: true },
    { pattern: 'hinge', main: false },
    { pattern: 'lat_delt', main: false },
    { pattern: 'core', main: false },
  ],
  full_b: [
    { pattern: 'hinge', main: true },
    { pattern: 'v_push', main: true },
    { pattern: 'v_pull', main: true },
    { pattern: 'lunge', main: false },
    { pattern: 'biceps', main: false },
    { pattern: 'triceps', main: false },
  ],
  full_c: [
    { pattern: 'squat', main: true },
    { pattern: 'h_push', main: true },
    { pattern: 'h_pull', main: true },
    { pattern: 'glute', main: false },
    { pattern: 'rear_delt', main: false },
    { pattern: 'core', main: false },
  ],
  upper: [
    { pattern: 'h_push', main: true },
    { pattern: 'h_pull', main: true },
    { pattern: 'v_push', main: false },
    { pattern: 'v_pull', main: false },
    { pattern: 'lat_delt', main: false },
    { pattern: 'biceps', main: false },
    { pattern: 'triceps', main: false },
  ],
  lower: [
    { pattern: 'squat', main: true },
    { pattern: 'hinge', main: true },
    { pattern: 'lunge', main: false },
    { pattern: 'knee_flex', main: false },
    { pattern: 'knee_ext', main: false },
    { pattern: 'calf', main: false },
    { pattern: 'core', main: false },
  ],
  push: [
    { pattern: 'h_push', main: true },
    { pattern: 'v_push', main: true },
    { pattern: 'h_push', main: false },
    { pattern: 'lat_delt', main: false },
    { pattern: 'triceps', main: false },
  ],
  pull: [
    { pattern: 'v_pull', main: true },
    { pattern: 'h_pull', main: true },
    { pattern: 'h_pull', main: false },
    { pattern: 'rear_delt', main: false },
    { pattern: 'biceps', main: false },
    { pattern: 'core', main: false },
  ],
  legs: [
    { pattern: 'squat', main: true },
    { pattern: 'hinge', main: true },
    { pattern: 'lunge', main: false },
    { pattern: 'knee_flex', main: false },
    { pattern: 'knee_ext', main: false },
    { pattern: 'calf', main: false },
  ],
};

const FALLBACK: Partial<Record<Pattern, Pattern[]>> = {
  squat: ['lunge', 'glute'],
  hinge: ['glute'],
  lunge: ['glute', 'squat'],
  knee_flex: ['glute'],
  knee_ext: ['lunge'],
  v_pull: ['h_pull'],
  h_pull: ['v_pull'],
  v_push: ['h_push'],
  rear_delt: ['h_pull'],
};

export function chooseSplit(p: Pick<UserProfile, 'daysPerWeek' | 'level' | 'goal'>): { split: SplitCode; days: DayType[]; notes: RoutineNote[] } {
  const notes: RoutineNote[] = [];
  let days = clamp(Math.round(p.daysPerWeek), 1, 7);
  if (days === 7) {
    days = 6;
    notes.push('seven_days_rest');
  }
  if (p.goal === 'endurance') {
    notes.push('endurance_focus');
    const strength = days <= 2 ? days : days <= 4 ? 2 : 3;
    const fb: DayType[] = (['full_a', 'full_b', 'full_c'] as DayType[]).slice(0, strength);
    const cardio: DayType[] = Array(days - strength).fill('cardio');
    return { split: 'full_body_cardio', days: interleave(fb, cardio), notes };
  }
  const beginnerCap = p.level === 'beginner' ? 4 : 6;
  if (days > beginnerCap) {
    notes.push('beginner_capped');
    const strength = beginnerCap;
    const extra: DayType[] = Array(days - strength).fill('cardio');
    return { split: 'upper_lower_cardio', days: interleave(['upper', 'lower', 'upper', 'lower'], extra), notes };
  }
  switch (days) {
    case 1:
      return { split: 'full_body', days: ['full_a'], notes };
    case 2:
      return { split: 'full_body', days: ['full_a', 'full_b'], notes };
    case 3:
      return { split: 'full_body', days: ['full_a', 'full_b', 'full_c'], notes };
    case 4:
      return { split: 'upper_lower', days: ['upper', 'lower', 'upper', 'lower'], notes };
    case 5:
      if (p.goal === 'strength') return { split: 'upper_lower', days: ['upper', 'lower', 'upper', 'lower', 'full_a'], notes };
      return { split: 'upper_lower_ppl', days: ['upper', 'lower', 'push', 'pull', 'legs'], notes };
    default:
      if (p.goal === 'strength') return { split: 'upper_lower', days: ['upper', 'lower', 'upper', 'lower', 'upper', 'lower'], notes };
      return { split: 'ppl', days: ['push', 'pull', 'legs', 'push', 'pull', 'legs'], notes };
  }
}

function interleave(a: DayType[], b: DayType[]): DayType[] {
  const out: DayType[] = [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

interface Scheme {
  main: { repsMin: number; repsMax: number; restSec: number };
  acc: { repsMin: number; repsMax: number; restSec: number };
  rirMin: number;
  rirMax: number;
}

export function repScheme(goal: Goal, level: Level, conservative: boolean): Scheme {
  let s: Scheme;
  if (goal === 'strength') {
    s = { main: { repsMin: 3, repsMax: 6, restSec: 180 }, acc: { repsMin: 6, repsMax: 10, restSec: 120 }, rirMin: 2, rirMax: 3 };
    if (level === 'beginner') s.main = { repsMin: 5, repsMax: 8, restSec: 150 };
  } else if (goal === 'endurance') {
    s = { main: { repsMin: 10, repsMax: 15, restSec: 75 }, acc: { repsMin: 12, repsMax: 20, restSec: 60 }, rirMin: 2, rirMax: 3 };
  } else {
    s = { main: { repsMin: 6, repsMax: 10, restSec: 120 }, acc: { repsMin: 10, repsMax: 15, restSec: 75 }, rirMin: 1, rirMax: 3 };
  }
  if (level === 'beginner') {
    s.rirMin = Math.max(s.rirMin, 2);
    s.rirMax = Math.max(s.rirMax, 3);
  }
  if (conservative) {
    s.rirMin = 3;
    s.rirMax = 4;
    if (s.main.repsMin < 6) s.main = { repsMin: 6, repsMax: 10, restSec: 150 };
  }
  return s;
}

export function availableEquipment(p: Pick<UserProfile, 'location' | 'equipment'>): Equipment[] {
  if (p.location === 'gym' || p.location === 'both') return ALL_EQUIPMENT;
  return Array.from(new Set<Equipment>([...p.equipment, 'bodyweight']));
}

export interface ExerciseFilter {
  equipment: Equipment[];
  injuries: UserProfile['health']['injuries'];
  excluded: string[];
  maxDifficulty: 1 | 2 | 3;
  preferred: string[];
}

export function exerciseAllowed(e: Exercise, f: ExerciseFilter): boolean {
  if (!e.equipment.every((q) => f.equipment.includes(q))) return false;
  if (e.stress.some((a) => f.injuries.includes(a))) return false;
  if (f.excluded.includes(e.id)) return false;
  if (e.difficulty > f.maxDifficulty && !f.preferred.includes(e.id)) return false;
  return true;
}

export function alternativesFor(exerciseId: string, f: ExerciseFilter, limit = 3): string[] {
  const e = getExercise(exerciseId);
  return EXERCISES.filter((x) => x.id !== e.id && x.pattern === e.pattern && exerciseAllowed(x, f))
    .sort((a, b) => Number(a.load === e.load) - Number(b.load === e.load) || a.difficulty - b.difficulty)
    .slice(0, limit)
    .map((x) => x.id);
}

const SECONDS_PER_REP = 3.5;

function setSeconds(reps: number, restSec: number): number {
  return reps * SECONDS_PER_REP + restSec;
}

export function generateWorkoutPlan(p: UserProfile): WorkoutPlan | null {
  const safety = assessSafety(p);
  if (!safety.allowed || safety.trainingMode === 'none') return null;
  const conservative = safety.trainingMode === 'conservative';
  const { split, days, notes } = chooseSplit({ daysPerWeek: p.daysPerWeek, level: p.level, goal: safety.effectiveGoal });
  if (conservative) notes.push('conservative');
  if (p.health.injuries.length) notes.push('injury_modified', 'not_treatment');

  const filter: ExerciseFilter = {
    equipment: availableEquipment(p),
    injuries: p.health.injuries,
    excluded: p.excludedExercises,
    maxDifficulty: conservative || p.level === 'beginner' ? 2 : 3,
    preferred: p.preferredExercises,
  };
  const scheme = repScheme(safety.effectiveGoal, p.level, conservative);
  const minutes = clamp(p.sessionMinutes, 20, 120);
  if (minutes < 35) notes.push('short_sessions');
  const warmupMin = minutes <= 30 ? 5 : 8;
  const budgetSec = (minutes - warmupMin) * 60;
  const mainSets = p.level === 'beginner' || conservative ? 3 : p.level === 'intermediate' ? 3 : 4;
  const accSets = p.level === 'advanced' ? 3 : 2;

  const usedThisWeek = new Map<string, DayType>();
  const byType = new Map<DayType, PlannedExercise[]>();
  let missingEquipment = false;

  const out: WorkoutDay[] = days.map((dayType, index) => {
    if (dayType === 'cardio' || dayType === 'mobility') {
      return {
        index,
        dayType,
        exercises: [],
        estMinutes: Math.min(minutes, 45),
        cardio: { minutes: Math.min(minutes, 45), intensity: conservative ? 'light' : 'moderate' },
      };
    }
    // Días del mismo tipo repiten ejercicios: facilita la progresión de cargas.
    const repeat = byType.get(dayType);
    if (repeat) {
      return { index, dayType, exercises: repeat.map((x) => ({ ...x })), estMinutes: estimate(repeat, warmupMin) };
    }
    const today = new Set<string>();
    const planned: PlannedExercise[] = [];
    let used = 0;
    for (const slot of DAY_SLOTS[dayType]) {
      const exercise = pickExercise(slot, filter, today, usedThisWeek, dayType, p.level);
      if (!exercise) {
        missingEquipment = true;
        continue;
      }
      const rep = slot.main ? scheme.main : scheme.acc;
      let sets = slot.main ? mainSets : accSets;
      const avgReps = (rep.repsMin + rep.repsMax) / 2;
      let cost = sets * setSeconds(avgReps, rep.restSec);
      // Asegura al menos 3 ejercicios: si falta tiempo, se reducen series.
      if (used + cost > budgetSec) {
        if (planned.length < 3) {
          sets = 2;
          cost = sets * setSeconds(avgReps, rep.restSec);
          if (used + cost > budgetSec * 1.1) break;
        } else {
          continue;
        }
      }
      used += cost;
      today.add(exercise.id);
      usedThisWeek.set(exercise.id, dayType);
      planned.push({
        exerciseId: exercise.id,
        pattern: exercise.pattern,
        main: slot.main,
        sets,
        repsMin: rep.repsMin,
        repsMax: rep.repsMax,
        restSec: rep.restSec,
        rirMin: scheme.rirMin,
        rirMax: scheme.rirMax,
        alternatives: alternativesFor(exercise.id, filter),
      });
    }
    // Si sobra tiempo, se añaden series (primero a los ejercicios principales)
    // hasta un máximo razonable por ejercicio.
    const capMain = p.level === 'advanced' && !conservative ? 5 : 4;
    const capAcc = p.level === 'advanced' && !conservative ? 4 : 3;
    let added = true;
    while (added) {
      added = false;
      // Reparto equitativo: una serie más a cada ejercicio por vuelta, en orden.
      for (const pe of planned) {
        const cap = pe.main ? capMain : capAcc;
        const cost = setSeconds((pe.repsMin + pe.repsMax) / 2, pe.restSec);
        if (pe.sets < cap && used + cost <= budgetSec) {
          pe.sets += 1;
          used += cost;
          added = true;
        }
      }
    }
    byType.set(dayType, planned);
    return { index, dayType, exercises: planned, estMinutes: estimate(planned, warmupMin) };
  });

  if (missingEquipment) notes.push('missing_equipment');
  const deloadEveryWeeks = p.level === 'beginner' ? null : p.level === 'intermediate' ? 6 : 5;
  if (deloadEveryWeeks) notes.push('deload');

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    split,
    days: out,
    weeklySets: weeklySets(out),
    cardio: cardioPlan(p, safety.effectiveGoal, conservative),
    notes: Array.from(new Set(notes)),
    deloadEveryWeeks,
  };
}

function estimate(ex: PlannedExercise[], warmupMin: number): number {
  const sec = ex.reduce((a, e) => a + e.sets * setSeconds((e.repsMin + e.repsMax) / 2, e.restSec), 0);
  return Math.round(warmupMin + sec / 60);
}

function pickExercise(
  slot: Slot,
  f: ExerciseFilter,
  today: Set<string>,
  week: Map<string, DayType>,
  dayType: DayType,
  level: Level,
): Exercise | null {
  const patterns: Pattern[] = [slot.pattern, ...(FALLBACK[slot.pattern] ?? [])];
  for (const pattern of patterns) {
    const cands = EXERCISES.filter((e) => e.pattern === pattern && exerciseAllowed(e, f) && !today.has(e.id));
    if (!cands.length) continue;
    const scored = cands.map((e) => {
      let s = 0;
      if (f.preferred.includes(e.id)) s += 5;
      if (slot.main && e.compound) s += 2;
      if (level === 'beginner') s += e.difficulty === 1 ? 1.5 : 0;
      if (level === 'advanced' && slot.main && (e.load === 'barbell' || e.load === 'dumbbell')) s += 1;
      if (level !== 'beginner' && slot.main && e.load === 'barbell') s += 0.5;
      if (e.load === 'band' && f.equipment.some((q) => q === 'dumbbell' || q === 'machine' || q === 'cable')) s -= 1;
      const usedOn = week.get(e.id);
      if (usedOn && usedOn !== dayType) s -= 1.5; // variedad entre sesiones distintas
      return { e, s };
    });
    scored.sort((a, b) => b.s - a.s || a.e.id.localeCompare(b.e.id));
    return scored[0].e;
  }
  return null;
}

export function weeklySets(days: WorkoutDay[]): Partial<Record<Muscle, number>> {
  const out: Partial<Record<Muscle, number>> = {};
  for (const d of days) {
    for (const pe of d.exercises) {
      const e = getExercise(pe.exerciseId);
      out[e.primary] = (out[e.primary] ?? 0) + pe.sets;
      for (const m of e.secondary) out[m] = (out[m] ?? 0) + pe.sets * 0.5;
    }
  }
  return out;
}

function cardioPlan(p: UserProfile, goal: Goal, conservative: boolean): CardioPlan {
  if (goal === 'endurance') {
    const start = Math.max(p.cardioMinutesPerWeek, 90);
    const sessions = Math.max(2, Math.min(5, 7 - p.daysPerWeek + 2));
    return { sessionsPerWeek: sessions, minutesPerSession: Math.round(start / sessions), intensity: conservative ? 'light' : 'moderate', weeklyProgressionPct: conservative ? 5 : 10 };
  }
  if (goal === 'fat_loss' || goal === 'toning') {
    return { sessionsPerWeek: 3, minutesPerSession: 25, intensity: conservative ? 'light' : 'moderate', weeklyProgressionPct: 0 };
  }
  // Recomendación general de actividad aeróbica (OMS: 150 min/semana moderada).
  return { sessionsPerWeek: 3, minutesPerSession: 20, intensity: 'moderate', weeklyProgressionPct: 0 };
}

/** Cambia un ejercicio del plan por una alternativa y lo aplica a todos los días del mismo tipo. */
export function swapExercise(plan: WorkoutPlan, dayIndex: number, fromId: string, toId: string, f: ExerciseFilter): WorkoutPlan {
  const day = plan.days[dayIndex];
  if (!day) throw new Error('Día inexistente');
  const target = getExercise(toId);
  if (!exerciseAllowed(target, f)) throw new Error('Ejercicio no compatible con tu equipo o lesiones');
  const days = plan.days.map((d) =>
    d.dayType !== day.dayType
      ? d
      : {
          ...d,
          exercises: d.exercises.map((e) =>
            e.exerciseId === fromId ? { ...e, exerciseId: toId, pattern: target.pattern, alternatives: alternativesFor(toId, f) } : e,
          ),
        },
  );
  return { ...plan, days, weeklySets: weeklySets(days) };
}

export function filterFor(p: UserProfile): ExerciseFilter {
  const safety = assessSafety(p);
  return {
    equipment: availableEquipment(p),
    injuries: p.health.injuries,
    excluded: p.excludedExercises,
    maxDifficulty: safety.trainingMode === 'conservative' || p.level === 'beginner' ? 2 : 3,
    preferred: p.preferredExercises,
  };
}
