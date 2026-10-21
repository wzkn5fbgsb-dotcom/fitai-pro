// Borrador del perfil durante el onboarding y su resumen.
// Los parámetros de ruta no pueden llevar objetos, así que el borrador vive en
// memoria (módulo) y las pantallas se suscriben con useDraft().
import { useSyncExternalStore } from 'react';
import type { UserProfile } from '../core';

let draft: UserProfile | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function getDraft(): UserProfile | null {
  return draft;
}

export function setDraft(p: UserProfile | null): void {
  if (p === draft) return;
  draft = p;
  emit();
}

export function clearDraft(): void {
  setDraft(null);
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Borrador actual; la pantalla se vuelve a dibujar cuando cambia. */
export function useDraft(): UserProfile | null {
  return useSyncExternalStore(subscribe, getDraft, getDraft);
}
