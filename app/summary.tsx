// Resumen del perfil antes de crear el plan. Cada sección se puede editar
// volviendo al paso correspondiente del onboarding.
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Body, Button, Card, Divider, Empty, H2, H3, Notice, Row, Screen, Small } from '../src/components';
import { FOODS, EXERCISES, assessSafety, formatHeight, type UserProfile } from '../src/core';
import { useApp } from '../src/data/store';
import { useI18n } from '../src/i18n';
import { clearDraft, useDraft } from '../src/lib/draft';
import { fmtWeight } from '../src/lib/format';
import { space } from '../src/theme';

export default function Summary() {
  const draft = useDraft();
  const { actions } = useApp();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  if (!draft) {
    return (
      <Screen>
        <Empty
          title={t('sa.summary.noDraft')}
          action={{ title: t('sa.summary.start'), onPress: () => router.replace('/onboarding') }}
        />
      </Screen>
    );
  }

  const safety = assessSafety(draft);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      await actions.saveProfile({ ...draft, updatedAt: new Date().toISOString() });
      clearDraft();
      // Vacía la pila (onboarding o perfil) y deja sólo las pestañas.
      if (router.canDismiss()) router.dismissAll();
      router.replace('/(tabs)');
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const edit = (step: number) => router.push(`/onboarding?step=${step}&edit=1&back=1`);

  return (
    <Screen>
      <H2>{t('summary.title')}</H2>
      <Body>{t('summary.intro')}</Body>

      {safety.flags.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <H3>{t('sa.summary.safetyTitle')}</H3>
          {safety.flags.map((f) => (
            <Notice
              key={f.code}
              kind={f.severity === 'block' ? 'danger' : f.severity === 'caution' ? 'warn' : 'info'}
              text={t(`safety.${f.code}`)}
            />
          ))}
          {safety.recommendProfessional ? <Notice kind="info" text={t('safety.professional')} /> : null}
        </View>
      ) : null}

      <Sections p={draft} onEdit={edit} />

      {!safety.allowed ? <Notice kind="danger" text={t('sa.summary.blocked')} /> : null}
      {error ? <Notice kind="danger" text={t('common.error')} /> : null}
      <Button title={t('summary.confirm')} onPress={confirm} loading={busy} disabled={!safety.allowed} />
      <Small center>{t('common.disclaimer')}</Small>
    </Screen>
  );
}

/** Secciones del resumen, cada una con su botón de edición. */
function Sections({ p, onEdit }: { p: UserProfile; onEdit: (step: number) => void }) {
  const { t, lang } = useI18n();
  const notSet = t('sa.summary.notSet');
  const none = t('sa.summary.none');
  const list = (items: string[]) => (items.length ? items.join(', ') : none);
  const exName = (id: string) => EXERCISES.find((e) => e.id === id)?.name[lang] ?? id;
  const foodName = (id: string) => FOODS.find((f) => f.id === id)?.name[lang] ?? id;
  const tri = (v: string) => (v === 'yes' ? t('common.yes') : v === 'no' ? t('common.no') : t('common.preferNot'));
  const h = p.health;

  return (
    <>
      <Section title={t('summary.basics')} onEdit={() => onEdit(0)}>
        <Line label={t('onboarding.age')} value={t('sa.summary.yearsN', { n: p.age })} />
        <Line label={t('onboarding.sex').split(' (')[0]} value={t(`sex.${p.sex}`)} />
        <Line label={t('onboarding.height')} value={formatHeight(p.heightCm, p.units)} />
        <Line label={t('onboarding.weight')} value={fmtWeight(p.weightKg, p.units)} />
        <Line label={t('onboarding.targetWeight')} value={p.targetWeightKg !== undefined ? fmtWeight(p.targetWeightKg, p.units) : notSet} />
        <Line label={t('onboarding.country')} value={p.country} />
        <Line label={t('onboarding.units')} value={t(`onboarding.${p.units}`)} />
      </Section>

      <Section title={t('onboarding.titles.goal')} onEdit={() => onEdit(1)}>
        <Body style={{ fontWeight: '700' }}>{t(`goals.${p.goal}.name`)}</Body>
        <Small>{t(`goals.${p.goal}.desc`)}</Small>
      </Section>

      <Section title={t('summary.training')} onEdit={() => onEdit(2)}>
        <Line label={t('onboarding.level')} value={t(`levels.${p.level}`)} />
        <Line label={t('onboarding.monthsTraining')} value={t('sa.summary.monthsN', { n: p.monthsTraining })} />
        <Line label={t('onboarding.days')} value={t('sa.summary.daysN', { n: p.daysPerWeek })} />
        <Line label={t('onboarding.session')} value={t('sa.summary.minutesN', { n: p.sessionMinutes })} />
      </Section>

      <Section title={t('onboarding.titles.equipment')} onEdit={() => onEdit(3)}>
        <Line label={t('onboarding.location')} value={t(`location.${p.location}`)} />
        {p.location !== 'gym' ? (
          <Line label={t('onboarding.equipment')} value={list(p.equipment.map((e) => t(`equipment.${e}`)))} />
        ) : null}
        <Line label={t('onboarding.preferred')} value={list(p.preferredExercises.map(exName))} />
        <Line label={t('onboarding.excluded')} value={list(p.excludedExercises.map(exName))} />
      </Section>

      <Section title={t('summary.activity')} onEdit={() => onEdit(4)}>
        <Line label={t('onboarding.job')} value={t(`job.${p.job}`)} />
        <Line label={t('onboarding.steps')} value={p.dailySteps !== undefined ? t('sa.summary.stepsN', { n: p.dailySteps }) : notSet} />
        <Line
          label={t('onboarding.cardio')}
          value={
            p.cardioMinutesPerWeek > 0
              ? t('sa.summary.cardioN', { n: p.cardioMinutesPerWeek, intensity: t(`intensity.${p.cardioIntensity}`) })
              : none
          }
        />
        <Line label={t('onboarding.sleep')} value={p.sleepHours !== undefined ? t('sa.summary.hoursN', { n: p.sleepHours }) : notSet} />
      </Section>

      <Section title={t('summary.food')} onEdit={() => onEdit(5)}>
        <Line label={t('onboarding.diet')} value={t(`diets.${p.diet}`)} />
        <Line label={t('onboarding.allergens')} value={list(p.allergens.map((a) => t(`allergens.${a}`)))} />
        <Line label={t('onboarding.excludedFoods')} value={list(p.excludedFoods.map(foodName))} />
        <Line label={t('onboarding.favoriteFoods')} value={list(p.favoriteFoods.map(foodName))} />
        <Line label={t('onboarding.budget')} value={t(`budget.${p.budget}`)} />
        {p.weeklyFoodBudgetUsd !== undefined ? (
          <Line label={t('onboarding.weeklyBudget')} value={t('sa.summary.usdN', { n: p.weeklyFoodBudgetUsd })} />
        ) : null}
        <Line label={t('onboarding.cookingTime')} value={t(`cooking.${p.cookingTime}`)} />
        <Line label={t('onboarding.meals')} value={t('sa.summary.mealsN', { n: p.mealsPerDay })} />
        <Line label={t('onboarding.prepStyle')} value={t(`prep.${p.prepStyle}`)} />
      </Section>

      <Section title={t('summary.health')} onEdit={() => onEdit(6)}>
        <Line label={t('onboarding.injuries')} value={list(h.injuries.map((a) => t(`areas.${a}`)))} />
        <Line label={t('onboarding.conditions')} value={list(h.conditions.map((c) => t(`conditions.${c}`)))} />
        {p.sex !== 'male' ? <Line label={t('onboarding.pregnant')} value={tri(h.pregnantOrBreastfeeding)} /> : null}
        <Line label={t('onboarding.edHistory')} value={tri(h.eatingDisorderHistory)} />
        <Line label={t('onboarding.avoidExercise')} value={h.advisedToAvoidExercise ? t('common.yes') : t('common.no')} />
      </Section>
    </>
  );
}

function Section({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <H3 style={{ flex: 1 }}>{title}</H3>
        <Button title={t('common.edit')} variant="ghost" small onPress={onEdit} />
      </Row>
      <Divider />
      {children}
    </Card>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingVertical: 2 }}>
      <Small style={{ flex: 1 }}>{label}</Small>
      <Body style={{ flex: 1, textAlign: 'right' }}>{value}</Body>
    </View>
  );
}
