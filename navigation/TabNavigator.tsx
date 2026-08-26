import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { typography } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import DiscoverStack from './DiscoverStack';
import ProfileStack from './ProfileStack';
import NotificationsScreen from '../screens/NotificationsScreen';
import EventCreateScreen from '../screens/EventCreateScreen';
import CalendarScreen from '../screens/CalendarScreen';
import type { RouteName } from '../types/navigation';

export type TabParamList = Record<RouteName, undefined>;

type IconName = keyof typeof Ionicons.glyphMap;

const TAB_ICONS: Record<RouteName, { active: IconName; inactive: IconName }> = {
  Discover: { active: 'compass', inactive: 'compass-outline' },
  Calendar: { active: 'calendar', inactive: 'calendar-outline' },
  EventCreate: { active: 'add-circle', inactive: 'add-circle-outline' },
  Notifications: { active: 'notifications', inactive: 'notifications-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
};

const Tab = createBottomTabNavigator<TabParamList>();

export default function TabNavigator() {
  const { colors } = useTheme();

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
      <Tab.Screen
        name="Discover"
        component={DiscoverStack}
        options={{ title: 'Keşfet', headerShown: false }}
      />
      <Tab.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Takvim' }} />
      <Tab.Screen
        name="EventCreate"
        component={EventCreateScreen}
        options={{ title: 'Etkinlik Oluştur' }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Bildirimler' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{ title: 'Profil', headerShown: false }}
      />
    </Tab.Navigator>
  );
}
