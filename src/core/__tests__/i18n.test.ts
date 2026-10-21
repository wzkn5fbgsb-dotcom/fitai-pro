import { test } from 'node:test';
import assert from 'node:assert/strict';
import { es } from '../../i18n/es.ts';
import { en } from '../../i18n/en.ts';

type Leaf = { path: string; value: unknown };

function walk(node: unknown, path: string, out: Map<string, unknown>): void {
  if (Array.isArray(node)) {
    out.set(path, node);
    node.forEach((v, i) => walk(v, `${path}[${i}]`, out));
  } else if (node !== null && typeof node === 'object') {
    out.set(path, node);
    for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k, out);
  } else {
    out.set(path, node);
  }
}

function flatten(obj: unknown): Map<string, unknown> {
  const out = new Map<string, unknown>();
  walk(obj, '', out);
  out.delete('');
  return out;
}

function strings(obj: unknown): Leaf[] {
  return [...flatten(obj)].filter(([, v]) => typeof v === 'string').map(([path, value]) => ({ path, value }));
}

function placeholders(s: string): string[] {
  return [...new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();
}

const esFlat = flatten(es);
const enFlat = flatten(en);

test('es y en tienen exactamente las mismas claves (recursivo)', () => {
  const esKeys = [...esFlat.keys()].sort();
  const enKeys = [...enFlat.keys()].sort();
  assert.deepEqual(enKeys, esKeys);
});

test('los nodos coinciden en tipo y los arrays en longitud', () => {
  for (const [path, v] of esFlat) {
    const w = enFlat.get(path);
    assert.equal(Array.isArray(w), Array.isArray(v), `tipo array distinto en ${path}`);
    assert.equal(typeof w, typeof v, `tipo distinto en ${path}`);
    if (Array.isArray(v)) assert.equal((w as unknown[]).length, v.length, `longitud distinta en ${path}`);
  }
});

test('ningún texto está vacío', () => {
  for (const { path, value } of [...strings(es), ...strings(en)]) {
    assert.ok((value as string).trim().length > 0, `texto vacío en ${path}`);
  }
});

test('los {placeholders} coinciden en cada texto', () => {
  for (const { path, value } of strings(es)) {
    const other = enFlat.get(path);
    assert.equal(typeof other, 'string', `falta texto en en: ${path}`);
    assert.deepEqual(placeholders(other as string), placeholders(value as string), `placeholders distintos en ${path}`);
  }
});
