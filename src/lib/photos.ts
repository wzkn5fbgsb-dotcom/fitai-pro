// Fotos de progreso.
// - Modo local: copia en el directorio de documentos de la app.
// - Modo nube: bucket PRIVADO 'progress-photos', ruta `${userId}/${id}.jpg`, se muestran con URL firmada.
import { Directory, File, Paths } from 'expo-file-system';
import { getSupabase } from './supabase';

export const PHOTO_BUCKET = 'progress-photos';
const DIR_NAME = 'progress-photos';

function photosDir(): Directory {
  const dir = new Directory(Paths.document, DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** Copia la imagen elegida al almacenamiento de la app y devuelve su uri file://. */
export async function saveLocalPhoto(sourceUri: string, id: string): Promise<string> {
  const dest = new File(photosDir(), `${id}.jpg`);
  if (dest.exists) dest.delete();
  await new File(sourceUri).copy(dest);
  return dest.uri;
}

export function deleteLocalPhoto(uri: string): void {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // ya no existe
  }
}

/** Borra todas las fotos locales (al eliminar los datos). */
export function deleteAllLocalPhotos(): void {
  try {
    const dir = new Directory(Paths.document, DIR_NAME);
    if (dir.exists) dir.delete();
  } catch {
    // nada
  }
}

export function storagePathFor(userId: string, id: string): string {
  return `${userId}/${id}.jpg`;
}

/** Sube la imagen al bucket privado. Devuelve la ruta en el bucket. */
export async function uploadPhoto(sourceUri: string, userId: string, id: string): Promise<string> {
  const sb = getSupabase();
  if (!sb) throw new Error('no_cloud');
  const path = storagePathFor(userId, id);
  const bytes = await new File(sourceUri).arrayBuffer();
  const { error } = await sb.storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

/** URL temporal (1 h) para mostrar una foto del bucket privado. */
export async function signedPhotoUrl(path: string): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.storage.from(PHOTO_BUCKET).createSignedUrl(path, 3600);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function deleteCloudPhoto(path: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.storage.from(PHOTO_BUCKET).remove([path]);
  if (error) throw error;
}
