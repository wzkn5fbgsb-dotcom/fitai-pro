// Componentes de estado y mensajes: Empty, Notice, LockCard y ModalSheet.
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../i18n';
import { radius, space, useTheme } from '../theme';
import { Button } from './Controls';
import { Icon, type IconName } from './Icon';
import { Body, H2, H3, Small } from './Text';

// ---------- Empty ----------
export interface EmptyProps {
  title: string;
  body?: string;
  action?: { title: string; onPress: () => void };
  icon?: IconName;
}

export function Empty({ title, body, action, icon = 'info' }: EmptyProps) {
  const { c } = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        gap: space.sm,
        paddingVertical: space.xl,
        paddingHorizontal: space.lg,
        borderRadius: radius.md,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: c.border,
        backgroundColor: c.surface,
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: radius.pill,
          backgroundColor: c.surface2,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: space.xs,
        }}
      >
        <Icon name={icon} size={24} color={c.muted} />
      </View>
      <H3 center>{title}</H3>
      {body ? (
        <Small center style={{ maxWidth: 320 }}>
          {body}
        </Small>
      ) : null}
      {action ? (
        <Button title={action.title} onPress={action.onPress} small style={{ marginTop: space.sm }} />
      ) : null}
    </View>
  );
}

// ---------- Notice ----------
export interface NoticeProps {
  kind: 'info' | 'warn' | 'danger' | 'ok';
  text: string;
  title?: string;
}

export function Notice({ kind, text, title }: NoticeProps) {
  const { c, isDark } = useTheme();
  const tone = { info: c.protein, warn: c.warn, danger: c.danger, ok: c.ok }[kind];
  const icon: IconName = kind === 'ok' ? 'check' : 'info';
  return (
    <View
      accessibilityRole={kind === 'danger' || kind === 'warn' ? 'alert' : 'text'}
      style={{
        flexDirection: 'row',
        gap: space.md,
        padding: space.md + 2,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: tone + (isDark ? '55' : '66'),
        backgroundColor: tone + (isDark ? '1A' : '14'),
      }}
    >
      <View style={{ paddingTop: 1 }}>
        <Icon name={icon} size={20} color={tone} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <H3>{title}</H3> : null}
        <Body style={{ fontSize: 14, lineHeight: 20 }}>{text}</Body>
      </View>
    </View>
  );
}

// ---------- LockCard ----------
export interface LockCardProps {
  text: string;
  title?: string;
}

export function LockCard({ text, title }: LockCardProps) {
  const { c } = useTheme();
  const { t } = useI18n();
  return (
    <View
      style={{
        gap: space.md,
        padding: space.lg,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: c.accent + '66',
        backgroundColor: c.surface,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.pill,
            backgroundColor: c.accent + '22',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="lock" size={20} color={c.accent} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          {title ? <H3>{title}</H3> : null}
          <Body style={{ fontSize: 14, lineHeight: 20 }}>{text}</Body>
        </View>
      </View>
      <Button title={t('common.upgrade')} icon="crown" onPress={() => router.push('/membership')} />
    </View>
  );
}

// ---------- ModalSheet ----------
export interface ModalSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children?: ReactNode;
  scroll?: boolean;
}

export function ModalSheet({ visible, onClose, title, children, scroll = true }: ModalSheetProps) {
  const { c } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: c.overlay }}>
        {/* Toque fuera de la hoja para cerrar */}
        <Pressable
          style={{ flex: 1 }}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View
          accessibilityViewIsModal
          style={{
            maxHeight: '88%',
            backgroundColor: c.surface,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: c.border,
            paddingBottom: Math.max(insets.bottom, space.lg),
          }}
        >
          {/* Asa visual */}
          <View style={{ alignItems: 'center', paddingTop: space.sm }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: c.border }} />
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingLeft: space.lg,
              paddingRight: space.sm,
              paddingTop: space.xs,
              minHeight: 48,
            }}
          >
            <View style={{ flex: 1 }}>{title ? <H2 numberOfLines={2}>{title}</H2> : null}</View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              hitSlop={6}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: pressed ? c.surface2 : 'transparent',
              })}
            >
              <Icon name="close" size={22} color={c.muted} />
            </Pressable>
          </View>
          {scroll ? (
            <ScrollView
              contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, gap: space.md }}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          ) : (
            <View style={{ padding: space.lg, paddingTop: space.sm, gap: space.md }}>{children}</View>
          )}
        </View>
      </View>
    </Modal>
  );
}
