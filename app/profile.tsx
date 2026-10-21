// Perfil y ajustes: idioma, tema, unidades, recordatorios, membresía, datos y cuenta.
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import {
  Body,
  Button,
  Card,
  Divider,
  Field,
  H2,
  H3,
  Icon,
  Label,
  ListItem,
  Notice,
  Row,
  Screen,
  Segmented,
  Small,
  Switch,
} from '../src/components';
import { formatHeight, type Lang, type UnitSystem } from '../src/core';
import { useApp } from '../src/data/store';
import type { ThemePref } from '../src/data/types';
import { useI18n } from '../src/i18n';
import { setDraft } from '../src/lib/draft';
import { fmtWeight } from '../src/lib/format';
import { requestPermission } from '../src/lib/notifications';
import { radius, space, useTheme } from '../src/theme';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function Profile() {
  const { state, actions, plan } = useApp();
  const { t, lang } = useI18n();
  const { c } = useTheme();
  const profile = state.profile;
  const s = state.settings;

  const [time, setTime] = useState(s.workoutTime);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState<null | 'signOut' | 'delete'>(null);
  const [deleteError, setDeleteError] = useState(false);

  // Si la hora cambia desde fuera (sincronización), refleja el valor guardado.
  useEffect(() => setTime(s.workoutTime), [s.workoutTime]);

  const timeValid = TIME_RE.test(time);

  const setLang = (l: Lang) => {
    actions.setLang(l);
    if (profile && profile.lang !== l) void actions.saveProfile({ ...profile, lang: l, updatedAt: new Date().toISOString() });
  };

  const setUnits = (u: UnitSystem) => {
    if (profile && profile.units !== u) void actions.saveProfile({ ...profile, units: u, updatedAt: new Date().toISOString() });
  };

  // Al activar un recordatorio se pide permiso; si se niega, no se activa.
  const toggleReminder = async (field: 'workoutReminders' | 'mealReminders', on: boolean) => {
    if (on) {
      const ok = await requestPermission();
      if (!ok) {
        setDenied(true);
        return;
      }
    }
    setDenied(false);
    await actions.updateSettings({ [field]: on });
  };

  const onTime = (v: string) => {
    const clean = v.replace(/[^0-9:]/g, '').slice(0, 5);
    setTime(clean);
    if (TIME_RE.test(clean) && clean !== s.workoutTime) void actions.updateSettings({ workoutTime: clean });
  };

  const editProfile = () => {
    if (!profile) {
      router.push('/onboarding');
      return;
    }
    setDraft(profile);
    router.push('/onboarding?step=0&edit=1');
  };

  const signOut = async () => {
    setBusy('signOut');
    try {
      await actions.signOut();
      router.replace('/');
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = () => {
    Alert.alert(t('profile.deleteAll'), t('profile.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy('delete');
            setDeleteError(false);
            try {
              const r = await actions.deleteAllData();
              if (r.ok) {
                setDraft(null);
                router.replace('/welcome');
              } else setDeleteError(true);
            } catch {
              setDeleteError(true);
            } finally {
              setBusy(null);
            }
          })();
        },
      },
    ]);
  };

  const version = Constants.expoConfig?.version;

  return (
    <Screen keyboard>
      {/* Encabezado del perfil */}
      <Card>
        <Row gap={space.md}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: radius.pill,
              backgroundColor: c.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="user" size={26} color={c.accentText} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            {profile ? (
              <>
                <H3>{t('sa.profile.ageGoal', { age: profile.age, goal: t(`goals.${profile.goal}.name`) })}</H3>
                <Small>
                  {formatHeight(profile.heightCm, profile.units)} · {fmtWeight(profile.weightKg, profile.units)} · {t(`levels.${profile.level}`)}
                </Small>
              </>
            ) : (
              <Body>{t('sa.profile.noProfile')}</Body>
            )}
          </View>
        </Row>
        <Button title={t('profile.editProfile')} variant="secondary" icon="settings" onPress={editProfile} />
      </Card>

      {/* Ajustes */}
      <H2 style={{ marginTop: space.md }}>{t('profile.settings')}</H2>
      <Card>
        <Label>{t('profile.language')}</Label>
        <Segmented
          options={[
            { value: 'es', label: t('sa.langs.es') },
            { value: 'en', label: t('sa.langs.en') },
          ]}
          value={lang}
          onChange={(v) => setLang(v as Lang)}
        />
        <Label style={{ marginTop: space.sm }}>{t('profile.theme')}</Label>
        <Segmented
          options={(['system', 'light', 'dark'] as ThemePref[]).map((v) => ({ value: v, label: t(`profile.themes.${v}`) }))}
          value={s.theme}
          onChange={(v) => void actions.updateSettings({ theme: v as ThemePref })}
        />
        {profile ? (
          <>
            <Label style={{ marginTop: space.sm }}>{t('profile.units')}</Label>
            <Segmented
              options={[
                { value: 'metric', label: t('onboarding.metric') },
                { value: 'imperial', label: t('onboarding.imperial') },
              ]}
              value={profile.units}
              onChange={(v) => setUnits(v as UnitSystem)}
            />
          </>
        ) : null}
      </Card>

      {/* Recordatorios */}
      <H2 style={{ marginTop: space.md }}>{t('profile.notifications')}</H2>
      <Card>
        <Switch
          label={t('profile.workoutReminders')}
          value={s.workoutReminders}
          onChange={(v) => void toggleReminder('workoutReminders', v)}
        />
        {s.workoutReminders ? (
          <Field
            label={t('profile.reminderTime')}
            value={time}
            onChangeText={onTime}
            keyboardType="numbers-and-punctuation"
            placeholder="18:30"
            hint={t('sa.profile.timeHint')}
            error={!timeValid ? t('sa.profile.timeInvalid') : undefined}
          />
        ) : null}
        <Divider />
        <Switch label={t('profile.mealReminders')} value={s.mealReminders} onChange={(v) => void toggleReminder('mealReminders', v)} />
        {denied ? <Notice kind="warn" text={t('profile.notifDenied')} /> : null}
      </Card>

      {/* Membresía y legal */}
      <Card>
        <ListItem
          icon="crown"
          title={t('profile.membership')}
          subtitle={t('membership.current', { plan: t(`membership.plans.${plan}`) })}
          onPress={() => router.push('/membership')}
        />
        <Divider />
        <ListItem icon="info" title={t('profile.legal')} onPress={() => router.push('/legal')} />
      </Card>

      {/* Datos y cuenta */}
      <H2 style={{ marginTop: space.md }}>{t('profile.data')}</H2>
      <Card>
        <ListItem
          icon={state.mode === 'cloud' ? 'refresh' : 'user'}
          title={t('profile.mode')}
          subtitle={state.mode === 'cloud' ? t('profile.modeCloud', { email: state.email ?? '' }) : t('profile.modeLocal')}
        />
        {state.syncError ? <Notice kind="warn" text={t('common.syncError')} /> : null}
        {state.mode === 'cloud' ? (
          <Button title={t('auth.signOut')} variant="secondary" onPress={signOut} loading={busy === 'signOut'} disabled={busy !== null} />
        ) : null}
        <Button
          title={t('profile.deleteAll')}
          variant="danger"
          icon="trash"
          onPress={confirmDelete}
          loading={busy === 'delete'}
          disabled={busy !== null}
        />
        {deleteError ? <Notice kind="danger" text={t('sa.profile.deleteFailed')} /> : null}
      </Card>

      <Small center style={{ marginTop: space.md }}>
        {t('common.disclaimer')}
      </Small>
      {version ? <Small center>{t('profile.version', { v: version })}</Small> : null}
    </Screen>
  );
}
