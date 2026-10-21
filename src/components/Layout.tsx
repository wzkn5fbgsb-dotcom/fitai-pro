// Contenedores de diseño: Screen, Card, Row, Divider y ListItem.
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { font, radius, space, useTheme } from '../theme';
import { Icon, type IconName } from './Icon';
import { Body, Small } from './Text';

export interface ScreenProps {
  children?: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  keyboard?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Screen({ children, scroll = true, padded = true, keyboard, style }: ScreenProps) {
  const { c } = useTheme();
  const pad: ViewStyle | null = padded ? { padding: space.lg, gap: space.md } : null;

  // Contenido: con o sin ScrollView según `scroll`.
  const content = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[pad, { flexGrow: 1, paddingBottom: padded ? space.xxl : 0 }, style]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, pad, style]}>{children}</View>
  );

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
      {keyboard ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

export interface CardProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
}

export function Card({ children, style, onPress, accessibilityLabel }: CardProps) {
  const { c } = useTheme();
  const base: ViewStyle = {
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    padding: space.lg,
    gap: space.sm,
  };
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [base, pressed ? { opacity: 0.85 } : null, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

export interface RowProps {
  children?: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  wrap?: boolean;
}

export function Row({ children, gap = space.sm, style, wrap }: RowProps) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>
      {children}
    </View>
  );
}

export function Divider() {
  const { c } = useTheme();
  return <View style={{ height: 1, backgroundColor: c.border, marginVertical: space.xs }} />;
}

export interface ListItemProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  icon?: IconName;
}

export function ListItem({ title, subtitle, right, onPress, icon }: ListItemProps) {
  const { c } = useTheme();
  const inner = (
    <>
      {icon ? (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.sm,
            backgroundColor: c.surface2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} size={20} color={c.text} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Body style={{ fontWeight: font.h3.fontWeight }} numberOfLines={2}>
          {title}
        </Body>
        {subtitle ? <Small numberOfLines={2}>{subtitle}</Small> : null}
      </View>
      {right}
      {onPress && !right ? <Icon name="chevron-right" size={18} color={c.muted} /> : null}
    </>
  );
  const rowStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 52,
    paddingVertical: space.sm,
  };
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
        style={({ pressed }) => [rowStyle, pressed ? { opacity: 0.7 } : null]}
      >
        {inner}
      </Pressable>
    );
  }
  return <View style={rowStyle}>{inner}</View>;
}
