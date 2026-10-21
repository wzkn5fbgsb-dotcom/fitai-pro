// Componentes tipográficos basados en los estilos de `font` del tema.
import type { ReactNode } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { font, useTheme } from '../theme';

export interface TextProps {
  children?: ReactNode;
  color?: string;
  style?: StyleProp<TextStyle>;
  center?: boolean;
  numberOfLines?: number;
}

type Variant = keyof typeof font;

// Fábrica: crea un componente de texto con una variante y un color por defecto.
function makeText(variant: Variant, muted: boolean, displayName: string) {
  function T({ children, color, style, center, numberOfLines }: TextProps) {
    const { c } = useTheme();
    return (
      <Text
        numberOfLines={numberOfLines}
        style={[
          font[variant] as TextStyle,
          { color: color ?? (muted ? c.muted : c.text) },
          center ? { textAlign: 'center' } : null,
          style,
        ]}
      >
        {children}
      </Text>
    );
  }
  T.displayName = displayName;
  return T;
}

export const H1 = makeText('h1', false, 'H1');
export const H2 = makeText('h2', false, 'H2');
export const H3 = makeText('h3', false, 'H3');
export const Body = makeText('body', false, 'Body');
export const Small = makeText('small', true, 'Small');
export const Label = makeText('label', true, 'Label');
export const Num = makeText('num', false, 'Num');
