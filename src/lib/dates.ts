// Fechas en hora LOCAL del teléfono (YYYY-MM-DD). Lunes = 0.
const pad = (n: number) => String(n).padStart(2, '0');

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function todayStr(): string {
  return toDateStr(new Date());
}
export function weekdayIndex(d: Date = new Date()): number {
  return (d.getDay() + 6) % 7;
}
export function addDays(date: string, n: number): string {
  const [y, m, dd] = date.split('-').map(Number);
  return toDateStr(new Date(y, m - 1, dd + n));
}
/** Lunes de la semana de la fecha dada. */
export function weekStart(date: string = todayStr()): string {
  const [y, m, dd] = date.split('-').map(Number);
  const d = new Date(y, m - 1, dd);
  return addDays(date, -weekdayIndex(d));
}
export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}
export function formatDate(date: string, lang: 'es' | 'en'): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { day: 'numeric', month: 'short' });
}
