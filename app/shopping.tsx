// Lista de compras consolidada del menú semanal: días, marcas, ajustes y exportación.
import { useMemo, useState } from 'react';
import { Alert, Pressable, Share, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { useApp } from '../src/data/store';
import { useI18n } from '../src/i18n';
import { useTheme, space, radius } from '../src/theme';
import {
  Body,
  Button,
  Card,
  Divider,
  Empty,
  Icon,
  Label,
  LockCard,
  ModalSheet,
  Notice,
  NumberField,
  ProgressBar,
  Row,
  Screen,
  Small,
  Stepper,
} from '../src/components';
import { FOOD_BY_ID, buildShoppingList, can, shoppingListToText, type ShoppingItem } from '../src/core';
import { fmtNum } from '../src/lib/format';

const CATEGORY_ORDER = ['protein', 'dairy', 'legume', 'carb', 'vegetable', 'fruit', 'fat'];

export default function ShoppingScreen() {
  const { state, actions, plan } = useApp();
  const { t, lang } = useI18n();
  const { c } = useTheme();
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [draft, setDraft] = useState<number | undefined>(undefined);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  const week = state.weekPlan;
  const sh = state.shopping;
  const maxDays = Math.max(1, Math.min(7, week?.days.length ?? 7));
  const days = Math.max(1, Math.min(sh.days || maxDays, maxDays));

  const items = useMemo(() => (week ? buildShoppingList(week, days) : []), [week, days]);
  const visible = items.filter((i) => !sh.removed.includes(i.foodId));
  const removedCount = items.length - visible.length;
  const doneCount = visible.filter((i) => sh.checked[i.foodId]).length;

  const groups = useMemo(() => {
    const map = new Map<string, ShoppingItem[]>();
    for (const it of visible) {
      const arr = map.get(it.category) ?? [];
      arr.push(it);
      map.set(it.category, arr);
    }
    return [...map.entries()].sort((a, b) => CATEGORY_ORDER.indexOf(a[0]) - CATEGORY_ORDER.indexOf(b[0]));
  }, [visible]);

  const header = <Stack.Screen options={{ title: t('shopping.title') }} />;

  if (!can(plan, 'shopping_list')) {
    return (
      <Screen>
        {header}
        <LockCard text={t('sc.shopping.locked')} />
      </Screen>
    );
  }

  if (!week || state.weekPlanKind !== 'week' || items.length === 0) {
    return (
      <Screen>
        {header}
        <Empty
          title={t('shopping.empty')}
          body={t('sc.shopping.noPlanBody')}
          action={{ title: t('sc.shopping.goNutrition'), onPress: () => router.replace('/nutrition') }}
        />
      </Screen>
    );
  }

  const toggle = (id: string) => void actions.updateShopping({ checked: { ...sh.checked, [id]: !sh.checked[id] } });
  const remove = (id: string) => void actions.updateShopping({ removed: [...sh.removed, id] });

  const openEdit = (it: ShoppingItem) => {
    setEditing(it);
    setDraft(sh.overrides[it.foodId] ?? it.buyGrams);
    setDraftError(null);
  };

  const saveEdit = () => {
    if (!editing) return;
    if (draft === undefined || !Number.isFinite(draft) || draft < 1 || draft > 20000) {
      setDraftError(t('sc.shopping.invalidGrams'));
      return;
    }
    void actions.updateShopping({ overrides: { ...sh.overrides, [editing.foodId]: Math.round(draft) } });
    setEditing(null);
  };

  const clearEdit = () => {
    if (!editing) return;
    const next = { ...sh.overrides };
    delete next[editing.foodId];
    void actions.updateShopping({ overrides: next });
    setEditing(null);
  };

  const reset = () => {
    Alert.alert(t('sc.shopping.resetConfirmTitle'), t('sc.shopping.resetConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('shopping.reset'),
        style: 'destructive',
        onPress: () => void actions.updateShopping({ checked: {}, removed: [], overrides: {} }),
      },
    ]);
  };

  const share = async () => {
    setShareError(null);
    try {
      await Share.share({
        message: shoppingListToText(items, lang, {
          checked: sh.checked,
          overrides: sh.overrides,
          removed: sh.removed,
          title: `${t('shopping.title')} — FITAI PRO (${days} ${t('shopping.days').toLowerCase()})`,
        }),
      });
    } catch {
      setShareError(t('sc.shopping.shareError'));
    }
  };

  const qtyText = (it: ShoppingItem) => {
    const food = FOOD_BY_ID[it.foodId];
    const ov = sh.overrides[it.foodId];
    if (ov !== undefined) return `${fmtNum(ov)} g · ${t('sc.shopping.adjusted')}`;
    const stateText = t(`nutrition.states.${it.state}`);
    if (food?.unit && it.units !== undefined) {
      return `${t('nutrition.units', { n: it.units, unit: food.unit[lang] })} (~${fmtNum(it.buyGrams)} g)`;
    }
    return `${fmtNum(it.buyGrams)} g · ${stateText}`;
  };

  return (
    <Screen>
      {header}

      <Card>
        <Stepper label={t('shopping.days')} value={days} min={1} max={maxDays} onChange={(n) => void actions.updateShopping({ days: n })} />
        <Small>{t('sc.shopping.items', { n: visible.length })}</Small>
        <ProgressBar value={visible.length ? doneCount / visible.length : 0} color={c.ok} />
        <Small>{t('sc.shopping.progress', { done: doneCount, total: visible.length })}</Small>
      </Card>

      <Row gap={space.sm}>
        <Button title={t('shopping.share')} icon="share" onPress={() => void share()} style={{ flex: 1 }} />
        <Button title={t('shopping.reset')} icon="refresh" variant="secondary" onPress={reset} style={{ flex: 1 }} />
      </Row>
      {shareError ? <Notice kind="danger" text={shareError} /> : null}

      {groups.map(([cat, list]) => (
        <Card key={cat}>
          <Label>{t(`sc.shopping.categories.${cat}`)}</Label>
          {list.map((it, i) => {
            const food = FOOD_BY_ID[it.foodId];
            const checked = !!sh.checked[it.foodId];
            return (
              <View key={it.foodId}>
                {i > 0 ? <Divider /> : null}
                <Row gap={space.sm} style={{ minHeight: 48 }}>
                  <Pressable
                    onPress={() => toggle(it.foodId)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    accessibilityLabel={food?.name[lang] ?? it.foodId}
                    hitSlop={6}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, flex: 1, minHeight: 44 }}
                  >
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: radius.sm - 2,
                        borderWidth: 2,
                        borderColor: checked ? c.ok : c.border,
                        backgroundColor: checked ? c.ok : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {checked ? <Icon name="check" size={16} color="#FFFFFF" /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Body
                        color={checked ? c.muted : c.text}
                        style={checked ? { textDecorationLine: 'line-through' } : undefined}
                      >
                        {food?.name[lang] ?? it.foodId}
                      </Body>
                      <Small>{qtyText(it)}</Small>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => openEdit(it)}
                    accessibilityRole="button"
                    accessibilityLabel={t('shopping.adjust')}
                    hitSlop={6}
                    style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Icon name="settings" size={18} color={c.muted} />
                  </Pressable>
                  <Pressable
                    onPress={() => remove(it.foodId)}
                    accessibilityRole="button"
                    accessibilityLabel={t('shopping.remove')}
                    hitSlop={6}
                    style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Icon name="trash" size={18} color={c.muted} />
                  </Pressable>
                </Row>
              </View>
            );
          })}
        </Card>
      ))}

      {removedCount > 0 ? (
        <Row style={{ justifyContent: 'space-between' }}>
          <Small>{t('sc.shopping.removedCount', { n: removedCount })}</Small>
          <Button
            small
            variant="ghost"
            title={t('sc.shopping.restore')}
            onPress={() => void actions.updateShopping({ removed: [] })}
          />
        </Row>
      ) : null}

      <Small>{t('shopping.note')}</Small>
      <Small>{t('nutrition.noCost')}</Small>

      <ModalSheet visible={editing !== null} onClose={() => setEditing(null)} title={t('shopping.adjust')}>
        {editing ? (
          <View style={{ gap: space.md }}>
            <Body style={{ fontWeight: '600' }}>{FOOD_BY_ID[editing.foodId]?.name[lang] ?? editing.foodId}</Body>
            <Small>{t('sc.shopping.computed', { g: fmtNum(editing.grams) })}</Small>
            <NumberField
              label={t('shopping.adjust')}
              value={draft}
              onChange={(n) => {
                setDraft(n);
                setDraftError(null);
              }}
              suffix="g"
              error={draftError ?? undefined}
            />
            <Button title={t('common.save')} onPress={saveEdit} />
            {sh.overrides[editing.foodId] !== undefined ? (
              <Button title={t('shopping.reset')} variant="secondary" onPress={clearEdit} />
            ) : null}
          </View>
        ) : null}
      </ModalSheet>
    </Screen>
  );
}
