// Construcción de la petición al modelo de IA y validación de su respuesta.
// Funciones puras para poder probar respuestas incorrectas o vacías del modelo.
import { detectRiskSignals } from './safety.ts';
import type { Lang } from './types.ts';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export const MAX_USER_MESSAGE = 1000;
export const MAX_HISTORY_TURNS = 6;

export function systemPrompt(lang: Lang): string {
  const es = lang === 'es';
  return [
    es
      ? 'Eres AI COACH de FITAI PRO, un asistente de entrenamiento y nutrición deportiva. Responde en español, breve y claro (máximo 150 palabras).'
      : 'You are AI COACH for FITAI PRO, a training and sports-nutrition assistant. Answer in English, briefly and clearly (max 150 words).',
    'Rules:',
    '1. Use ONLY the user data provided in <user_data>. If a fact about the user is not there, say you do not have it. Never invent logs, foods eaten, weights or results.',
    '2. Never give calorie or macro numbers that are not in <user_data>; the app computes them with a validated engine. Do not change goals, delete records or take actions: suggest the user do it in the app.',
    '3. Clearly separate general information, estimates, and things that need a professional.',
    '4. Do not diagnose, treat injuries or medical conditions, or recommend supplements, drugs, dehydration, purging, extreme fasting or very-low-calorie diets. For pain, injuries, pregnancy, eating-disorder signs or medical conditions, recommend a qualified professional.',
    '5. Do not claim hormonal or metabolic effects of foods without strong evidence. Do not promise specific results in a fixed time.',
  ].join('\n');
}

export function buildMessages(userData: Record<string, unknown>, history: ChatTurn[], message: string): ChatTurn[] {
  const clean = history
    .filter((t) => (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string' && t.content.trim())
    .slice(-MAX_HISTORY_TURNS)
    .map((t) => ({ role: t.role, content: t.content.slice(0, MAX_USER_MESSAGE) }));
  // La API exige que el primer turno sea del usuario y que alternen.
  while (clean.length && clean[0].role !== 'user') clean.shift();
  const alternated: ChatTurn[] = [];
  for (const t of clean) {
    if (alternated.length && alternated[alternated.length - 1].role === t.role) alternated[alternated.length - 1] = t;
    else alternated.push(t);
  }
  if (alternated.length && alternated[alternated.length - 1].role === 'user') alternated.pop();
  const content = `<user_data>\n${JSON.stringify(userData)}\n</user_data>\n\n${message.slice(0, MAX_USER_MESSAGE)}`;
  return [...alternated, { role: 'user', content }];
}

export type ParsedAi =
  | { ok: true; text: string; inputTokens: number; outputTokens: number }
  | { ok: false; error: 'empty' | 'malformed' | 'refused_unsafe' };

/** Valida la respuesta de la API de Messages. Nunca confía a ciegas en el modelo. */
export function parseAiResponse(body: unknown): ParsedAi {
  if (!body || typeof body !== 'object') return { ok: false, error: 'malformed' };
  const b = body as { content?: unknown; usage?: { input_tokens?: number; output_tokens?: number } };
  if (!Array.isArray(b.content)) return { ok: false, error: 'malformed' };
  const text = b.content
    .filter((c): c is { type: string; text: string } => !!c && typeof c === 'object' && (c as { type?: string }).type === 'text' && typeof (c as { text?: unknown }).text === 'string')
    .map((c) => c.text)
    .join('\n')
    .trim();
  if (!text) return { ok: false, error: 'empty' };
  // Si la respuesta contiene señales de riesgo (p. ej., recomienda purgas), se descarta.
  if (detectRiskSignals(text) && !/profesional|professional|988|911/i.test(text)) return { ok: false, error: 'refused_unsafe' };
  return {
    ok: true,
    text: text.slice(0, 2000),
    inputTokens: Number(b.usage?.input_tokens ?? 0),
    outputTokens: Number(b.usage?.output_tokens ?? 0),
  };
}

export function estimateCostUsd(inputTokens: number, outputTokens: number, pricePerMTokIn: number, pricePerMTokOut: number): number {
  return (inputTokens * pricePerMTokIn + outputTokens * pricePerMTokOut) / 1_000_000;
}
