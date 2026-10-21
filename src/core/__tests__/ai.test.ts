import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMessages, parseAiResponse, estimateCostUsd, systemPrompt } from '../ai.ts';

test('respuesta válida del modelo', () => {
  const r = parseAiResponse({ content: [{ type: 'text', text: '  Hola  ' }], usage: { input_tokens: 100, output_tokens: 20 } });
  assert.deepEqual(r, { ok: true, text: 'Hola', inputTokens: 100, outputTokens: 20 });
});

test('respuestas incorrectas del modelo se rechazan', () => {
  assert.deepEqual(parseAiResponse(null), { ok: false, error: 'malformed' });
  assert.deepEqual(parseAiResponse({ error: { type: 'overloaded_error' } }), { ok: false, error: 'malformed' });
  assert.deepEqual(parseAiResponse({ content: [] }), { ok: false, error: 'empty' });
  assert.deepEqual(parseAiResponse({ content: [{ type: 'tool_use', id: 'x' }] }), { ok: false, error: 'empty' });
  assert.deepEqual(parseAiResponse({ content: [{ type: 'text', text: 'Toma laxantes para bajar rápido' }] }), { ok: false, error: 'refused_unsafe' });
});

test('una respuesta que menciona riesgos pero deriva a un profesional se acepta', () => {
  const r = parseAiResponse({ content: [{ type: 'text', text: 'Purgarse es peligroso; habla con un profesional o llama al 988.' }] });
  assert.equal(r.ok, true);
});

test('el historial se limpia, alterna y empieza por el usuario', () => {
  const msgs = buildMessages({ goal: 'fat_loss' }, [
    { role: 'assistant', content: 'hola' },
    { role: 'user', content: 'a' },
    { role: 'user', content: 'b' },
    { role: 'assistant', content: 'c' },
    { role: 'user', content: 'pendiente' },
  ], 'pregunta');
  assert.equal(msgs[0].role, 'user');
  for (let i = 1; i < msgs.length; i++) assert.notEqual(msgs[i].role, msgs[i - 1].role);
  assert.ok(msgs[msgs.length - 1].content.includes('<user_data>'));
  assert.ok(msgs[msgs.length - 1].content.endsWith('pregunta'));
});

test('el mensaje del usuario se recorta y el sistema prohíbe inventar datos', () => {
  const msgs = buildMessages({}, [], 'x'.repeat(5000));
  assert.ok(msgs[0].content.length < 1100);
  assert.match(systemPrompt('es'), /Never invent/);
});

test('costo estimado', () => {
  assert.equal(estimateCostUsd(1_000_000, 0, 1, 5), 1);
  assert.equal(estimateCostUsd(0, 200_000, 1, 5), 1);
});
