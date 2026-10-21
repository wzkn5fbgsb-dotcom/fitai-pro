// AI Coach: primero responde con reglas y datos reales (answerLocally); lo que no
// reconoce va al modelo de IA en modo nube. Los mensajes viven sólo en esta pantalla.
import { useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Body, Chip, Empty, Icon, LockCard, Notice, Row, Small } from '../../src/components';
import { answerLocally } from '../../src/core';
import { useApp } from '../../src/data/store';
import { useI18n } from '../../src/i18n';
import { coachContext } from '../../src/lib/derive';
import { font, radius, space, useTheme } from '../../src/theme';

type Source = 'rules' | 'ai' | 'system';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  source?: Source;
  remaining?: number;
  locked?: boolean; // mostrar LockCard de mejora de plan
}

let seq = 0;
const mid = () => `${Date.now().toString(36)}-${(seq++).toString(36)}`;

export default function CoachScreen() {
  const { state, actions } = useApp();
  const { t, tx, lang } = useI18n();
  const { c } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  const ctx = coachContext(state, lang);
  if (!ctx) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, padding: space.lg }}>
        <Empty title={t('sb.coach.noProfile')} />
      </View>
    );
  }

  const push = (m: Message) => setMessages((prev) => [...prev, m]);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    // Historial para la IA: últimos 6 turnos (sin mensajes del sistema).
    const history = messages
      .filter((m) => m.source !== 'system')
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.text }));
    push({ id: mid(), role: 'user', text });
    setInput('');

    const local = answerLocally(text, ctx);
    if (local.handled) {
      push({ id: mid(), role: 'assistant', text: local.text, source: 'rules' });
      return;
    }
    if (state.mode !== 'cloud') {
      push({ id: mid(), role: 'assistant', text: t('coach.unknownLocal'), source: 'system' });
      return;
    }
    setBusy(true);
    try {
      const r = await actions.askCoachAI(text, history);
      if (r.ok) {
        push({ id: mid(), role: 'assistant', text: r.text, source: 'ai', remaining: r.remainingToday });
      } else if (r.error === 'limit') {
        push({ id: mid(), role: 'assistant', text: t('coach.limit'), source: 'system', locked: true });
      } else if (r.error === 'no_account') {
        push({ id: mid(), role: 'assistant', text: t('sb.coach.noAccount'), source: 'system' });
      } else {
        push({ id: mid(), role: 'assistant', text: t('coach.error'), source: 'system' });
      }
    } catch {
      push({ id: mid(), role: 'assistant', text: t('coach.error'), source: 'system' });
    } finally {
      setBusy(false);
    }
  };

  const suggestions = tx<string[]>('coach.suggestions') ?? [];

  const header = (
    <View style={{ gap: space.md, marginBottom: space.md }}>
      <View style={{ backgroundColor: c.surface, borderColor: c.border, borderWidth: 1, borderRadius: radius.md, padding: space.lg, gap: space.sm }}>
        <Row gap={space.sm}>
          <View style={{ width: 32, height: 32, borderRadius: radius.pill, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="chat" size={18} color={c.accentText} />
          </View>
          <Body style={{ fontWeight: '700', flex: 1 }}>{t('coach.title')}</Body>
        </Row>
        <Body>{t('coach.intro')}</Body>
      </View>
      {state.mode !== 'cloud' ? <Notice kind="info" text={t('coach.localNote')} /> : null}
      {messages.length === 0 ? (
        <Row wrap gap={space.sm}>
          {suggestions.map((s) => (
            <Chip key={s} label={s} onPress={() => void send(s)} />
          ))}
        </Row>
      ) : null}
    </View>
  );

  const renderItem = ({ item }: { item: Message }) => {
    const mine = item.role === 'user';
    return (
      <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginBottom: space.sm, gap: space.xs }}>
        <View
          style={{
            maxWidth: '86%',
            backgroundColor: mine ? c.accent : c.surface,
            borderColor: mine ? c.accent : c.border,
            borderWidth: 1,
            borderRadius: radius.lg,
            borderBottomRightRadius: mine ? 6 : radius.lg,
            borderBottomLeftRadius: mine ? radius.lg : 6,
            paddingHorizontal: space.md,
            paddingVertical: space.sm + 2,
            gap: space.xs,
          }}
        >
          <Body color={mine ? c.accentText : c.text} style={{ lineHeight: 21 }}>
            {item.text}
          </Body>
          {item.source === 'rules' || item.source === 'ai' ? (
            <Small style={{ fontSize: 11 }}>{item.source === 'rules' ? t('coach.sourceRules') : t('coach.sourceAi')}</Small>
          ) : null}
          {item.source === 'ai' && typeof item.remaining === 'number' ? (
            <Small style={{ fontSize: 11 }}>{t('coach.remaining', { n: item.remaining })}</Small>
          ) : null}
        </View>
        {item.locked ? (
          <View style={{ width: '86%' }}>
            <LockCard text={t('coach.upgradeForMore')} />
          </View>
        ) : null}
      </View>
    );
  };

  const canSend = input.trim().length > 0 && !busy;

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m: Message) => m.id}
          renderItem={renderItem}
          ListHeaderComponent={header}
          ListFooterComponent={
            busy ? (
              <Row gap={space.sm} style={{ paddingVertical: space.sm }}>
                <ActivityIndicator color={c.muted} />
                <Small>{t('sb.coach.thinking')}</Small>
              </Row>
            ) : null
          }
          contentContainerStyle={{ padding: space.lg, paddingBottom: space.md }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: space.sm,
            paddingHorizontal: space.md,
            paddingVertical: space.sm,
            borderTopWidth: 1,
            borderTopColor: c.border,
            backgroundColor: c.surface,
          }}
        >
          {messages.length > 0 ? (
            <Pressable
              onPress={() => setMessages([])}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={t('sb.coach.clear')}
              hitSlop={6}
              style={({ pressed }) => ({ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.4 : pressed ? 0.6 : 1 })}
            >
              <Icon name="refresh" size={20} color={c.muted} />
            </Pressable>
          ) : null}
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={t('coach.placeholder')}
            placeholderTextColor={c.muted}
            multiline
            maxLength={1000}
            accessibilityLabel={t('coach.placeholder')}
            style={[
              font.body,
              {
                flex: 1,
                color: c.text,
                backgroundColor: c.surface2,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: c.border,
                paddingHorizontal: space.md,
                paddingTop: 10,
                paddingBottom: 10,
                minHeight: 40,
                maxHeight: 120,
              },
            ]}
          />
          <Pressable
            onPress={() => void send(input)}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel={t('coach.send')}
            accessibilityState={{ disabled: !canSend }}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: radius.pill,
              backgroundColor: canSend ? c.accent : c.surface2,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Icon name="send" size={18} color={canSend ? c.accentText : c.muted} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
