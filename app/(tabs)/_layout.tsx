// Navegación principal por pestañas: Inicio, Entreno, Nutrición, Progreso y Coach.
import { Pressable } from 'react-native';
import { Tabs, router } from 'expo-router';
import { Icon, type IconName } from '../../src/components';
import { useI18n } from '../../src/i18n';
import { useTheme } from '../../src/theme';

// Pestañas en orden: nombre de la ruta, clave de traducción e ícono.
const TABS: { name: string; key: string; icon: IconName }[] = [
  { name: 'index', key: 'tabs.home', icon: 'home' },
  { name: 'training', key: 'tabs.training', icon: 'dumbbell' },
  { name: 'nutrition', key: 'tabs.nutrition', icon: 'food' },
  { name: 'progress', key: 'tabs.progress', icon: 'chart' },
  { name: 'coach', key: 'tabs.coach', icon: 'chat' },
];

export default function TabsLayout() {
  const { c } = useTheme();
  const { t } = useI18n();

  // Botón de perfil en la cabecera de todas las pestañas.
  const profileButton = () => (
    <Pressable
      onPress={() => router.push('/profile')}
      accessibilityRole="button"
      accessibilityLabel={t('profile.title')}
      hitSlop={10}
      style={({ pressed }) => ({
        marginRight: 16,
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: c.surface2,
        borderWidth: 1,
        borderColor: c.border,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon name="user" size={18} color={c.text} />
    </Pressable>
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.text,
        headerTitleStyle: { fontWeight: '700', color: c.text },
        headerShadowVisible: false,
        headerRight: profileButton,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        tabBarLabelStyle: { fontWeight: '600' },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.key),
            tabBarIcon: ({ color, size }: { color: string; size: number }) => <Icon name={tab.icon} size={size} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
