# Contratos internos de la app (para quien escribe pantallas)

Todo el código de la app es TypeScript con React Native + Expo Router (Expo SDK 57, React 19.2, RN 0.86).
Imports dentro de la app SIN extensión (`'../src/core'`), el motor `src/core` usa extensiones `.ts` internamente.

## Estado y acciones — `src/data/store.tsx`
```ts
import { useApp } from '../src/data/store';
const { state, actions, plan } = useApp(); // tipos en src/data/types.ts
```
`AppProvider` envuelve la app en `app/_layout.tsx`. Ver `src/data/types.ts` para TODOS los campos y acciones.

## Traducciones — `src/i18n`
```ts
import { useI18n } from '../src/i18n';
const { t, tx, lang } = useI18n();
t('home.hello'); t('training.dayN', { n: 2 }); tx<string[]>('nutrition.dayNames');
```
Nunca escribas textos visibles sin pasar por `t()`. Claves en `src/i18n/es.ts` (en.ts tiene la misma estructura).

## Tema — `src/theme`
```ts
import { useTheme, space, radius, font } from '../src/theme';
const { c, isDark } = useTheme(); // c.bg, c.surface, c.surface2, c.text, c.muted, c.border, c.accent, c.accentText, c.danger, c.warn, c.ok, c.protein, c.carbs, c.fat
```

## Componentes — `src/components` (importar de `'../src/components'`)
| Componente | Props |
|---|---|
| `Screen` | `{ children, scroll?: boolean = true, padded?: boolean = true, keyboard?: boolean }` — fondo `c.bg`, SafeArea (bordes inferiores), ScrollView |
| `Card` | `{ children, style?, onPress? }` |
| `H1`, `H2`, `H3`, `Body`, `Small`, `Label`, `Num` | `{ children, color?, style?, center?, numberOfLines? }` (texto con estilos de `font`; `Small` y `Label` usan `c.muted` por defecto) |
| `Button` | `{ title, onPress, variant?: 'primary'\|'secondary'\|'ghost'\|'danger', disabled?, loading?, icon?: IconName, small?, style? }` |
| `Chip` | `{ label, selected?, onPress?, color? }` |
| `ChipGroup` | `{ options: {value: string, label: string}[], value: string[] , onChange(v: string[]), multi?: boolean }` (si `multi` es false el arreglo tiene 0–1 elementos) |
| `Segmented` | `{ options: {value: string, label: string}[], value: string, onChange(v: string) }` |
| `Field` | `{ label, value: string, onChangeText, placeholder?, keyboardType?, suffix?, secureTextEntry?, autoCapitalize?, hint?, error? }` |
| `NumberField` | `{ label, value: number \| undefined, onChange(n: number \| undefined), suffix?, decimals?: number = 0, hint? }` |
| `Stepper` | `{ label?, value: number, min, max, step?: number = 1, onChange(n), suffix? }` |
| `Switch` | `{ label, value: boolean, onChange(v) }` |
| `ProgressBar` | `{ value: number /*0..1*/, color?, height? }` |
| `Ring` | `{ value: number /*0..1*/, size?: 72, stroke?: 8, color?, label?: string, sublabel?: string }` |
| `MacroBar` | `{ label, value: number, target: number, unit?: 'g', color }` |
| `LineChart` | `{ data: {x: string /*YYYY-MM-DD*/, y: number}[], height?: 160, color?, formatY?(n): string }` (svg, maneja 0–1 puntos mostrando estado vacío) |
| `BarChart` | `{ data: {label: string, value: number}[], height?: 120, color?, max? }` |
| `Empty` | `{ title, body?, action?: {title, onPress} }` |
| `Notice` | `{ kind: 'info'\|'warn'\|'danger'\|'ok', text, title? }` |
| `LockCard` | `{ text, }` — tarjeta "función Pro/Elite" con botón que navega a `/membership` |
| `Row` | `{ children, gap?, style?, wrap? }` (flexDirection row, alignItems center) |
| `ListItem` | `{ title, subtitle?, right?: ReactNode, onPress?, icon?: IconName }` |
| `Icon` | `{ name: IconName, size?: 22, color? }` — `IconName = 'home'\|'dumbbell'\|'food'\|'chart'\|'chat'\|'user'\|'plus'\|'check'\|'chevron-right'\|'chevron-left'\|'camera'\|'image'\|'trash'\|'settings'\|'crown'\|'close'\|'cart'\|'refresh'\|'info'\|'send'\|'clock'\|'flame'\|'share'\|'swap'\|'lock'` (SVG con react-native-svg, sin otras librerías de íconos) |
| `ModalSheet` | `{ visible, onClose, title?, children }` (Modal nativo con fondo `c.overlay`) |
| `Divider` | `{}` |

## Utilidades
- `src/lib/dates.ts`: `todayStr()`, `weekdayIndex()`, `addDays()`, `weekStart()`, `daysBetween()`, `formatDate(date, lang)`.
- `src/lib/format.ts`: `fmtWeight(kg, units)`, `fmtNum(n, decimals?)`, `displayWeightToKg(value, units)`, `kgToDisplay(kg, units)` (number), `weightUnit(units)` ('kg'|'lb'), `lengthUnit(units)`, `cmToDisplay`, `displayToCm`.
- `src/lib/derive.ts` (selectores puros sobre `AppState`): `targetsFor(state)` → `TargetsResult \| null`, `nextWorkoutDayIndex(state)`, `todayMealDay(state)` (índice de día del plan para hoy), `consumedOn(state, date)`, `weekWorkoutsDone(state)`, `lastExerciseLog(state, exerciseId)`, `reviewDue(state)`, `coachContext(state, lang)`.

## Reglas
- Nada de botones que no hagan nada. Si una función no está disponible, muéstralo con `Notice`/`LockCard`.
- Nunca mostrar cifras inventadas: si no hay datos, `Empty` con la acción para empezar.
- Gating de funciones: `can(plan, 'feature')` de `src/core/plans.ts`.
- Navegación: `import { router, useLocalSearchParams, Stack, Link } from 'expo-router'`.
