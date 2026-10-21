// Genera supabase/seed.sql a partir de los datos del motor (fuente única de verdad).
// Uso: node --experimental-strip-types scripts/gen-seed.ts
import { writeFileSync } from 'node:fs';
import { FOODS } from '../src/core/data/foods.ts';
import { RECIPES } from '../src/core/data/recipes.ts';
import { EXERCISES } from '../src/core/data/exercises.ts';

const q = (s: string | null | undefined) => (s === null || s === undefined ? 'null' : `'${s.replace(/'/g, "''")}'`);
const arr = (xs: string[]) => (xs.length ? `array[${xs.map(q).join(',')}]::text[]` : `'{}'::text[]`);
const n = (x: number | null | undefined) => (x === null || x === undefined ? 'null' : String(x));

const lines: string[] = ['-- Generado por scripts/gen-seed.ts — no editar a mano.', 'begin;'];
for (const f of FOODS) {
  lines.push(
    `insert into public.foods (id,name_es,name_en,usda_ndb,usda_description,kcal_100g,protein_100g,carbs_100g,fat_100g,fiber_100g,state,category,origin,allergens,cost_tier,unit_grams,verified_on) values (${[
      q(f.id), q(f.name.es), q(f.name.en), q(f.usda.ndb), q(f.usda.description), n(f.per100.kcal), n(f.per100.protein), n(f.per100.carbs), n(f.per100.fat), n(f.per100.fiber), q(f.state), q(f.category), q(f.origin), arr(f.allergens), n(f.costTier), n(f.unit?.grams), f.verified ? q(f.verified) : 'null',
    ].join(',')}) on conflict (id) do update set kcal_100g = excluded.kcal_100g, protein_100g = excluded.protein_100g, carbs_100g = excluded.carbs_100g, fat_100g = excluded.fat_100g, fiber_100g = excluded.fiber_100g, name_es = excluded.name_es, name_en = excluded.name_en, updated_at = now();`,
  );
}
for (const r of RECIPES) {
  lines.push(
    `insert into public.recipes (id,name_es,name_en,meal_types,prep_minutes,steps_es,steps_en,seasonings_es,seasonings_en,batch_friendly) values (${[
      q(r.id), q(r.name.es), q(r.name.en), arr(r.mealTypes), n(r.prepMinutes), arr(r.steps.es), arr(r.steps.en), q(r.seasonings.es), q(r.seasonings.en), String(r.batchFriendly),
    ].join(',')}) on conflict (id) do update set name_es = excluded.name_es, name_en = excluded.name_en, steps_es = excluded.steps_es, steps_en = excluded.steps_en, updated_at = now();`,
  );
  lines.push(`delete from public.recipe_ingredients where recipe_id = ${q(r.id)};`);
  r.ingredients.forEach((i, pos) => {
    lines.push(
      `insert into public.recipe_ingredients (recipe_id,position,food_id,role,base_g,min_g,max_g,step_g,alternatives) values (${[
        q(r.id), n(pos), q(i.foodId), q(i.role), n(i.baseG), n(i.minG), n(i.maxG), n(i.stepG), arr(i.alternatives ?? []),
      ].join(',')});`,
    );
  });
}
for (const e of EXERCISES) {
  lines.push(
    `insert into public.exercises (id,name_es,name_en,pattern,primary_muscle,secondary_muscles,equipment,load_type,difficulty,compound,stress_areas,cues_es,cues_en,mistakes_es,mistakes_en) values (${[
      q(e.id), q(e.name.es), q(e.name.en), q(e.pattern), q(e.primary), arr(e.secondary), arr(e.equipment), q(e.load), n(e.difficulty), String(e.compound), arr(e.stress), arr(e.cues.es), arr(e.cues.en), arr(e.mistakes.es), arr(e.mistakes.en),
    ].join(',')}) on conflict (id) do update set name_es = excluded.name_es, name_en = excluded.name_en, cues_es = excluded.cues_es, cues_en = excluded.cues_en, mistakes_es = excluded.mistakes_es, mistakes_en = excluded.mistakes_en, updated_at = now();`,
  );
}
lines.push('commit;', '');
const out = new URL('../supabase/seed.sql', import.meta.url);
writeFileSync(out, lines.join('\n'));
console.log(`seed.sql: ${FOODS.length} alimentos, ${RECIPES.length} recetas, ${EXERCISES.length} ejercicios`);
