import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AuthStack from './navigation/AuthStack';

// Gün 10'da AuthContext kurulunca kök burada oturum durumuna göre
// AuthStack / TabNavigator arasında seçim yapacak. O güne kadar kayıt ve
// e-posta doğrulama akışını test edebilmek için doğrudan AuthStack render
// ediliyor.
export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AuthStack />
      </NavigationContainer>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
