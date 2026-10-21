// Almacenamiento clave-valor persistente (SQLite) para el caché local y la sesión de Supabase.
import Storage from 'expo-sqlite/kv-store';

export { Storage };

export async function loadJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await Storage.getItem(key);
    if (raw == null) return null;
    return JSON.parse(raw) as T;
  } catch {
    // dato corrupto o almacenamiento no disponible: se trata como vacío
    return null;
  }
}

export async function saveJSON(key: string, value: unknown): Promise<void> {
  try {
    await Storage.setItem(key, JSON.stringify(value));
  } catch {
    // no se pudo escribir: el estado sigue en memoria
  }
}

export async function remove(key: string): Promise<void> {
  try {
    await Storage.removeItem(key);
  } catch {
    // nada que hacer
  }
}
