// Indicadores de progreso: ProgressBar, Ring y MacroBar.
import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { font, radius, space, useTheme } from '../theme';
import { Small } from './Text';

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

// ---------- ProgressBar ----------
export interface ProgressBarProps {
  value: number;
  color?: string;
  height?: number;
}

export function ProgressBar({ value, color, height = 8 }: ProgressBarProps) {
  const { c } = useTheme();
  const v = clamp01(value);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}
      style={{ height, borderRadius: radius.pill, backgroundColor: c.surface2, overflow: 'hidden' }}
    >
      <View
        style={{ width: `${v * 100}%`, height: '100%', borderRadius: radius.pill, backgroundColor: color ?? c.accent }}
      />
    </View>
  );
}

// ---------- Ring ----------
export interface RingProps {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
  sublabel?: string;
}

export function Ring({ value, size = 72, stroke = 8, color, label, sublabel }: RingProps) {
  const { c } = useTheme();
  const v = clamp01(value);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const cx = size / 2;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={[label, sublabel].filter(Boolean).join(' ')}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      {/* Se rota todo el lienzo -90° para que el arco empiece arriba */}
      <Svg
        width={size}
        height={size}
        style={{ position: 'absolute', top: 0, left: 0, transform: [{ rotate: '-90deg' }] }}
      >
        <Circle cx={cx} cy={cx} r={r} stroke={c.surface2} strokeWidth={stroke} fill="none" />
        {v > 0 ? (
          <Circle
            cx={cx}
            cy={cx}
            r={r}
            stroke={color ?? c.accent}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circ} ${circ}`}
            strokeDashoffset={circ * (1 - v)}
          />
        ) : null}
      </Svg>
      {label ? (
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[font.num, { color: c.text, fontSize: Math.max(12, size * 0.24), maxWidth: size - stroke * 2 - 4 }]}
        >
          {label}
        </Text>
      ) : null}
      {sublabel ? (
        <Text
          numberOfLines={1}
          style={{ color: c.muted, fontSize: Math.max(9, size * 0.13), fontWeight: '600', maxWidth: size - stroke * 2 - 4 }}
        >
          {sublabel}
        </Text>
      ) : null}
    </View>
  );
}

// ---------- MacroBar ----------
export interface MacroBarProps {
  label: string;
  value: number;
  target: number;
  unit?: string;
  color: string;
}

export function MacroBar({ label, value, target, unit = 'g', color }: MacroBarProps) {
  const { c } = useTheme();
  const ratio = target > 0 ? value / target : 0;
  const over = target > 0 && value > target * 1.05;
  return (
    <View style={{ gap: space.xs + 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.sm }}>
        <Small color={c.text} style={{ fontWeight: '600' }}>
          {label}
        </Small>
        <Text style={{ fontVariant: ['tabular-nums'] }}>
          <Text style={{ color: over ? c.warn : c.text, fontSize: 14, fontWeight: '800' }}>{Math.round(value)}</Text>
          <Text style={{ color: c.muted, fontSize: 13 }}>
            {' / '}
            {Math.round(target)} {unit}
          </Text>
        </Text>
      </View>
      <ProgressBar value={ratio} color={color} height={6} />
    </View>
  );
}
