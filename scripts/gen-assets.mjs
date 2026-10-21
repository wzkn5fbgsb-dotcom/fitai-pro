// Genera los íconos y la pantalla de inicio (PNG) a partir de SVG con `sharp`.
// Uso: node scripts/gen-assets.mjs   (sharp debe estar instalado: npm i -D sharp, o global)
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let sharp;
try {
  sharp = require('sharp');
} catch {
  const globalRoot = execSync('npm root -g').toString().trim();
  sharp = require(join(globalRoot, 'sharp'));
}

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
mkdirSync(out, { recursive: true });

const DARK = '#0B0D10';
const VOLT = '#C8F25A';
const FONT = "'DejaVu Sans', 'Helvetica Neue', Arial, sans-serif";

// Monograma: una "F" geométrica inclinada (trazos rectos, sin fuentes) + "AI" pequeño.
// Dibujado en un lienzo de 1024; `scale`/`dx`/`dy` permiten encogerlo para el ícono adaptativo.
function monogram(scale = 1) {
  const s = scale;
  const t = (x, y) => `${(512 + (x - 512) * s).toFixed(1)},${(512 + (y - 512) * s).toFixed(1)}`;
  // F inclinada (skew ~ -10°): mástil + brazo superior + brazo medio
  const stem = [t(330, 800), t(420, 800), t(500, 260), t(410, 260)];
  const top = [t(410, 260), t(760, 260), t(745, 350), t(397, 350)];
  const mid = [t(395, 480), t(650, 480), t(636, 565), t(382, 565)]; // empieza dentro del mástil
  const poly = (pts) => `<polygon points="${pts.join(' ')}" fill="${VOLT}"/>`;
  const aiX = 512 + (560 - 512) * s;
  const aiY = 512 + (790 - 512) * s;
  // Desplazado a la izquierda para centrar ópticamente "F" + "AI".
  return `<g transform="translate(${-36 * s} 0)">
    ${poly(stem)}${poly(top)}${poly(mid)}
    <text x="${aiX}" y="${aiY}" font-family="${FONT}" font-weight="700" font-size="${200 * s}"
          letter-spacing="${6 * s}" fill="${VOLT}">AI</text></g>`;
}

const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="${DARK}"/>
  <circle cx="512" cy="512" r="430" fill="none" stroke="${VOLT}" stroke-opacity="0.12" stroke-width="10"/>
  ${monogram(1)}
</svg>`;

// Ícono adaptativo de Android: el sistema recorta hasta ~66 % central → dejamos margen.
const adaptiveSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${monogram(0.62)}
</svg>`;

const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1242" height="2436" viewBox="0 0 1242 2436">
  <rect width="1242" height="2436" fill="${DARK}"/>
  <g transform="translate(621 1180)">
    <text x="0" y="0" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="190" letter-spacing="8">
      <tspan fill="#FFFFFF">FIT</tspan><tspan fill="${VOLT}">AI</tspan>
    </text>
    <text x="0" y="130" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="80" letter-spacing="40" fill="#FFFFFF">PRO</text>
    <rect x="-90" y="180" width="180" height="10" rx="5" fill="${VOLT}"/>
  </g>
</svg>`;

// opaque = sin canal alfa (Apple rechaza íconos con transparencia).
const jobs = [
  ['icon.png', iconSvg, 1024, 1024, true],
  ['adaptive-icon.png', adaptiveSvg, 1024, 1024, false],
  ['splash.png', splashSvg, 1242, 2436, true],
  ['favicon.png', iconSvg, 48, 48, true],
];
for (const [name, svg, w, h, opaque] of jobs) {
  let img = sharp(Buffer.from(svg)).resize(w, h);
  if (opaque) img = img.flatten({ background: DARK }).removeAlpha();
  await img.png().toFile(join(out, name));
  console.log('✓', name, `${w}x${h}`);
}
