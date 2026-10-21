// Compras dentro de la app con RevenueCat (react-native-purchases).
// El módulo nativo se carga de forma perezosa: si falta (Expo Go, web) la app no se cae.
// El SERVIDOR es la fuente de verdad: tras comprar, la app llama a refreshSubscription()
// y nunca desbloquea funciones localmente.
import { Platform } from 'react-native';
import { purchasesConfigured, revenueCatKey } from './config';

export type PaidPlan = 'pro' | 'elite';
export type BillingPeriod = 'monthly' | 'annual';

export interface StorePackage {
  id: string;
  plan: PaidPlan;
  period: BillingPeriod;
  priceString: string;
  product: unknown; // StoreProduct de RevenueCat
}

/* eslint-disable @typescript-eslint/no-explicit-any */
let mod: any | null | undefined;
function rc(): any | null {
  if (mod !== undefined) return mod;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('react-native-purchases');
    mod = m?.default ?? m ?? null;
  } catch {
    mod = null;
  }
  return mod;
}

let configuredFor: string | null = null;
let packagesCache: Map<string, any> = new Map();

export function purchasesAvailable(): boolean {
  return purchasesConfigured && rc() !== null && Platform.OS !== 'web';
}

/** Configura RevenueCat con el id de usuario de Supabase como app_user_id. */
export async function configurePurchases(userId: string): Promise<boolean> {
  const P = rc();
  if (!purchasesConfigured || !P || !userId) return false;
  try {
    if (configuredFor === null) {
      P.configure({ apiKey: revenueCatKey, appUserID: userId });
      configuredFor = userId;
    } else if (configuredFor !== userId) {
      await P.logIn(userId);
      configuredFor = userId;
    }
    return true;
  } catch {
    return false;
  }
}

/** Cierra la sesión de la tienda al salir de la cuenta. */
export async function logOutPurchases(): Promise<void> {
  const P = rc();
  if (!P || configuredFor === null) return;
  try {
    await P.logOut();
  } catch {
    // usuario anónimo u otro error: se ignora
  }
  configuredFor = null;
  packagesCache = new Map();
}

/** Paquetes de la oferta actual. */
export async function getPackages(): Promise<StorePackage[]> {
  const P = rc();
  if (!P || configuredFor === null) return [];
  try {
    const offerings = await P.getOfferings();
    const pkgs: any[] = offerings?.current?.availablePackages ?? [];
    const out: StorePackage[] = [];
    packagesCache = new Map();
    for (const p of pkgs) {
      const type = String(p.packageType ?? '');
      const period: BillingPeriod | null = type === 'ANNUAL' ? 'annual' : type === 'MONTHLY' ? 'monthly' : null;
      if (!period) continue;
      const productId = String(p.product?.identifier ?? '').toLowerCase();
      const pkgId = String(p.identifier ?? '').toLowerCase();
      const plan: PaidPlan = productId.includes('elite') || pkgId.includes('elite') ? 'elite' : 'pro';
      packagesCache.set(p.identifier, p);
      out.push({ id: p.identifier, plan, period, priceString: String(p.product?.priceString ?? ''), product: p.product });
    }
    return out;
  } catch {
    return [];
  }
}

export type PurchaseResult = { ok: true } | { ok: false; error: 'cancelled' | 'unavailable' | 'failed' };

export async function purchase(pkgId: string): Promise<PurchaseResult> {
  const P = rc();
  if (!P || configuredFor === null) return { ok: false, error: 'unavailable' };
  try {
    let pkg = packagesCache.get(pkgId);
    if (!pkg) {
      await getPackages();
      pkg = packagesCache.get(pkgId);
    }
    if (!pkg) return { ok: false, error: 'unavailable' };
    await P.purchasePackage(pkg);
    return { ok: true };
  } catch (e: any) {
    if (e?.userCancelled) return { ok: false, error: 'cancelled' };
    return { ok: false, error: 'failed' };
  }
}

/** Restaura compras: la tienda avisa al servidor (webhook) y luego se relee la suscripción. */
export async function restore(): Promise<{ ok: boolean }> {
  const P = rc();
  if (!P || configuredFor === null) return { ok: false };
  try {
    await P.restorePurchases();
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Página de la tienda para gestionar o cancelar la suscripción. */
export function manageUrl(): string {
  return Platform.OS === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions';
}
