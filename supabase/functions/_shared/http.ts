// Utilidades comunes de las funciones Edge (Deno).
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

export function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

/** Cliente con privilegios de servidor (ignora RLS). Nunca se expone a la app. */
export function adminClient(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
}

/** Valida el token del usuario que llama. */
export async function requireUser(req: Request): Promise<{ user: User } | { error: Response }> {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return { error: json({ error: 'unauthorized' }, 401) };
  const client = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return { error: json({ error: 'unauthorized' }, 401) };
  return { user: data.user };
}

/** Registra un error técnico SIN datos personales (sólo origen y código). */
export async function logError(admin: SupabaseClient, userId: string | null, source: string, code: string): Promise<void> {
  try {
    await admin.from('app_errors').insert({ user_id: userId, source, code: code.slice(0, 80) });
  } catch {
    // el registro de errores nunca debe tumbar la función
  }
}

export async function currentPlan(admin: SupabaseClient, userId: string): Promise<'free' | 'pro' | 'elite'> {
  const { data, error } = await admin.rpc('current_plan', { uid: userId });
  if (error) throw error;
  return (data as 'free' | 'pro' | 'elite') ?? 'free';
}
