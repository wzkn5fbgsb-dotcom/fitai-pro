// Selectores puros sobre el estado de la app.
import { computeTargets, type CoachContext, type ExerciseLog, type Lang, type TargetsResult } from '../core';
import type { AppState } from '../data/types';
import { daysBetween, todayStr, weekStart, weekdayIndex } from './dates';

export function targetsFor(state: AppState): TargetsResult | null {
  if (!state.profile) return null;
  return computeTargets(state.profile, state.settings.calorieOffsetKcal);
}

/** Siguiente día de la rutina: rota tras la última sesión registrada. */
export function nextWorkoutDayIndex(state: AppState): number | null {
  const plan = state.workoutPlan;
  if (!plan || plan.days.length === 0) return null;
  const sorted = [...state.sessions].sort((a, b) => b.date.localeCompare(a.date));
  const generated = plan.generatedAt;
  const last = sorted.find((s) => s.date >= generated.slice(0, 10)) ?? null;
  return last ? (last.dayIndex + 1) % plan.days.length : 0;
}

export function todayMealDay(state: AppState): number {
  const n = state.weekPlan?.days.length ?? 7;
  return weekdayIndex() % Math.max(1, n);
}

export function consumedOn(state: AppState, date: string): { kcal: number; protein: number; carbs: number; fat: number; meals: number } | null {
  const logs = Object.values(state.mealLogs[date] ?? {}).filter((l) => l.eaten);
  if (!logs.length) return null;
  return logs.reduce(
    (a, l) => ({ kcal: a.kcal + l.kcal, protein: a.protein + l.protein, carbs: a.carbs + l.carbs, fat: a.fat + l.fat, meals: a.meals + 1 }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0, meals: 0 },
  );
}

export function weekWorkoutsDone(state: AppState): { done: number; planned: number } {
  const start = weekStart();
  const done = state.sessions.filter((s) => s.date.slice(0, 10) >= start).length;
  const planned = state.workoutPlan?.days.length ?? 0;
  return { done, planned };
}

export function lastExerciseLog(state: AppState, exerciseId: string): { log: ExerciseLog; recoveryOk: boolean; date: string } | null {
  const sorted = [...state.sessions].sort((a, b) => b.date.localeCompare(a.date));
  for (const s of sorted) {
    const log = s.exercises.find((e) => e.exerciseId === exerciseId);
    if (log) return { log, recoveryOk: s.recoveryOk, date: s.date };
  }
  return null;
}

/** La revisión toca si no hay una para la semana actual y han pasado ≥7 días desde la creación del perfil. */
export function reviewDue(state: AppState): { due: boolean; next: string } {
  const ws = weekStart();
  const has = state.checkins.some((c) => c.weekStart === ws);
  const created = state.profile?.createdAt.slice(0, 10) ?? todayStr();
  const old = daysBetween(created, todayStr()) >= 7;
  return { due: !has && old, next: has ? weekStart(addWeek(ws)) : ws };
}

function addWeek(d: string): string {
  const [y, m, dd] = d.split('-').map(Number);
  const x = new Date(y, m - 1, dd + 7);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

export function coachContext(state: AppState, lang: Lang): CoachContext | null {
  if (!state.profile) return null;
  const t = targetsFor(state);
  const c = consumedOn(state, todayStr());
  return {
    lang,
    profile: state.profile,
    workoutPlan: state.workoutPlan,
    nextWorkoutDayIndex: nextWorkoutDayIndex(state),
    weekPlan: state.weekPlan,
    todayPlanDay: todayMealDay(state),
    consumedToday: c ? { kcal: c.kcal, protein: c.protein } : null,
    proteinTargetG: t?.ok ? t.targets.proteinG : null,
    kcalTarget: t?.ok ? t.targets.kcal : null,
    weights: state.weights,
    lastChange: state.changes.length ? state.changes[state.changes.length - 1] : null,
    today: todayStr(),
  };
}
