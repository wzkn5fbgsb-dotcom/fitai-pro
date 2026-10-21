// Cuenta en la nube: iniciar sesión, crear cuenta y recuperar contraseña con código.
import { router } from 'expo-router';
import { useState } from 'react';
import { Body, Button, Card, Field, H2, Notice, Screen, Small } from '../src/components';
import { useApp } from '../src/data/store';
import { useI18n } from '../src/i18n';
import { space } from '../src/theme';

type AuthView = 'signIn' | 'signUp' | 'reset';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Traduce los códigos de error de las acciones a claves de i18n. */
function errorKey(code: string | undefined): string {
  const c = (code ?? '').toLowerCase();
  if (!c) return 'common.error';
  if (c.includes('weak') || c.includes('password_length')) return 'auth.weakPassword';
  if (c.includes('already') || c.includes('exists') || c.includes('taken') || c.includes('registered')) return 'sa.auth.emailTaken';
  if (c.includes('not_confirmed') || c.includes('confirm')) return 'sa.auth.notConfirmed';
  if (c.includes('otp') || c.includes('code') || c.includes('token') || c.includes('expired')) return 'sa.auth.codeInvalid';
  if (c.includes('rate') || c.includes('too_many') || c.includes('429')) return 'sa.auth.rateLimit';
  if (c.includes('network') || c.includes('fetch') || c.includes('offline') || c.includes('unavailable')) return 'sa.auth.network';
  if (c.includes('invalid') || c.includes('credentials') || c.includes('email')) return 'auth.invalid';
  return 'common.error';
}

export default function Auth() {
  const { actions } = useApp();
  const { t } = useI18n();
  const [view, setView] = useState<AuthView>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const emailOk = EMAIL_RE.test(email.trim());
  const passOk = password.length >= 8;
  const emailErr = touched && !emailOk ? t('sa.auth.emailInvalid') : undefined;
  const passErr = touched && !passOk ? t('auth.weakPassword') : undefined;

  const switchTo = (v: AuthView) => {
    setView(v);
    setError(null);
    setInfo(null);
    setTouched(false);
    setPassword('');
    setCode('');
    setCodeSent(false);
  };

  // Ejecuta una acción mostrando el estado de carga y capturando errores inesperados.
  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await fn();
    } catch {
      setError(t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const submitSignIn = () => {
    setTouched(true);
    if (!emailOk || !passOk) return;
    void run(async () => {
      const r = await actions.signIn(email.trim(), password);
      if (r.ok) router.replace('/');
      else setError(t(errorKey(r.error)));
    });
  };

  const submitSignUp = () => {
    setTouched(true);
    if (!emailOk || !passOk) return;
    void run(async () => {
      const r = await actions.signUp(email.trim(), password);
      if (!r.ok) {
        setError(t(errorKey(r.error)));
        return;
      }
      if (r.needsConfirm) {
        setView('signIn');
        setPassword('');
        setTouched(false);
        setInfo(t('auth.checkEmail'));
      } else {
        router.replace('/');
      }
    });
  };

  const submitSendCode = () => {
    setTouched(true);
    if (!emailOk) return;
    void run(async () => {
      const r = await actions.sendResetCode(email.trim());
      if (r.ok) {
        setCodeSent(true);
        setTouched(false);
        setInfo(t('auth.resetSent'));
      } else setError(t(errorKey(r.error)));
    });
  };

  const submitReset = () => {
    setTouched(true);
    if (!emailOk || !passOk || code.trim().length < 6) {
      if (code.trim().length < 6) setError(t('sa.auth.codeInvalid'));
      return;
    }
    void run(async () => {
      const r = await actions.resetPassword(email.trim(), code.trim(), password);
      if (r.ok) {
        switchTo('signIn');
        setInfo(t('auth.resetDone'));
      } else setError(t(errorKey(r.error)));
    });
  };

  const useLocal = () => {
    void run(async () => {
      await actions.chooseMode('local');
      router.replace('/');
    });
  };

  const title = view === 'signIn' ? t('auth.signIn') : view === 'signUp' ? t('auth.signUp') : t('auth.resetTitle');

  return (
    <Screen keyboard>
      <H2>{title}</H2>
      {view !== 'reset' ? <Body>{t('sa.auth.intro')}</Body> : null}

      {info ? <Notice kind="ok" text={info} /> : null}
      {error ? <Notice kind="danger" text={error} /> : null}

      <Card>
        <Field
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          error={emailErr}
        />

        {view === 'reset' && codeSent ? (
          <>
            <Field
              label={t('auth.code')}
              value={code}
              onChangeText={(s) => setCode(s.replace(/[^0-9]/g, '').slice(0, 8))}
              keyboardType="number-pad"
              autoCapitalize="none"
            />
            <Field
              label={t('auth.newPassword')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              hint={t('auth.passwordHint')}
              error={passErr}
            />
          </>
        ) : null}

        {view !== 'reset' ? (
          <Field
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            hint={view === 'signUp' ? t('auth.passwordHint') : undefined}
            error={passErr}
          />
        ) : null}
      </Card>

      {view === 'signIn' ? (
        <>
          <Button title={t('auth.signIn')} onPress={submitSignIn} loading={busy} />
          <Button title={t('auth.forgot')} variant="ghost" onPress={() => switchTo('reset')} />
          <Button title={t('auth.switchToSignUp')} variant="secondary" onPress={() => switchTo('signUp')} />
        </>
      ) : null}

      {view === 'signUp' ? (
        <>
          <Button title={t('auth.signUp')} onPress={submitSignUp} loading={busy} />
          <Button title={t('auth.switchToSignIn')} variant="secondary" onPress={() => switchTo('signIn')} />
        </>
      ) : null}

      {view === 'reset' ? (
        <>
          {codeSent ? (
            <>
              <Button title={t('sa.auth.changePassword')} onPress={submitReset} loading={busy} />
              <Button title={t('auth.sendCode')} variant="ghost" onPress={submitSendCode} disabled={busy} />
            </>
          ) : (
            <Button title={t('auth.sendCode')} onPress={submitSendCode} loading={busy} />
          )}
          <Button title={t('sa.auth.backToSignIn')} variant="secondary" onPress={() => switchTo('signIn')} />
        </>
      ) : null}

      <Button title={t('sa.auth.useLocal')} variant="ghost" onPress={useLocal} disabled={busy} style={{ marginTop: space.lg }} />
      <Small center>{t('common.disclaimer')}</Small>
    </Screen>
  );
}
