// Bottom tab navigator'daki sekme adlarının tek doğruluk kaynağı.
// TabNavigator.tsx buradan türeterek TabParamList'i oluşturur, böylece
// route.name her zaman bu union'a daralır (TAB_ICONS erişiminde any gerekmez).

export type RouteName = 'Kesfet' | 'Takvim' | 'EtkinlikOlustur' | 'Bildirimler' | 'Profil';
