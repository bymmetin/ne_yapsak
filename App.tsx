import { NavigationContainer } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AuthStack from './navigation/AuthStack';
import { supabase } from './services/supabase';

// E-posta doğrulama linkine tıklanınca uygulama bu deep link ile açılır.
// Dinleyici kasıtlı olarak kökte (tek bir ekranda değil): uygulama tamamen
// kapalıyken linke tıklanırsa (getInitialURL) veya açıkken/arka plandan
// dönerken (addEventListener) link hangi ekran o an mount'luysa ona değil,
// her zaman buraya gelir. exchangeCodeForSession'dan sonra oturum
// AsyncStorage'a yazılır; ekranlar bunu kendi onAuthStateChange
// aboneliğiyle okur (bkz. EmailDogrulamaScreen).
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

// Gün 10'da AuthContext kurulunca kök burada oturum durumuna göre
// AuthStack / TabNavigator arasında seçim yapacak. O güne kadar kayıt ve
// e-posta doğrulama akışını test edebilmek için doğrudan AuthStack render
// ediliyor.
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
    <SafeAreaProvider>
      <NavigationContainer>
        <AuthStack />
      </NavigationContainer>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
