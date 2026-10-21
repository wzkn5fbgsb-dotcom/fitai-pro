import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mifflinStJeor, estimateEnergy, stepsFactor } from '../energy.ts';
import { computeTargets, macrosConsistent, calorieFloor } from '../targets.ts';
import { GOALS } from '../types.ts';
import { lbToKg, kgToLb, ftInToCm, cmToFtIn, bmi } from '../units.ts';
import { profile } from './helpers.ts';

test('Mifflin-St Jeor coincide con la fórmula publicada', () => {
  // Hombre 85 kg, 178 cm, 32 años: 10*85 + 6.25*178 - 5*32 + 5 = 1807.5
  assert.equal(mifflinStJeor(85, 178, 32, 'male'), 1807.5);
  // Mujer 60 kg, 165 cm, 28 años: 600 + 1031.25 - 140 - 161 = 1330.25
  assert.equal(mifflinStJeor(60, 165, 28, 'female'), 1330.25);
  // Sin sexo declarado: promedio de las constantes (-78)
  assert.equal(mifflinStJeor(60, 165, 28, 'unspecified'), 600 + 1031.25 - 140 - 78);
});

test('conversión de unidades es reversible', () => {
  assert.ok(Math.abs(kgToLb(lbToKg(180)) - 180) < 1e-9);
  assert.equal(Math.round(lbToKg(200) * 100) / 100, 90.72);
  assert.equal(Math.round(ftInToCm(5, 10) * 10) / 10, 177.8);
  assert.deepEqual(cmToFtIn(177.8), { ft: 5, inches: 10 });
  assert.equal(Math.round(bmi(85, 178) * 10) / 10, 26.8);
});

test('los pasos tienen prioridad sobre el tipo de trabajo', () => {
  const e = estimateEnergy(profile({ job: 'sedentary', dailySteps: 11000 }));
  assert.equal(e.activitySource, 'steps');
  assert.equal(e.activityFactor, stepsFactor(11000));
  assert.equal(e.activityFactor, 1.5);
});

test('el ejercicio suma energía neta y no duplica el basal', () => {
  const a = estimateEnergy(profile({ daysPerWeek: 0 as unknown as number, cardioMinutesPerWeek: 0 }));
  const b = estimateEnergy(profile({ daysPerWeek: 4, sessionMinutes: 60, cardioMinutesPerWeek: 0 }));
  // 4 h/semana × (5 - 1) MET × 85 kg / 7 ≈ 194 kcal/día
  assert.ok(Math.abs(b.tdee - a.tdee - (4 * 4 * 85) / 7) < 0.01);
});

test('los macros son coherentes con las calorías para todos los objetivos', () => {
  for (const goal of GOALS) {
    for (const sex of ['male', 'female', 'unspecified'] as const) {
      for (const weightKg of [50, 70, 95, 130]) {
        const r = computeTargets(profile({ goal, sex, weightKg, heightCm: sex === 'female' ? 163 : 178 }));
        assert.ok(r.ok, `${goal} ${sex} ${weightKg}`);
        if (!r.ok) continue;
        const t = r.targets;
        assert.ok(macrosConsistent(t), `macros incoherentes ${goal} ${sex} ${weightKg}: ${JSON.stringify(t)}`);
        assert.ok(t.proteinG > 0 && t.carbsG >= 0 && t.fatG > 0);
        assert.ok(t.fatG * 9 >= t.kcal * 0.19, 'grasa mínima ~20 %');
        assert.ok(t.kcal >= t.floorKcal, 'nunca por debajo del mínimo');
        assert.ok(t.proteinG <= 2.4 * weightKg, 'proteína acotada');
      }
    }
  }
});

test('pérdida de grasa: déficit moderado, nunca extremo', () => {
  const r = computeTargets(profile({ goal: 'fat_loss' }));
  assert.ok(r.ok);
  if (!r.ok) return;
  const t = r.targets;
  const deficit = t.energy.tdee - t.kcal;
  assert.ok(deficit >= 240 && deficit <= 760, `déficit ${deficit}`);
  assert.ok(deficit / t.energy.tdee <= 0.26);
});

test('pérdida de grasa con poco gasto respeta el mínimo de calorías', () => {
  const r = computeTargets(profile({ goal: 'fat_loss', sex: 'female', weightKg: 50, heightCm: 152, age: 60, job: 'sedentary', daysPerWeek: 1, sessionMinutes: 20 }));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.ok(r.targets.kcal >= calorieFloor('female', r.targets.energy.bmr));
  assert.ok(r.targets.kcal >= 1200);
});

test('ganancia muscular con IMC alto no impone superávit', () => {
  const r = computeTargets(profile({ goal: 'muscle_gain', weightKg: 110, heightCm: 178 }));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.ok(r.targets.strategy.includes('surplus_skipped_bmi'));
  assert.ok(Math.abs(r.targets.kcal - r.targets.energy.tdee) <= 10);
});

test('ganancia muscular con IMC normal usa superávit moderado', () => {
  const r = computeTargets(profile({ goal: 'muscle_gain', weightKg: 70, level: 'intermediate' }));
  assert.ok(r.ok);
  if (!r.ok) return;
  const surplus = r.targets.kcal - r.targets.energy.tdee;
  assert.ok(surplus > 200 && surplus < 300, `superávit ${surplus}`);
});

test('con IMC ≥ 30 la proteína se calcula sobre el peso de referencia', () => {
  const r = computeTargets(profile({ goal: 'fat_loss', weightKg: 130, heightCm: 175 }));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.ok(r.targets.proteinG < 2.0 * 130, 'no infla la proteína');
  assert.ok(r.targets.proteinReferenceKg < 80);
});

test('el ajuste manual está acotado a ±500 kcal', () => {
  const base = computeTargets(profile({ goal: 'maintenance' }));
  const up = computeTargets(profile({ goal: 'maintenance' }), 2000);
  assert.ok(base.ok && up.ok);
  if (!base.ok || !up.ok) return;
  assert.ok(up.targets.kcal - base.targets.kcal <= 510);
});

test('menores de 18 años: no se genera ningún plan', () => {
  const r = computeTargets(profile({ age: 16 }));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'blocked');
});

test('historial de TCA, embarazo o enfermedad renal: sin cifras de nutrición', () => {
  for (const health of [
    { eatingDisorderHistory: 'yes' as const },
    { pregnantOrBreastfeeding: 'yes' as const },
    { conditions: ['kidney' as const] },
  ]) {
    const r = computeTargets(profile({ health: { ...profile().health, ...health } }));
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'nutrition_professional');
  }
});

test('condición médica: déficit máximo 15 %', () => {
  const r = computeTargets(profile({ goal: 'fat_loss', weightKg: 120, health: { ...profile().health, conditions: ['diabetes'] } }));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.ok((r.targets.energy.tdee - r.targets.kcal) / r.targets.energy.tdee <= 0.151);
  assert.equal(r.safety.nutritionMode, 'conservative');
});

test('IMC bajo: pérdida de grasa se convierte en mantenimiento', () => {
  const r = computeTargets(profile({ goal: 'fat_loss', weightKg: 52, heightCm: 178 }));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.safety.effectiveGoal, 'maintenance');
  assert.ok(r.targets.kcal >= r.targets.energy.tdee - 10);
});
