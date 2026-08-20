# 40 Günlük Mobil Uygulama Geliştirme Planı
### Proje: Ne Yapsak — Randevu/Etkinlik Organizasyon Uygulaması (React Native + Expo + TypeScript + Supabase)

---

## Nasıl Kullanılır

1. Her gün, o güne ait TÜM alt maddeleri **gerçekten yap**.
2. Gün bitince **"→ SS + defter"** işaretine geldiğinde: o anki ekranın gerçek ekran görüntüsünü al, hemen resmi şablonu doldurup günlük girişini yaz.
3. Bir gün bittiremezsen, ertesi günün alt maddeleriyle birleştirip devam et.
4. Terminal/Claude Code kurulumu daha önce konuştuğumuzla aynı — proje klasörünü `mkdir ne_yapsak && cd ne_yapsak` ile aç.

---

## Günlük Giriş Şablonu (Resmi Format)

Resmi staj defterindeki ayrı, boş faaliyet sayfasına yazılacak format: tek gün, resmi/edilgen dilde akıcı bir paragraf, madde madde değil.

```
İş Günü: X
Tarih: ..../..../2026

FAALİYETLER
[Resmi, edilgen dilde, 3-5 cümlelik tek paragraf. Ne yapıldığı, hangi
araç/teknikle yapıldığı, hangi sonuca ulaşıldığı. "...yapılmıştır",
"...oluşturulmuştur", "...gerçekleştirilmiştir" gibi kalıplar kullan.]

[Ekran görüntüsü — gerçek uygulama/kod ekranı]
```

---

## Hafta 1 — Proje Temeli, Navigasyon, Statik Ekranlar (Gün 1-6)

**1. Kurulum ve proje yapısı**
- Expo + TypeScript projesi oluştur (`ne_yapsak`), klasör yapısını kur (screens/, components/, types/, services/, constants/)
- Renk paleti ve tipografi sabitlerini tanımla
- Git reposunu başlat, ilk commit
→ **SS + defter** *(tamamlandı)*

**2. Veri modelleri ve tip sistemi**
- TypeScript interface'leri: `Etkinlik`, `Kullanici`, `Katilim`, `Kategori`, `Yorum`
- tsconfig strict mode, ESLint/Prettier kur
- 10-15 örnek etkinliklik mock veri seti
→ **SS + defter** *(tamamlandı)*

**3. Navigasyon iskeleti**
- Bottom Tabs: Keşfet, Takvim, Etkinlik Oluştur, Bildirimler, Profil (5 sekme)
- İkon seti, aktif/pasif tab renkleri, header stilleri
→ **SS + defter** *(tamamlandı)*

**4. Keşfet ekranı — liste**
- FlatList ile mock veriyle etkinlik listesi
- `EtkinlikKarti` component (kapak fotoğrafı, başlık, tarih, katılımcı sayısı, kategori etiketi)
- Pull-to-refresh davranışı
- Boş liste / yükleniyor / hata durumları için placeholder bileşenleri (ilerideki haftalarda gerçek veriyle tekrar kullanılacak)
→ **SS + defter** *(tamamlandı)*

**5. Etkinlik detay ekranı**
- Açıklama, tarih/saat, konum, katılımcı avatarları (mock veriyle), "Katıl" butonu
→ **SS + defter** *(tamamlandı)*

**6. Takvim, profil iskeleti ve hafta özeti**
- `react-native-calendars` ile aylık takvim görünümü, etkinlik günleri işaretli
- Profil ekranı iskeleti (avatar, düzenlediğim/katıldığım etkinlik sayacı)
- Tüm hafta boyunca yapılan ekranları gözden geçir, tutarsız stilleri düzelt, klasör yapısını temizle
→ **SS + defter** *(tamamlandı)*

## Hafta 2 — Supabase Backend Kurulumu ve Kimlik Doğrulama (Gün 7-13)

**7. Supabase kurulumu ve şema tasarımı**
- Supabase projesi aç, tabloları tasarla (etkinlikler, profiles, katilimlar, yorumlar, favoriler)
- `@supabase/supabase-js` kur, `.env` yönetimi
→ **SS + defter**

**8. Kayıt akışı**
- Kayıt formu + validasyon
- `supabase.auth.signUp` entegrasyonu
- E-posta doğrulama bekleme ekranı: "tekrar gönder" butonu, doğrulama linkinden döndükten sonra oturumu yakalama
→ **SS + defter**

**9. Giriş akışı**
- Giriş formu + `supabase.auth.signInWithPassword`
- "Şifremi Unuttum" akışı
- Google ile giriş (Supabase OAuth) entegrasyonu
→ **SS + defter**

**10. Global auth state**
- Context API ile `AuthContext`, `onAuthStateChange` dinleyicisi
- Girişsiz kullanıcının korumalı ekranlara erişimini engelleme
→ **SS + defter**

**11. Çıkış ve hata mesajları**
- `signOut`, yanlış şifre / var olan e-posta gibi durumlarda net mesaj
→ **SS + defter**

**12. Profil senkronizasyonu**
- `profiles` tablosu, kayıt olunca otomatik profil satırı
- Avatar yükleme (expo-image-picker + Supabase Storage)
→ **SS + defter**

**13. Hafta özeti**
- Kayıt (e-posta doğrulama dahil) → Google ile giriş → normal giriş → profil düzenleme → çıkış akışını uçtan uca test et
→ **SS + defter**

## Hafta 3 — Etkinlik CRUD ve Fotoğraf Yönetimi (Gün 14-20)

**14. Tablo tasarımı ve RLS**
- `etkinlikler` tablosu (id, organizator_id, baslik, aciklama, kategori, tarih, saat, konum_lat, konum_lng, kapasite, kapak_foto, created_at)
- RLS: okuma herkese açık, yazma/silme sadece organizatöre
→ **SS + defter**

**15. Etkinlik oluşturma formu — adım 1**
- Başlık/açıklama/kategori/tarih-saat seçici (date-time picker)
- React Hook Form + Zod ile form validasyonu, satır içi hata mesajları
→ **SS + defter**

**16. Kapak fotoğrafı**
- expo-image-picker ile fotoğraf seçme, Supabase Storage'a yükleme
→ **SS + defter**

**17. Yayınlama ve gerçek listeleme**
- Formu Supabase `insert`'e bağla
- Keşfet ekranındaki mock veriyi gerçek `select` sorgusuyla değiştir
- Sayfalama (infinite scroll) ile performanslı listeleme
→ **SS + defter**

**18. Etkinlik düzenleme**
- "Etkinliklerim" ekranından sadece organizatörün düzenleyebildiği form
→ **SS + defter**

**19. Etkinlik iptali**
- Silme/iptal etme (onay diyaloglu), katılımcılara bildirim tetikleme mantığının taslağı
→ **SS + defter**

**20. Hafta özeti**
- Loading/empty/error state'lerini, form validasyon edge-case'lerini ve sayfalama performansını gözden geçir, tüm CRUD senaryolarını test et
→ **SS + defter**

## Hafta 4 — Katılım, Konum, Harita (Gün 21-27)

**21. Katılım mantığı**
- `katilimlar` tablosu, "Katıl" butonuyla insert
- Kapasite dolunca "Bekleme Listesine Katıl" seçeneği
- Biri etkinlikten ayrılınca sıradaki kişiye bildirim tetikleme mantığının taslağı
→ **SS + defter**

**22. Katılımcı listesi ve paylaşım**
- Etkinlik detayında gerçek katılımcıları avatarlarıyla listeleme
- Etkinliği link ile paylaşma (share sheet + deep link ile uygulamada açılış)
→ **SS + defter**

**23. Konum izinleri**
- expo-location kurulumu, izin akışı
- Etkinlik oluştururken haritadan konum seçme
→ **SS + defter**

**24. Harita ekranı — temel**
- react-native-maps ile etkinlikleri pin olarak gösterme, pin'e tıklayınca mini kart
→ **SS + defter**

**25. Harita — kümeleme ve filtre**
- Yakın pinleri kümeleme (cluster), haritadan kategori filtreleme
→ **SS + defter**

**26. Arama ve tarih filtreleme**
- Başlık/açıklamada arama (`ilike`)
- "Bugün / Bu hafta / Bu ay" tarih aralığı filtresi
→ **SS + defter**

**27. Hafta özeti**
- Arama+filtre+harita+katılım+bekleme listesi+paylaşım kombinasyonlarını test et
→ **SS + defter**

## Hafta 5 — Bildirimler, Gerçek Zamanlı Güncellemeler, Yorumlar (Gün 28-34)

**28. Bildirim kurulumu**
- expo-notifications kurulumu, izin akışı (Android 13+/iOS)
→ **SS + defter**

**29. Etkinlik hatırlatma ve değerlendirme bildirimi**
- Etkinlikten 1 gün / 1 saat önce yerel bildirim planlama (`scheduleNotificationAsync`)
- Etkinlik bitince değerlendirme daveti bildirimi + 1-5 yıldız ve yorum ile puanlama ekranı
→ **SS + defter**

**30. Gerçek zamanlı katılımcı sayısı**
- Supabase Realtime ile biri katılınca sayının anlık güncellenmesi
→ **SS + defter**

**31. Yorumlar — veri modeli**
- `yorumlar` tablosu, etkinlik detay sayfasında yorum/tartışma bölümü
→ **SS + defter**

**32. Yorumlar — gerçek zamanlı ve moderasyon**
- Yorum gönderme + Supabase Realtime ile anlık yorum akışı
- Yorum/kullanıcı şikayet etme (report) ve engelleme (block) temel akışı
→ **SS + defter**

**33. Favoriler**
- Favoriye ekle/çıkar (kalp ikonu), Favorilerim ekranı
→ **SS + defter**

**34. Hafta özeti**
- Bildirim + realtime katılım + yorum + favori + puanlama + şikayet/engelleme akışlarını uçtan uca test et
→ **SS + defter**

## Hafta 6 — Cilalama, Test, Paketleme, Kapanış (Gün 35-40)

**35. UI/UX cilalama ve erişilebilirlik**
- Dark/light mode, skeleton loading ekranları, tutarlı boşluk/renk/font
- Erişilebilirlik (accessibility) denetimi: kontrast oranları, dokunma alanı boyutları, ekran okuyucu etiketleri
→ **SS + defter**

**36. Takvimi gerçek veriyle bağlama**
- Katıldığım/oluşturduğum etkinlikler takvimde gerçek veriyle işaretli
→ **SS + defter**

**37. Kapsamlı test — manuel ve otomatik**
- 20+ senaryoyu (kayıt/giriş/CRUD/foto/konum/harita/katılım/bildirim/yorum/favori/puanlama) manuel test et, bug listesi çıkar
- Kritik akışlar (giriş, etkinlik oluşturma, katılım) için Jest ile birkaç otomatik test yaz
→ **SS + defter**

**38. Bug fixing ve performans**
- Kritik bugları düzelt, gereksiz re-render'ları optimize et
→ **SS + defter**

**39. README, dokümantasyon ve CI**
- Proje açıklaması, kullanılan teknolojiler, ekran görüntüleri
- GitHub Actions ile push sonrası otomatik testleri çalıştıran basit bir CI pipeline kurulumu
→ **SS + defter**

**40. Paketleme ve kapanış**
- `eas build -p android` ile APK üret, telefonda test et
- GitHub'a push (public/private kararını sen ver)
- Genel değerlendirme yazısı (öğrenilenler, en zor kısım), son ekran görüntülerini al, defteri tamamla
→ **SS + defter**

---

## Notlar

- Toplam 40 iş günü — resmi kabul yazısındaki süreyle eşleşecek şekilde ayarlandı.
- Her SS + defter adımını o gün bitirmeden yap.
- E-posta doğrulama, Google ile giriş, form validasyonu, sayfalama, bekleme listesi, etkinlik paylaşımı, etkinlik puanlama, kullanıcı şikayet/engelleme, otomatik test ve CI eklendi — kapsam, 40 günün tamamının gerçek iş hacmiyle dolu kalması için genişletildi.
- Resmi staj defterindeki günlük faaliyet sayfasına FAALİYETLER paragrafını elle/yazıcıyla işle, ekran görüntüsünü ekle, gerekli imza alanlarını (öğrenci, varsa denetçi öğretim elemanı / kurum yetkilisi) unutma.
- Bitmiş proje gerçek bir portföy parçası — GitHub'a attığında CV'ine eklenir.
