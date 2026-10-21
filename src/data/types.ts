// CONTRATO del estado de la app y de sus acciones. Las pantallas sólo usan esto
// (vía useApp() de ./store). La implementación decide si guarda en el teléfono
// (modo local) o además en Supabase (modo nube).
import type {
  CheckIn,
  Lang,
  PlanId,
  ReviewProposal,
  SessionLog,
  SubscriptionStatus,
  UserProfile,
  WeekPlan,
  WeightEntry,
  WorkoutPlan,
} from '../core';

export type Mode = 'local' | 'cloud';
export type ThemePref = 'system' | 'light' | 'dark';

export interface Measurement {
  date: string; // YYYY-MM-DD
  waistCm?: number;
  chestCm?: number;
  armCm?: number;
  hipCm?: number;
  thighCm?: number;
}

export interface MealLog {
  eaten: boolean;
  recipeId: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface PhotoMeta {
  id: string;
  date: string; // YYYY-MM-DD
  pose: 'front' | 'side' | 'back';
  /** modo local: file:// en el directorio de documentos; modo nube: ruta en el bucket privado */
  uri: string;
  storagePath?: string;
}

export interface CheckinRecord {
  weekStart: string;
  answers: CheckIn;
  proposal: ReviewProposal;
  decision: 'pending' | 'accepted' | 'rejected' | 'modified';
  appliedDeltaKcal: number;
  decidedAt?: string;
}

export interface Settings {
  theme: ThemePref;
  workoutReminders: boolean;
  workoutTime: string; // 'HH:MM'
  mealReminders: boolean;
  calorieOffsetKcal: number; // suma de ajustes aceptados, acotada a ±500
}

export interface ShoppingState {
  days: number;
  checked: Record<string, boolean>;
  removed: string[];
  overrides: Record<string, number>; // foodId -> gramos
}

export interface Subscription {
  plan: PlanId;
  status: SubscriptionStatus;
  expiresAt: string | null;
  willRenew: boolean;
}

export interface AppState {
  ready: boolean; // cargado desde almacenamiento
  mode: Mode | null; // null = aún no elige (pantalla de bienvenida)
  lang: Lang; // idioma antes de tener perfil
  email: string | null; // modo nube
  userId: string | null; // modo nube
  profile: UserProfile | null;
  settings: Settings;
  workoutPlan: WorkoutPlan | null;
  weekPlan: WeekPlan | null;
  weekPlanKind: 'week' | 'preview' | null;
  sessions: SessionLog[];
  weights: WeightEntry[];
  measurements: Measurement[];
  mealLogs: Record<string, Record<string, MealLog>>; // fecha -> slotId -> registro
  photos: PhotoMeta[];
  checkins: CheckinRecord[];
  changes: { date: string; summary: string }[]; // historial de cambios del plan
  shopping: ShoppingState;
  subscription: Subscription; // modo nube: leído del SERVIDOR
  devPlan: PlanId | null; // sólo __DEV__: simular plan en modo local
  syncError: boolean;
}

export interface AppActions {
  setLang(lang: Lang): void;
  chooseMode(mode: Mode): Promise<void>;
  // autenticación (modo nube)
  signUp(email: string, password: string): Promise<{ ok: boolean; needsConfirm?: boolean; error?: string }>;
  signIn(email: string, password: string): Promise<{ ok: boolean; error?: string }>;
  sendResetCode(email: string): Promise<{ ok: boolean; error?: string }>;
  resetPassword(email: string, code: string, newPassword: string): Promise<{ ok: boolean; error?: string }>;
  signOut(): Promise<void>;
  // perfil y planes
  saveProfile(p: UserProfile): Promise<void>; // guarda y regenera rutina si cambió lo relevante
  regenerateWorkout(): Promise<void>;
  setWorkoutPlan(plan: WorkoutPlan, changeSummary?: string): Promise<void>;
  generateMealPlan(): Promise<{ ok: boolean; error?: string }>; // nube: función del servidor
  substituteIngredient(dayIndex: number, slotId: string, fromFoodId: string, toFoodId: string): Promise<{ ok: boolean; error?: string }>;
  replaceRecipe(dayIndex: number, slotId: string, recipeId: string): Promise<{ ok: boolean; error?: string }>;
  // registros
  addSession(s: SessionLog): Promise<void>;
  logWeight(date: string, weightKg: number): Promise<void>;
  saveMeasurement(m: Measurement): Promise<void>;
  setMealEaten(date: string, slotId: string, log: MealLog | null): Promise<void>;
  addPhoto(localUri: string, pose: PhotoMeta['pose'], date: string): Promise<void>;
  deletePhoto(id: string): Promise<void>;
  photoDisplayUri(p: PhotoMeta): Promise<string>; // nube: URL firmada temporal
  saveCheckin(c: CheckinRecord): Promise<void>; // si acepta/modifica, actualiza calorieOffsetKcal
  // ajustes
  updateSettings(patch: Partial<Settings>): Promise<void>;
  updateShopping(patch: Partial<ShoppingState>): Promise<void>;
  setDevPlan(plan: PlanId | null): void;
  refreshSubscription(): Promise<void>;
  // coach (nube): llama a la función ai-coach
  askCoachAI(message: string, history: { role: 'user' | 'assistant'; content: string }[]): Promise<
    { ok: true; text: string; remainingToday?: number } | { ok: false; error: 'limit' | 'unavailable' | 'no_account' }
  >;
  deleteAllData(): Promise<{ ok: boolean }>;
}

export interface AppContextValue {
  state: AppState;
  actions: AppActions;
  /** plan efectivo: nube = servidor; local = 'free' o devPlan en __DEV__ */
  plan: PlanId;
}
