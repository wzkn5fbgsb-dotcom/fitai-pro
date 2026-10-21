// Construye el contexto del usuario a partir de la BASE DE DATOS (nunca de lo
// que diga el cliente), para el coach y la generación de planes.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  computeTargets,
  type CoachContext,
  type UserProfile,
  type WeekPlan,
  type WorkoutPlan,
  type WeightEntry,
  type Lang,
} from './core/index.ts';

export interface UserData {
  profile: UserProfile;
  offsetKcal: number;
  workoutPlan: WorkoutPlan | null;
  weekPlan: WeekPlan | null;
  lastSessionDayIndex: number | null;
  weights: WeightEntry[];
  consumedToday: { kcal: number; protein: number } | null;
  lastChange: { date: string; summary: string } | null;
}

export async function loadUserData(admin: SupabaseClient, userId: string, today: string): Promise<UserData | null> {
  const [prof, prefs, wp, np, sess, meas, logs, chk] = await Promise.all([
    admin.from('user_profiles').select('data').eq('user_id', userId).maybeSingle(),
    admin.from('user_preferences').select('calorie_offset_kcal').eq('user_id', userId).maybeSingle(),
    admin.from('workout_plans').select('plan').eq('user_id', userId).eq('active', true).maybeSingle(),
    admin.from('nutrition_plans').select('week').eq('user_id', userId).eq('active', true).maybeSingle(),
    admin.from('workout_sessions').select('day_index').eq('user_id', userId).order('performed_at', { ascending: false }).limit(1),
    admin.from('body_measurements').select('measured_on, weight_kg').eq('user_id', userId).not('weight_kg', 'is', null).order('measured_on', { ascending: false }).limit(90),
    admin.from('daily_nutrition_logs').select('kcal, protein_g, eaten').eq('user_id', userId).eq('log_date', today),
    admin.from('weekly_checkins').select('decided_at, decision, applied_delta_kcal').eq('user_id', userId).in('decision', ['accepted', 'modified']).order('decided_at', { ascending: false }).limit(1),
  ]);
  if (!prof.data) return null;
  const eaten = (logs.data ?? []).filter((l) => l.eaten);
  const last = chk.data?.[0];
  return {
    profile: prof.data.data as UserProfile,
    offsetKcal: prefs.data?.calorie_offset_kcal ?? 0,
    workoutPlan: (wp.data?.plan as WorkoutPlan) ?? null,
    weekPlan: (np.data?.week as WeekPlan) ?? null,
    lastSessionDayIndex: sess.data?.[0]?.day_index ?? null,
    weights: (meas.data ?? []).map((m) => ({ date: m.measured_on as string, weightKg: Number(m.weight_kg) })),
    consumedToday: eaten.length
      ? { kcal: eaten.reduce((a, l) => a + Number(l.kcal), 0), protein: eaten.reduce((a, l) => a + Number(l.protein_g), 0) }
      : null,
    lastChange: last
      ? { date: String(last.decided_at).slice(0, 10), summary: `Ajuste de calorías aceptado en la revisión semanal: ${last.applied_delta_kcal > 0 ? '+' : ''}${last.applied_delta_kcal} kcal/día.` }
      : null,
  };
}

export function toCoachContext(d: UserData, lang: Lang, today: string): CoachContext {
  const t = computeTargets(d.profile, d.offsetKcal);
  const days = d.workoutPlan?.days.length ?? 0;
  const weekday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7; // lunes = 0
  return {
    lang,
    profile: d.profile,
    workoutPlan: d.workoutPlan,
    nextWorkoutDayIndex: days ? (d.lastSessionDayIndex === null ? 0 : (d.lastSessionDayIndex + 1) % days) : null,
    weekPlan: d.weekPlan,
    todayPlanDay: d.weekPlan ? weekday % d.weekPlan.days.length : 0,
    consumedToday: d.consumedToday,
    proteinTargetG: t.ok ? t.targets.proteinG : null,
    kcalTarget: t.ok ? t.targets.kcal : null,
    weights: d.weights,
    lastChange: d.lastChange,
    today,
  };
}
