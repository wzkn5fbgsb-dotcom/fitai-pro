// Textos añadidos por pantallas en archivos separados: cada archivo exporta
// { es: { <espacio>: {...} }, en: { <espacio>: {...} } } con un espacio de nombres propio.
import { screensA } from './screensA';
import { screensB } from './screensB';
import { screensC } from './screensC';

export const EXTRA: { es: Record<string, unknown>; en: Record<string, unknown> }[] = [screensA, screensB, screensC];
