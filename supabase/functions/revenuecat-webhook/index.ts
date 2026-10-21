// Webhook de RevenueCat → estado de la suscripción en la base de datos.
// Seguridad: cabecera Authorization secreta + idempotencia por id de evento.
// El acceso premium SIEMPRE se decide con esta tabla (servidor), nunca con la app.
import { applyStoreEvent, type StoreEventType, type SubscriptionState } from '../_shared/core/index.ts';
import { adminClient, env, json, logError } from '../_shared/http.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const expected = `Bearer ${env('REVENUECAT_WEBHOOK_AUTH')}`;
  if (!timingSafeEqual(req.headers.get('Authorization') ?? '', expected)) return json({ error: 'unauthorized' }, 401);

  const admin = adminClient();
  let payload: { event?: Record<string, unknown> };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const ev = payload.event ?? {};
  const eventId = String(ev.id ?? '');
  const type = String(ev.type ?? '') as StoreEventType;
  const appUserId = String(ev.app_user_id ?? '');
  if (!eventId || !type) return json({ error: 'bad_event' }, 400);
  const userId = UUID.test(appUserId) ? appUserId : null;

  // Idempotencia: el id del evento es único; un reenvío no se procesa dos veces.
  const { error: insErr } = await admin.from('payment_events').insert({
    event_id: eventId,
    user_id: userId,
    event_type: type,
    product_id: typeof ev.product_id === 'string' ? ev.product_id : null,
    price_usd: typeof ev.price === 'number' ? ev.price : null,
    store: typeof ev.store === 'string' ? ev.store : null,
    environment: typeof ev.environment === 'string' ? ev.environment : null,
    payload,
  });
  if (insErr) {
    if (insErr.code === '23505') return json({ ok: true, duplicate: true });
    await logError(admin, userId, 'revenuecat-webhook', `insert_${insErr.code}`);
    return json({ error: 'db_error' }, 500); // RevenueCat reintentará
  }
  if (!userId) return json({ ok: true, ignored: 'anonymous_user' });

  const { data: row } = await admin.from('subscriptions').select('plan,status,expires_at,will_renew').eq('user_id', userId).maybeSingle();
  const prev: SubscriptionState = row
    ? { plan: row.plan, status: row.status, expiresAt: row.expires_at, willRenew: row.will_renew }
    : { plan: 'free', status: 'expired', expiresAt: null, willRenew: false };
  const next = applyStoreEvent(prev, {
    type,
    entitlementIds: Array.isArray(ev.entitlement_ids) ? (ev.entitlement_ids as string[]) : [],
    expirationAtMs: typeof ev.expiration_at_ms === 'number' ? ev.expiration_at_ms : null,
    nowMs: Date.now(),
  });
  const { error: upErr } = await admin.from('subscriptions').upsert({
    user_id: userId,
    plan: next.plan,
    status: next.status,
    expires_at: next.expiresAt,
    will_renew: next.willRenew,
    store: typeof ev.store === 'string' ? ev.store : null,
    product_id: typeof ev.product_id === 'string' ? ev.product_id : null,
  });
  if (upErr) {
    await logError(admin, userId, 'revenuecat-webhook', `upsert_${upErr.code}`);
    // Se borra el evento para que el reintento de RevenueCat pueda procesarlo.
    await admin.from('payment_events').delete().eq('event_id', eventId);
    return json({ error: 'db_error' }, 500);
  }
  await admin.from('payment_events').update({ processed_at: new Date().toISOString() }).eq('event_id', eventId);
  return json({ ok: true });
});
