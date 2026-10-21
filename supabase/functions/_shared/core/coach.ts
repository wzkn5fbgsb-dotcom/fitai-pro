// GENERADO desde src/core por scripts/sync-functions.ts — no editar aquí.
// Enrutador determinista del AI COACH. Responde con datos REALES del usuario las
// preguntas frecuentes sin llamar al modelo (más barato y sin invenciones).
// Lo que no reconoce se envía al modelo de IA (en modo nube) junto con estos datos.
import { FOODS, getFood, matchFoodsFromText } from './data/foods.ts';
import { getExercise, EXERCISES } from './data/exercises.ts';
import { RECIPES, RECIPE_BY_ID } from './data/recipes.ts';
import { adaptRecipe, isFoodAllowed, restrictionsOf, type WeekPlan } from './mealplan.ts';
import { detectRiskSignals } from './safety.ts';
import { weightTrend, type WeightEntry } from './review.ts';
import { alternativesFor, filterFor, type WorkoutPlan } from './routine.ts';
import type { Lang, UserProfile } from './types.ts';
import { formatWeight } from './units.ts';

export type CoachIntent =
  | 'risk'
  | 'today_workout'
  | 'protein_today'
  | 'substitute_food'
  | 'substitute_exercise'
  | 'no_gym'
  | 'ingredients_tomorrow'
  | 'progress'
  | 'why_changed'
  | 'fridge'
  | 'unknown';

export interface CoachContext {
  lang: Lang;
  profile: UserProfile;
  workoutPlan: WorkoutPlan | null;
  nextWorkoutDayIndex: number | null;
  weekPlan: WeekPlan | null;
  todayPlanDay: number; // 0..6 (lunes = 0)
  consumedToday: { kcal: number; protein: number } | null; // de comidas marcadas como hechas
  proteinTargetG: number | null;
  kcalTarget: number | null;
  weights: WeightEntry[];
  lastChange: { date: string; summary: string } | null;
  today: string; // YYYY-MM-DD
}

export interface CoachReply {
  intent: CoachIntent;
  handled: boolean;
  text: string;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export function detectIntent(message: string): CoachIntent {
  const t = norm(message);
  if (detectRiskSignals(message)) return 'risk';
  if (/(que|what).*(entren|entreno|train|workout).*(hoy|today)|(hoy|today).*(entren|train|workout)|rutina de hoy|today'?s workout/.test(t)) return 'today_workout';
  if (/(proteina|protein)/.test(t) && /(cuant|llevo|how much|so far|hoy|today|consum)/.test(t)) return 'protein_today';
  if (/(no puedo ir al gim|sin gimnasio|no gym|can'?t (go to|get to) the gym|at home today|en casa hoy)/.test(t)) return 'no_gym';
  if (/(sustitu|reemplaz|cambiar|swap|replace|instead).*(ejercicio|exercise)|(ejercicio|exercise).*(sustitu|reemplaz|swap|replace)/.test(t)) return 'substitute_exercise';
  if (/(ingredientes|ingredients|comprar|shopping).*(manana|tomorrow)/.test(t)) return 'ingredients_tomorrow';
  if (/(refri|refrigerador|nevera|fridge|lo que tengo|what i have)/.test(t)) return 'fridge';
  if (/(no tengo|sin |instead of|no .* left|out of|en vez de|en lugar de|sustitu|reemplaz|replace|swap)/.test(t) && matchFoodsFromText(message).length) return 'substitute_food';
  if (/(por que|why).*(cambi|change)/.test(t)) return 'why_changed';
  if (/(como voy|progreso|how am i doing|progress|mi objetivo|my goal)/.test(t)) return 'progress';
  return 'unknown';
}

export function answerLocally(message: string, ctx: CoachContext): CoachReply {
  const intent = detectIntent(message);
  const es = ctx.lang === 'es';
  const reply = (text: string, handled = true): CoachReply => ({ intent, handled, text });
  const r = restrictionsOf(ctx.profile);

  switch (intent) {
    case 'risk':
      return reply(
        es
          ? 'Lo que describes puede ser riesgoso para tu salud y no es algo que deba resolverse con una dieta o un plan automático. Te recomiendo hablar con un profesional de la salud. Si estás en EE. UU., puedes llamar o enviar un mensaje de texto al 988 (Línea de Crisis y Suicidio) en cualquier momento; para apoyo con la alimentación, la National Alliance for Eating Disorders ofrece una línea de ayuda (1-866-662-1235). Si hay peligro inmediato, llama al 911.'
          : 'What you describe could be risky for your health and isn\'t something a diet or an automated plan should handle. Please talk with a health professional. In the US you can call or text 988 (Suicide & Crisis Lifeline) any time; for support around eating, the National Alliance for Eating Disorders has a helpline (1-866-662-1235). If you are in immediate danger, call 911.',
      );
    case 'today_workout': {
      const plan = ctx.workoutPlan;
      if (!plan || ctx.nextWorkoutDayIndex === null) return reply(es ? 'Todavía no tienes una rutina generada. Ve a Entrenamiento para crearla.' : 'You don\'t have a routine yet. Go to Training to create one.');
      const day = plan.days[ctx.nextWorkoutDayIndex];
      if (day.cardio) {
        return reply(es ? `Hoy toca cardio: ${day.cardio.minutes} minutos a intensidad ${day.cardio.intensity === 'light' ? 'suave' : 'moderada'}.` : `Today is cardio: ${day.cardio.minutes} minutes at ${day.cardio.intensity} intensity.`);
      }
      const list = day.exercises
        .map((e) => `• ${getExercise(e.exerciseId).name[ctx.lang]}: ${e.sets} × ${e.repsMin}–${e.repsMax}`)
        .join('\n');
      return reply((es ? `Tu próxima sesión (día ${day.index + 1}, ~${day.estMinutes} min):\n` : `Your next session (day ${day.index + 1}, ~${day.estMinutes} min):\n`) + list);
    }
    case 'protein_today': {
      if (ctx.proteinTargetG === null) return reply(es ? 'Tu plan no incluye objetivos numéricos de nutrición.' : 'Your plan does not include numeric nutrition targets.');
      if (!ctx.consumedToday) return reply(es ? `Hoy no has marcado comidas como hechas. Tu objetivo es de ${ctx.proteinTargetG} g de proteína.` : `You haven't marked any meals as eaten today. Your target is ${ctx.proteinTargetG} g of protein.`);
      const p = Math.round(ctx.consumedToday.protein);
      return reply(
        es
          ? `Según las comidas que marcaste hoy, llevas unos ${p} g de proteína de ${ctx.proteinTargetG} g (estimación con la base de datos USDA). Te faltan unos ${Math.max(0, ctx.proteinTargetG - p)} g.`
          : `Based on the meals you marked today, you've had about ${p} g of protein out of ${ctx.proteinTargetG} g (USDA-based estimate). About ${Math.max(0, ctx.proteinTargetG - p)} g to go.`,
      );
    }
    case 'substitute_food': {
      const ids = matchFoodsFromText(message);
      const food = getFood(ids[0]);
      const options = FOODS.filter((f) => f.id !== food.id && f.category === food.category && isFoodAllowed(f, r))
        .sort((a, b) => a.costTier - b.costTier)
        .slice(0, 4)
        .map((f) => f.name[ctx.lang]);
      if (!options.length) return reply(es ? `No encuentro un sustituto compatible con tus restricciones para ${food.name.es}.` : `I can't find a substitute for ${food.name.en} that fits your restrictions.`);
      return reply(
        es
          ? `En lugar de ${food.name.es.toLowerCase()} puedes usar: ${options.join(', ')}. En Nutrición toca el ingrediente en la receta para cambiarlo: la app recalcula las cantidades para mantener tus macros.`
          : `Instead of ${food.name.en.toLowerCase()} you can use: ${options.join(', ')}. In Nutrition, tap the ingredient in the recipe to swap it; the app recalculates amounts to keep your macros.`,
      );
    }
    case 'substitute_exercise':
    case 'no_gym': {
      const plan = ctx.workoutPlan;
      if (!plan) return reply(es ? 'Primero genera tu rutina en Entrenamiento.' : 'Generate your routine in Training first.');
      const named = EXERCISES.find((e) => norm(message).includes(norm(e.name.es)) || norm(message).includes(norm(e.name.en)));
      if (intent === 'substitute_exercise' && named) {
        const alts = alternativesFor(named.id, filterFor(ctx.profile)).map((id) => getExercise(id).name[ctx.lang]);
        return reply(alts.length ? (es ? `Alternativas para ${named.name.es}: ${alts.join(', ')}.` : `Alternatives to ${named.name.en}: ${alts.join(', ')}.`) : es ? 'No hay alternativas compatibles con tu equipo y lesiones.' : 'No alternatives fit your equipment and injuries.');
      }
      if (intent === 'no_gym' && ctx.nextWorkoutDayIndex !== null) {
        const home = { ...filterFor(ctx.profile), equipment: Array.from(new Set([...ctx.profile.equipment, 'bodyweight' as const])) };
        const day = plan.days[ctx.nextWorkoutDayIndex];
        const lines = day.exercises.map((e) => {
          const ex = getExercise(e.exerciseId);
          const alt = ex.equipment.every((q) => home.equipment.includes(q)) ? ex.id : alternativesFor(ex.id, home, 1)[0];
          return `• ${ex.name[ctx.lang]} → ${alt ? getExercise(alt).name[ctx.lang] : es ? '(sin alternativa en casa)' : '(no home alternative)'}`;
        });
        return reply((es ? 'Versión en casa de tu próxima sesión, con tu equipo:\n' : 'Home version of your next session with your equipment:\n') + lines.join('\n'));
      }
      return reply(es ? 'Dime qué ejercicio quieres cambiar o abre el ejercicio en Entrenamiento para ver sus alternativas.' : 'Tell me which exercise to change, or open it in Training to see alternatives.');
    }
    case 'ingredients_tomorrow': {
      if (!ctx.weekPlan) return reply(es ? 'Aún no tienes un menú generado.' : 'You don\'t have a meal plan yet.');
      const day = ctx.weekPlan.days[(ctx.todayPlanDay + 1) % ctx.weekPlan.days.length];
      const totals = new Map<string, number>();
      for (const m of day.meals) for (const i of m.ingredients) totals.set(i.foodId, (totals.get(i.foodId) ?? 0) + i.grams);
      const lines = [...totals.entries()].map(([id, g]) => `• ${getFood(id).name[ctx.lang]}: ${Math.round(g)} g`);
      return reply((es ? 'Ingredientes para mañana:\n' : 'Ingredients for tomorrow:\n') + lines.join('\n'));
    }
    case 'progress': {
      const t = weightTrend(ctx.weights, 28, ctx.today);
      if (!t.sufficient) return reply(es ? 'Aún no hay suficientes pesajes para ver una tendencia (se necesitan al menos 6 en 2 semanas). Registra tu peso varias veces por semana, a la misma hora.' : 'Not enough weigh-ins for a trend yet (at least 6 over 2 weeks). Log your weight several times a week at the same time of day.');
      const dir = t.slopeKgPerWeek;
      const w = formatWeight(Math.abs(dir), ctx.profile.units);
      return reply(
        es
          ? `En las últimas semanas tu peso cambia unos ${dir < 0 ? '-' : '+'}${w} por semana (${(t.pctPerWeek * 100).toFixed(2)} %). Es una tendencia estimada; los resultados dependen de muchos factores. Revisa la pestaña Progreso para medidas y fuerza.`
          : `Over recent weeks your weight is changing about ${dir < 0 ? '-' : '+'}${w} per week (${(t.pctPerWeek * 100).toFixed(2)}%). This is an estimated trend; results depend on many factors. See Progress for measurements and strength.`,
      );
    }
    case 'why_changed':
      if (!ctx.lastChange) return reply(es ? 'Tu plan no ha tenido ajustes desde que lo creaste.' : 'Your plan hasn\'t been adjusted since you created it.');
      return reply((es ? `Último cambio (${ctx.lastChange.date}): ` : `Last change (${ctx.lastChange.date}): `) + ctx.lastChange.summary);
    case 'fridge': {
      const have = new Set(matchFoodsFromText(message));
      if (!have.size) return reply(es ? 'Dime qué alimentos tienes (por ejemplo: "tengo huevo, arroz y espinaca").' : 'Tell me which foods you have (e.g., "I have eggs, rice and spinach").');
      const scored = RECIPES.map((rec) => {
        const ings = adaptRecipe(rec, r);
        if (!ings) return null;
        const match = ings.filter((i) => have.has(i.foodId)).length;
        return { rec, match, total: ings.length };
      })
        .filter((x): x is { rec: (typeof RECIPES)[number]; match: number; total: number } => !!x && x.match > 0)
        .sort((a, b) => b.match / b.total - a.match / a.total)
        .slice(0, 3);
      if (!scored.length) return reply(es ? 'No encontré recetas compatibles con esos ingredientes.' : 'No compatible recipes found with those ingredients.');
      return reply(
        (es ? 'Con lo que tienes podrías preparar:\n' : 'With what you have you could make:\n') +
          scored.map((s) => `• ${RECIPE_BY_ID[s.rec.id].name[ctx.lang]} (${s.match}/${s.total})`).join('\n'),
      );
    }
    default:
      return reply('', false);
  }
}

/** Resumen compacto y verificable que se envía al modelo de IA como contexto. */
export function contextSummary(ctx: CoachContext): Record<string, unknown> {
  const p = ctx.profile;
  return {
    goal: p.goal,
    level: p.level,
    daysPerWeek: p.daysPerWeek,
    diet: p.diet,
    allergens: p.allergens,
    units: p.units,
    injuries: p.health.injuries,
    targets: { kcal: ctx.kcalTarget, proteinG: ctx.proteinTargetG },
    consumedToday: ctx.consumedToday,
    nextWorkout:
      ctx.workoutPlan && ctx.nextWorkoutDayIndex !== null
        ? ctx.workoutPlan.days[ctx.nextWorkoutDayIndex].exercises.map((e) => ({ exercise: getExercise(e.exerciseId).name.en, sets: e.sets, reps: `${e.repsMin}-${e.repsMax}` }))
        : null,
    weightTrend: weightTrend(ctx.weights, 28, ctx.today),
    lastChange: ctx.lastChange,
  };
}
