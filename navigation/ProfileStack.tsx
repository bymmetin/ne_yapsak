import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { typography } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import EventDetailScreen from '../screens/EventDetailScreen';
import EventEditScreen from '../screens/EventEditScreen';
import MyEventsScreen from '../screens/MyEventsScreen';
import AttendedEventsScreen from '../screens/AttendedEventsScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import RatingScreen from '../screens/RatingScreen';
import type { ProfileStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStack() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: typography.fontWeight.bold },
      }}
    >
      <Stack.Screen name="ProfileHome" component={ProfileScreen} options={{ title: 'Profil' }} />
      <Stack.Screen
        name="MyEvents"
        component={MyEventsScreen}
        options={{ title: 'Etkinliklerim' }}
      />
      <Stack.Screen
        name="AttendedEvents"
        component={AttendedEventsScreen}
        options={{ title: 'Katıldıklarım' }}
      />
      <Stack.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{ title: 'Favorilerim' }}
      />
      <Stack.Screen
        name="EventEdit"
        component={EventEditScreen}
        options={{ title: 'Etkinliği Düzenle' }}
      />
      <Stack.Screen
        name="EventDetail"
        component={EventDetailScreen}
        options={{ title: 'Etkinlik Detayı' }}
      />
      <Stack.Screen
        name="Rating"
        component={RatingScreen}
        options={{ title: 'Etkinliği Değerlendir' }}
      />
    </Stack.Navigator>
  );
}
