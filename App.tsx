import { NavigationContainer } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from './constants/theme';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthStack from './navigation/AuthStack';
import TabNavigator from './navigation/TabNavigator';
import { supabase } from './services/supabase';

// E-posta doğrulama/şifre sıfırlama linkine tıklanınca uygulama bu deep
// link ile açılır. Dinleyici kasıtlı olarak kökte (tek bir ekranda değil):
// uygulama tamamen kapalıyken linke tıklanırsa (getInitialURL) veya
// açıkken/arka plandan dönerken (addEventListener) link hangi ekran o an
// mount'luysa ona değil, her zaman buraya gelir. exchangeCodeForSession'dan
// sonra oturum AsyncStorage'a yazılır; AuthContext'in onAuthStateChange
// aboneliği bunu global olarak yakalar (bkz. context/AuthContext.tsx).
function dogrulamaKoduIsle(url: string) {
  console.log('[DeepLink] Gelen URL (tam):', url);
  const { queryParams } = Linking.parse(url);
  const kod = typeof queryParams?.code === 'string' ? queryParams.code : null;

  if (!kod) {
    console.log('[DeepLink] URL içinde "code" parametresi yok, atlanıyor.');
    return;
  }

  console.log('[DeepLink] "code" parametresi bulundu, exchangeCodeForSession çağrılıyor.');
  supabase.auth.exchangeCodeForSession(kod).then(({ error }) => {
    if (error) {
      console.log('[DeepLink] exchangeCodeForSession HATA:', error.message);
    } else {
      console.log('[DeepLink] exchangeCodeForSession BAŞARILI, oturum kuruldu.');
    }
  });
}

// Oturum durumuna göre AuthStack / TabNavigator arasında seçim yapar.
// sifreKurtarmaModu true iken oturum var olsa bile AuthStack'te kalınır
// (bkz. context/AuthContext.tsx) — yoksa şifre sıfırlama linkinden dönen
// kullanıcı yeni şifre formunu görmeden ana ekrana atılır.
function KokNavigasyon() {
  const { session, yukleniyor, sifreKurtarmaModu } = useAuth();

  if (yukleniyor) {
    return (
      <View style={styles.yukleniyor}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return session && !sifreKurtarmaModu ? <TabNavigator /> : <AuthStack />;
}

export default function App() {
  useEffect(() => {
    // Uygulama tamamen kapalıyken linke tıklanıp açıldığı durum.
    Linking.getInitialURL().then((url) => {
      console.log('[DeepLink] getInitialURL sonucu:', url);
      if (url) dogrulamaKoduIsle(url);
    });

    // Uygulama açıkken (ön planda veya arka plandan dönerken) gelen linkler.
    const abonelik = Linking.addEventListener('url', ({ url }) => {
      dogrulamaKoduIsle(url);
    });

    return () => abonelik.remove();
  }, []);

  return (
    <AuthProvider>
      <SafeAreaProvider>
        <NavigationContainer>
          <KokNavigasyon />
        </NavigationContainer>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  yukleniyor: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
