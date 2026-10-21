// Copia el motor (src/core) a supabase/functions/_shared/core para que las
// funciones del servidor usen exactamente el mismo código que la app.
// Uso: node --experimental-strip-types scripts/sync-functions.ts [--check]
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src/core');
const dst = join(root, 'supabase/functions/_shared/core');
const check = process.argv.includes('--check');
const header = '// GENERADO desde src/core por scripts/sync-functions.ts — no editar aquí.\n';

function files(dir: string, rel = ''): string[] {
  return readdirSync(join(dir, rel)).flatMap((name) => {
    const r = join(rel, name);
    if (name === '__tests__') return [];
    return statSync(join(dir, r)).isDirectory() ? files(dir, r) : name.endsWith('.ts') ? [r] : [];
  });
}

let stale = 0;
for (const rel of files(src)) {
  const want = header + readFileSync(join(src, rel), 'utf8');
  const out = join(dst, rel);
  const have = existsSync(out) ? readFileSync(out, 'utf8') : '';
  if (have !== want) {
    stale++;
    if (!check) {
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, want);
    }
  }
}
if (check && stale) {
  console.error(`${stale} archivo(s) de _shared/core desactualizados. Ejecuta: npm run sync:functions`);
  process.exit(1);
}
console.log(check ? 'core sincronizado ✓' : `copiados/actualizados: ${stale}`);
