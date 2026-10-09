import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BedDouble, CalendarDays, House, ScanLine, User, type LucideIcon } from 'lucide-react-native';
import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLiveUpdates } from '../api/live';
import { useCan } from '../api/queries';
import { useI18n } from '../i18n';
import { DashboardScreen } from '../screens/DashboardScreen';
import { HousekeepingScreen } from '../screens/HousekeepingScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ReservationDetailScreen } from '../screens/ReservationDetailScreen';
import { ReservationsScreen } from '../screens/ReservationsScreen';
import { ScanScreen } from '../screens/ScanScreen';
import { WebScreen } from '../screens/WebScreen';
import { size, type, typeArabic, useTheme } from '../theme';
import { Text } from '../ui';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const tabIcon = (Glyph: LucideIcon) =>
  function TabIcon({ color }: { color: string }) {
    return <Glyph size={size.iconLg} color={color} strokeWidth={2} />;
  };

/**
 * Barre de navigation du bas (charte HOTELIA) : Accueil, Chambres, Scan, Réservations, Profil,
 * selon les droits du profil. Tâches et Messages arriveront avec leurs API (phase 2).
 */
function Tabs() {
  const { c, shadow } = useTheme();
  const { m, rtl } = useI18n();
  const can = useCan();
  const insets = useSafeAreaInsets();
  const font = (rtl ? typeArabic : type).tabLabel;
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accentText,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line, height: size.tabBar + insets.bottom, paddingTop: 6, ...shadow['2'] },
        tabBarLabel: ({ color, children }) => (
          <Text style={[font, { color }]} numberOfLines={1}>{children}</Text>
        ),
      }}
    >
      <Tab.Screen name="Home" component={DashboardScreen} options={{ title: m.tabs.home, tabBarIcon: tabIcon(House) }} />
      {can('rooms:read') && <Tab.Screen name="Rooms" component={HousekeepingScreen} options={{ title: m.tabs.rooms, tabBarIcon: tabIcon(BedDouble) }} />}
      {can('rooms:status') && <Tab.Screen name="Scan" component={ScanScreen} options={{ title: m.tabs.scan, tabBarIcon: tabIcon(ScanLine) }} />}
      {can('reservations:read') && (
        <Tab.Screen name="Reservations" component={ReservationsScreen} options={{ title: m.tabs.reservations, tabBarIcon: tabIcon(CalendarDays) }} />
      )}
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: m.tabs.profile, tabBarIcon: tabIcon(User) }} />
    </Tab.Navigator>
  );
}

/** Application connectée : onglets, puis fiches et écrans web empilés par-dessus. */
export function AppNavigator() {
  const { c, name } = useTheme();
  const { rtl, r } = useI18n();
  useLiveUpdates(true);

  const navTheme: Theme = useMemo(() => {
    const base = name === 'dark' ? DarkTheme : DefaultTheme;
    return { ...base, colors: { ...base.colors, primary: c.accent, background: c.bg, card: c.surface, text: c.text, border: c.line, notification: c.accent } };
  }, [c, name]);

  return (
    <NavigationContainer theme={navTheme} direction={rtl ? 'rtl' : 'ltr'}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: c.surface },
          headerTintColor: c.text,
          headerTitleStyle: (rtl ? typeArabic : type).title2,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: c.bg },
        }}
      >
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name="Reservation" component={ReservationDetailScreen} options={{ title: r.title }} />
        <Stack.Screen name="Web" component={WebScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
