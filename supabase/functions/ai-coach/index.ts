// AI COACH — responde con datos reales del usuario.
// 1) Preguntas frecuentes: reglas deterministas (sin costo de IA).
// 2) El resto: modelo de IA con límites por plan validados en el servidor.
import {
  answerLocally,
  buildMessages,
  checkAiUsage,
  contextSummary,
  estimateCostUsd,
  parseAiResponse,
  systemPrompt,
  MAX_USER_MESSAGE,
  type ChatTurn,
  type Lang,
} from '../_shared/core/index.ts';
import { adminClient, cors, currentPlan, env, json, logError, requireUser } from '../_shared/http.ts';
import { loadUserData, toCoachContext } from '../_shared/context.ts';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const auth = await requireUser(req);
  if ('error' in auth) return auth.error;
  const userId = auth.user.id;
  const admin = adminClient();

  let body: { message?: unknown; lang?: unknown; history?: unknown; today?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message || message.length > MAX_USER_MESSAGE) return json({ error: 'bad_message' }, 400);
  const lang: Lang = body.lang === 'en' ? 'en' : 'es';
  const today = typeof body.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : new Date().toISOString().slice(0, 10);
  const history = Array.isArray(body.history) ? (body.history as ChatTurn[]) : [];

  const data = await loadUserData(admin, userId, today);
  if (!data) return json({ error: 'no_profile' }, 409);
  const ctx = toCoachContext(data, lang, today);

  // 1) Respuesta determinista con datos reales
  const local = answerLocally(message, ctx);
  if (local.handled) return json({ text: local.text, source: 'rules', intent: local.intent });

  // 2) Límites por plan (validados en el servidor) y detección de abuso
  const plan = await currentPlan(admin, userId);
  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const minuteAgo = new Date(now.getTime() - 60_000).toISOString();
  const [d, m, burst] = await Promise.all([
    admin.from('ai_usage').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('success', true).gte('created_at', dayStart),
    admin.from('ai_usage').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('success', true).gte('created_at', monthStart),
    admin.from('ai_usage').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', minuteAgo),
  ]);
  if ((burst.count ?? 0) >= 6) {
    await logError(admin, userId, 'ai-coach', 'rate_burst');
    return json({ error: 'too_many_requests' }, 429);
  }
  const usage = checkAiUsage(plan, d.count ?? 0, m.count ?? 0);
  if (!usage.allowed) return json({ error: 'limit_reached', reason: usage.reason, plan }, 429);

  // Presupuesto global de IA (alerta y corte de seguridad)
  const { data: cfg } = await admin.from('plan_config').select('ai_monthly_budget_usd').eq('id', 1).maybeSingle();
  const { data: spent } = await admin.from('ai_usage').select('est_cost_usd').gte('created_at', monthStart);
  const spentUsd = (spent ?? []).reduce((a, r) => a + Number(r.est_cost_usd), 0);
  if (cfg && spentUsd >= Number(cfg.ai_monthly_budget_usd)) {
    await logError(admin, null, 'ai-coach', 'budget_exceeded');
    return json({ error: 'ai_unavailable' }, 503);
  }

  // 3) Llamada al modelo
  const model = Deno.env.get('AI_MODEL') ?? 'claude-haiku-5-5';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'x-api-key': env('ANTHROPIC_API_KEY'),
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 600,
        system: systemPrompt(lang),
        messages: buildMessages(contextSummary(ctx), history, message),
      }),
    });
  } catch {
    clearTimeout(timer);
    await logError(admin, userId, 'ai-coach', 'upstream_network');
    return json({ error: 'ai_unavailable' }, 502);
  }
  clearTimeout(timer);
  if (!res.ok) {
    await logError(admin, userId, 'ai-coach', `upstream_${res.status}`);
    return json({ error: 'ai_unavailable' }, res.status === 429 ? 503 : 502);
  }
  const parsed = parseAiResponse(await res.json().catch(() => null));
  if (!parsed.ok) {
    await logError(admin, userId, 'ai-coach', `bad_output_${parsed.error}`);
    return json({ error: 'ai_bad_output' }, 502);
  }
  const cost = estimateCostUsd(
    parsed.inputTokens,
    parsed.outputTokens,
    Number(Deno.env.get('AI_PRICE_IN_PER_MTOK') ?? '1'),
    Number(Deno.env.get('AI_PRICE_OUT_PER_MTOK') ?? '5'),
  );
  await admin.from('ai_usage').insert({
    user_id: userId,
    model,
    intent: 'free_text',
    input_tokens: parsed.inputTokens,
    output_tokens: parsed.outputTokens,
    est_cost_usd: cost,
    success: true,
  });
  return json({ text: parsed.text, source: 'ai', remainingToday: Math.max(0, usage.remainingToday - 1) });
});
