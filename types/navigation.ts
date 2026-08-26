// Bottom tab navigator'daki sekme adlarının tek doğruluk kaynağı.
// TabNavigator.tsx buradan türeterek TabParamList'i oluşturur, böylece
// route.name her zaman bu union'a daralır (TAB_ICONS erişiminde any gerekmez).

export type RouteName = 'Discover' | 'Calendar' | 'EventCreate' | 'Notifications' | 'Profile';

// Keşfet sekmesi içindeki stack: liste -> detay geçişi.
// EventDetail parametresi olarak sadece id taşınır, detay ekranı veriyi
// services/events.ts'teki getEvent ile kendisi çeker (Gün 17).
// Map (Gün 24): DiscoverScreen header'ındaki harita ikonundan push'lanır -
// ayrı bir bottom tab DEĞİL (bkz. MapScreen.tsx başındaki not), bu yüzden
// burada, TabNavigator'da değil.
// Rating (Gün 29): değerlendirme daveti bildirimine dokununca ya da
// EventDetail'daki "Etkinliği Değerlendir" butonundan buraya gelinir.
// EventDetail'daki aynı desen - parametre olarak sadece id taşınır, ekran
// başlık/tarihi getEvent ile kendisi çeker.
export type DiscoverStackParamList = {
  DiscoverList: undefined;
  EventDetail: { eventId: string };
  Map: undefined;
  Rating: { eventId: string };
};

// Profil sekmesi içindeki stack: profil -> etkinliklerim -> düzenle (Gün 18),
// profil -> katıldıklarım (Gün 21), profil -> favorilerim (Gün 33).
// EventEdit parametresi olarak sadece id taşınır, EventDetail'daki aynı
// yaklaşımla ekran veriyi kendisi getEvent ile çeker.
export type ProfileStackParamList = {
  ProfileHome: undefined;
  MyEvents: undefined;
  AttendedEvents: undefined;
  Favorites: undefined;
  EventEdit: { eventId: string };
  // DiscoverStackParamList > EventDetail ile aynı desen: sadece id taşınır,
  // ekran veriyi kendisi getEvent ile çeker.
  EventDetail: { eventId: string };
  // DiscoverStackParamList > Rating ile birebir aynı param şekli -
  // EventDetailScreen'deki "Etkinliği Değerlendir" butonu artık buradan
  // (Katıldıklarım -> EventDetail) da erişilebildiği için gerekiyor.
  Rating: { eventId: string };
};

// Kimlik doğrulama akışı (Gün 8-9). Gün 10'da AuthContext kurulunca bu stack
// ile TabNavigator arasında oturum durumuna göre geçiş yapılacak; şimdilik
// App.tsx'te doğrudan bu stack render ediliyor.
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  EmailVerification: { email: string };
  ForgotPassword: undefined;
};
