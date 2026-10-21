// Fotos de progreso: guía, privacidad, captura/selección, galería por fecha,
// eliminación y comparación lado a lado (Elite).
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, View } from 'react-native';
import { Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../src/data/store';
import type { PhotoMeta } from '../src/data/types';
import { useI18n } from '../src/i18n';
import { useTheme, space, radius } from '../src/theme';
import {
  Body,
  Button,
  Card,
  ChipGroup,
  Empty,
  Icon,
  Label,
  LockCard,
  Notice,
  Row,
  Screen,
  Segmented,
  Small,
} from '../src/components';
import { can } from '../src/core';
import { formatDate, todayStr } from '../src/lib/dates';

type Pose = PhotoMeta['pose'];
const POSES: Pose[] = ['front', 'side', 'back'];

/** Resuelve la URI visible de una foto (en la nube, URL firmada temporal). */
function usePhotoUri(photo: PhotoMeta | undefined, resolve: (p: PhotoMeta) => Promise<string>) {
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setUri(null);
    setFailed(false);
    if (!photo) return;
    resolve(photo)
      .then((u) => {
        if (alive) setUri(u);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo?.id, photo?.uri]);
  return { uri, failed };
}

function PhotoImage({ photo, height, onLongPress }: { photo: PhotoMeta; height: number; onLongPress?: () => void }) {
  const { actions } = useApp();
  const { c } = useTheme();
  const { t } = useI18n();
  const { uri, failed } = usePhotoUri(photo, actions.photoDisplayUri);
  const [loadFailed, setLoadFailed] = useState(false);
  const box = {
    width: '100%' as const,
    height,
    borderRadius: radius.sm,
    backgroundColor: c.surface2,
    overflow: 'hidden' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  return (
    <Pressable onLongPress={onLongPress} delayLongPress={400} style={box} accessibilityRole="image">
      {uri && !loadFailed ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" onError={() => setLoadFailed(true)} />
      ) : failed || loadFailed ? (
        <Small center>{t('sc.photos.loadError')}</Small>
      ) : (
        <Icon name="image" size={24} color={c.muted} />
      )}
    </Pressable>
  );
}

export default function PhotosScreen() {
  const { state, actions, plan } = useApp();
  const { t, tx, lang } = useI18n();
  const { c } = useTheme();
  const [pose, setPose] = useState<Pose>('front');
  const [busy, setBusy] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cmpA, setCmpA] = useState<string[]>([]);
  const [cmpB, setCmpB] = useState<string[]>([]);

  const guide = tx<string[]>('photos.guide') ?? [];
  const poseOptions = POSES.map((p) => ({ value: p, label: t(`photos.${p}`) }));
  const canCompare = can(plan, 'photo_comparison');

  // Galería agrupada por fecha (más reciente primero).
  const byDate = useMemo(() => {
    const map = new Map<string, PhotoMeta[]>();
    for (const p of state.photos) {
      const arr = map.get(p.date) ?? [];
      arr.push(p);
      map.set(p.date, arr);
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, list]) => [date, list.sort((x, y) => POSES.indexOf(x.pose) - POSES.indexOf(y.pose))] as const);
  }, [state.photos]);

  // Fechas disponibles para la pose elegida (comparación).
  const poseDates = useMemo(
    () => [...new Set(state.photos.filter((p) => p.pose === pose).map((p) => p.date))].sort(),
    [state.photos, pose],
  );
  useEffect(() => {
    // Por defecto: la primera y la última fecha de la pose.
    setCmpA(poseDates.length >= 2 ? [poseDates[0]] : []);
    setCmpB(poseDates.length >= 2 ? [poseDates[poseDates.length - 1]] : []);
  }, [poseDates]);

  const photoFor = (date: string | undefined) => (date ? state.photos.find((p) => p.date === date && p.pose === pose) : undefined);

  const addFrom = async (source: 'camera' | 'library') => {
    setError(null);
    setPermissionDenied(false);
    try {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setPermissionDenied(true);
        return;
      }
      const res =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (res.canceled || !res.assets?.length) return;
      setBusy(true);
      await actions.addPhoto(res.assets[0].uri, pose, todayStr());
    } catch {
      setError(t('sc.photos.saveError'));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = (p: PhotoMeta) => {
    Alert.alert(t('photos.delete'), t('photos.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          actions.deletePhoto(p.id).catch(() => setError(t('sc.photos.deleteError')));
        },
      },
    ]);
  };

  const dateOptions = poseDates.map((d) => ({ value: d, label: formatDate(d, lang) }));
  const photoA = photoFor(cmpA[0]);
  const photoB = photoFor(cmpB[0]);

  return (
    <Screen>
      <Stack.Screen options={{ title: t('photos.title') }} />

      <Notice kind="info" text={t('photos.noAi')} />

      {/* Guía */}
      <Card>
        <Label>{t('sc.photos.guideTitle')}</Label>
        {guide.map((g, i) => (
          <Row key={i} style={{ alignItems: 'flex-start' }} gap={space.sm}>
            <Icon name="check" size={16} color={c.accent} />
            <Body style={{ flex: 1, fontSize: 14 }}>{g}</Body>
          </Row>
        ))}
        <Small style={{ marginTop: space.xs }}>{t('photos.privacy')}</Small>
        <Small>{state.mode === 'cloud' ? t('sc.photos.cloudPrivacy') : t('photos.localPrivacy')}</Small>
      </Card>

      {/* Captura */}
      <Card>
        <Label>{t('sc.photos.pose')}</Label>
        <Segmented options={poseOptions} value={pose} onChange={(v) => setPose(v as Pose)} />
        <Row gap={space.sm}>
          <Button title={t('photos.take')} icon="camera" onPress={() => void addFrom('camera')} loading={busy} style={{ flex: 1 }} />
          <Button
            title={t('photos.choose')}
            icon="image"
            variant="secondary"
            onPress={() => void addFrom('library')}
            disabled={busy}
            style={{ flex: 1 }}
          />
        </Row>
        {busy ? <Small>{t('sc.photos.saving')}</Small> : null}
        {permissionDenied ? <Notice kind="warn" text={t('photos.permission')} /> : null}
        {error ? <Notice kind="danger" text={error} /> : null}
      </Card>

      {/* Comparación */}
      <Card>
        <Label>{t('photos.compare')}</Label>
        {!canCompare ? (
          <LockCard text={t('photos.compareLocked')} />
        ) : poseDates.length < 2 ? (
          <Small>{t('sc.photos.needTwo')}</Small>
        ) : (
          <>
            <Small>{t('photos.compareHint')}</Small>
            <Small>{t('sc.photos.before')}</Small>
            <ChipGroup options={dateOptions} value={cmpA} onChange={(v) => v.length && setCmpA(v)} />
            <Small>{t('sc.photos.after')}</Small>
            <ChipGroup options={dateOptions} value={cmpB} onChange={(v) => v.length && setCmpB(v)} />
            <Row gap={space.sm} style={{ alignItems: 'flex-start' }}>
              {[photoA, photoB].map((p, i) => (
                <View key={i} style={{ flex: 1, gap: space.xs }}>
                  {p ? <PhotoImage photo={p} height={240} /> : null}
                  <Small center>{`${i === 0 ? t('sc.photos.before') : t('sc.photos.after')} · ${p ? formatDate(p.date, lang) : ''}`}</Small>
                </View>
              ))}
            </Row>
          </>
        )}
      </Card>

      {/* Galería */}
      <Label>{t('sc.photos.gallery')}</Label>
      {byDate.length === 0 ? (
        <Empty title={t('photos.empty')} />
      ) : (
        byDate.map(([date, list]) => (
          <Card key={date}>
            <Body style={{ fontWeight: '700' }}>{formatDate(date, lang)}</Body>
            <Row gap={space.sm} style={{ alignItems: 'flex-start' }}>
              {list.map((p) => (
                <View key={p.id} style={{ flex: 1, maxWidth: '33%', gap: space.xs }}>
                  <PhotoImage photo={p} height={150} onLongPress={() => confirmDelete(p)} />
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Small>{t(`photos.${p.pose}`)}</Small>
                    <Pressable
                      onPress={() => confirmDelete(p)}
                      accessibilityRole="button"
                      accessibilityLabel={t('photos.delete')}
                      hitSlop={10}
                      style={{ padding: 4 }}
                    >
                      <Icon name="trash" size={16} color={c.muted} />
                    </Pressable>
                  </Row>
                </View>
              ))}
            </Row>
          </Card>
        ))
      )}
    </Screen>
  );
}
