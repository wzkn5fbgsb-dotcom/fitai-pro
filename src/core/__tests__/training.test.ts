import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, EXERCISE_BY_ID, getExercise } from '../data/exercises.ts';
import { chooseSplit, generateWorkoutPlan, swapExercise, filterFor, exerciseAllowed } from '../routine.ts';
import { suggestProgression, estimatedOneRm, type ExerciseLog } from '../progression.ts';
import { profile } from './helpers.ts';

test('biblioteca de ejercicios: ids únicos y textos bilingües', () => {
  assert.equal(new Set(EXERCISES.map((e) => e.id)).size, EXERCISES.length);
  for (const e of EXERCISES) {
    assert.ok(e.cues.es.length >= 2 && e.cues.es.length === e.cues.en.length, e.id);
    assert.ok(e.mistakes.es.length >= 2 && e.mistakes.es.length === e.mistakes.en.length, e.id);
    assert.equal(e.videoUrl, undefined, 'no se inventan enlaces de video');
  }
});

test('nunca asigna más días de los disponibles', () => {
  for (let days = 1; days <= 7; days++) {
    for (const level of ['beginner', 'intermediate', 'advanced'] as const) {
      const plan = generateWorkoutPlan(profile({ daysPerWeek: days, level }))!;
      assert.ok(plan.days.length <= days, `${days} ${level}`);
      assert.ok(plan.days.length <= 6, 'siempre al menos un día de descanso');
    }
  }
  assert.equal(chooseSplit({ daysPerWeek: 3, level: 'advanced', goal: 'muscle_gain' }).split, 'full_body');
  assert.equal(chooseSplit({ daysPerWeek: 4, level: 'beginner', goal: 'muscle_gain' }).split, 'upper_lower');
  assert.equal(chooseSplit({ daysPerWeek: 6, level: 'advanced', goal: 'muscle_gain' }).split, 'ppl');
});

test('principiante con 6 días: máximo 4 de fuerza y el resto cardio', () => {
  const plan = generateWorkoutPlan(profile({ daysPerWeek: 6, level: 'beginner' }))!;
  const strength = plan.days.filter((d) => d.exercises.length > 0).length;
  assert.equal(strength, 4);
  assert.ok(plan.notes.includes('beginner_capped'));
});

test('respeta el equipo disponible en casa', () => {
  const p = profile({ location: 'home', equipment: ['dumbbell', 'bench'] });
  const plan = generateWorkoutPlan(p)!;
  for (const d of plan.days)
    for (const e of d.exercises) {
      const ex = getExercise(e.exerciseId);
      assert.ok(ex.equipment.every((q) => ['dumbbell', 'bench', 'bodyweight'].includes(q)), ex.id);
    }
});

test('excluye ejercicios que cargan zonas lesionadas', () => {
  const p = profile({ health: { ...profile().health, injuries: ['knee', 'shoulder'] } });
  const plan = generateWorkoutPlan(p)!;
  for (const d of plan.days) for (const e of d.exercises) assert.ok(!getExercise(e.exerciseId).stress.some((a) => a === 'knee' || a === 'shoulder'), e.exerciseId);
  assert.ok(plan.notes.includes('not_treatment'));
});

test('respeta ejercicios excluidos y favorece los preferidos', () => {
  const p = profile({ excludedExercises: ['back_squat', 'bench_press'], preferredExercises: ['leg_press'] });
  const plan = generateWorkoutPlan(p)!;
  const ids = plan.days.flatMap((d) => d.exercises.map((e) => e.exerciseId));
  assert.ok(!ids.includes('back_squat') && !ids.includes('bench_press'));
  assert.ok(ids.includes('leg_press'));
});

test('la sesión cabe en el tiempo disponible', () => {
  for (const sessionMinutes of [30, 45, 60, 90]) {
    const plan = generateWorkoutPlan(profile({ sessionMinutes, daysPerWeek: 4, level: 'intermediate' }))!;
    for (const d of plan.days) assert.ok(d.estMinutes <= sessionMinutes * 1.1 + 1, `${sessionMinutes}: ${d.estMinutes}`);
  }
});

test('fuerza usa repeticiones bajas; hipertrofia, moderadas', () => {
  const s = generateWorkoutPlan(profile({ goal: 'strength', level: 'intermediate' }))!;
  const h = generateWorkoutPlan(profile({ goal: 'muscle_gain', level: 'intermediate' }))!;
  const mainS = s.days[0].exercises.find((e) => e.main)!;
  const mainH = h.days[0].exercises.find((e) => e.main)!;
  assert.ok(mainS.repsMax <= 6);
  assert.ok(mainH.repsMin >= 6 && mainH.repsMax <= 12);
});

test('volumen semanal razonable para intermedio 4 días', () => {
  const plan = generateWorkoutPlan(profile({ daysPerWeek: 4, level: 'intermediate', sessionMinutes: 60 }))!;
  for (const m of ['chest', 'lats', 'quads', 'hamstrings'] as const) {
    const v = plan.weeklySets[m] ?? 0;
    assert.ok(v >= 6 && v <= 24, `${m}: ${v}`);
  }
});

test('restricción médica de ejercicio: no se genera rutina', () => {
  assert.equal(generateWorkoutPlan(profile({ health: { ...profile().health, advisedToAvoidExercise: true } })), null);
  assert.equal(generateWorkoutPlan(profile({ age: 15 })), null);
});

test('cambiar ejercicio por una alternativa compatible', () => {
  const p = profile({ daysPerWeek: 4 });
  const plan = generateWorkoutPlan(p)!;
  const first = plan.days[0].exercises[0];
  const alt = first.alternatives[0];
  const next = swapExercise(plan, 0, first.exerciseId, alt, filterFor(p));
  assert.equal(next.days[0].exercises[0].exerciseId, alt);
  assert.equal(next.days[2].exercises[0].exerciseId, alt, 'aplica a días del mismo tipo');
  const forbidden = EXERCISES.find((e) => !exerciseAllowed(e, filterFor(profile({ location: 'home', equipment: [] }))))!;
  assert.throws(() => swapExercise(plan, 0, first.exerciseId, forbidden.id, filterFor(profile({ location: 'home', equipment: [] }))));
});

test('alternativas existen y son del mismo patrón', () => {
  const plan = generateWorkoutPlan(profile())!;
  for (const d of plan.days)
    for (const e of d.exercises) for (const a of e.alternatives) assert.equal(EXERCISE_BY_ID[a].pattern, getExercise(e.exerciseId).pattern);
});

// -------------------------------------------------------------- progresión
const planned = { exerciseId: 'back_squat', pattern: 'squat' as const, main: true, sets: 3, repsMin: 6, repsMax: 10, restSec: 120, rirMin: 1, rirMax: 3, alternatives: [] };
const log = (reps: number[], over: Partial<ExerciseLog> = {}): ExerciseLog => ({
  exerciseId: 'back_squat',
  sets: reps.map((r) => ({ weightKg: 100, reps: r, rir: 2, completed: true })),
  pain: false,
  techniqueOk: true,
  ...over,
});

test('sube la carga al completar el tope del rango', () => {
  const s = suggestProgression(planned, log([10, 10, 10]), { recoveryOk: true });
  assert.equal(s.action, 'increase_load');
  assert.equal(s.nextWeightKg, 105);
});

test('suma repeticiones dentro del rango', () => {
  const s = suggestProgression(planned, log([8, 8, 7]), { recoveryOk: true });
  assert.equal(s.action, 'add_reps');
  assert.equal(s.targetReps, 8);
});

test('NUNCA sube la carga con dolor, mala técnica o mala recuperación', () => {
  assert.equal(suggestProgression(planned, log([10, 10, 10], { pain: true }), { recoveryOk: true }).action, 'review_exercise');
  assert.equal(suggestProgression(planned, log([10, 10, 10], { techniqueOk: false }), { recoveryOk: true }).action, 'hold');
  assert.equal(suggestProgression(planned, log([10, 10, 10]), { recoveryOk: false }).action, 'hold');
});

test('reduce la carga si fue demasiado pesada', () => {
  const l = log([3, 3, 2]);
  l.sets.forEach((s) => (s.rir = 0));
  const s = suggestProgression(planned, l, { recoveryOk: true });
  assert.equal(s.action, 'reduce_load');
  assert.equal(s.nextWeightKg, 90);
});

test('sin registro previo: no inventa cargas', () => {
  const s = suggestProgression(planned, undefined, undefined);
  assert.equal(s.action, 'no_data');
  assert.equal(s.nextWeightKg, null);
});

test('incremento en libras para usuarios imperiales', () => {
  const s = suggestProgression(planned, log([10, 10, 10]), { recoveryOk: true }, 'imperial');
  assert.ok(Math.abs((s.nextWeightKg as number) - (100 + 10 * 0.45359237)) < 0.01);
});

test('1RM estimado (Epley)', () => {
  assert.equal(Math.round(estimatedOneRm(100, 5) * 10) / 10, 116.7);
});
