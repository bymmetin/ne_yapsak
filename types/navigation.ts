// Bottom tab navigator'daki sekme adlarının tek doğruluk kaynağı.
// TabNavigator.tsx buradan türeterek TabParamList'i oluşturur, böylece
// route.name her zaman bu union'a daralır (TAB_ICONS erişiminde any gerekmez).

export type RouteName = 'Kesfet' | 'Takvim' | 'EtkinlikOlustur' | 'Bildirimler' | 'Profil';

// Keşfet sekmesi içindeki stack: liste -> detay geçişi.
// EtkinlikDetay parametresi olarak sadece id taşınır, detay ekranı
// veriyi kendisi mockEtkinlikler içinden bulur (Gün 17'de Supabase
// sorgusuna dönüşünce de aynı pattern kullanılacak).
export type KesfetStackParamList = {
  KesfetListesi: undefined;
  EtkinlikDetay: { etkinlikId: string };
};

// Kimlik doğrulama akışı (Gün 8-9). Gün 10'da AuthContext kurulunca bu stack
// ile TabNavigator arasında oturum durumuna göre geçiş yapılacak; şimdilik
// App.tsx'te doğrudan bu stack render ediliyor.
export type AuthStackParamList = {
  Giris: undefined;
  Kayit: undefined;
  EmailDogrulama: { email: string };
  SifremiUnuttum: undefined;
};
