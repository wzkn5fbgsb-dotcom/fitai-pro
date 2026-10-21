// Traducciones. Uso: const { t, tx, lang } = useI18n(); t('home.hello'); t('training.dayN', { n: 2 })
// tx(path) devuelve el valor crudo (arreglos u objetos), p. ej. tx<string[]>('nutrition.dayNames').
import { useApp } from '../data/store';
import { en } from './en';
import { es, type Strings } from './es';
import type { Lang } from '../core/types';
import { EXTRA } from './extra';

export const STRINGS: Record<Lang, Strings> = { es, en };

export function lookup(lang: Lang, path: string): unknown {
  const v = walk(STRINGS[lang], path);
  if (v !== undefined) return v;
  for (const x of EXTRA) {
    const e = walk(x[lang], path);
    if (e !== undefined) return e;
  }
  return undefined;
}

function walk(root: unknown, path: string): unknown {
  let cur: unknown = root;
  for (const k of path.split('.')) {
    if (cur && typeof cur === 'object' && k in (cur as Record<string, unknown>)) cur = (cur as Record<string, unknown>)[k];
    else return undefined;
  }
  return cur;
}

export function translate(lang: Lang, path: string, vars?: Record<string, string | number>): string {
  const v = lookup(lang, path);
  if (typeof v !== 'string') return path;
  return vars ? v.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`)) : v;
}

export function useI18n() {
  const { state } = useApp();
  const lang: Lang = state.profile?.lang ?? state.lang;
  return {
    lang,
    t: (path: string, vars?: Record<string, string | number>) => translate(lang, path, vars),
    tx: <T,>(path: string) => lookup(lang, path) as T,
  };
}
