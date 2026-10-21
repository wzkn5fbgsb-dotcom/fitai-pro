// Privacidad, términos y aviso general (contenido completo dentro de la app).
import { View } from 'react-native';
import { Body, Card, H2, Notice, Row, Screen, Small } from '../src/components';
import { useI18n } from '../src/i18n';
import { space, useTheme } from '../src/theme';

export default function Legal() {
  const { t, tx } = useI18n();
  const privacy = tx<string[]>('legal.privacy') ?? [];
  const terms = tx<string[]>('legal.terms') ?? [];

  return (
    <Screen>
      <Notice kind="warn" text={t('legal.draftNote')} />

      <H2>{t('legal.privacyTitle')}</H2>
      <Card>
        <Bullets items={privacy} />
      </Card>

      <H2 style={{ marginTop: space.md }}>{t('legal.termsTitle')}</H2>
      <Card>
        <Bullets items={terms} />
      </Card>

      <Notice kind="info" text={t('common.disclaimer')} />
      <Small>{t('common.estimateNote')}</Small>
    </Screen>
  );
}

function Bullets({ items }: { items: string[] }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      {items.map((text, i) => (
        <Row key={i} gap={space.sm} style={{ alignItems: 'flex-start' }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.accent, marginTop: 8 }} />
          <Body style={{ flex: 1 }}>{text}</Body>
        </Row>
      ))}
    </View>
  );
}
