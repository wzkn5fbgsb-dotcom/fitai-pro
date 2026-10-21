// Punto de entrada: decide a qué pantalla ir según el estado guardado.
import { Redirect } from 'expo-router';
import { useApp } from '../src/data/store';

export default function Index() {
  const { state } = useApp();
  if (!state.mode) return <Redirect href="/welcome" />;
  if (state.mode === 'cloud' && !state.userId) return <Redirect href="/auth" />;
  if (!state.profile) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
