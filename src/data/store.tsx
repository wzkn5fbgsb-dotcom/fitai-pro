// Estado global de la app: implementa EXACTAMENTE el contrato de ./types.ts.
// - Todo el AppState (menos `ready` y `syncError`) se guarda en el teléfono tras cada cambio.
// - Modo nube: actualizaciones optimistas; luego se escribe en Supabase. Si falla, syncError = true
//   (se limpia con la siguiente escritura correcta).
// - La membresía en modo nube SIEMPRE viene del servidor; nunca se desbloquea localmente.
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getLocales } from 'expo-localization';
import {
  can,
  clamp,
  computeTargets,
  effectivePlan,
  generateWeekPlan,
  generateWorkoutPlan,
  hashString,
  replaceMealInDay,
  replaceMealRecipe,
  restrictionsOf,
  substituteIngredient as coreSubstitute,
  type Lang,
  type PlanId,
  type UserProfile,
  type WeekPlan,
  type WorkoutPlan,
} from '../core';
import { todayStr } from '../lib/dates';
import { loadJSON, remove, saveJSON } from '../lib/storage';
import { getSupabase } from '../lib/supabase';
import { cloudConfigured } from '../lib/config';
import { cancelAllReminders, requestPermission, rescheduleReminders, type ReminderTexts } from '../lib/notifications';
import { configurePurchases, logOutPurchases } from '../lib/purchases';
import {
  deleteAllLocalPhotos,
  deleteCloudPhoto,
  deleteLocalPhoto,
  saveLocalPhoto,
  signedPhotoUrl,
  uploadPhoto,
} from '../lib/photos';
import { es } from '../i18n/es';
import { en } from '../i18n/en';
import * as cloud from './cloud';
import type { AppActions, AppContextValue, AppState, Settings, ShoppingState, Subscription } from './types';

const STATE_KEY = 'fitai:v1:state';
/** Fecha (ISO) a partir de la cual el menú guardado en la nube está desactualizado. */
const MEAL_STALE_KEY = 'fitai:v1:mealStaleAt';

declare const __DEV__: boolean;

// ------------------------------------------------------------------ estado inicial
const INITIAL_SETTINGS: Settings = {
  theme: 'system',
  workoutReminders: false,
  workoutTime: '18:00',
  mealReminders: false,
  calorieOffsetKcal: 0,
};
const INITIAL_SHOPPING: ShoppingState = { days: 7, checked: {}, removed: [], overrides: {} };
const INITIAL_SUBSCRIPTION: Subscription = { plan: 'free', status: 'expired', expiresAt: null, willRenew: false };

function deviceLang(): Lang {
  try {
    return getLocales()[0]?.languageCode === 'en' ? 'en' : 'es';
  } catch {
    return 'es';
  }
}

function initialState(lang: Lang = deviceLang()): AppState {
  return {
    ready: false,
    mode: null,
    lang,
    email: null,
    userId: null,
    profile: null,
    settings: { ...INITIAL_SETTINGS },
    workoutPlan: null,
    weekPlan: null,
    weekPlanKind: null,
    sessions: [],
    weights: [],
    measurements: [],
    mealLogs: {},
    photos: [],
    checkins: [],
    changes: [],
    shopping: { ...INITIAL_SHOPPING, checked: {}, removed: [], overrides: {} },
    subscription: { ...INITIAL_SUBSCRIPTION },
    devPlan: null,
    syncError: false,
  };
}

type Persisted = Omit<AppState, 'ready' | 'syncError'>;

function toPersisted(s: AppState): Persisted {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { ready, syncError, ...rest } = s;
  return rest;
}

function fromCache(cache: Partial<Persisted> | null): AppState {
  const base = initialState();
  if (!cache) return { ...base, ready: true };
  return {
    ...base,
    ...cache,
    settings: { ...base.settings, ...(cache.settings ?? {}) },
    shopping: { ...base.shopping, ...(cache.shopping ?? {}) },
    subscription: { ...base.subscription, ...(cache.subscription ?? {}) },
    ready: true,
    syncError: false,
  };
}

/** Plan efectivo: nube = servidor; local = 'free' (o devPlan en desarrollo). */
function planOf(s: AppState): PlanId {
  if (s.mode === 'cloud') return effectivePlan(s.subscription, Date.now());
  return __DEV__ && s.devPlan ? s.devPlan : 'free';
}

// ------------------------------------------------------------------ utilidades
function uuid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const TRAINING_KEYS: (keyof UserProfile)[] = [
  'goal',
  'level',
  'daysPerWeek',
  'sessionMinutes',
  'location',
  'equipment',
  'excludedExercises',
  'preferredExercises',
  'age',
  'health', // incluye lesiones y "evitar ejercicio intenso"
];

const NUTRITION_KEYS: (keyof UserProfile)[] = [
  'age',
  'sex',
  'heightCm',
  'weightKg',
  'targetWeightKg',
  'goal',
  'level',
  'daysPerWeek',
  'sessionMinutes',
  'job',
  'dailySteps',
  'cardioMinutesPerWeek',
  'cardioIntensity',
  'diet',
  'allergens',
  'excludedFoods',
  'favoriteFoods',
  'budget',
  'cookingTime',
  'mealsPerDay',
  'prepStyle',
  'health',
];

function changed(a: UserProfile, b: UserProfile, keys: (keyof UserProfile)[]): boolean {
  return keys.some((k) => !same(a[k], b[k]));
}

const TXT = {
  es: {
    workoutUpdated: 'Rutina actualizada tras cambiar tu perfil',
    workoutRegenerated: 'Rutina regenerada con tu perfil actual',
    calories: (d: number) => `Calorías ajustadas ${d > 0 ? '+' : ''}${d} kcal/día tras la revisión semanal`,
    channel: 'Recordatorios',
  },
  en: {
    workoutUpdated: 'Routine updated after your profile changed',
    workoutRegenerated: 'Routine regenerated with your current profile',
    calories: (d: number) => `Calories adjusted ${d > 0 ? '+' : ''}${d} kcal/day after the weekly review`,
    channel: 'Reminders',
  },
};

const langOf = (s: AppState): Lang => s.profile?.lang ?? s.lang;

function reminderTexts(lang: Lang): ReminderTexts {
  const S = lang === 'en' ? en : es;
  const slots = S.nutrition.slots as Record<string, string>;
  const mealTitles: Record<string, string> = {};
  for (const k of Object.keys(slots)) mealTitles[k] = S.notif.mealTitle.replace('{meal}', slots[k]);
  return {
    channelName: TXT[lang].channel,
    workoutTitle: S.notif.workoutTitle,
    workoutBody: S.notif.workoutBody,
    mealBody: S.notif.mealBody,
    mealTitles,
  };
}

function reschedule(s: AppState): Promise<void> {
  return rescheduleReminders({
    workoutReminders: s.settings.workoutReminders && !!s.profile,
    workoutTime: s.settings.workoutTime,
    mealReminders: s.settings.mealReminders && !!s.profile,
    daysPerWeek: s.profile?.daysPerWeek ?? 3,
    mealsPerDay: s.profile?.mealsPerDay ?? 3,
    texts: reminderTexts(langOf(s)),
  });
}

type AuthError = 'invalid' | 'weak_password' | 'network';

function mapAuthError(e: unknown): AuthError {
  const err = (e ?? {}) as { code?: string; message?: string; name?: string; status?: number };
  const msg = String(err.message ?? '');
  if (err.code === 'weak_password' || (/password/i.test(msg) && /weak|short|at least|characters/i.test(msg))) return 'weak_password';
  if (err.name === 'AuthRetryableFetchError' || err.status === 0 || /network|fetch|timed? ?out/i.test(msg)) return 'network';
  return 'invalid';
}

// ------------------------------------------------------------------ acciones
interface Ctx {
  get(): AppState;
  set(next: AppState): void;
  update(fn: (s: AppState) => AppState): AppState;
  staleAt: { current: string | null };
}

function createActions(ctx: Ctx): AppActions & { _boot(): Promise<void> } {
  const { get, update } = ctx;

  const cloudUser = (): string | null => {
    const s = get();
    return s.mode === 'cloud' && s.userId && getSupabase() ? s.userId : null;
  };

  /** Ejecuta una escritura en la nube (si aplica) y actualiza syncError. */
  async function sync<T>(fn: (userId: string) => Promise<T>): Promise<T | undefined> {
    const uid = cloudUser();
    if (!uid) return undefined;
    try {
      const r = await fn(uid);
      if (get().syncError) update((s) => ({ ...s, syncError: false }));
      return r;
    } catch {
      update((s) => ({ ...s, syncError: true }));
      return undefined;
    }
  }

  const pushChange = (s: AppState, summary: string): AppState => ({
    ...s,
    changes: [...s.changes, { date: todayStr(), summary }].slice(-100),
  });

  function markMealStale(): void {
    const at = new Date().toISOString();
    ctx.staleAt.current = at;
    void saveJSON(MEAL_STALE_KEY, at);
  }

  /** Aplica los datos leídos de la nube sobre el estado. */
  function applyCloud(s: AppState, c: cloud.CloudState): AppState {
    let weekPlan = c.weekPlan;
    let weekPlanKind = c.weekPlanKind;
    // El servidor no deja que la app desactive menús: descartamos los que quedaron desactualizados.
    const stale = ctx.staleAt.current;
    if (weekPlan && stale && weekPlan.generatedAt < stale) {
      weekPlan = null;
      weekPlanKind = null;
    }
    return {
      ...s,
      profile: c.profile,
      settings: { ...s.settings, ...c.settings },
      workoutPlan: c.workoutPlan,
      weekPlan,
      weekPlanKind,
      sessions: c.sessions,
      weights: c.weights,
      measurements: c.measurements,
      mealLogs: c.mealLogs,
      photos: c.photos,
      checkins: c.checkins,
      subscription: c.subscription,
      lang: c.profile?.lang ?? s.lang,
    };
  }

  async function refreshFromCloud(): Promise<void> {
    const uid = cloudUser();
    if (!uid) return;
    try {
      const c = await cloud.loadCloudState(uid);
      if (get().userId !== uid) return; // la sesión cambió mientras cargaba
      const next = update((s) => ({ ...applyCloud(s, c), syncError: false }));
      void reschedule(next);
    } catch {
      update((s) => ({ ...s, syncError: true }));
    }
  }

  /** Tras iniciar sesión: pasa a modo nube, sube el perfil local si la nube no tiene y carga los datos. */
  async function afterSignIn(userId: string, email: string | null): Promise<{ ok: boolean; error?: string }> {
    const prev = get();
    const sameOwner = prev.mode !== 'cloud' || prev.userId === null || prev.userId === userId;
    update((s) => ({
      ...(sameOwner ? s : { ...initialState(s.lang), ready: true }),
      mode: 'cloud',
      userId,
      email,
      ready: true,
    }));
    void configurePurchases(userId);
    let c: cloud.CloudState;
    try {
      c = await cloud.loadCloudState(userId);
    } catch {
      update((s) => ({ ...s, syncError: true }));
      return { ok: false, error: 'network' };
    }
    const local = get();
    if (!c.profile && sameOwner && local.profile) {
      try {
        await cloud.upsertProfile(userId, local.profile);
        await cloud.updatePreferences(userId, local.settings);
        if (local.workoutPlan) await cloud.saveWorkoutPlan(userId, local.workoutPlan);
        c = await cloud.loadCloudState(userId);
      } catch {
        update((s) => ({ ...s, syncError: true }));
        return { ok: true };
      }
    }
    const next = update((s) => ({ ...applyCloud(s, c), syncError: false }));
    void reschedule(next);
    return { ok: true };
  }

  async function resetAll(lang: Lang): Promise<void> {
    ctx.staleAt.current = null;
    await Promise.all([remove(STATE_KEY), remove(MEAL_STALE_KEY)]);
    ctx.set({ ...initialState(lang), ready: true });
    await cancelAllReminders();
  }

  async function setWorkoutPlanImpl(plan: WorkoutPlan | null, summary?: string): Promise<void> {
    update((s) => {
      const n = { ...s, workoutPlan: plan };
      return summary ? pushChange(n, summary) : n;
    });
    await sync((uid) => cloud.saveWorkoutPlan(uid, plan));
  }

  const actions: AppActions & { _boot(): Promise<void> } = {
    async _boot() {
      ctx.staleAt.current = await loadJSON<string>(MEAL_STALE_KEY);
      const s = get();
      void reschedule(s);
      if (s.mode !== 'cloud' || !cloudConfigured) return;
      const sb = getSupabase();
      if (!sb) return;
      try {
        const { data } = await sb.auth.getSession();
        const user = data.session?.user ?? null;
        if (!user) {
          update((x) => ({ ...x, userId: null, email: null }));
          return;
        }
        if (user.id !== get().userId) {
          await afterSignIn(user.id, user.email ?? null);
          return;
        }
        update((x) => ({ ...x, email: user.email ?? x.email }));
        void configurePurchases(user.id);
        await refreshFromCloud();
      } catch {
        update((x) => ({ ...x, syncError: true }));
      }
    },

    setLang(lang) {
      const next = update((s) => ({
        ...s,
        lang,
        profile: s.profile ? { ...s.profile, lang, updatedAt: new Date().toISOString() } : s.profile,
      }));
      const p = next.profile;
      if (p) void sync((uid) => cloud.upsertProfile(uid, p));
      void reschedule(next);
    },

    async chooseMode(mode) {
      update((s) => ({ ...s, mode }));
    },

    // ------------------------------------------------------------ autenticación
    async signUp(email, password) {
      const sb = getSupabase();
      if (!sb) return { ok: false, error: 'network' };
      if (password.length < 8) return { ok: false, error: 'weak_password' };
      try {
        const { data, error } = await sb.auth.signUp({ email: email.trim(), password });
        if (error) return { ok: false, error: mapAuthError(error) };
        if (!data.session || !data.user) return { ok: true, needsConfirm: true };
        // Si la carga inicial falla, la sesión ya está abierta: syncError lo indica.
        await afterSignIn(data.user.id, data.user.email ?? email.trim());
        return { ok: true };
      } catch (e) {
        return { ok: false, error: mapAuthError(e) };
      }
    },

    async signIn(email, password) {
      const sb = getSupabase();
      if (!sb) return { ok: false, error: 'network' };
      try {
        const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (error || !data.user) return { ok: false, error: mapAuthError(error) };
        await afterSignIn(data.user.id, data.user.email ?? email.trim());
        return { ok: true };
      } catch (e) {
        return { ok: false, error: mapAuthError(e) };
      }
    },

    async sendResetCode(email) {
      const sb = getSupabase();
      if (!sb) return { ok: false, error: 'network' };
      try {
        const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } });
        if (error) return { ok: false, error: mapAuthError(error) };
        return { ok: true };
      } catch (e) {
        return { ok: false, error: mapAuthError(e) };
      }
    },

    async resetPassword(email, code, newPassword) {
      const sb = getSupabase();
      if (!sb) return { ok: false, error: 'network' };
      if (newPassword.length < 8) return { ok: false, error: 'weak_password' };
      try {
        const { data, error } = await sb.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
        if (error || !data.user) return { ok: false, error: mapAuthError(error) };
        const upd = await sb.auth.updateUser({ password: newPassword });
        if (upd.error) return { ok: false, error: mapAuthError(upd.error) };
        await afterSignIn(data.user.id, data.user.email ?? email.trim());
        return { ok: true };
      } catch (e) {
        return { ok: false, error: mapAuthError(e) };
      }
    },

    async signOut() {
      const lang = langOf(get());
      try {
        await getSupabase()?.auth.signOut();
      } catch {
        // sin red: la sesión local se borra igualmente
      }
      await logOutPurchases();
      // Los datos de la cuenta no se quedan en el teléfono al cerrar sesión.
      await resetAll(lang);
    },

    // ------------------------------------------------------------ perfil y planes
    async saveProfile(input) {
      const prev = get();
      const old = prev.profile;
      const p: UserProfile = { ...input, updatedAt: new Date().toISOString() };
      const trainingChanged = !old || !prev.workoutPlan || changed(old, p, TRAINING_KEYS);
      const nutritionChanged = !!old && changed(old, p, NUTRITION_KEYS);
      const newPlan = trainingChanged ? generateWorkoutPlan(p) : prev.workoutPlan;
      const lang = p.lang;

      const next = update((s) => {
        let n: AppState = { ...s, profile: p, lang: p.lang };
        if (trainingChanged) {
          n = { ...n, workoutPlan: newPlan };
          if (old && newPlan) n = pushChange(n, TXT[lang].workoutUpdated);
        }
        if (nutritionChanged) n = { ...n, weekPlan: null, weekPlanKind: null };
        return n;
      });
      if (nutritionChanged) markMealStale();

      await sync(async (uid) => {
        await cloud.upsertProfile(uid, p);
        if (trainingChanged) await cloud.saveWorkoutPlan(uid, newPlan);
      });
      if (!old || old.daysPerWeek !== p.daysPerWeek || old.mealsPerDay !== p.mealsPerDay || old.lang !== p.lang) {
        await reschedule(next);
      }
    },

    async regenerateWorkout() {
      const p = get().profile;
      if (!p) return;
      const plan = generateWorkoutPlan(p);
      await setWorkoutPlanImpl(plan, plan ? TXT[p.lang].workoutRegenerated : undefined);
    },

    async setWorkoutPlan(plan, changeSummary) {
      await setWorkoutPlanImpl(plan, changeSummary);
    },

    async generateMealPlan() {
      const s = get();
      if (!s.profile) return { ok: false, error: 'no_profile' };
      if (s.mode === 'cloud') {
        if (!cloudUser()) return { ok: false, error: 'no_account' };
        const r = await cloud.callFunction<{ kind: 'week' | 'preview'; week: WeekPlan }>('nutrition-plan', { action: 'generate' });
        if (!r.ok) {
          const err = r.data?.error;
          if (r.status === 422 && typeof err === 'string') return { ok: false, error: err };
          return { ok: false, error: r.status === 0 ? 'network' : typeof err === 'string' ? err : 'unavailable' };
        }
        const { week, kind } = r.data;
        update((x) => ({ ...x, weekPlan: week, weekPlanKind: kind === 'preview' ? 'preview' : 'week', syncError: false }));
        return { ok: true };
      }
      const t = computeTargets(s.profile, s.settings.calorieOffsetKcal);
      if (!t.ok) return { ok: false, error: t.reason };
      const seed = hashString(s.profile.createdAt + todayStr());
      let week: WeekPlan;
      let kind: 'week' | 'preview';
      try {
        if (can(planOf(s), 'weekly_meal_plan')) {
          week = generateWeekPlan({ profile: s.profile, targets: t.targets, seed });
          kind = 'week';
        } else {
          const one = generateWeekPlan({ profile: s.profile, targets: t.targets, seed, days: 1 });
          week = { ...one, days: [{ ...one.days[0], meals: one.days[0].meals.slice(0, 1) }] };
          kind = 'preview';
        }
      } catch {
        return { ok: false, error: 'invalid' };
      }
      update((x) => ({ ...x, weekPlan: week, weekPlanKind: kind }));
      return { ok: true };
    },

    async substituteIngredient(dayIndex, slotId, fromFoodId, toFoodId) {
      return editMeal({ action: 'substitute', dayIndex, slotId, fromFoodId, toFoodId });
    },

    async replaceRecipe(dayIndex, slotId, recipeId) {
      return editMeal({ action: 'replace_recipe', dayIndex, slotId, recipeId });
    },

    // ------------------------------------------------------------ registros
    async addSession(sess) {
      update((s) => ({ ...s, sessions: [...s.sessions.filter((x) => x.id !== sess.id), sess] }));
      const cloudId = await sync((uid) => cloud.insertSession(uid, sess));
      if (cloudId && cloudId !== sess.id) {
        update((s) => ({ ...s, sessions: s.sessions.map((x) => (x.id === sess.id ? { ...x, id: cloudId } : x)) }));
      }
    },

    async logWeight(date, weightKg) {
      update((s) => ({
        ...s,
        weights: [...s.weights.filter((w) => w.date !== date), { date, weightKg }].sort((a, b) => a.date.localeCompare(b.date)),
      }));
      await sync((uid) => cloud.upsertWeight(uid, date, weightKg));
    },

    async saveMeasurement(m) {
      update((s) => ({
        ...s,
        measurements: [...s.measurements.filter((x) => x.date !== m.date), m].sort((a, b) => a.date.localeCompare(b.date)),
      }));
      await sync((uid) => cloud.upsertMeasurement(uid, m));
    },

    async setMealEaten(date, slotId, log) {
      update((s) => {
        const day = { ...(s.mealLogs[date] ?? {}) };
        if (log) day[slotId] = log;
        else delete day[slotId];
        const mealLogs = { ...s.mealLogs };
        if (Object.keys(day).length) mealLogs[date] = day;
        else delete mealLogs[date];
        return { ...s, mealLogs };
      });
      await sync((uid) => (log ? cloud.upsertMealLog(uid, date, slotId, log) : cloud.deleteMealLog(uid, date, slotId)));
    },

    async addPhoto(localUri, pose, date) {
      const id = uuid();
      const uid = cloudUser();
      if (uid) {
        try {
          const path = await uploadPhoto(localUri, uid, id);
          const meta = { id, date, pose, uri: path, storagePath: path };
          await cloud.insertPhotoRow(uid, meta);
          update((s) => ({ ...s, photos: [...s.photos, meta], syncError: false }));
          return;
        } catch {
          // sin red: se guarda en el teléfono para no perder la foto
          update((s) => ({ ...s, syncError: true }));
        }
      }
      const uri = await saveLocalPhoto(localUri, id);
      update((s) => ({ ...s, photos: [...s.photos, { id, date, pose, uri }] }));
    },

    async deletePhoto(id) {
      const photo = get().photos.find((p) => p.id === id);
      if (!photo) return;
      update((s) => ({ ...s, photos: s.photos.filter((p) => p.id !== id) }));
      if (photo.storagePath) {
        const path = photo.storagePath;
        await sync(async (uid) => {
          await cloud.deletePhotoRow(uid, id);
          await deleteCloudPhoto(path);
        });
      } else {
        deleteLocalPhoto(photo.uri);
      }
    },

    async photoDisplayUri(p) {
      if (p.storagePath) return (await signedPhotoUrl(p.storagePath)) ?? '';
      return p.uri;
    },

    async saveCheckin(c) {
      const prev = get();
      const old = prev.checkins.find((x) => x.weekStart === c.weekStart);
      const applies = (r: typeof c | undefined) => !!r && (r.decision === 'accepted' || r.decision === 'modified');
      // Sólo se aplica la diferencia respecto a lo ya aplicado para esa semana (guardar dos veces no duplica).
      const before = applies(old) ? old!.appliedDeltaKcal : 0;
      const now = applies(c) ? c.appliedDeltaKcal : 0;
      const oldOffset = prev.settings.calorieOffsetKcal;
      const newOffset = clamp(oldOffset + (now - before), -500, 500);
      const offsetChanged = newOffset !== oldOffset;
      const record = { ...c, decidedAt: c.decidedAt ?? (c.decision !== 'pending' ? new Date().toISOString() : undefined) };

      const next = update((s) => {
        let n: AppState = {
          ...s,
          checkins: [...s.checkins.filter((x) => x.weekStart !== c.weekStart), record].sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
        };
        if (offsetChanged) {
          n = { ...n, settings: { ...n.settings, calorieOffsetKcal: newOffset }, weekPlan: null, weekPlanKind: null };
          n = pushChange(n, TXT[langOf(s)].calories(newOffset - oldOffset));
        }
        return n;
      });
      if (offsetChanged) markMealStale();
      await sync(async (uid) => {
        await cloud.upsertCheckin(uid, record);
        if (offsetChanged) await cloud.updatePreferences(uid, next.settings);
      });
    },

    // ------------------------------------------------------------ ajustes
    async updateSettings(patch) {
      const enabling = (patch.workoutReminders && !get().settings.workoutReminders) || (patch.mealReminders && !get().settings.mealReminders);
      const next = update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
      if (enabling) await requestPermission();
      await reschedule(next);
      await sync((uid) => cloud.updatePreferences(uid, next.settings));
    },

    async updateShopping(patch) {
      update((s) => ({ ...s, shopping: { ...s.shopping, ...patch } }));
    },

    setDevPlan(plan) {
      if (!__DEV__) return;
      update((s) => ({ ...s, devPlan: plan }));
    },

    async refreshSubscription() {
      const sub = await sync((uid) => cloud.loadSubscription(uid));
      if (sub) update((s) => ({ ...s, subscription: sub }));
    },

    // ------------------------------------------------------------ coach
    async askCoachAI(message, history) {
      const s = get();
      if (s.mode !== 'cloud' || !cloudUser()) return { ok: false, error: 'no_account' };
      const r = await cloud.callFunction<{ text?: string; source?: string; remainingToday?: number }>('ai-coach', {
        message,
        lang: langOf(s),
        history,
        today: todayStr(),
      });
      if (!r.ok) return { ok: false, error: r.status === 429 ? 'limit' : 'unavailable' };
      const text = typeof r.data?.text === 'string' ? r.data.text : '';
      if (!text) return { ok: false, error: 'unavailable' };
      return typeof r.data.remainingToday === 'number' ? { ok: true, text, remainingToday: r.data.remainingToday } : { ok: true, text };
    },

    async deleteAllData() {
      const s = get();
      const lang = langOf(s);
      if (s.mode === 'cloud' && s.userId) {
        const r = await cloud.callFunction('delete-account', {});
        if (!r.ok) return { ok: false };
        try {
          await getSupabase()?.auth.signOut({ scope: 'local' });
        } catch {
          // el usuario ya no existe en el servidor
        }
        await logOutPurchases();
      }
      for (const p of s.photos) if (!p.storagePath) deleteLocalPhoto(p.uri);
      deleteAllLocalPhotos();
      await resetAll(lang);
      return { ok: true };
    },
  };

  type MealEdit =
    | { action: 'substitute'; dayIndex: number; slotId: string; fromFoodId: string; toFoodId: string }
    | { action: 'replace_recipe'; dayIndex: number; slotId: string; recipeId: string };

  async function editMeal(body: MealEdit): Promise<{ ok: boolean; error?: string }> {
    const s = get();
    if (!can(planOf(s), 'meal_substitution')) return { ok: false, error: 'upgrade_required' };
    try {
      if (s.mode === 'cloud') {
        if (!cloudUser()) return { ok: false, error: 'no_account' };
        const r = await cloud.callFunction<{ kind: 'week' | 'preview'; week: WeekPlan }>('nutrition-plan', body);
        if (!r.ok) return { ok: false, error: r.status === 403 ? 'upgrade_required' : 'invalid' };
        update((x) => ({ ...x, weekPlan: r.data.week, weekPlanKind: r.data.kind === 'preview' ? 'preview' : 'week', syncError: false }));
        return { ok: true };
      }
      const week = s.weekPlan;
      if (!s.profile || !week) return { ok: false, error: 'invalid' };
      const t = computeTargets(s.profile, s.settings.calorieOffsetKcal);
      if (!t.ok) return { ok: false, error: 'invalid' };
      const day = week.days[body.dayIndex];
      const meal = day?.meals.find((m) => m.slotId === body.slotId);
      if (!day || !meal) return { ok: false, error: 'invalid' };
      const r = restrictionsOf(s.profile);
      const nextMeal =
        body.action === 'substitute' ? coreSubstitute(meal, body.fromFoodId, body.toFoodId, r) : replaceMealRecipe(meal, body.recipeId, r);
      const nextWeek: WeekPlan = {
        ...week,
        days: week.days.map((d) => (d.dayIndex === day.dayIndex ? replaceMealInDay(d, meal.slotId, nextMeal, t.targets) : d)),
      };
      update((x) => ({ ...x, weekPlan: nextWeek }));
      return { ok: true };
    } catch {
      return { ok: false, error: 'invalid' };
    }
  }

  // Si el servidor revoca la sesión (token caducado, cuenta borrada), volvemos a la pantalla de acceso.
  getSupabase()?.auth.onAuthStateChange((event: string) => {
    if (event === 'SIGNED_OUT' && get().mode === 'cloud' && get().userId) {
      update((x) => ({ ...x, userId: null, email: null }));
    }
  });

  return actions;
}

// ------------------------------------------------------------------ proveedor
const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => initialState());
  const stateRef = useRef<AppState>(state);
  const staleAt = useRef<string | null>(null);

  const actionsRef = useRef<(AppActions & { _boot(): Promise<void> }) | null>(null);
  const publicRef = useRef<AppActions | null>(null);
  if (!actionsRef.current) {
    const set = (next: AppState) => {
      stateRef.current = next;
      setState(next);
    };
    actionsRef.current = createActions({
      get: () => stateRef.current,
      set,
      update: (fn) => {
        const next = fn(stateRef.current);
        set(next);
        return next;
      },
      staleAt,
    });
    // Objeto estable para las pantallas (sin la función interna de arranque).
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _boot, ...pub } = actionsRef.current;
    publicRef.current = pub;
  }

  // Arranque: caché local y, en modo nube con sesión, actualización en segundo plano.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const cache = await loadJSON<Partial<Persisted>>(STATE_KEY);
      if (!alive) return;
      const s = fromCache(cache);
      stateRef.current = s;
      setState(s);
      await actionsRef.current!._boot();
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Guarda el estado tras cada cambio (también es el caché del modo nube).
  useEffect(() => {
    if (!state.ready) return;
    void saveJSON(STATE_KEY, toPersisted(state));
  }, [state]);

  const value = useMemo<AppContextValue>(() => ({ state, actions: publicRef.current!, plan: planOf(state) }), [state]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const v = useContext(AppContext);
  if (!v) throw new Error('useApp() debe usarse dentro de <AppProvider>');
  return v;
}
