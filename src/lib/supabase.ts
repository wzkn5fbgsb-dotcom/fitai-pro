// Cliente de Supabase (sólo si hay backend configurado).
// La sesión se guarda en el almacén SQLite del teléfono.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { Storage } from './storage';
import { SUPABASE_ANON_KEY, SUPABASE_URL, cloudConfigured } from './config';

let client: SupabaseClient | null = null;
let appStateHooked = false;

export function getSupabase(): SupabaseClient | null {
  if (!cloudConfigured) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: Storage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
    hookAppState(client);
  }
  return client;
}

// Patrón recomendado por Supabase para React Native: refrescar el token sólo
// mientras la app está en primer plano.
function hookAppState(c: SupabaseClient): void {
  if (appStateHooked || Platform.OS === 'web') return;
  appStateHooked = true;
  AppState.addEventListener('change', (state: string) => {
    if (state === 'active') c.auth.startAutoRefresh();
    else c.auth.stopAutoRefresh();
  });
  if (AppState.currentState === 'active') c.auth.startAutoRefresh();
}
