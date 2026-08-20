import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { colors, typography } from '../constants/theme';
import BildirimlerScreen from '../screens/BildirimlerScreen';
import EtkinlikOlusturScreen from '../screens/EtkinlikOlusturScreen';
import KesfetScreen from '../screens/KesfetScreen';
import ProfilScreen from '../screens/ProfilScreen';
import TakvimScreen from '../screens/TakvimScreen';

export type TabParamList = {
  Kesfet: undefined;
  Takvim: undefined;
  EtkinlikOlustur: undefined;
  Bildirimler: undefined;
  Profil: undefined;
};

type IconName = keyof typeof Ionicons.glyphMap;

const TAB_ICONS: Record<keyof TabParamList, { active: IconName; inactive: IconName }> = {
  Kesfet: { active: 'compass', inactive: 'compass-outline' },
  Takvim: { active: 'calendar', inactive: 'calendar-outline' },
  EtkinlikOlustur: { active: 'add-circle', inactive: 'add-circle-outline' },
  Bildirimler: { active: 'notifications', inactive: 'notifications-outline' },
  Profil: { active: 'person', inactive: 'person-outline' },
};

const Tab = createBottomTabNavigator<TabParamList>();

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontSize: typography.fontSize.xs,
        },
        tabBarIcon: ({ color, size, focused }) => {
          const icons = TAB_ICONS[route.name];
          return (
            <Ionicons name={focused ? icons.active : icons.inactive} size={size} color={color} />
          );
        },
        headerStyle: {
          backgroundColor: colors.primary,
        },
        headerTintColor: colors.white,
        headerTitleStyle: {
          fontWeight: typography.fontWeight.bold,
        },
      })}
    >
      <Tab.Screen name="Kesfet" component={KesfetScreen} options={{ title: 'Keşfet' }} />
      <Tab.Screen name="Takvim" component={TakvimScreen} options={{ title: 'Takvim' }} />
      <Tab.Screen
        name="EtkinlikOlustur"
        component={EtkinlikOlusturScreen}
        options={{ title: 'Etkinlik Oluştur' }}
      />
      <Tab.Screen
        name="Bildirimler"
        component={BildirimlerScreen}
        options={{ title: 'Bildirimler' }}
      />
      <Tab.Screen name="Profil" component={ProfilScreen} options={{ title: 'Profil' }} />
    </Tab.Navigator>
  );
}
