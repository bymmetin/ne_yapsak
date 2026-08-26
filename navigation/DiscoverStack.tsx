import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { typography } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import EventDetailScreen from '../screens/EventDetailScreen';
import DiscoverScreen from '../screens/DiscoverScreen';
import MapScreen from '../screens/MapScreen';
import RatingScreen from '../screens/RatingScreen';
import type { DiscoverStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<DiscoverStackParamList>();

export default function DiscoverStack() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: typography.fontWeight.bold },
      }}
    >
      <Stack.Screen name="DiscoverList" component={DiscoverScreen} options={{ title: 'Keşfet' }} />
      <Stack.Screen
        name="EventDetail"
        component={EventDetailScreen}
        options={{ title: 'Etkinlik Detayı' }}
      />
      <Stack.Screen name="Map" component={MapScreen} options={{ title: 'Harita' }} />
      <Stack.Screen
        name="Rating"
        component={RatingScreen}
        options={{ title: 'Etkinliği Değerlendir' }}
      />
    </Stack.Navigator>
  );
}
