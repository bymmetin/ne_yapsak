// Gün 38: Guest modu - session'sız kullanıcı artık kökte AuthStack yerine
// doğrudan TabNavigator'ı görüyor (bkz. App.tsx > RootNavigation), bu yüzden
// "Katıl"/yorum/favori/etkinlik oluştur gibi korumalı bir aksiyona dokununca
// Giriş ekranına gitmek artık kökteki koşullu render'ı değiştirmek değil,
// TabNavigator'ın İÇİNDEN (DiscoverStack > EventDetail, hatta doğrudan bir
// Tab.Screen olan EventCreate gibi) köke kadar bir "Auth" ekranı push'lamak
// anlamına geliyor. Bu ekranlar kendi navigation prop'larıyla (DiscoverStack/
// TabParamList) "Auth" adında bir rotayı hiç tanımıyor - App.tsx'teki
// navigateFromNotificationResponse'daki AYNI "modül seviyesinde bir ref +
// gevşek tipli navigate" deseni burada da kullanılıyor (bkz. o dosyadaki
// yorum, aynı köklü sınırlama: ayrı param list'lerin birleşik bir
// RootParamList'i yok).
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export function requireLogin() {
  if (navigationRef.isReady()) {
    navigationRef.navigate('Auth' as never);
  }
}
