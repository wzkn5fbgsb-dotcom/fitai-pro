// Capa de datos en la nube: traduce las piezas del AppState a las tablas de
// Supabase (supabase/migrations/20261020000001_schema.sql) y viceversa.
// Todas las funciones LANZAN un error si Supabase responde con error; el store
// las envuelve para marcar syncError.
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  assessSafety,
  type CheckIn,
  type ExerciseLog,
  type PlanId,
  type ReviewProposal,
  type SessionLog,
  type SetLog,
  type SubscriptionStatus,
  type UserProfile,
  type WeekPlan,
  type WeightEntry,
  type WorkoutPlan,
} from '../core';
import { getSupabase } from '../lib/supabase';
import type { CheckinRecord, Measurement, MealLog, PhotoMeta, Settings, Subscription, ThemePref } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

function sb(): SupabaseClient {
  const c = getSupabase();
  if (!c) throw new Error('no_cloud');
  return c;
}

function check<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data;
}

/** Postgres devuelve numeric como texto: lo convertimos a número. */
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function numOrUndef(v: unknown): number | undefined {
  const n = numOrNull(v);
  return n === null ? undefined : n;
}
const clampInt = (v: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(v)));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string) => UUID_RE.test(s);

/** PostgREST devuelve como máximo ~1000 filas por consulta: paginamos. */
async function fetchAll(build: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: unknown }>): Promise<Row[]> {
  const page = 1000;
  const out: Row[] = [];
  for (let from = 0; ; from += page) {
    const rows = check(await build(from, from + page - 1)) ?? [];
    out.push(...rows);
    if (rows.length < page) break;
  }
  return out;
}

// ------------------------------------------------------------------ lectura
export interface CloudState {
  profile: UserProfile | null;
  settings: Partial<Settings>;
  workoutPlan: WorkoutPlan | null;
  weekPlan: WeekPlan | null;
  weekPlanKind: 'week' | 'preview' | null;
  sessions: SessionLog[];
  weights: WeightEntry[];
  measurements: Measurement[];
  mealLogs: Record<string, Record<string, MealLog>>;
  photos: PhotoMeta[];
  checkins: CheckinRecord[];
  subscription: Subscription;
}

export async function loadCloudState(userId: string): Promise<CloudState> {
  const c = sb();
  const [prof, prefs, wp, np, sessions, logs, meas, meals, photos, checkins, subscription] = await Promise.all([
    c.from('user_profiles').select('data').eq('user_id', userId).maybeSingle(),
    c.from('user_preferences').select('theme, notifications, calorie_offset_kcal').eq('user_id', userId).maybeSingle(),
    c.from('workout_plans').select('plan').eq('user_id', userId).eq('active', true).maybeSingle(),
    c.from('nutrition_plans').select('week, kind').eq('user_id', userId).eq('active', true).maybeSingle(),
    fetchAll((a, b) => c.from('workout_sessions').select('*').eq('user_id', userId).order('performed_at', { ascending: true }).range(a, b)),
    fetchAll((a, b) =>
      c.from('exercise_logs').select('*').eq('user_id', userId).order('session_id').order('set_number', { ascending: true }).range(a, b),
    ),
    fetchAll((a, b) => c.from('body_measurements').select('*').eq('user_id', userId).order('measured_on', { ascending: true }).range(a, b)),
    fetchAll((a, b) => c.from('daily_nutrition_logs').select('*').eq('user_id', userId).order('log_date', { ascending: true }).range(a, b)),
    fetchAll((a, b) => c.from('progress_photos').select('*').eq('user_id', userId).order('taken_on', { ascending: true }).range(a, b)),
    fetchAll((a, b) => c.from('weekly_checkins').select('*').eq('user_id', userId).order('week_start', { ascending: true }).range(a, b)),
    loadSubscription(userId),
  ]);

  const profRow = check(prof) as Row | null;
  const prefRow = check(prefs) as Row | null;
  const wpRow = check(wp) as Row | null;
  const npRow = check(np) as Row | null;

  return {
    profile: (profRow?.data as UserProfile) ?? null,
    settings: prefRow ? settingsFromRow(prefRow) : {},
    workoutPlan: (wpRow?.plan as WorkoutPlan) ?? null,
    weekPlan: (npRow?.week as WeekPlan) ?? null,
    weekPlanKind: npRow ? (npRow.kind === 'preview' ? 'preview' : 'week') : null,
    sessions: sessionsFromRows(sessions, logs),
    ...measurementsFromRows(meas),
    mealLogs: mealLogsFromRows(meals),
    photos: photos.map(
      (r): PhotoMeta => ({ id: String(r.id), date: String(r.taken_on), pose: r.pose, uri: String(r.storage_path), storagePath: String(r.storage_path) }),
    ),
    checkins: checkins.map(
      (r): CheckinRecord => ({
        weekStart: String(r.week_start),
        answers: r.answers as CheckIn,
        proposal: r.proposal as ReviewProposal,
        decision: r.decision,
        appliedDeltaKcal: num(r.applied_delta_kcal),
        decidedAt: r.decided_at ?? undefined,
      }),
    ),
    subscription,
  };
}

function settingsFromRow(r: Row): Partial<Settings> {
  const n = (r.notifications ?? {}) as Row;
  const out: Partial<Settings> = { calorieOffsetKcal: num(r.calorie_offset_kcal) };
  if (r.theme === 'system' || r.theme === 'light' || r.theme === 'dark') out.theme = r.theme as ThemePref;
  if (typeof n.workoutReminders === 'boolean') out.workoutReminders = n.workoutReminders;
  if (typeof n.workoutTime === 'string') out.workoutTime = n.workoutTime;
  if (typeof n.mealReminders === 'boolean') out.mealReminders = n.mealReminders;
  return out;
}

function sessionsFromRows(sessions: Row[], logs: Row[]): SessionLog[] {
  type Acc = { sets: { n: number; set: SetLog }[]; pain: boolean; techniqueOk: boolean };
  const bySession = new Map<string, Map<string, Acc>>();
  for (const l of logs) {
    const sid = String(l.session_id);
    let ex = bySession.get(sid);
    if (!ex) bySession.set(sid, (ex = new Map()));
    const eid = String(l.exercise_id);
    let e = ex.get(eid);
    if (!e) ex.set(eid, (e = { sets: [], pain: false, techniqueOk: true }));
    const set: SetLog = { weightKg: numOrNull(l.weight_kg), reps: num(l.reps), completed: l.completed !== false };
    const rir = numOrNull(l.rir);
    if (rir !== null) set.rir = rir;
    e.sets.push({ n: num(l.set_number), set });
    if (l.pain) e.pain = true;
    if (l.technique_ok === false) e.techniqueOk = false;
  }
  return sessions.map((s) => {
    const ex = bySession.get(String(s.id)) ?? new Map<string, Acc>();
    const exercises: ExerciseLog[] = [...ex.entries()].map(([exerciseId, e]) => ({
      exerciseId,
      sets: e.sets.sort((a, b) => a.n - b.n).map((x) => x.set),
      pain: e.pain,
      techniqueOk: e.techniqueOk,
    }));
    const out: SessionLog = {
      id: String(s.id),
      date: String(s.performed_at),
      dayIndex: num(s.day_index),
      exercises,
      recoveryOk: s.recovery_ok !== false,
      completedPct: num(s.completed_pct),
    };
    const pe = numOrNull(s.perceived_effort);
    if (pe !== null) out.perceivedEffort = pe;
    if (typeof s.notes === 'string' && s.notes) out.notes = s.notes;
    return out;
  });
}

function measurementsFromRows(rows: Row[]): { weights: WeightEntry[]; measurements: Measurement[] } {
  const weights: WeightEntry[] = [];
  const measurements: Measurement[] = [];
  for (const r of rows) {
    const date = String(r.measured_on);
    const w = numOrNull(r.weight_kg);
    if (w !== null) weights.push({ date, weightKg: w });
    const m: Measurement = {
      date,
      waistCm: numOrUndef(r.waist_cm),
      chestCm: numOrUndef(r.chest_cm),
      armCm: numOrUndef(r.arm_cm),
      hipCm: numOrUndef(r.hip_cm),
      thighCm: numOrUndef(r.thigh_cm),
    };
    if (m.waistCm !== undefined || m.chestCm !== undefined || m.armCm !== undefined || m.hipCm !== undefined || m.thighCm !== undefined) {
      measurements.push(m);
    }
  }
  return { weights, measurements };
}

function mealLogsFromRows(rows: Row[]): Record<string, Record<string, MealLog>> {
  const out: Record<string, Record<string, MealLog>> = {};
  for (const r of rows) {
    const date = String(r.log_date);
    (out[date] ??= {})[String(r.slot_id)] = {
      eaten: r.eaten !== false,
      recipeId: r.recipe_id ?? '',
      kcal: num(r.kcal),
      protein: num(r.protein_g),
      carbs: num(r.carbs_g),
      fat: num(r.fat_g),
    };
  }
  return out;
}

/** Suscripción según el SERVIDOR: el plan sale de current_plan(), el resto de la fila. */
export async function loadSubscription(userId: string): Promise<Subscription> {
  const c = sb();
  const [planRes, rowRes] = await Promise.all([
    c.rpc('current_plan'),
    c.from('subscriptions').select('status, expires_at, will_renew').eq('user_id', userId).maybeSingle(),
  ]);
  const serverPlan = check(planRes) as unknown;
  const row = check(rowRes) as Row | null;
  const plan: PlanId = serverPlan === 'pro' || serverPlan === 'elite' ? serverPlan : 'free';
  const status = (row?.status ?? 'expired') as SubscriptionStatus;
  return { plan, status, expiresAt: row?.expires_at ?? null, willRenew: !!row?.will_renew };
}

// ---------------------------------------------------------------- escritura
export async function upsertProfile(userId: string, p: UserProfile): Promise<void> {
  const c = sb();
  check(
    await c.from('user_profiles').upsert(
      {
        user_id: userId,
        age: p.age,
        sex: p.sex,
        height_cm: p.heightCm,
        weight_kg: p.weightKg,
        units: p.units,
        lang: p.lang,
        country: p.country,
        level: p.level,
        data: p,
      },
      { onConflict: 'user_id' },
    ),
  );
  check(
    await c.from('user_preferences').upsert(
      {
        user_id: userId,
        diet: p.diet,
        allergens: p.allergens,
        excluded_foods: p.excludedFoods,
        favorite_foods: p.favoriteFoods,
        budget: p.budget,
        cooking_time: p.cookingTime,
        meals_per_day: p.mealsPerDay,
        prep_style: p.prepStyle,
      },
      { onConflict: 'user_id' },
    ),
  );

  // Objetivo: una sola fila activa (ended_at null) por usuario.
  const active = check(await c.from('fitness_goals').select('id, goal').eq('user_id', userId).is('ended_at', null).maybeSingle()) as Row | null;
  if (!active || active.goal !== p.goal) {
    if (active) check(await c.from('fitness_goals').update({ ended_at: new Date().toISOString() }).eq('id', active.id));
    check(await c.from('fitness_goals').insert({ user_id: userId, goal: p.goal, target_weight_kg: p.targetWeightKg ?? null }));
  } else {
    check(await c.from('fitness_goals').update({ target_weight_kg: p.targetWeightKg ?? null }).eq('id', active.id));
  }

  // Banderas de seguridad: se recalculan completas.
  const flags = new Map(assessSafety(p).flags.map((f) => [f.code, f.severity]));
  check(await c.from('health_safety_flags').delete().eq('user_id', userId));
  if (flags.size) {
    check(await c.from('health_safety_flags').insert([...flags].map(([code, severity]) => ({ user_id: userId, code, severity }))));
  }
}

/** Desactiva la rutina anterior e inserta la nueva (null = sólo desactivar). */
export async function saveWorkoutPlan(userId: string, plan: WorkoutPlan | null): Promise<void> {
  const c = sb();
  check(await c.from('workout_plans').update({ active: false }).eq('user_id', userId).eq('active', true));
  if (plan) check(await c.from('workout_plans').insert({ user_id: userId, split: plan.split, plan, active: true }));
}

/** Inserta la sesión y una fila de exercise_logs por serie. Devuelve el id en la nube. */
export async function insertSession(userId: string, s: SessionLog): Promise<string> {
  const c = sb();
  const activePlan = check(await c.from('workout_plans').select('id').eq('user_id', userId).eq('active', true).maybeSingle()) as Row | null;
  const row: Row = {
    user_id: userId,
    plan_id: activePlan?.id ?? null,
    day_index: clampInt(s.dayIndex, 0, 6),
    performed_at: s.date,
    perceived_effort: s.perceivedEffort != null ? clampInt(s.perceivedEffort, 1, 10) : null,
    recovery_ok: s.recoveryOk,
    completed_pct: Math.max(0, Math.min(1, s.completedPct)),
    notes: s.notes ? s.notes.slice(0, 1000) : null,
  };
  if (isUuid(s.id)) row.id = s.id;
  const inserted = check(await c.from('workout_sessions').insert(row).select('id').single()) as Row;
  const sessionId = String(inserted.id);
  const rows: Row[] = [];
  for (const e of s.exercises) {
    e.sets.slice(0, 20).forEach((set, i) => {
      rows.push({
        session_id: sessionId,
        user_id: userId,
        exercise_id: e.exerciseId,
        set_number: i + 1,
        weight_kg: set.weightKg != null && set.weightKg >= 0 ? set.weightKg : null,
        reps: clampInt(set.reps, 0, 100),
        rir: set.rir != null ? clampInt(set.rir, 0, 10) : null,
        completed: set.completed,
        pain: e.pain,
        technique_ok: e.techniqueOk,
      });
    });
  }
  if (rows.length) check(await c.from('exercise_logs').insert(rows));
  return sessionId;
}

/** body_measurements es único por (user_id, measured_on): sólo se tocan las columnas enviadas. */
export async function upsertWeight(userId: string, date: string, weightKg: number): Promise<void> {
  check(
    await sb()
      .from('body_measurements')
      .upsert({ user_id: userId, measured_on: date, weight_kg: weightKg }, { onConflict: 'user_id,measured_on' }),
  );
}

export async function upsertMeasurement(userId: string, m: Measurement): Promise<void> {
  check(
    await sb()
      .from('body_measurements')
      .upsert(
        {
          user_id: userId,
          measured_on: m.date,
          waist_cm: m.waistCm ?? null,
          chest_cm: m.chestCm ?? null,
          arm_cm: m.armCm ?? null,
          hip_cm: m.hipCm ?? null,
          thigh_cm: m.thighCm ?? null,
        },
        { onConflict: 'user_id,measured_on' },
      ),
  );
}

export async function upsertMealLog(userId: string, date: string, slotId: string, log: MealLog): Promise<void> {
  check(
    await sb()
      .from('daily_nutrition_logs')
      .upsert(
        {
          user_id: userId,
          log_date: date,
          slot_id: slotId,
          recipe_id: log.recipeId || null,
          eaten: log.eaten,
          kcal: Math.round(log.kcal * 10) / 10,
          protein_g: Math.round(log.protein * 10) / 10,
          carbs_g: Math.round(log.carbs * 10) / 10,
          fat_g: Math.round(log.fat * 10) / 10,
        },
        { onConflict: 'user_id,log_date,slot_id' },
      ),
  );
}

export async function deleteMealLog(userId: string, date: string, slotId: string): Promise<void> {
  check(await sb().from('daily_nutrition_logs').delete().eq('user_id', userId).eq('log_date', date).eq('slot_id', slotId));
}

export async function insertPhotoRow(userId: string, p: PhotoMeta): Promise<void> {
  check(
    await sb()
      .from('progress_photos')
      .insert({ id: p.id, user_id: userId, storage_path: p.storagePath ?? p.uri, pose: p.pose, taken_on: p.date }),
  );
}

export async function deletePhotoRow(userId: string, id: string): Promise<void> {
  check(await sb().from('progress_photos').delete().eq('user_id', userId).eq('id', id));
}

export async function upsertCheckin(userId: string, r: CheckinRecord): Promise<void> {
  check(
    await sb()
      .from('weekly_checkins')
      .upsert(
        {
          user_id: userId,
          week_start: r.weekStart,
          answers: r.answers,
          proposal: r.proposal,
          decision: r.decision,
          applied_delta_kcal: clampInt(r.appliedDeltaKcal, -500, 500),
          decided_at: r.decidedAt ?? null,
        },
        { onConflict: 'user_id,week_start' },
      ),
  );
}

export async function updatePreferences(userId: string, s: Settings): Promise<void> {
  check(
    await sb()
      .from('user_preferences')
      .upsert(
        {
          user_id: userId,
          theme: s.theme,
          notifications: { workoutReminders: s.workoutReminders, workoutTime: s.workoutTime, mealReminders: s.mealReminders },
          calorie_offset_kcal: clampInt(s.calorieOffsetKcal, -500, 500),
        },
        { onConflict: 'user_id' },
      ),
  );
}

// ---------------------------------------------------------------- funciones
export type FunctionResult<T = any> = { ok: true; data: T } | { ok: false; status: number; data: any };

/** Llama a una función Edge. Nunca lanza: devuelve el estado HTTP en caso de error. */
export async function callFunction<T = any>(name: string, body: unknown): Promise<FunctionResult<T>> {
  const c = getSupabase();
  if (!c) return { ok: false, status: 0, data: null };
  try {
    const { data, error } = await c.functions.invoke(name, { body: body as Record<string, unknown> });
    if (!error) return { ok: true, data: data as T };
    const ctx = (error as any)?.context;
    const status = typeof ctx?.status === 'number' ? ctx.status : 0;
    let payload: any = null;
    try {
      if (ctx && typeof ctx.json === 'function') payload = await ctx.json();
    } catch {
      payload = null;
    }
    return { ok: false, status, data: payload };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
