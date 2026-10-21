// Controles interactivos: botones, chips, campos de texto y numéricos, stepper y switch.
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Switch as RNSwitch,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { font, radius, space, useTheme } from '../theme';
import { Icon, type IconName } from './Icon';
import { Body, Label, Small } from './Text';

const MIN_TOUCH = 44;

// ---------- Button ----------
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  small,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const { c } = useTheme();
  const inactive = !!disabled || !!loading;

  // Colores por variante.
  const palette: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
    primary: { bg: c.accent, fg: c.accentText, border: c.accent },
    secondary: { bg: c.surface2, fg: c.text, border: c.border },
    ghost: { bg: 'transparent', fg: c.text, border: 'transparent' },
    danger: { bg: c.danger, fg: '#FFFFFF', border: c.danger },
  };
  const p = palette[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: inactive, busy: !!loading }}
      hitSlop={small ? 6 : 0}
      style={({ pressed }) => [
        {
          minHeight: small ? 36 : 52,
          minWidth: MIN_TOUCH,
          paddingHorizontal: small ? space.md : space.xl,
          borderRadius: radius.pill,
          backgroundColor: p.bg,
          borderWidth: 1,
          borderColor: p.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.sm,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed && !inactive ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={small ? 16 : 20} color={p.fg} /> : null}
          <Text
            numberOfLines={1}
            style={{ color: p.fg, fontSize: small ? 14 : 16, fontWeight: '700', letterSpacing: 0.1 }}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

// ---------- Chip ----------
export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
}

export function Chip({ label, selected, onPress, color }: ChipProps) {
  const { c } = useTheme();
  const tone = color ?? c.accent;
  const fg = selected ? (color ? c.bg : c.accentText) : c.text;
  const body = (
    <Text style={{ color: fg, fontSize: 14, fontWeight: selected ? '700' : '500' }} numberOfLines={1}>
      {label}
    </Text>
  );
  const chipStyle: ViewStyle = {
    minHeight: 36,
    paddingHorizontal: space.md + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: selected ? tone : c.border,
    backgroundColor: selected ? tone : c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  };
  if (!onPress) return <View style={chipStyle}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected }}
      hitSlop={4}
      style={({ pressed }) => [chipStyle, pressed ? { opacity: 0.8 } : null]}
    >
      {body}
    </Pressable>
  );
}

// ---------- ChipGroup ----------
export interface Option {
  value: string;
  label: string;
}

export interface ChipGroupProps {
  options: Option[];
  value: string[];
  onChange: (v: string[]) => void;
  multi?: boolean;
}

export function ChipGroup({ options, value, onChange, multi = false }: ChipGroupProps) {
  // Alterna selección; en modo simple el arreglo tiene 0–1 elementos.
  const toggle = (v: string) => {
    const has = value.includes(v);
    if (multi) onChange(has ? value.filter((x) => x !== v) : [...value, v]);
    else onChange(has ? [] : [v]);
  };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {options.map((o) => (
        <Chip key={o.value} label={o.label} selected={value.includes(o.value)} onPress={() => toggle(o.value)} />
      ))}
    </View>
  );
}

// ---------- Segmented ----------
export interface SegmentedProps {
  options: Option[];
  value: string;
  onChange: (v: string) => void;
}

export function Segmented({ options, value, onChange }: SegmentedProps) {
  const { c } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        backgroundColor: c.surface2,
        borderRadius: radius.md,
        padding: 3,
        gap: 3,
      }}
    >
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: sel }}
            style={{
              flex: 1,
              minHeight: 40,
              borderRadius: radius.md - 3,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: space.sm,
              backgroundColor: sel ? c.surface : 'transparent',
              borderWidth: 1,
              borderColor: sel ? c.border : 'transparent',
            }}
          >
            <Text
              numberOfLines={1}
              style={{ color: sel ? c.text : c.muted, fontSize: 14, fontWeight: sel ? '700' : '500' }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------- Field ----------
export interface FieldProps {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  suffix?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  hint?: string;
  error?: string;
  multiline?: boolean;
  onBlur?: () => void;
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  suffix,
  secureTextEntry,
  autoCapitalize,
  hint,
  error,
  multiline,
  onBlur,
}: FieldProps) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: space.xs + 2 }}>
      <Label>{label}</Label>
      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          minHeight: 50,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: error ? c.danger : focused ? c.accent : c.border,
          backgroundColor: c.surface,
          paddingHorizontal: space.md + 2,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={c.muted}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          multiline={multiline}
          accessibilityLabel={label}
          accessibilityHint={hint}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          selectionColor={c.accent}
          style={{
            flex: 1,
            color: c.text,
            fontSize: 16,
            paddingVertical: space.md,
            minHeight: multiline ? 96 : undefined,
            textAlignVertical: multiline ? 'top' : 'center',
          }}
        />
        {suffix ? <Small style={{ marginLeft: space.sm }}>{suffix}</Small> : null}
      </View>
      {error ? <Small color={c.danger}>{error}</Small> : hint ? <Small>{hint}</Small> : null}
    </View>
  );
}

// ---------- NumberField ----------
export interface NumberFieldProps {
  label: string;
  value: number | undefined;
  onChange: (n: number | undefined) => void;
  suffix?: string;
  decimals?: number;
  hint?: string;
  placeholder?: string;
  error?: string;
}

// Convierte un número a texto con a lo sumo `decimals` decimales (sin ceros sobrantes).
function numToText(n: number | undefined, decimals: number): string {
  if (n === undefined || !Number.isFinite(n)) return '';
  const f = Number(n.toFixed(decimals));
  return String(f);
}

// Interpreta texto con coma o punto decimal. Devuelve undefined si no es un número.
function parseNum(s: string): number | undefined {
  const norm = s.trim().replace(',', '.');
  if (norm === '' || norm === '.' || norm === '-') return undefined;
  const n = Number(norm);
  return Number.isFinite(n) ? n : undefined;
}

export function NumberField({
  label,
  value,
  onChange,
  suffix,
  decimals = 0,
  hint,
  placeholder,
  error,
}: NumberFieldProps) {
  // Texto crudo en estado local para permitir entradas intermedias como "7." o "7,".
  const [text, setText] = useState<string>(numToText(value, decimals));
  const lastEmitted = useRef<number | undefined>(value);

  // Si el valor cambia desde fuera (no por lo que tecleamos), sincroniza el texto.
  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setText(numToText(value, decimals));
    }
  }, [value, decimals]);

  const handle = (raw: string) => {
    // Solo dígitos y un separador decimal (si se permiten decimales).
    let clean = raw.replace(decimals > 0 ? /[^0-9.,]/g : /[^0-9]/g, '');
    if (decimals > 0) {
      const idx = clean.search(/[.,]/);
      if (idx >= 0) {
        const intPart = clean.slice(0, idx);
        const sep = clean[idx];
        const frac = clean
          .slice(idx + 1)
          .replace(/[.,]/g, '')
          .slice(0, decimals);
        clean = `${intPart}${sep}${frac}`;
      }
    }
    setText(clean);
    const n = clean === '' ? undefined : parseNum(clean);
    lastEmitted.current = n;
    onChange(n);
  };

  return (
    <Field
      label={label}
      value={text}
      onChangeText={handle}
      keyboardType="decimal-pad"
      suffix={suffix}
      hint={hint}
      placeholder={placeholder}
      error={error}
      onBlur={() => setText(numToText(parseNum(text), decimals))}
    />
  );
}

// ---------- Stepper ----------
export interface StepperProps {
  label?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
  suffix?: string;
}

export function Stepper({ label, value, min, max, step = 1, onChange, suffix }: StepperProps) {
  const { c } = useTheme();
  // Redondeo para evitar errores de coma flotante (p. ej. 2.5 + 0.1).
  const round = (n: number) => Math.round(n * 1000) / 1000;
  const dec = () => onChange(Math.max(min, round(value - step)));
  const inc = () => onChange(Math.min(max, round(value + step)));
  const canDec = value > min;
  const canInc = value < max;

  const btn = (kind: 'minus' | 'plus', enabled: boolean, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={`${label ?? ''} ${kind === 'minus' ? '−' : '+'}${step}`.trim()}
      accessibilityState={{ disabled: !enabled }}
      style={({ pressed }) => ({
        width: MIN_TOUCH,
        height: MIN_TOUCH,
        borderRadius: radius.pill,
        backgroundColor: c.surface2,
        borderWidth: 1,
        borderColor: c.border,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: !enabled ? 0.35 : pressed ? 0.7 : 1,
      })}
    >
      {kind === 'plus' ? (
        <Icon name="plus" size={20} color={c.text} />
      ) : (
        <View style={{ width: 14, height: 2, borderRadius: 1, backgroundColor: c.text }} />
      )}
    </Pressable>
  );

  return (
    <View style={{ gap: space.xs + 2 }}>
      {label ? <Label>{label}</Label> : null}
      <View
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value, text: suffix ? `${value} ${suffix}` : String(value) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e: { nativeEvent: { actionName: string } }) => {
          if (e.nativeEvent.actionName === 'increment' && canInc) inc();
          if (e.nativeEvent.actionName === 'decrement' && canDec) dec();
        }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}
      >
        {btn('minus', canDec, dec)}
        <View style={{ minWidth: 72, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 4 }}>
          <Text style={[font.num, { color: c.text, fontSize: 24 }]}>{value}</Text>
          {suffix ? <Small>{suffix}</Small> : null}
        </View>
        {btn('plus', canInc, inc)}
      </View>
    </View>
  );
}

// ---------- Switch ----------
export interface SwitchProps {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}

export function Switch({ label, value, onChange, hint }: SwitchProps) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      style={{ flexDirection: 'row', alignItems: 'center', minHeight: MIN_TOUCH + 4, gap: space.md }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Body>{label}</Body>
        {hint ? <Small>{hint}</Small> : null}
      </View>
      <RNSwitch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: c.surface2, true: c.accent }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={c.surface2}
        importantForAccessibility="no"
        accessibilityElementsHidden
      />
    </Pressable>
  );
}
