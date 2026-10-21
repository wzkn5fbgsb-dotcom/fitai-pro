// Compara la base de alimentos (src/core/data/foods.ts) con la API oficial de
// USDA FoodData Central (conjunto SR Legacy).
//
// Uso:  FDC_API_KEY=tu_clave node --experimental-strip-types scripts/verify-usda.ts
// Clave gratuita: https://fdc.nal.usda.gov/api-key-signup
//
// Informa diferencias mayores de 2 % o de 0,5 g (kcal: 2 % o 1 kcal) y termina
// con código 1 si hay alguna diferencia o algún alimento no encontrado.
import { FOODS, type Food, type Per100 } from '../src/core/data/foods.ts';

const API = 'https://api.nal.usda.gov/fdc/v1/foods/search';
const NUTRIENTS: Record<keyof Per100, string> = {
  kcal: '208',
  protein: '203',
  fat: '204',
  carbs: '205',
  fiber: '291',
};

interface FdcNutrient {
  nutrientNumber?: string;
  value?: number;
}
interface FdcFood {
  fdcId: number;
  description: string;
  ndbNumber?: string | number;
  foodNutrients?: FdcNutrient[];
}

type Row = { id: string; field: string; ours: string; usda: string; diff: string };

const stripZeros = (s: string | number | undefined) => String(s ?? '').replace(/^0+/, '');

function differs(field: keyof Per100, ours: number, usda: number): boolean {
  const abs = Math.abs(ours - usda);
  const rel = usda === 0 ? (ours === 0 ? 0 : Infinity) : abs / Math.abs(usda);
  const absTol = field === 'kcal' ? 1 : 0.5;
  return rel > 0.02 && abs > absTol;
}

async function search(key: string, food: Food): Promise<FdcFood | null> {
  const url =
    `${API}?api_key=${encodeURIComponent(key)}&dataType=SR%20Legacy` +
    `&query=${encodeURIComponent(food.usda.description)}&pageSize=5`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { headers: { Accept: 'application/json' } });
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 1500 * attempt));
      continue;
    }
    if (res.status === 401 || res.status === 403) throw new Error(`La API rechazó la clave (HTTP ${res.status}). Revisa FDC_API_KEY.`);
    if (!res.ok) throw new Error(`HTTP ${res.status} al consultar "${food.id}"`);
    const body = (await res.json()) as { foods?: FdcFood[] };
    const want = stripZeros(food.usda.ndb);
    return (body.foods ?? []).find((x) => stripZeros(x.ndbNumber) === want) ?? null;
  }
  throw new Error(`La API no respondió tras 3 intentos ("${food.id}")`);
}

function table(rows: Row[]): string {
  const cols: (keyof Row)[] = ['id', 'field', 'ours', 'usda', 'diff'];
  const head: Row = { id: 'alimento', field: 'nutriente', ours: 'app', usda: 'USDA', diff: 'diferencia' };
  const all = [head, ...rows];
  const w = cols.map((c) => Math.max(...all.map((r) => r[c].length)));
  const line = (r: Row) => '| ' + cols.map((c, i) => r[c].padEnd(w[i])).join(' | ') + ' |';
  return [line(head), '|' + w.map((n) => '-'.repeat(n + 2)).join('|') + '|', ...rows.map(line)].join('\n');
}

async function main(): Promise<number> {
  const key = process.env.FDC_API_KEY ?? '';
  if (!key) {
    console.error(
      'ERROR: falta la variable FDC_API_KEY.\n' +
        'Consigue una clave gratuita en https://fdc.nal.usda.gov/api-key-signup y ejecuta:\n' +
        '  FDC_API_KEY=tu_clave npm run verify:usda\n' +
        'En GitHub: guarda la clave como secret FDC_API_KEY y lanza el workflow "Verificar datos de alimentos (USDA)".',
    );
    return 2;
  }

  const mismatches: Row[] = [];
  const notFound: string[] = [];
  let ok = 0;

  for (const food of FOODS) {
    const hit = await search(key, food);
    if (!hit) {
      notFound.push(`${food.id} (NDB ${food.usda.ndb}: ${food.usda.description})`);
      continue;
    }
    const byNum = new Map<string, number>();
    for (const n of hit.foodNutrients ?? []) {
      if (n.nutrientNumber && typeof n.value === 'number') byNum.set(String(n.nutrientNumber), n.value);
    }
    let foodOk = true;
    for (const field of Object.keys(NUTRIENTS) as (keyof Per100)[]) {
      const ours = food.per100[field];
      const usda = byNum.get(NUTRIENTS[field]);
      if (ours === null && usda === undefined) continue;
      if (ours === null || usda === undefined) {
        foodOk = false;
        mismatches.push({ id: food.id, field, ours: String(ours ?? '—'), usda: String(usda ?? '—'), diff: 'falta en un lado' });
        continue;
      }
      if (differs(field, ours, usda)) {
        foodOk = false;
        const pct = usda === 0 ? '∞' : ((100 * (ours - usda)) / usda).toFixed(1);
        mismatches.push({ id: food.id, field, ours: String(ours), usda: String(usda), diff: `${(ours - usda).toFixed(2)} (${pct} %)` });
      }
    }
    if (foodOk) ok++;
  }

  console.log(`Alimentos revisados: ${FOODS.length} · correctos: ${ok} · con diferencias: ${new Set(mismatches.map((m) => m.id)).size} · no encontrados: ${notFound.length}`);
  if (mismatches.length) console.log('\nDiferencias (> 2 % y > 0,5 g / 1 kcal):\n' + table(mismatches));
  if (notFound.length) console.log('\nNo encontrados en SR Legacy por número NDB:\n- ' + notFound.join('\n- '));
  if (!mismatches.length && !notFound.length) console.log('Todo coincide con USDA FoodData Central.');
  return mismatches.length || notFound.length ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    const cause = err instanceof Error && err.cause instanceof Error ? ` (${err.cause.message})` : '';
    console.error('ERROR:', err instanceof Error ? err.message + cause : err);
    console.error('Si el error es de red, comprueba la conexión a api.nal.usda.gov.');
    process.exit(1);
  },
);
