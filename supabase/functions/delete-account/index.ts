// Elimina la cuenta y TODOS los datos del usuario (exigido por Apple 5.1.1(v)).
// Las tablas cuelgan de auth.users con ON DELETE CASCADE; las fotos se borran del almacenamiento.
import { adminClient, cors, json, logError, requireUser } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const auth = await requireUser(req);
  if ('error' in auth) return auth.error;
  const userId = auth.user.id;
  const admin = adminClient();
  try {
    const bucket = admin.storage.from('progress-photos');
    for (;;) {
      const { data, error } = await bucket.list(userId, { limit: 100 });
      if (error) throw error;
      if (!data?.length) break;
      const { error: rmErr } = await bucket.remove(data.map((f) => `${userId}/${f.name}`));
      if (rmErr) throw rmErr;
    }
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
    return json({ ok: true });
  } catch {
    await logError(admin, null, 'delete-account', 'failed');
    return json({ error: 'delete_failed' }, 500);
  }
});
