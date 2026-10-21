// Identidad visual de FITAI PRO: tinta profunda + acento "volt".
import { createContext, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

export interface Palette {
  bg: string;
  surface: string;
  surface2: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  accentText: string;
  danger: string;
  warn: string;
  ok: string;
  protein: string;
  carbs: string;
  fat: string;
  overlay: string;
}

export const dark: Palette = {
  bg: '#0B0D10',
  surface: '#14171C',
  surface2: '#1D2128',
  text: '#F2F4F7',
  muted: '#9AA3AF',
  border: '#272C34',
  accent: '#C8F25A',
  accentText: '#0B0D10',
  danger: '#FF6B6B',
  warn: '#F5B94A',
  ok: '#4ADE80',
  protein: '#7DD3FC',
  carbs: '#FBBF24',
  fat: '#F472B6',
  overlay: 'rgba(0,0,0,0.6)',
};

export const light: Palette = {
  bg: '#F5F6F2',
  surface: '#FFFFFF',
  surface2: '#ECEFE6',
  text: '#101317',
  muted: '#59616C',
  border: '#DADFD3',
  accent: '#4A7300',
  accentText: '#FFFFFF',
  danger: '#C62828',
  warn: '#A15C00',
  ok: '#1B7F3B',
  protein: '#0369A1',
  carbs: '#A16207',
  fat: '#BE185D',
  overlay: 'rgba(0,0,0,0.4)',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 14, lg: 20, pill: 999 };
export const font = {
  h1: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.2 },
  h3: { fontSize: 16, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 21 },
  small: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  num: { fontSize: 30, fontWeight: '800' as const, fontVariant: ['tabular-nums' as const] },
  label: { fontSize: 12, fontWeight: '700' as const, letterSpacing: 0.6, textTransform: 'uppercase' as const },
};

export type ThemePref = 'system' | 'light' | 'dark';

const ThemeCtx = createContext<{ c: Palette; isDark: boolean }>({ c: dark, isDark: true });

export function ThemeProvider({ pref, children }: { pref: ThemePref; children: ReactNode }) {
  const scheme = useColorScheme();
  const isDark = pref === 'system' ? scheme !== 'light' : pref === 'dark';
  return <ThemeCtx.Provider value={{ c: isDark ? dark : light, isDark }}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  return useContext(ThemeCtx);
}
