# Proje: Ne Yapsak

Randevu/Etkinlik Organizasyon Uygulaması — React Native + Expo + TypeScript + Supabase.

## Bağlam
Bu proje 42 günlük bir staj planına göre ilerliyor. Planın tamamı `plan.md` dosyasında.
Her gün SADECE o günün checklist maddelerini uygula. Önceki günlerde biten işi bozma,
sonraki günlerin işini şimdiden yapma — plan sırasını koru.

Bir günün maddesini uygulamanı istediğimde şu formatta söyleyeceğim:
"Plan dosyasındaki Gün X'i uygula" veya "Gün X, madde Y'yi uygula".
Önce plan.md içinden ilgili günü oku, sonra uygula.

## Teknoloji ve Konvansiyonlar
- Expo (managed workflow), TypeScript strict mode
- Klasör yapısı: screens/, components/, types/, services/, constants/
- State yönetimi: Context API (özellikle auth için) — gerekmedikçe ekstra state
  kütüphanesi ekleme
- Supabase anahtarları `.env` içinde tutulur, asla koda gömülmez
- ESLint/Prettier kurallarına uy

## Çalıştırma / Test
- `npx expo start` ile başlat
- Bir değişiklik yaptıktan sonra bana tam olarak nasıl test edeceğimi söyle
  (hangi ekran, hangi adım, ne görmem gerekiyor)

## Git
- Commit mesajı formatı: `Gün X: kısa özet` (X = plandaki gün numarası)
- Günün sonunda commit at, commit mesajını sen öner

## Beklenti
Kodu yaz ama NEDEN öyle yazdığını da kısaca açıkla (2-3 cümle yeter).
Bunları staj defterime yazacağım — gerçekten ne yapıldığını anlamam lazım,
sadece çalışan kod yeterli değil.
