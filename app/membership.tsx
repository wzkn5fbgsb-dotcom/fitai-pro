// Membresías: plan actual, comparación de planes, compra, restauración y gestión.
// El servidor es la fuente de verdad: tras comprar sólo se relee la suscripción.
import { useEffect, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import {
  Body,
  Button,
  Card,
  H2,
  H3,
  Icon,
  Label,
  Notice,
  Num,
  Row,
  Screen,
  Segmented,
  Small,
} from '../src/components';
import {
  DEFAULT_PRICES,
  ELITE_PLANNED,
  FEATURES,
  LIMITS,
  annualPrice,
  type Feature,
  type PlanId,
} from '../src/core';
import { useApp } from '../src/data/store';
import { useI18n } from '../src/i18n';
import { purchasesConfigured } from '../src/lib/config';
import { formatDate } from '../src/lib/dates';
import { getPackages, manageUrl, purchase, restore, type BillingPeriod, type PaidPlan, type StorePackage } from '../src/lib/purchases';
import { radius, space, useTheme } from '../src/theme';

/** Funciones que se listan en cada tarjeta (las que añade respecto al plan anterior). */
const added = (p: PlanId, prev: PlanId): Feature[] => FEATURES[p].filter((f) => !FEATURES[prev].includes(f) && f !== 'ai_coach');
const SHOWN: Record<Exclude<PlanId, 'free'>, Feature[]> = { pro: added('pro', 'free'), elite: added('elite', 'pro') };

export default function Membership() {
  const { state, actions, plan } = useApp();
  const { t, lang } = useI18n();
  const { c } = useTheme();
  const [period, setPeriod] = useState<BillingPeriod>('annual');
  const [packages, setPackages] = useState<StorePackage[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'danger' | 'warn'; text: string } | null>(null);

  const isCloud = state.mode === 'cloud';
  const canBuy = isCloud && purchasesConfigured;
  const sub = state.subscription;
  const store = Platform.OS === 'ios' ? 'App Store' : 'Google Play';

  // Paquetes reales de la tienda (sólo en modo nube con compras configuradas).
  useEffect(() => {
    if (!canBuy) return;
    let alive = true;
    getPackages()
      .then((p) => {
        if (alive) setPackages(p);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [canBuy, state.userId]);

  const pkgFor = (p: PaidPlan): StorePackage | undefined => packages.find((x) => x.plan === p && x.period === period);

  const subscribe = async (p: PaidPlan) => {
    const pkg = pkgFor(p);
    if (!pkg) {
      setMsg({ kind: 'warn', text: t('sa.membership.storeUnavailable') });
      return;
    }
    setBusy(p);
    setMsg(null);
    try {
      const r = await purchase(pkg.id);
      if (r.ok) {
        await actions.refreshSubscription();
        setMsg({ kind: 'ok', text: t('membership.purchased') });
      } else if (r.error !== 'cancelled') {
        setMsg({ kind: 'danger', text: t('membership.purchaseError') });
      }
    } catch {
      setMsg({ kind: 'danger', text: t('membership.purchaseError') });
    } finally {
      setBusy(null);
    }
  };

  const doRestore = async () => {
    setBusy('restore');
    setMsg(null);
    try {
      const r = await restore();
      if (r.ok) {
        await actions.refreshSubscription();
        setMsg({ kind: 'ok', text: t('membership.restored') });
      } else setMsg({ kind: 'danger', text: t('sa.membership.restoreFailed') });
    } catch {
      setMsg({ kind: 'danger', text: t('sa.membership.restoreFailed') });
    } finally {
      setBusy(null);
    }
  };

  const manage = () => {
    void Linking.openURL(manageUrl()).catch(() => setMsg({ kind: 'danger', text: t('common.error') }));
  };

  // Estado de la suscripción en texto.
  const expiry = sub.expiresAt ? formatDate(sub.expiresAt.slice(0, 10), lang) : null;
  const statusText =
    sub.status === 'cancelled_active'
      ? t('membership.status.cancelled_active', { date: expiry ?? '—' })
      : t(`membership.status.${sub.status}`);
  const showSubStatus = isCloud && (plan !== 'free' || sub.status !== 'expired');

  // Texto de precio: el de la tienda si existe; si no, el de referencia en USD.
  const priceFor = (p: PaidPlan): { main: string; unit: string; sub?: string } => {
    const pkg = pkgFor(p);
    const unit = period === 'annual' ? t('membership.perYear') : t('membership.perMonth');
    if (pkg && pkg.priceString) return { main: pkg.priceString, unit };
    if (period === 'monthly') return { main: `$${DEFAULT_PRICES.monthlyUsd[p].toFixed(2)}`, unit };
    const yearly = annualPrice(p);
    return {
      main: `$${yearly.toFixed(2)}`,
      unit,
      sub: t('sa.membership.perMonthEquiv', { price: `$${(yearly / 12).toFixed(2)}` }),
    };
  };

  // daily_meal_plan va incluido en el texto de weekly_meal_plan ("menú diario y semanal").
  const featureLabel = (f: Feature): string => {
    if (f === 'workout_history') return t('sa.membership.workoutHistory');
    if (f === 'daily_meal_plan') return '';
    return t(`membership.features.${f}`);
  };

  const planFeatures = (p: PlanId): string[] => {
    const out: string[] = [];
    if (p === 'free') {
      out.push(t('membership.features.basic_routine'));
      out.push(t('membership.features.nutrition_targets'));
      out.push(t('membership.features.nutrition_preview'));
      out.push(t('membership.features.progress_basic'));
      out.push(t('membership.features.ai_coach_free', { n: LIMITS.free.aiMessagesPerDay }));
      return out;
    }
    for (const f of SHOWN[p]) {
      const l = featureLabel(f);
      if (l) out.push(l);
    }
    out.push(t(`membership.features.ai_coach_${p}`, { n: LIMITS[p].aiMessagesPerDay }));
    return out;
  };

  return (
    <Screen>
      {/* Plan actual */}
      <Card>
        <Row gap={space.md}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.sm,
              backgroundColor: plan === 'free' ? c.surface2 : c.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="crown" size={22} color={plan === 'free' ? c.text : c.accentText} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Label>{t('sa.membership.yourPlan')}</Label>
            <H2>{t(`membership.plans.${plan}`)}</H2>
          </View>
        </Row>
        {showSubStatus ? (
          <>
            <Body color={sub.status === 'billing_issue' ? c.warn : c.text}>{statusText}</Body>
            {sub.willRenew && expiry && sub.status === 'active' ? <Small>{t('membership.renews', { date: expiry })}</Small> : null}
          </>
        ) : null}
      </Card>

      {!isCloud ? <Notice kind="info" text={t('membership.needAccount')} /> : null}
      {isCloud && !purchasesConfigured ? <Notice kind="info" text={t('membership.notConfigured')} /> : null}
      {msg ? <Notice kind={msg.kind} text={msg.text} /> : null}

      {/* Periodo */}
      <Segmented
        options={[
          { value: 'monthly', label: t('membership.monthly') },
          { value: 'annual', label: `${t('membership.annual')} · ${t('membership.save', { pct: DEFAULT_PRICES.annualDiscountPct })}` },
        ]}
        value={period}
        onChange={(v) => setPeriod(v as BillingPeriod)}
      />

      {/* Tarjetas de planes */}
      {(['free', 'pro', 'elite'] as PlanId[]).map((p) => {
        const current = p === plan;
        const paid = p !== 'free';
        const price = paid ? priceFor(p as PaidPlan) : null;
        return (
          <Card key={p} style={{ borderColor: current ? c.accent : c.border, borderWidth: current ? 2 : 1 }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <H2>{t(`membership.plans.${p}`)}</H2>
              {current ? (
                <View style={{ backgroundColor: c.accent, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2 }}>
                  <Small color={c.accentText} style={{ fontWeight: '700' }}>
                    {t('sa.membership.yourPlan')}
                  </Small>
                </View>
              ) : null}
            </Row>
            {price ? (
              <View>
                <Row gap={4} style={{ alignItems: 'baseline' }}>
                  <Num>{price.main}</Num>
                  <Small>{price.unit}</Small>
                </Row>
                {price.sub ? <Small>{price.sub}</Small> : null}
              </View>
            ) : (
              <Num>{t('sa.membership.free')}</Num>
            )}

            {p === 'pro' ? <Small>{t('membership.everythingIn', { plan: t('membership.plans.free') })}</Small> : null}
            {p === 'elite' ? <Small>{t('membership.everythingIn', { plan: t('membership.plans.pro') })}</Small> : null}
            {planFeatures(p).map((f) => (
              <Row key={f} gap={space.sm} style={{ alignItems: 'flex-start' }}>
                <Icon name="check" size={18} color={c.ok} />
                <Body style={{ flex: 1 }}>{f}</Body>
              </Row>
            ))}

            {p === 'elite' ? (
              <View style={{ gap: space.xs, marginTop: space.xs }}>
                <Small>{t('sa.membership.planned')}</Small>
                {ELITE_PLANNED.map((f) => (
                  <Row key={f} gap={space.sm} style={{ alignItems: 'flex-start' }}>
                    <Icon name="clock" size={18} color={c.muted} />
                    <Body style={{ flex: 1 }} color={c.muted}>
                      {t(`membership.features.${f}`)}
                    </Body>
                    <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.pill, paddingHorizontal: space.sm }}>
                      <Small>{t('common.inDevelopment')}</Small>
                    </View>
                  </Row>
                ))}
              </View>
            ) : null}

            {paid && !current && canBuy ? (
              <Button
                title={t('membership.subscribe')}
                onPress={() => void subscribe(p as PaidPlan)}
                loading={busy === p}
                disabled={busy !== null}
                variant={p === 'pro' ? 'primary' : 'secondary'}
              />
            ) : null}
          </Card>
        );
      })}

      {canBuy ? (
        <>
          <Button title={t('membership.restore')} variant="secondary" onPress={() => void doRestore()} loading={busy === 'restore'} disabled={busy !== null} />
          <Button title={t('membership.manage')} variant="ghost" onPress={manage} />
        </>
      ) : null}

      <Small>{t('membership.priceNote')}</Small>
      <Small>{t('membership.terms', { store })}</Small>

      {__DEV__ ? (
        <Card style={{ borderStyle: 'dashed' }}>
          <H3>{t('membership.devTitle')}</H3>
          <Small>{t('membership.devNote')}</Small>
          <Segmented
            options={(['free', 'pro', 'elite'] as PlanId[]).map((v) => ({ value: v, label: t(`membership.plans.${v}`) }))}
            value={state.devPlan ?? 'free'}
            onChange={(v) => actions.setDevPlan(v === 'free' ? null : (v as PlanId))}
          />
        </Card>
      ) : null}
    </Screen>
  );
}
