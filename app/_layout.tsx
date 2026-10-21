// Raíz de la app: estado global, tema, área segura y navegación en pila.
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '../src/data/store';
import { useI18n } from '../src/i18n';
import { ThemeProvider, useTheme } from '../src/theme';

export default function RootLayout() {
  return (
    <AppProvider>
      <Themed />
    </AppProvider>
  );
}

// Lee la preferencia de tema del estado (necesita estar dentro de AppProvider).
function Themed() {
  const { state } = useApp();
  return (
    <ThemeProvider pref={state.settings.theme}>
      <SafeAreaProvider>
        <Navigator />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

function Navigator() {
  const { state } = useApp();
  const { c } = useTheme();
  const { t } = useI18n();

  // Mientras se carga el almacenamiento mostramos sólo un indicador centrado.
  if (!state.ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
        <StatusBar style="auto" />
        <ActivityIndicator size="large" color={c.accent} accessibilityLabel={t('common.loading')} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.bg },
          headerTintColor: c.text,
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: c.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ title: t('auth.title') }} />
        <Stack.Screen name="onboarding" options={{ title: t('sa.titles.onboarding') }} />
        <Stack.Screen name="summary" options={{ title: t('summary.title') }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ title: t('profile.title') }} />
        <Stack.Screen name="membership" options={{ title: t('membership.title') }} />
        <Stack.Screen name="legal" options={{ title: t('legal.title') }} />
        <Stack.Screen name="session/[day]" options={{ title: t('session.title') }} />
        <Stack.Screen name="exercise/[id]" options={{ title: t('sa.titles.exercise') }} />
        <Stack.Screen name="meal/[day]/[slot]" options={{ title: t('sa.titles.meal') }} />
        <Stack.Screen name="shopping" options={{ title: t('shopping.title') }} />
        <Stack.Screen name="photos" options={{ title: t('photos.title') }} />
        <Stack.Screen name="review" options={{ title: t('review.title') }} />
      </Stack>
    </>
  );
}
