// Configuración pública de la app. Expo incrusta las variables EXPO_PUBLIC_* al compilar.
// Sin URL/clave de Supabase la app funciona sólo en modo local.
import { Platform } from 'react-native';

export const SUPABASE_URL: string = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY: string = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const REVENUECAT_IOS_KEY: string = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
export const REVENUECAT_ANDROID_KEY: string = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';

/** Hay backend (Supabase) configurado: se puede ofrecer el modo nube. */
export const cloudConfigured: boolean = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

/** Clave de RevenueCat de la plataforma actual ('' si no hay). */
export const revenueCatKey: string =
  Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : Platform.OS === 'android' ? REVENUECAT_ANDROID_KEY : '';

/** Las compras sólo existen con backend y clave de la tienda de esta plataforma. */
export const purchasesConfigured: boolean = cloudConfigured && revenueCatKey.length > 0;
