// Membresías: niveles, funciones y límites. El servidor usa ESTE MISMO archivo
// (copiado a supabase/functions/_shared/core) para validar el acceso; ocultar
// botones en la app es sólo una comodidad visual.
export type PlanId = 'free' | 'pro' | 'elite';
export const PLAN_ORDER: PlanId[] = ['free', 'pro', 'elite'];

export type Feature =
  | 'basic_routine'
  | 'custom_routine' // cambiar ejercicios, regenerar con preferencias
  | 'nutrition_targets'
  | 'nutrition_preview' // una comida de ejemplo
  | 'daily_meal_plan'
  | 'weekly_meal_plan'
  | 'shopping_list'
  | 'meal_substitution'
  | 'full_progress' // medidas, fotos, fuerza e historial completo
  | 'weekly_review_adjustments'
  | 'workout_history'
  | 'photo_comparison'
  | 'ai_coach';

export const FEATURES: Record<PlanId, Feature[]> = {
  free: ['basic_routine', 'nutrition_targets', 'nutrition_preview', 'ai_coach'],
  pro: [
    'basic_routine',
    'custom_routine',
    'nutrition_targets',
    'nutrition_preview',
    'daily_meal_plan',
    'weekly_meal_plan',
    'shopping_list',
    'meal_substitution',
    'full_progress',
    'weekly_review_adjustments',
    'workout_history',
    'ai_coach',
  ],
  elite: [
    'basic_routine',
    'custom_routine',
    'nutrition_targets',
    'nutrition_preview',
    'daily_meal_plan',
    'weekly_meal_plan',
    'shopping_list',
    'meal_substitution',
    'full_progress',
    'weekly_review_adjustments',
    'workout_history',
    'photo_comparison',
    'ai_coach',
  ],
};

/** Funciones Elite anunciadas pero AÚN NO construidas. Se muestran como "en desarrollo". */
export const ELITE_PLANNED = ['photo_ai_analysis', 'device_integrations', 'progress_reports'] as const;

export interface PlanLimits {
  aiMessagesPerDay: number;
  aiMessagesPerMonth: number;
  progressHistoryDays: number | null; // null = sin límite
  weightEntriesVisible: number | null;
}

export const LIMITS: Record<PlanId, PlanLimits> = {
  free: { aiMessagesPerDay: 3, aiMessagesPerMonth: 30, progressHistoryDays: 30, weightEntriesVisible: 30 },
  pro: { aiMessagesPerDay: 30, aiMessagesPerMonth: 400, progressHistoryDays: null, weightEntriesVisible: null },
  elite: { aiMessagesPerDay: 80, aiMessagesPerMonth: 1500, progressHistoryDays: null, weightEntriesVisible: null },
};

export interface PriceConfig {
  monthlyUsd: Record<Exclude<PlanId, 'free'>, number>;
  annualDiscountPct: number; // configurable desde el panel administrativo
}

/** Hipótesis iniciales de precio: deben validarse con pruebas comerciales. */
export const DEFAULT_PRICES: PriceConfig = {
  monthlyUsd: { pro: 9.99, elite: 19.99 },
  annualDiscountPct: 30,
};

export function annualPrice(plan: Exclude<PlanId, 'free'>, cfg: PriceConfig = DEFAULT_PRICES): number {
  const raw = cfg.monthlyUsd[plan] * 12 * (1 - cfg.annualDiscountPct / 100);
  // Precio "psicológico" terminado en .99 más cercano.
  return Math.round((Math.round(raw) - 0.01) * 100) / 100;
}

export function can(plan: PlanId, feature: Feature): boolean {
  return FEATURES[plan].includes(feature);
}

export function minimumPlanFor(feature: Feature): PlanId {
  return PLAN_ORDER.find((p) => can(p, feature)) ?? 'elite';
}

export function planRank(p: PlanId): number {
  return PLAN_ORDER.indexOf(p);
}

export interface UsageCheck {
  allowed: boolean;
  reason?: 'daily_limit' | 'monthly_limit';
  remainingToday: number;
}

export function checkAiUsage(plan: PlanId, usedToday: number, usedThisMonth: number): UsageCheck {
  const l = LIMITS[plan];
  if (usedThisMonth >= l.aiMessagesPerMonth) return { allowed: false, reason: 'monthly_limit', remainingToday: 0 };
  if (usedToday >= l.aiMessagesPerDay) return { allowed: false, reason: 'daily_limit', remainingToday: 0 };
  return { allowed: true, remainingToday: Math.min(l.aiMessagesPerDay - usedToday, l.aiMessagesPerMonth - usedThisMonth) };
}

// --------------------------------------------------------------- suscripciones
/** Eventos de RevenueCat que nos interesan (https://www.revenuecat.com/docs/webhooks). */
export type StoreEventType =
  | 'INITIAL_PURCHASE'
  | 'RENEWAL'
  | 'PRODUCT_CHANGE'
  | 'CANCELLATION'
  | 'UNCANCELLATION'
  | 'EXPIRATION'
  | 'BILLING_ISSUE'
  | 'SUBSCRIPTION_PAUSED'
  | 'TRANSFER'
  | 'TEST';

export type SubscriptionStatus = 'active' | 'in_grace' | 'billing_issue' | 'cancelled_active' | 'expired' | 'paused';

export interface SubscriptionState {
  plan: PlanId;
  status: SubscriptionStatus;
  expiresAt: string | null;
  willRenew: boolean;
}

/** Plan correspondiente a un "entitlement" de la tienda. */
export function planFromEntitlements(ids: string[]): PlanId {
  if (ids.includes('elite')) return 'elite';
  if (ids.includes('pro')) return 'pro';
  return 'free';
}

/** Aplica un evento de la tienda al estado de la suscripción (función pura, testeable). */
export function applyStoreEvent(
  prev: SubscriptionState,
  ev: { type: StoreEventType; entitlementIds: string[]; expirationAtMs: number | null; nowMs: number },
): SubscriptionState {
  const expiresAt = ev.expirationAtMs ? new Date(ev.expirationAtMs).toISOString() : prev.expiresAt;
  const evPlan = planFromEntitlements(ev.entitlementIds);
  switch (ev.type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'UNCANCELLATION':
    case 'PRODUCT_CHANGE':
    case 'TRANSFER':
      return { plan: evPlan === 'free' ? prev.plan : evPlan, status: 'active', expiresAt, willRenew: true };
    case 'CANCELLATION':
      // Cancelada: conserva el acceso hasta la fecha de expiración.
      return { ...prev, status: 'cancelled_active', expiresAt, willRenew: false };
    case 'BILLING_ISSUE':
      return { ...prev, status: 'billing_issue', expiresAt };
    case 'SUBSCRIPTION_PAUSED':
      return { ...prev, status: 'paused', willRenew: false };
    case 'EXPIRATION':
      return { plan: 'free', status: 'expired', expiresAt, willRenew: false };
    case 'TEST':
    default:
      return prev;
  }
}

/** Plan efectivo en este momento (lo que el servidor usa para conceder acceso). */
export function effectivePlan(s: SubscriptionState | null, nowMs: number): PlanId {
  if (!s) return 'free';
  if (s.status === 'expired' || s.status === 'paused') return 'free';
  if (s.expiresAt && Date.parse(s.expiresAt) < nowMs) return 'free';
  return s.plan;
}
