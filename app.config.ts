// Configuración de Expo (SDK 57). Se evalúa al compilar y al arrancar `expo start`.
// Valores que cambian por entorno se leen de variables (ver .env.example).
import type { ExpoConfig } from 'expo/config';

const BUNDLE_ID = process.env.APP_BUNDLE_ID || 'com.fitaipro.app';
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID || '';
const DARK = '#0B0D10';

const photosPermission =
  'FITAI PRO usa tus fotos sólo para guardar tus fotos de progreso privadas. / FITAI PRO uses your photos only to save your private progress photos.';
const cameraPermission =
  'FITAI PRO usa la cámara para tomar tus fotos de progreso privadas. / FITAI PRO uses the camera to take your private progress photos.';

const config: ExpoConfig = {
  name: 'FITAI PRO',
  slug: 'fitai-pro',
  scheme: 'fitaipro',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
  runtimeVersion: { policy: 'appVersion' },
  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: true,
    infoPlist: {
      NSCameraUsageDescription: cameraPermission,
      NSPhotoLibraryUsageDescription: photosPermission,
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: BUNDLE_ID,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: DARK,
    },
    // Permisos mínimos: los plugins añaden sólo lo necesario (cámara/notificaciones).
    permissions: [],
    blockedPermissions: ['android.permission.RECORD_AUDIO'],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-localization',
    'expo-sqlite',
    ['expo-notifications', {}],
    ['expo-image-picker', { photosPermission, cameraPermission, microphonePermission: false }],
    [
      'expo-splash-screen',
      {
        image: './assets/splash.png',
        imageWidth: 220,
        resizeMode: 'contain',
        backgroundColor: DARK,
      },
    ],
    // SDK 57: activa el ciclo de vida por "escenas" (UIScene) que exige iOS 27.
    // Es opcional (opt-in) en SDK 57; lo activamos ya para no tener sorpresas.
    ['expo-build-properties', { ios: { enableSceneSupport: true } }],
  ],
  experiments: {
    typedRoutes: false,
  },
  ...(EAS_PROJECT_ID
    ? {
        extra: { eas: { projectId: EAS_PROJECT_ID } },
        updates: { url: `https://u.expo.dev/${EAS_PROJECT_ID}` },
      }
    : {}),
};

export default config;
