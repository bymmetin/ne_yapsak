import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { colors, typography } from '../constants/theme';
import EmailDogrulamaScreen from '../screens/EmailDogrulamaScreen';
import GirisScreen from '../screens/GirisScreen';
import KayitScreen from '../screens/KayitScreen';
import SifremiUnuttumScreen from '../screens/SifremiUnuttumScreen';
import type { AuthStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack() {
  return (
    <Stack.Navigator
      initialRouteName="Giris"
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: typography.fontWeight.bold },
      }}
    >
      <Stack.Screen name="Giris" component={GirisScreen} options={{ title: 'Giriş Yap' }} />
      <Stack.Screen name="Kayit" component={KayitScreen} options={{ title: 'Kayıt Ol' }} />
      <Stack.Screen
        name="EmailDogrulama"
        component={EmailDogrulamaScreen}
        options={{ title: 'E-posta Doğrulama', headerBackVisible: false }}
      />
      <Stack.Screen
        name="SifremiUnuttum"
        component={SifremiUnuttumScreen}
        options={{ title: 'Şifremi Unuttum' }}
      />
    </Stack.Navigator>
  );
}
