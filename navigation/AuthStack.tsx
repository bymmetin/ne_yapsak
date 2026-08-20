import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { colors, typography } from '../constants/theme';
import EmailDogrulamaScreen from '../screens/EmailDogrulamaScreen';
import KayitScreen from '../screens/KayitScreen';
import type { AuthStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: typography.fontWeight.bold },
      }}
    >
      <Stack.Screen name="Kayit" component={KayitScreen} options={{ title: 'Kayıt Ol' }} />
      <Stack.Screen
        name="EmailDogrulama"
        component={EmailDogrulamaScreen}
        options={{ title: 'E-posta Doğrulama', headerBackVisible: false }}
      />
    </Stack.Navigator>
  );
}
