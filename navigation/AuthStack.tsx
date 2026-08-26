import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { typography } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import EmailVerificationScreen from '../screens/EmailVerificationScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import type { AuthStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: typography.fontWeight.bold },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Giriş Yap' }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Kayıt Ol' }} />
      <Stack.Screen
        name="EmailVerification"
        component={EmailVerificationScreen}
        options={{ title: 'E-posta Doğrulama', headerBackVisible: false }}
      />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{ title: 'Şifremi Unuttum' }}
      />
    </Stack.Navigator>
  );
}
