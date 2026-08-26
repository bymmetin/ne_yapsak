import { LinkingOptions, NavigationContainer, ParamListBase } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import type { ColorPalette } from './context/ThemeContext';
import AuthStack from './navigation/AuthStack';
import { navigationRef } from './navigation/navigationRef';
import TabNavigator from './navigation/TabNavigator';
import { supabase } from './services/supabase';

// Gün 29: Uygulama ön plandayken bir yerel bildirim tetiklenirse (ör.
// hatırlatma/değerlendirme daveti zamanı gelirse) varsayılan davranış hiçbir
// şey GÖSTERMEMEK - bu handler olmadan planlanan bildirimler sessizce
// tetiklenir ama kullanıcı hiçbir şey görmez. Badge kasıtlı kapalı, uygulamada
// henüz bir "okunmamış sayısı" kavramı yok.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// E-posta doğrulama/şifre sıfırlama linkine tıklanınca uygulama bu deep
// link ile açılır. Dinleyici kasıtlı olarak kökte (tek bir ekranda değil):
// uygulama tamamen kapalıyken linke tıklanırsa (getInitialURL) veya
// açıkken/arka plandan dönerken (addEventListener) link hangi ekran o an
// mount'luysa ona değil, her zaman buraya gelir. exchangeCodeForSession'dan
// sonra oturum AsyncStorage'a yazılır; AuthContext'in onAuthStateChange
// aboneliği bunu global olarak yakalar (bkz. context/AuthContext.tsx).
function handleVerificationCode(url: string) {
  console.log('[DeepLink] Gelen URL (tam):', url);
  const { queryParams } = Linking.parse(url);
  const code = typeof queryParams?.code === 'string' ? queryParams.code : null;

  if (!code) {
    console.log('[DeepLink] URL içinde "code" parametresi yok, atlanıyor.');
    return;
  }

  console.log('[DeepLink] "code" parametresi bulundu, exchangeCodeForSession çağrılıyor.');
  supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
    if (error) {
      console.log('[DeepLink] exchangeCodeForSession HATA:', error.message);
    } else {
      console.log('[DeepLink] exchangeCodeForSession BAŞARILI, oturum kuruldu.');
    }
  });
}

// Gün 22: Etkinlik paylaşım linkleri (EventDetailScreen.tsx > shareEvent)
// "neyapsak://etkinlik/:eventId" biçiminde üretiliyor; bu config React
// Navigation'a bu path'i TabNavigator > Discover (DiscoverStack) >
// EventDetail ekranına eşlemesini söylüyor. Yukarıdaki
// handleVerificationCode'dan TAMAMEN ayrı bir mekanizma - o, Linking
// event'lerini kendi dinleyicisiyle (App.tsx kökünde, NavigationContainer
// dışında) yakalayıp exchangeCodeForSession çağırıyor, React Navigation'ın
// linking sistemine hiç girmiyor. "auth-callback" path'i buradaki
// config.screens'te tanımlı olmadığı için bu linking config onu görmezden
// gelir, iki mekanizma çakışmaz. Kullanıcı oturum açmamışsa (AuthStack
// render'da) bu path zaten eşleşecek bir ekran bulamaz - o senaryonun
// çözümü bu günün kapsamı dışı.
// "as unknown as LinkingOptions<ParamListBase>": React Navigation'ın nested
// screens tiplemesi (PathConfig<ParamList[RouteName]>) TabParamList'in
// Discover'ı sadece `undefined` (bkz. types/navigation.ts > RouteName) olarak
// tanımlamasından dolayı DiscoverStack'in kendi screens'ini iç içe
// tanıyamıyor - bu, RootNavigation'ın AuthStack/TabNavigator arasında
// koşullu seçim yapması (tek bir birleşik RootParamList olmaması) yüzünden
// zaten beklenen bir sınırlama; runtime davranışını etkilemiyor, sadece
// derleme zamanı narrow-check'i es geçiyoruz.
// Gün 38: bir "Main" katmanı eklendi - RootNavigation artık kökte doğrudan
// TabNavigator DEĞİL, onu bir "Main" ekranı olarak taşıyan bir RootStack
// döndürüyor (guest modu, bkz. RootNavigation), bu yüzden path eşlemesi de
// o kadar derine inmek zorunda.
const linking = {
  prefixes: [Linking.createURL('/')],
  config: {
    screens: {
      Main: {
        screens: {
          Discover: {
            screens: {
              EventDetail: 'etkinlik/:eventId',
            },
          },
        },
      },
    },
  },
} as unknown as LinkingOptions<ParamListBase>;

// Gün 29: Bir bildirime dokununca (hatırlatma -> EventDetail, değerlendirme
// daveti -> Rating) doğru ekrana yönlendirir - data payload'ı
// services/notifications.ts > buildNotificationData'da kuruluyor. Aynı
// "as unknown"/"as never" yaklaşımı yukarıdaki linking config'teki nested
// screens sınırlamasıyla aynı gerekçeye dayanıyor (bkz. o yorumdaki not) -
// Discover sekmesinin altındaki DiscoverStack'in kendi ekranlarını
// navigationRef'in ParamListBase tipinden tanıması mümkün değil.
// Gün 38: navigationRef artık burada üretilmiyor, navigation/navigationRef.ts'ten
// import ediliyor - requireLogin() (bkz. o dosya) da aynı referansı
// kullanabilsin diye, EventDetailScreen/ProfileScreen gibi hiçbir navigation
// prop'una sahip olmayan yerlerden de "Auth" ekranına gidebilmek için.
function navigateFromNotificationResponse(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data as
    { type?: string; eventId?: string } | undefined;

  if (!data?.eventId || !navigationRef.isReady()) return;

  const screen = data.type === 'rating' ? 'Rating' : 'EventDetail';
  try {
    const navigate = navigationRef.navigate as (name: string, params: object) => void;
    navigate('Main', { screen: 'Discover', params: { screen, params: { eventId: data.eventId } } });
  } catch (err) {
    console.log('[Bildirim] navigasyon başarısız:', err);
  }
}

const RootStack = createNativeStackNavigator();

// Gün 38: Guest modu. Eskiden session yoksa kökte doğrudan <AuthStack/>
// render edilirdi (TabNavigator hiç mount olmazdı) - artık TabNavigator
// ("Main") session'dan bağımsız HER ZAMAN mount'lu, çünkü Discover/Harita/
// EventDetail RLS zaten girişsiz okumaya izin veriyordu (bkz. supabase/
// schema.sql'deki "herkese_acik_okuma" politikaları), engel sadece bu
// dosyaydı. "Auth" (Login/Register/...) artık kökte bir DAL değil, "Main"in
// ÜZERİNE modal olarak push'lanan bir ekran - session'sız bir kullanıcı
// korumalı bir aksiyona (Katıl/yorum/favori/etkinlik oluştur, Profil sekmesi)
// dokununca navigation/navigationRef.ts > requireLogin() bunu açıyor.
// passwordRecoveryMode true iken davranış AYNI kaldı: RootStack'e hiç
// girilmeden bare <AuthStack/> render ediliyor (bkz. context/AuthContext.tsx)
// - şifre sıfırlama linkinden dönen kullanıcı, session zaten geçici olarak
// var olsa bile yeni şifre formunu görmeden ana ekrana atılmamalı.
function RootNavigation() {
  const { session, loading, passwordRecoveryMode } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createRootNavigationStyles(colors), [colors]);

  // "Auth" ekranı köke bir dal değil, "Main"in üzerine push'lanan bir ekran
  // olduğu için, session kurulunca (Giriş Yap'a basılıp başarılı olunca YA
  // DA e-posta doğrulama/Google OAuth deep-link'i session'ı doğrudan
  // kurunca - LoginScreen'in kendi goBack()'i sadece ilk durumu kapsar)
  // buradan köke (Main) elle dönülmesi gerekiyor. "Main" zaten RootStack'te
  // var olan bir rota olduğu için navigate('Main') - "Auth" üstteyse onu
  // pop'lar, zaten "Main" üstteyse (ör. uygulama zaten oturumla açıldıysa)
  // no-op'tur.
  useEffect(() => {
    if (session && !passwordRecoveryMode && navigationRef.isReady()) {
      navigationRef.navigate('Main' as never);
    }
  }, [session, passwordRecoveryMode]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (passwordRecoveryMode) {
    return <AuthStack />;
  }

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="Main" component={TabNavigator} />
      <RootStack.Screen name="Auth" component={AuthStack} options={{ presentation: 'modal' }} />
    </RootStack.Navigator>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

// Gün 35: App()'in eski gövdesi - ThemeProvider'ı App() içinde render etmek
// App()'in kendisinin useTheme() çağırabilmesini engelliyordu (Provider
// sadece children'ı sarar, kendi kurucu bileşenini değil) - bu yüzden
// StatusBar'ın tema-bağımlı style'ı (aşağıda) için ayrı bir alt bileşene
// taşındı.
function AppContent() {
  const { scheme } = useTheme();

  useEffect(() => {
    // Uygulama tamamen kapalıyken linke tıklanıp açıldığı durum.
    Linking.getInitialURL().then((url) => {
      console.log('[DeepLink] getInitialURL sonucu:', url);
      if (url) handleVerificationCode(url);
    });

    // Uygulama açıkken (ön planda veya arka plandan dönerken) gelen linkler.
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleVerificationCode(url);
    });

    return () => subscription.remove();
  }, []);

  // handleVerificationCode/Linking ile aynı çift-mekanizma deseni: uygulama
  // tamamen kapalıyken bir bildirime dokunulup açıldığı durum
  // (getLastNotificationResponse, senkron) ve açıkken/arka plandan dönerken
  // dokunulduğu durum (addNotificationResponseReceivedListener) ayrı ayrı
  // ele alınıyor.
  useEffect(() => {
    const initialResponse = Notifications.getLastNotificationResponse();
    if (initialResponse) {
      navigateFromNotificationResponse(initialResponse);
    }

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      navigateFromNotificationResponse(response);
    });

    return () => subscription.remove();
  }, []);

  // StatusBar'ın "style" prop'u ikon rengini belirtir (arkaplanı değil) -
  // "auto" sadece CİHAZIN sistem temasını takip eder, kullanıcı burada
  // sistemi ezip manuel bir tercih seçtiğinde (bkz. context/ThemeContext.tsx)
  // "auto" yanlış kalırdı (ör. sistem açık ama uygulama koyu iken koyu
  // ikonlar koyu arkaplanda görünmez olurdu) - bu yüzden çözümlenmiş
  // `scheme`'e göre elle hesaplanıyor: koyu arkaplan -> açık (light) ikonlar.
  return (
    <AuthProvider>
      <SafeAreaProvider>
        <NavigationContainer ref={navigationRef} linking={linking}>
          <RootNavigation />
        </NavigationContainer>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      </SafeAreaProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

function createRootNavigationStyles(colors: ColorPalette) {
  return StyleSheet.create({
    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
  });
}
