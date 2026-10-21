// Bienvenida: marca, idioma y elección de modo (local o con cuenta).
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Body, Button, Card, H3, Icon, Label, Notice, Row, Screen, Segmented, Small } from '../src/components';
import type { Lang } from '../src/core';
import { useApp } from '../src/data/store';
import type { Mode } from '../src/data/types';
import { useI18n } from '../src/i18n';
import { cloudConfigured } from '../src/lib/config';
import { radius, space, useTheme } from '../src/theme';
import type { IconName } from '../src/components';

export default function Welcome() {
  const { state, actions } = useApp();
  const { t, lang } = useI18n();
  const { c } = useTheme();
  const [mode, setMode] = useState<Mode>(state.mode ?? 'local');
  const [busy, setBusy] = useState(false);

  const start = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await actions.chooseMode(mode);
      router.replace(mode === 'cloud' ? '/auth' : '/onboarding');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      {/* Héroe de marca */}
      <View style={{ paddingTop: space.xxl * 1.5, paddingBottom: space.lg, gap: space.md }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: radius.md,
            backgroundColor: c.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="flame" size={30} color={c.accentText} />
        </View>
        <Row gap={space.sm} style={{ alignItems: 'baseline' }}>
          <Body style={{ fontSize: 44, lineHeight: 48, fontWeight: '900', letterSpacing: -1.5 }}>FITAI</Body>
          <Body style={{ fontSize: 44, lineHeight: 48, fontWeight: '900', letterSpacing: -1.5 }} color={c.accent}>
            {t('sa.welcome.brandAccent')}
          </Body>
        </Row>
        <Body color={c.muted} style={{ fontSize: 17, lineHeight: 24 }}>
          {t('welcome.tagline')}
        </Body>
      </View>

      {/* Idioma */}
      <Label>{t('welcome.language')}</Label>
      <Segmented
        options={[
          { value: 'es', label: t('sa.langs.es') },
          { value: 'en', label: t('sa.langs.en') },
        ]}
        value={lang}
        onChange={(v) => actions.setLang(v as Lang)}
      />

      {/* Modo */}
      <H3 style={{ marginTop: space.lg }}>{t('welcome.modeTitle')}</H3>
      <ModeCard
        icon="user"
        title={t('welcome.modeLocal')}
        desc={t('welcome.modeLocalDesc')}
        selected={mode === 'local'}
        onPress={() => setMode('local')}
      />
      <ModeCard
        icon="refresh"
        title={t('welcome.modeCloud')}
        desc={t('welcome.modeCloudDesc')}
        selected={mode === 'cloud'}
        disabled={!cloudConfigured}
        badge={!cloudConfigured ? t('sa.welcome.unavailable') : undefined}
        onPress={() => setMode('cloud')}
      />
      {!cloudConfigured ? <Notice kind="info" text={t('welcome.cloudNotConfigured')} /> : null}

      <Button
        title={t('welcome.start')}
        onPress={start}
        loading={busy}
        disabled={mode === 'cloud' && !cloudConfigured}
        style={{ marginTop: space.md }}
      />
      <Small center style={{ marginTop: space.sm }}>
        {t('common.disclaimer')}
      </Small>
    </Screen>
  );
}

function ModeCard(props: {
  icon: IconName;
  title: string;
  desc: string;
  selected: boolean;
  disabled?: boolean;
  badge?: string;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const { icon, title, desc, selected, disabled, badge, onPress } = props;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: !!disabled }}
      accessibilityLabel={`${title}. ${desc}`}
      style={({ pressed }) => ({ opacity: disabled ? 0.5 : pressed ? 0.85 : 1 })}
    >
      <Card style={{ borderColor: selected ? c.accent : c.border, borderWidth: selected ? 2 : 1 }}>
        <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.sm,
              backgroundColor: selected ? c.accent : c.surface2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={icon} size={20} color={selected ? c.accentText : c.text} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <H3>{title}</H3>
              {badge ? <Small>{badge}</Small> : selected ? <Icon name="check" size={20} color={c.accent} /> : null}
            </Row>
            <Small>{desc}</Small>
          </View>
        </Row>
      </Card>
    </Pressable>
  );
}
