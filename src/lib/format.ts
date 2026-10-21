import { cmToIn, inToCm, kgToLb, lbToKg, type UnitSystem } from '../core';

export const weightUnit = (u: UnitSystem) => (u === 'metric' ? 'kg' : 'lb');
export const lengthUnit = (u: UnitSystem) => (u === 'metric' ? 'cm' : 'in');

export function fmtNum(n: number, decimals = 0): string {
  return n.toFixed(decimals).replace(/\.0+$/, '');
}
export function kgToDisplay(kg: number, u: UnitSystem): number {
  return u === 'metric' ? kg : kgToLb(kg);
}
export function displayWeightToKg(v: number, u: UnitSystem): number {
  return u === 'metric' ? v : lbToKg(v);
}
export function fmtWeight(kg: number, u: UnitSystem, decimals = 1): string {
  return `${fmtNum(kgToDisplay(kg, u), decimals)} ${weightUnit(u)}`;
}
export function cmToDisplay(cm: number, u: UnitSystem): number {
  return u === 'metric' ? cm : cmToIn(cm);
}
export function displayToCm(v: number, u: UnitSystem): number {
  return u === 'metric' ? v : inToCm(v);
}
