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
