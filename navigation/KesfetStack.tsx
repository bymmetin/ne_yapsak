import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { colors, typography } from '../constants/theme';
import EtkinlikDetayScreen from '../screens/EtkinlikDetayScreen';
import KesfetScreen from '../screens/KesfetScreen';
import type { KesfetStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<KesfetStackParamList>();

export default function KesfetStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: typography.fontWeight.bold },
      }}
    >
      <Stack.Screen name="KesfetListesi" component={KesfetScreen} options={{ title: 'Keşfet' }} />
      <Stack.Screen
        name="EtkinlikDetay"
        component={EtkinlikDetayScreen}
        options={{ title: 'Etkinlik Detayı' }}
      />
    </Stack.Navigator>
  );
}
