// Cuestionario inicial en 7 pasos. Trabaja sobre un borrador del perfil
// (src/lib/draft.ts) que luego se revisa y confirma en /summary.
// Parámetros: ?step=N&edit=1 → abre ese paso y "Guardar" vuelve al resumen.
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  Body,
  Button,
  Card,
  Chip,
  ChipGroup,
  Field,
  H2,
  H3,
  Icon,
  Label,
  Notice,
  NumberField,
  ProgressBar,
  Row,
  Screen,
  Segmented,
  Small,
  Stepper,
  Switch,
} from '../src/components';
import {
  ALL_EQUIPMENT,
  ALLERGENS,
  BODY_AREAS,
  EXERCISES,
  FOODS,
  GOALS,
  MIN_AGE,
  cmToFtIn,
  defaultProfile,
  ftInToCm,
  matchFoodsFromText,
  validateProfile,
  type ProfileError,
  type TriState,
  type UserProfile,
} from '../src/core';
import { useApp } from '../src/data/store';
import { useI18n } from '../src/i18n';
import { getDraft, setDraft, useDraft } from '../src/lib/draft';
import { displayWeightToKg, kgToDisplay, weightUnit } from '../src/lib/format';
import { space, useTheme } from '../src/theme';

const STEPS = ['basics', 'goal', 'experience', 'equipment', 'activity', 'food', 'health'] as const;
type StepKey = (typeof STEPS)[number];

// Errores de validación que corresponden a cada paso.
const STEP_ERRORS: Record<StepKey, ProfileError[]> = {
  basics: ['age_range', 'height_range', 'weight_range', 'target_weight_range'],
  goal: [],
  experience: ['days_range', 'session_range'],
  equipment: [],
  activity: ['steps_range', 'cardio_range', 'sleep_range'],
  food: ['meals_range'],
  health: [],
};

const CONDITIONS = ['diabetes', 'heart', 'hypertension', 'kidney', 'other_under_care'] as const;

/** Número finito o undefined (para mostrar campos vacíos). */
const fin = (n: number | undefined): number | undefined => (n !== undefined && Number.isFinite(n) ? n : undefined);
/** Redondeo a 1 decimal estable para que el campo numérico no "salte" al convertir unidades. */
const r1 = (n: number) => Math.round(n * 10) / 10;

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export default function Onboarding() {
  const { state } = useApp();
  const { t, lang } = useI18n();
  const params = useLocalSearchParams<{ step?: string; edit?: string; back?: string }>();
  const editing = params.edit === '1';
  const initialStep = Math.min(STEPS.length - 1, Math.max(0, Number(params.step ?? 0) || 0));

  // El borrador compartido es la fuente de verdad: así las pantallas de edición
  // abiertas desde /summary y esta misma pantalla nunca se desincronizan.
  const shared = useDraft();
  const [initial] = useState<UserProfile>(() => getDraft() ?? state.profile ?? { ...defaultProfile(), lang });
  const p = shared ?? initial;
  const [step, setStep] = useState(initialStep);
  const [showErrors, setShowErrors] = useState(false);

  // Una ref encadena cambios seguidos (antes del siguiente render) sin perder ninguno.
  const latest = useRef(p);
  latest.current = p;
  const commit = (next: UserProfile) => {
    latest.current = next;
    setDraft(next);
  };
  const update = (patch: Partial<UserProfile>) => commit({ ...latest.current, ...patch });
  const updateHealth = (patch: Partial<UserProfile['health']>) =>
    commit({ ...latest.current, health: { ...latest.current.health, ...patch } });

  const key = STEPS[step];
  const allErrors = validateProfile(p);
  const stepErrors = allErrors.filter((e) => STEP_ERRORS[key].includes(e));
  const countryOk = /^[A-Z]{2}$/.test(p.country);
  const isMinor = Number.isFinite(p.age) && p.age < MIN_AGE;
  const blocked = key === 'basics' && (isMinor || !countryOk);
  const canContinue = stepErrors.length === 0 && !blocked;
  const errOf = (code: ProfileError) => (showErrors && stepErrors.includes(code) ? t(`profileErrors.${code}`) : undefined);

  const finish = () => {
    const final: UserProfile = {
      ...p,
      // El embarazo no aplica si el sexo indicado es hombre.
      health: p.sex === 'male' ? { ...p.health, pregnantOrBreastfeeding: 'no' } : p.health,
      updatedAt: new Date().toISOString(),
    };
    setDraft(final);
    // Desde el resumen (back=1) se vuelve atrás; desde el perfil se abre el resumen.
    if (editing && params.back === '1' && router.canGoBack()) router.back();
    else if (editing) router.replace('/summary');
    else router.push('/summary');
  };

  const next = () => {
    if (!canContinue) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    if (editing || step === STEPS.length - 1) finish();
    else setStep(step + 1);
  };

  const back = () => {
    setShowErrors(false);
    setStep(Math.max(0, step - 1));
  };

  // key={step}: al cambiar de paso la vista vuelve arriba.
  return (
    <Screen keyboard key={step}>
      <View style={{ gap: space.xs }}>
        <Small>{t('onboarding.stepOf', { n: step + 1, total: STEPS.length })}</Small>
        <ProgressBar value={(step + 1) / STEPS.length} />
      </View>
      <H2 style={{ marginTop: space.sm }}>{t(`onboarding.titles.${key}`)}</H2>

      {key === 'basics' ? <BasicsStep p={p} update={update} errOf={errOf} countryOk={countryOk} showErrors={showErrors} /> : null}
      {key === 'goal' ? <GoalStep p={p} update={update} /> : null}
      {key === 'experience' ? <ExperienceStep p={p} update={update} /> : null}
      {key === 'equipment' ? <EquipmentStep p={p} update={update} /> : null}
      {key === 'activity' ? <ActivityStep p={p} update={update} errOf={errOf} /> : null}
      {key === 'food' ? <FoodStep p={p} update={update} /> : null}
      {key === 'health' ? <HealthStep p={p} updateHealth={updateHealth} /> : null}

      {isMinor && key === 'basics' ? (
        <>
          <Notice kind="danger" text={t('safety.minor')} />
          <Small>{t('sa.onb.minorBlocked')}</Small>
        </>
      ) : null}
      {showErrors && stepErrors.length > 0 ? (
        <Notice kind="warn" text={stepErrors.map((e) => t(`profileErrors.${e}`)).join('\n')} />
      ) : null}

      <Row gap={space.sm} style={{ marginTop: space.md }}>
        {!editing && step > 0 ? (
          <Button title={t('common.back')} variant="secondary" onPress={back} style={{ flex: 1 }} />
        ) : null}
        <Button
          title={editing ? t('common.save') : step === STEPS.length - 1 ? t('sa.onb.finish') : t('common.continue')}
          onPress={next}
          disabled={isMinor && key === 'basics'}
          style={{ flex: 2 }}
        />
      </Row>
    </Screen>
  );
}

// ------------------------------------------------------------------ pasos
interface StepProps {
  p: UserProfile;
  update: (patch: Partial<UserProfile>) => void;
}

function BasicsStep({
  p,
  update,
  errOf,
  countryOk,
  showErrors,
}: StepProps & { errOf: (c: ProfileError) => string | undefined; countryOk: boolean; showErrors: boolean }) {
  const { t, tx } = useI18n();
  const imperial = p.units === 'imperial';
  const wu = weightUnit(p.units);

  // Estatura imperial: pies y pulgadas en estado local; se guarda en cm.
  const init = Number.isFinite(p.heightCm) ? cmToFtIn(p.heightCm) : null;
  const [ft, setFt] = useState<number | undefined>(init?.ft);
  const [inch, setInch] = useState<number | undefined>(init?.inches);
  const setImperialHeight = (f: number | undefined, i: number | undefined) => {
    setFt(f);
    setInch(i);
    update({ heightCm: f !== undefined ? ftInToCm(f, i ?? 0) : NaN });
  };

  const switchUnits = (u: string) => {
    const units = u === 'imperial' ? 'imperial' : 'metric';
    if (units === 'imperial' && Number.isFinite(p.heightCm)) {
      const fi = cmToFtIn(p.heightCm);
      setFt(fi.ft);
      setInch(fi.inches);
    }
    update({ units });
  };

  const sexOpts = Object.entries(tx<Record<string, string>>('sex')).map(([value, label]) => ({ value, label }));

  return (
    <>
      <Label>{t('onboarding.units')}</Label>
      <Segmented
        options={[
          { value: 'metric', label: t('onboarding.metric') },
          { value: 'imperial', label: t('onboarding.imperial') },
        ]}
        value={p.units}
        onChange={switchUnits}
      />
      <NumberField
        label={t('onboarding.age')}
        value={fin(p.age)}
        onChange={(n) => update({ age: n ?? NaN })}
        suffix={t('sa.onb.years')}
        error={errOf('age_range')}
      />
      <Label>{t('onboarding.sex')}</Label>
      <ChipGroup options={sexOpts} value={[p.sex]} onChange={(v) => v[0] && update({ sex: v[0] as UserProfile['sex'] })} />
      <Small>{t('onboarding.sexNote')}</Small>

      {imperial ? (
        <>
          <Label>{t('onboarding.height')}</Label>
          <Row gap={space.sm} style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <NumberField label={t('onboarding.feet')} value={ft} onChange={(n) => setImperialHeight(n, inch)} suffix="ft" />
            </View>
            <View style={{ flex: 1 }}>
              <NumberField label={t('onboarding.inches')} value={inch} onChange={(n) => setImperialHeight(ft, n)} suffix="in" />
            </View>
          </Row>
          {errOf('height_range') ? <Small>{errOf('height_range')}</Small> : null}
        </>
      ) : (
        <NumberField
          label={t('onboarding.height')}
          value={fin(p.heightCm) !== undefined ? Math.round(p.heightCm) : undefined}
          onChange={(n) => update({ heightCm: n ?? NaN })}
          suffix="cm"
          error={errOf('height_range')}
        />
      )}

      <NumberField
        label={t('onboarding.weight')}
        value={fin(p.weightKg) !== undefined ? r1(kgToDisplay(p.weightKg, p.units)) : undefined}
        onChange={(n) => update({ weightKg: n !== undefined ? displayWeightToKg(n, p.units) : NaN })}
        decimals={1}
        suffix={wu}
        error={errOf('weight_range')}
      />
      <NumberField
        label={`${t('onboarding.targetWeight')} (${t('common.optional')})`}
        value={p.targetWeightKg !== undefined ? r1(kgToDisplay(p.targetWeightKg, p.units)) : undefined}
        onChange={(n) => update({ targetWeightKg: n !== undefined ? displayWeightToKg(n, p.units) : undefined })}
        decimals={1}
        suffix={wu}
        error={errOf('target_weight_range')}
      />
      <Field
        label={t('onboarding.country')}
        value={p.country}
        onChangeText={(s) => update({ country: s.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2) })}
        autoCapitalize="characters"
        hint={t('sa.onb.countryHint')}
        error={showErrors && !countryOk ? t('sa.onb.countryError') : undefined}
      />
    </>
  );
}

function GoalStep({ p, update }: StepProps) {
  const { t } = useI18n();
  const { c } = useTheme();
  return (
    <>
      <Small>{t('sa.onb.goalPick')}</Small>
      {GOALS.map((g) => {
        const selected = p.goal === g;
        return (
          <Pressable
            key={g}
            onPress={() => update({ goal: g })}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <Card style={{ borderColor: selected ? c.accent : c.border, borderWidth: selected ? 2 : 1 }}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <H3>{t(`goals.${g}.name`)}</H3>
                  <Small>{t(`goals.${g}.desc`)}</Small>
                </View>
                {selected ? <Icon name="check" size={20} color={c.accent} /> : null}
              </Row>
            </Card>
          </Pressable>
        );
      })}
    </>
  );
}

function ExperienceStep({ p, update }: StepProps) {
  const { t, tx } = useI18n();
  const levelOpts = Object.entries(tx<Record<string, string>>('levels')).map(([value, label]) => ({ value, label }));
  return (
    <>
      <Label>{t('onboarding.level')}</Label>
      <ChipGroup options={levelOpts} value={[p.level]} onChange={(v) => v[0] && update({ level: v[0] as UserProfile['level'] })} />
      <NumberField
        label={t('onboarding.monthsTraining')}
        value={fin(p.monthsTraining)}
        onChange={(n) => update({ monthsTraining: n ?? 0 })}
        suffix={t('sa.onb.months')}
      />
      <Stepper label={t('onboarding.days')} value={p.daysPerWeek} min={1} max={7} onChange={(n) => update({ daysPerWeek: n })} />
      <Stepper
        label={t('onboarding.session')}
        value={p.sessionMinutes}
        min={20}
        max={120}
        step={5}
        onChange={(n) => update({ sessionMinutes: n })}
        suffix={t('common.min')}
      />
    </>
  );
}

function EquipmentStep({ p, update }: StepProps) {
  const { t, tx, lang } = useI18n();
  const locOpts = Object.entries(tx<Record<string, string>>('location')).map(([value, label]) => ({ value, label }));
  const eqOpts = ALL_EQUIPMENT.map((e) => ({ value: e, label: t(`equipment.${e}`) }));
  const exItems = useMemo(
    () => EXERCISES.map((e) => ({ id: e.id, label: e.name[lang] })).sort((a, b) => a.label.localeCompare(b.label, lang)),
    [lang],
  );

  const togglePreferred = (id: string) => {
    const on = p.preferredExercises.includes(id);
    update({
      preferredExercises: on ? p.preferredExercises.filter((x) => x !== id) : [...p.preferredExercises, id],
      excludedExercises: p.excludedExercises.filter((x) => x !== id),
    });
  };
  const toggleExcluded = (id: string) => {
    const on = p.excludedExercises.includes(id);
    update({
      excludedExercises: on ? p.excludedExercises.filter((x) => x !== id) : [...p.excludedExercises, id],
      preferredExercises: p.preferredExercises.filter((x) => x !== id),
    });
  };

  return (
    <>
      <Label>{t('onboarding.location')}</Label>
      <Segmented options={locOpts} value={p.location} onChange={(v) => update({ location: v as UserProfile['location'] })} />
      {p.location === 'gym' ? (
        <Small>{t('sa.onb.gymEquipment')}</Small>
      ) : (
        <>
          <Label>{t('onboarding.equipment')}</Label>
          <ChipGroup
            multi
            options={eqOpts}
            value={p.equipment}
            onChange={(v) => update({ equipment: v as UserProfile['equipment'] })}
          />
        </>
      )}
      <PickChips label={`${t('onboarding.preferred')} (${t('common.optional')})`} items={exItems} selected={p.preferredExercises} onToggle={togglePreferred} />
      <PickChips label={`${t('onboarding.excluded')} (${t('common.optional')})`} items={exItems} selected={p.excludedExercises} onToggle={toggleExcluded} />
    </>
  );
}

function ActivityStep({ p, update, errOf }: StepProps & { errOf: (c: ProfileError) => string | undefined }) {
  const { t, tx } = useI18n();
  const jobOpts = Object.entries(tx<Record<string, string>>('job')).map(([value, label]) => ({ value, label }));
  const intOpts = Object.entries(tx<Record<string, string>>('intensity')).map(([value, label]) => ({ value, label }));
  return (
    <>
      <Label>{t('onboarding.job')}</Label>
      <ChipGroup options={jobOpts} value={[p.job]} onChange={(v) => v[0] && update({ job: v[0] as UserProfile['job'] })} />
      <NumberField
        label={`${t('onboarding.steps')} (${t('common.optional')})`}
        value={p.dailySteps}
        onChange={(n) => update({ dailySteps: n })}
        suffix={t('sa.onb.steps')}
        error={errOf('steps_range')}
      />
      <NumberField
        label={t('onboarding.cardio')}
        value={fin(p.cardioMinutesPerWeek)}
        onChange={(n) => update({ cardioMinutesPerWeek: n ?? 0 })}
        suffix={t('sa.onb.perWeekMin')}
        error={errOf('cardio_range')}
      />
      {p.cardioMinutesPerWeek > 0 ? (
        <>
          <Label>{t('onboarding.cardioIntensity')}</Label>
          <Segmented
            options={intOpts}
            value={p.cardioIntensity}
            onChange={(v) => update({ cardioIntensity: v as UserProfile['cardioIntensity'] })}
          />
        </>
      ) : null}
      <NumberField
        label={`${t('onboarding.sleep')} (${t('common.optional')})`}
        value={p.sleepHours}
        onChange={(n) => update({ sleepHours: n })}
        decimals={1}
        suffix={t('sa.onb.hours')}
        error={errOf('sleep_range')}
      />
    </>
  );
}

function FoodStep({ p, update }: StepProps) {
  const { t, tx, lang } = useI18n();
  const [text, setText] = useState('');
  const matched = useMemo(() => (text.trim() ? matchFoodsFromText(text) : []), [text]);
  const nameOf = (id: string) => FOODS.find((f) => f.id === id)?.name[lang] ?? id;
  const foodItems = useMemo(
    () => FOODS.map((f) => ({ id: f.id, label: f.name[lang] })).sort((a, b) => a.label.localeCompare(b.label, lang)),
    [lang],
  );
  const opts = (k: string) => Object.entries(tx<Record<string, string>>(k)).map(([value, label]) => ({ value, label }));

  const toggleExcluded = (id: string) => {
    const on = p.excludedFoods.includes(id);
    update({
      excludedFoods: on ? p.excludedFoods.filter((x) => x !== id) : [...p.excludedFoods, id],
      favoriteFoods: p.favoriteFoods.filter((x) => x !== id),
    });
  };
  const toggleFavorite = (id: string) => {
    const on = p.favoriteFoods.includes(id);
    update({
      favoriteFoods: on ? p.favoriteFoods.filter((x) => x !== id) : [...p.favoriteFoods, id],
      excludedFoods: p.excludedFoods.filter((x) => x !== id),
    });
  };
  const addMatched = () => {
    const set = new Set([...p.excludedFoods, ...matched]);
    update({ excludedFoods: [...set], favoriteFoods: p.favoriteFoods.filter((x) => !set.has(x)) });
    setText('');
  };

  return (
    <>
      <Label>{t('onboarding.diet')}</Label>
      <ChipGroup options={opts('diets')} value={[p.diet]} onChange={(v) => v[0] && update({ diet: v[0] as UserProfile['diet'] })} />
      <Label>{t('onboarding.allergens')}</Label>
      <ChipGroup
        multi
        options={ALLERGENS.map((a) => ({ value: a, label: t(`allergens.${a}`) }))}
        value={p.allergens}
        onChange={(v) => update({ allergens: v as UserProfile['allergens'] })}
      />

      <Field
        label={t('onboarding.excludedFoods')}
        value={text}
        onChangeText={setText}
        placeholder={t('onboarding.excludedFoodsHint')}
        autoCapitalize="none"
      />
      {text.trim().length >= 3 ? (
        matched.length > 0 ? (
          <Card>
            <Small>{t('onboarding.matched', { list: matched.map(nameOf).join(', ') })}</Small>
            <Button title={t('sa.onb.addMatched')} icon="plus" small variant="secondary" onPress={addMatched} />
          </Card>
        ) : (
          <Small>{t('sa.onb.noMatch')}</Small>
        )
      ) : null}
      <PickChips label="" items={foodItems} selected={p.excludedFoods} onToggle={toggleExcluded} />
      <PickChips label={`${t('onboarding.favoriteFoods')} (${t('common.optional')})`} items={foodItems} selected={p.favoriteFoods} onToggle={toggleFavorite} />

      <Label>{t('onboarding.budget')}</Label>
      <Segmented options={opts('budget')} value={p.budget} onChange={(v) => update({ budget: v as UserProfile['budget'] })} />
      <NumberField
        label={`${t('onboarding.weeklyBudget')} (${t('common.optional')})`}
        value={p.weeklyFoodBudgetUsd}
        onChange={(n) => update({ weeklyFoodBudgetUsd: n })}
        suffix="USD"
      />
      <Label>{t('onboarding.cookingTime')}</Label>
      <ChipGroup
        options={opts('cooking')}
        value={[p.cookingTime]}
        onChange={(v) => v[0] && update({ cookingTime: v[0] as UserProfile['cookingTime'] })}
      />
      <Stepper label={t('onboarding.meals')} value={p.mealsPerDay} min={3} max={5} onChange={(n) => update({ mealsPerDay: n })} />
      <Label>{t('onboarding.prepStyle')}</Label>
      <Segmented options={opts('prep')} value={p.prepStyle} onChange={(v) => update({ prepStyle: v as UserProfile['prepStyle'] })} />
    </>
  );
}

function HealthStep({ p, updateHealth }: { p: UserProfile; updateHealth: (patch: Partial<UserProfile['health']>) => void }) {
  const { t } = useI18n();
  const h = p.health;
  return (
    <>
      <Notice kind="info" text={t('onboarding.healthIntro')} />

      <Label>{t('onboarding.injuries')}</Label>
      <ChipGroup
        multi
        options={[{ value: NONE, label: t('onboarding.none') }, ...BODY_AREAS.map((a) => ({ value: a, label: t(`areas.${a}`) }))]}
        value={withNone(h.injuries)}
        onChange={(v) => updateHealth({ injuries: fromNone(v, h.injuries) as UserProfile['health']['injuries'] })}
      />

      <Label>{t('onboarding.conditions')}</Label>
      <ChipGroup
        multi
        options={[{ value: NONE, label: t('onboarding.none') }, ...CONDITIONS.map((c) => ({ value: c, label: t(`conditions.${c}`) }))]}
        value={withNone(h.conditions)}
        onChange={(v) => updateHealth({ conditions: fromNone(v, h.conditions) as UserProfile['health']['conditions'] })}
      />

      {p.sex !== 'male' ? (
        <TriStateField
          label={t('onboarding.pregnant')}
          value={h.pregnantOrBreastfeeding}
          onChange={(v) => updateHealth({ pregnantOrBreastfeeding: v })}
        />
      ) : null}
      <TriStateField
        label={t('onboarding.edHistory')}
        value={h.eatingDisorderHistory}
        onChange={(v) => updateHealth({ eatingDisorderHistory: v })}
      />
      <Switch
        label={t('onboarding.avoidExercise')}
        value={h.advisedToAvoidExercise}
        onChange={(v) => updateHealth({ advisedToAvoidExercise: v })}
      />
    </>
  );
}

// ------------------------------------------------------------------ auxiliares
// Opción "Ninguna" dentro de un grupo múltiple: se marca cuando la lista está vacía.
const NONE = '__none';
const withNone = (list: string[]): string[] => (list.length ? list : [NONE]);
function fromNone(v: string[], prev: string[]): string[] {
  // Si se acaba de tocar "Ninguna", vacía la lista; si no, ignora esa opción.
  if (v.includes(NONE) && prev.length > 0) return [];
  return v.filter((x) => x !== NONE);
}

function TriStateField({ label, value, onChange }: { label: string; value: TriState; onChange: (v: TriState) => void }) {
  const { t } = useI18n();
  return (
    <View style={{ gap: space.sm }}>
      <Body>{label}</Body>
      <Segmented
        options={[
          { value: 'yes', label: t('common.yes') },
          { value: 'no', label: t('common.no') },
          { value: 'prefer_not', label: t('common.preferNot') },
        ]}
        value={value}
        onChange={(v) => onChange(v as TriState)}
      />
    </View>
  );
}

const COLLAPSED = 10;

/** Lista de chips con buscador. Los seleccionados se muestran primero. */
function PickChips({
  label,
  items,
  selected,
  onToggle,
}: {
  label: string;
  items: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);

  const query = norm(q.trim());
  const filtered = query ? items.filter((i) => norm(i.label).includes(query)) : items;
  const sel = filtered.filter((i) => selected.includes(i.id));
  const rest = filtered.filter((i) => !selected.includes(i.id));
  const shown = query || all ? [...sel, ...rest] : [...sel, ...rest.slice(0, COLLAPSED)];
  const hiddenCount = filtered.length - shown.length;

  return (
    <View style={{ gap: space.sm }}>
      <Field
        label={label || t('sa.onb.search')}
        value={q}
        onChangeText={setQ}
        placeholder={t('sa.onb.search')}
        autoCapitalize="none"
        hint={selected.length > 0 ? t('sa.onb.selected', { n: selected.length }) : undefined}
      />
      <Row wrap gap={space.sm}>
        {shown.map((i) => (
          <Chip key={i.id} label={i.label} selected={selected.includes(i.id)} onPress={() => onToggle(i.id)} />
        ))}
      </Row>
      {shown.length === 0 ? <Small>{t('sa.onb.noResults')}</Small> : null}
      {!query && (hiddenCount > 0 || all) ? (
        <Button
          small
          variant="ghost"
          title={all ? t('sa.onb.showLess') : t('sa.onb.showAll', { n: items.length })}
          onPress={() => setAll(!all)}
        />
      ) : null}
    </View>
  );
}
