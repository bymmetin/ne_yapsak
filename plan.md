# 42 Günlük Mobil Uygulama Geliştirme Planı
### Proje: Ne Yapsak — Randevu/Etkinlik Organizasyon Uygulaması (React Native + Expo + TypeScript + Supabase)

---

## Nasıl Kullanılır

1. Her gün, o güne ait TÜM alt maddeleri **gerçekten yap**.
2. Gün bitince **"→ SS + defter"** işaretine geldiğinde: o anki ekranın gerçek ekran görüntüsünü al, hemen resmi şablonu doldurup günlük girişini yaz.
3. Bir gün bittiremezsen, ertesi günün alt maddeleriyle birleştirip devam et.
4. Terminal/Claude Code kurulumu daha önce konuştuğumuzla aynı — proje klasörünü `mkdir ne_yapsak && cd ne_yapsak` ile aç.

---

## Günlük Giriş Şablonu (Resmi Format)

Kabul gören gerçek staj defterinde gördüğümüz format: sayfa başına tek gün, resmi/edilgen dilde akıcı bir paragraf, madde madde değil.

```
İş Günü: X
Tarih: ..../..../2026

FAALİYETLER
[Resmi, edilgen dilde, 3-5 cümlelik tek paragraf. Ne yapıldığı, hangi
araç/teknikle yapıldığı, hangi sonuca ulaşıldığı. "...yapılmıştır",
"...oluşturulmuştur", "...gerçekleştirilmiştir" gibi kalıplar kullan.]

[Ekran görüntüsü — gerçek uygulama/kod ekranı]
```

### Örnek Dolu Giriş (Gün 1)

```
İş Günü: 1
Tarih: ..../..../2026

FAALİYETLER
Staj sürecinin ilk gününde React Native ve Expo geliştirme ortamı
kurulmuş, TypeScript şablonuyla "Ne Yapsak" adlı etkinlik organizasyon
uygulamasının proje iskeleti oluşturulmuştur. Proje klasör yapısı
(screens, components, types, services, constants) modüler bir mimariye
uygun şekilde planlanmıştır. Uygulamanın renk paleti ve tipografi
standartları tema dosyasında tanımlanmış, sürüm kontrolü için Git
deposu başlatılmıştır.

[Ekran görüntüsü: ilk çalışan ekran]
```

---

## Hafta 1 — Proje Temeli, Navigasyon, Statik Ekranlar

**1. Kurulum ve proje yapısı**
- Expo + TypeScript projesi oluştur (`ne_yapsak`), klasör yapısını kur (screens/, components/, types/, services/, constants/)
- Renk paleti ve tipografi sabitlerini tanımla
- Git reposunu başlat, ilk commit
→ **SS + defter**

**2. Veri modelleri ve tip sistemi**
- TypeScript interface'leri: `Etkinlik`, `Kullanici`, `Katilim`, `Kategori`, `Yorum`
- tsconfig strict mode, ESLint/Prettier kur
- 10-15 örnek etkinliklik mock veri seti
→ **SS + defter**

**3. Navigasyon iskeleti**
- Bottom Tabs: Keşfet, Takvim, Etkinlik Oluştur, Bildirimler, Profil (5 sekme)
- İkon seti, aktif/pasif tab renkleri, header stilleri
→ **SS + defter**

**4. Keşfet ekranı — liste**
- FlatList ile mock veriyle etkinlik listesi
- `EtkinlikKarti` component (kapak fotoğrafı, başlık, tarih, katılımcı sayısı, kategori etiketi)
- Pull-to-refresh davranışı
→ **SS + defter**

**5. Etkinlik detay ekranı**
- Açıklama, tarih/saat, konum, katılımcı avatarları (mock veriyle), "Katıl" butonu
→ **SS + defter**

**6. Takvim ve profil iskeleti**
- `react-native-calendars` ile aylık takvim görünümü, etkinlik günleri işaretli
- Profil ekranı iskeleti (avatar, düzenlediğim/katıldığım etkinlik sayacı)
→ **SS + defter**

**7. Hafta özeti**
- Tüm ekranları gözden geçir, tutarsız stilleri düzelt, klasör yapısını temizle
→ **SS + defter**

## Hafta 2 — Supabase Backend Kurulumu ve Kimlik Doğrulama

**8. Supabase kurulumu ve şema tasarımı**
- Supabase projesi aç, tabloları tasarla (etkinlikler, profiles, katilimlar, yorumlar, favoriler)
- `@supabase/supabase-js` kur, `.env` yönetimi
→ **SS + defter**

**9. Kayıt akışı**
- Kayıt formu + validasyon
- `supabase.auth.signUp` entegrasyonu
→ **SS + defter**

**10. Giriş akışı**
- Giriş formu + `supabase.auth.signInWithPassword`
- "Şifremi Unuttum" akışı
→ **SS + defter**

**11. Global auth state**
- Context API ile `AuthContext`, `onAuthStateChange` dinleyicisi
- Girişsiz kullanıcının korumalı ekranlara erişimini engelleme
→ **SS + defter**

**12. Çıkış ve hata mesajları**
- `signOut`, yanlış şifre / var olan e-posta gibi durumlarda net mesaj
→ **SS + defter**

**13. Profil senkronizasyonu**
- `profiles` tablosu, kayıt olunca otomatik profil satırı
- Avatar yükleme (expo-image-picker + Supabase Storage)
→ **SS + defter**

**14. Hafta özeti**
- Kayıt → giriş → profil düzenleme → çıkış akışını uçtan uca test et
→ **SS + defter**

## Hafta 3 — Etkinlik CRUD ve Fotoğraf Yönetimi

**15. Tablo tasarımı ve RLS**
- `etkinlikler` tablosu (id, organizator_id, baslik, aciklama, kategori, tarih, saat, konum_lat, konum_lng, kapasite, kapak_foto, created_at)
- RLS: okuma herkese açık, yazma/silme sadece organizatöre
→ **SS + defter**

**16. Etkinlik oluşturma formu — adım 1**
- Başlık/açıklama/kategori/tarih-saat seçici (date-time picker)
→ **SS + defter**

**17. Kapak fotoğrafı**
- expo-image-picker ile fotoğraf seçme, Supabase Storage'a yükleme
→ **SS + defter**

**18. Yayınlama ve gerçek listeleme**
- Formu Supabase `insert`'e bağla
- Keşfet ekranındaki mock veriyi gerçek `select` sorgusuyla değiştir
→ **SS + defter**

**19. Etkinlik düzenleme**
- "Etkinliklerim" ekranından sadece organizatörün düzenleyebildiği form
→ **SS + defter**

**20. Etkinlik iptali**
- Silme/iptal etme (onay diyaloglu), katılımcılara bildirim tetikleme mantığının taslağı
→ **SS + defter**

**21. Hafta özeti**
- Loading/empty/error state'lerini gözden geçir, tüm CRUD senaryolarını test et
→ **SS + defter**

## Hafta 4 — Katılım, Konum, Harita

**22. Katılım mantığı**
- `katilimlar` tablosu, "Katıl" butonuyla insert, kapasite dolunca buton pasif
→ **SS + defter**

**23. Katılımcı listesi**
- Etkinlik detayında gerçek katılımcıları avatarlarıyla listeleme
→ **SS + defter**

**24. Konum izinleri**
- expo-location kurulumu, izin akışı
- Etkinlik oluştururken haritadan konum seçme
→ **SS + defter**

**25. Harita ekranı — temel**
- react-native-maps ile etkinlikleri pin olarak gösterme, pin'e tıklayınca mini kart
→ **SS + defter**

**26. Harita — kümeleme ve filtre**
- Yakın pinleri kümeleme (cluster), haritadan kategori filtreleme
→ **SS + defter**

**27. Arama ve tarih filtreleme**
- Başlık/açıklamada arama (`ilike`)
- "Bugün / Bu hafta / Bu ay" tarih aralığı filtresi
→ **SS + defter**

**28. Hafta özeti**
- Arama+filtre+harita+katılım kombinasyonlarını test et
→ **SS + defter**

## Hafta 5 — Bildirimler, Gerçek Zamanlı Güncellemeler, Yorumlar

**29. Bildirim kurulumu**
- expo-notifications kurulumu, izin akışı (Android 13+/iOS)
→ **SS + defter**

**30. Etkinlik hatırlatma bildirimi**
- Etkinlikten 1 gün / 1 saat önce yerel bildirim planlama (`scheduleNotificationAsync`)
→ **SS + defter**

**31. Gerçek zamanlı katılımcı sayısı**
- Supabase Realtime ile biri katılınca sayının anlık güncellenmesi
→ **SS + defter**

**32. Yorumlar — veri modeli**
- `yorumlar` tablosu, etkinlik detay sayfasında yorum/tartışma bölümü
→ **SS + defter**

**33. Yorumlar — gerçek zamanlı**
- Yorum gönderme + Supabase Realtime ile anlık yorum akışı
→ **SS + defter**

**34. Favoriler**
- Favoriye ekle/çıkar (kalp ikonu), Favorilerim ekranı
→ **SS + defter**

**35. Hafta özeti**
- Bildirim + realtime katılım + yorum + favori akışlarını uçtan uca test et
→ **SS + defter**

## Hafta 6 — Cilalama, Test, Paketleme, Kapanış

**36. UI/UX cilalama**
- Dark/light mode, skeleton loading ekranları, tutarlı boşluk/renk/font
→ **SS + defter**

**37. Takvimi gerçek veriyle bağlama**
- Katıldığım/oluşturduğum etkinlikler takvimde gerçek veriyle işaretli
→ **SS + defter**

**38. Kapsamlı manuel test**
- 20+ senaryoyu (kayıt/giriş/CRUD/foto/konum/harita/katılım/bildirim/yorum/favori) test et, bug listesi çıkar
→ **SS + defter**

**39. Bug fixing ve performans**
- Kritik bugları düzelt, gereksiz re-render'ları optimize et
→ **SS + defter**

**40. README ve dokümantasyon**
- Proje açıklaması, kullanılan teknolojiler, ekran görüntüleri
→ **SS + defter**

**41. Paketleme**
- `eas build -p android` ile APK üret, telefonda test et
- GitHub'a push (public/private kararını sen ver)
→ **SS + defter**

**42. Kapanış**
- Genel değerlendirme yazısı (öğrenilenler, en zor kısım)
- Son ekran görüntülerini al, defteri tamamla
→ **SS + defter**

---

## Notlar

- Her SS + defter adımını o gün bitirmeden yap.
- Hatırlatma bildirimi, gerçek zamanlı katılımcı sayısı, harita, yorum akışı — dört ayrı ileri seviye teknik alan, 42 günü gerçek iş hacmiyle dolduruyor.
- Bitmiş proje gerçek bir portföy parçası — GitHub'a attığında CV'ine eklenir.
