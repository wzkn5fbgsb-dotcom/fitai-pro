// Conversión de unidades. Todo se guarda en métrico; se convierte sólo para mostrar.
export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}
export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}
export function inToCm(inches: number): number {
  return inches * CM_PER_IN;
}
export function cmToIn(cm: number): number {
  return cm / CM_PER_IN;
}
export function ftInToCm(ft: number, inches: number): number {
  return inToCm(ft * 12 + inches);
}
export function cmToFtIn(cm: number): { ft: number; inches: number } {
  const total = Math.round(cmToIn(cm));
  return { ft: Math.floor(total / 12), inches: total % 12 };
}

export function round(value: number, step = 1): number {
  return Math.round(value / step) * step;
}

/** Redondeo hacia arriba a un múltiplo (para la lista de compras). */
export function roundUp(value: number, step = 1): number {
  return Math.ceil(value / step - 1e-9) * step;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

/** Peso de referencia para un IMC dado (se usa para no inflar la proteína con IMC alto). */
export function weightAtBmi(targetBmi: number, heightCm: number): number {
  const m = heightCm / 100;
  return targetBmi * m * m;
}

export function formatWeight(kg: number, units: 'metric' | 'imperial'): string {
  return units === 'metric' ? `${round(kg, 0.1).toFixed(1)} kg` : `${round(kgToLb(kg), 0.1).toFixed(1)} lb`;
}

export function formatHeight(cm: number, units: 'metric' | 'imperial'): string {
  if (units === 'metric') return `${Math.round(cm)} cm`;
  const { ft, inches } = cmToFtIn(cm);
  return `${ft}' ${inches}"`;
}

export function formatLength(cm: number, units: 'metric' | 'imperial'): string {
  return units === 'metric' ? `${round(cm, 0.1).toFixed(1)} cm` : `${round(cmToIn(cm), 0.1).toFixed(1)} in`;
}
