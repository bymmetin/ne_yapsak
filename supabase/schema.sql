-- Ne Yapsak - ilk şema taslağı (Gün 7).
-- Bu dosyayı Supabase projenin SQL Editor'ünde çalıştır (Dashboard > SQL Editor > New query).
--
-- Kapsam notu: burada sadece tablo yapısı + foreign key'ler + RLS'in AÇILMASI var.
-- Detaylı erişim politikaları (kim okuyabilir/yazabilir) kasıtlı olarak eksik;
-- her tablonun politikaları kendi planlanmış gününde eklenecek:
--   etkinlikler -> Gün 14 (Tablo tasarımı ve RLS)
--   profiles    -> Gün 12 (Profil senkronizasyonu, otomatik satır oluşturma dahil)
--   katilimlar  -> Gün 21 (Katılım mantığı)
--   yorumlar    -> Gün 31-32 (Yorumlar, moderasyon)
--   favoriler   -> Gün 33 (Favoriler)
-- RLS açık ama politika olmadığı için şu an bu tablolara hiçbir istemci
-- erişemez (Supabase'in güvenli varsayılanı) - bu normal, kasıtlı.

-- profiles: auth.users'ı genişletir, 1-1 ilişki.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  ad text not null,
  soyad text not null,
  kullanici_adi text not null unique,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- profiles RLS politikaları (Gün 12).
-- Okuma herkese açık: ad/soyad/avatar gibi profil bilgileri etkinlik
-- listesinde/detayında organizatör ve katılımcı olarak herkese gösterilecek
-- (Gün 17+, Gün 22). Yazma ise sadece kendi satırına - insert politikası
-- kasıtlı yok, satırlar sadece aşağıdaki trigger (security definer) ile
-- oluşturuluyor, istemci doğrudan insert edemiyor.
create policy "profiles_herkese_acik_okuma" on public.profiles
  for select using (true);

create policy "profiles_sadece_kendi_guncelleme" on public.profiles
  for update using (auth.uid() = id);

-- Push bildirim altyapısı (Gün 28). "create table if not exists" yukarıdaki
-- ilk tanımda zaten var olan profiles tablosuna yeni kolon eklemiyor - proje
-- gerçek Supabase'e daha önce uygulandığı için bu ayrı bir "alter table" ile
-- yapılıyor (add column if not exists: script'i tekrar çalıştırmak güvenli
-- kalsın diye). Token'ı kim yazabilir sorusu yukarıdaki
-- profiles_sadece_kendi_guncelleme politikasıyla zaten çözülü - ayrı bir
-- politika gerekmiyor. Bu kolon SADECE toplanıyor; gerçek push gönderimi
-- (development build + FCM/APNs) bu 40 günlük kapsamın dışında, bkz.
-- services/notifications.ts.
alter table public.profiles add column if not exists expo_push_token text;

-- Kayıt olunca profiles tablosunda otomatik satır oluşturma (Gün 12).
-- signUp'a options.data ile gönderilen metadata (ad, soyad, kullanici_adi -
-- bkz. KayitScreen.tsx) Supabase tarafından auth.users.raw_user_meta_data
-- içine yazılıyor; bu fonksiyon her yeni auth.users satırında bunu okuyup
-- profiles'a kopyalıyor. security definer gerekli çünkü normal istemci
-- rolünün auth.users üzerinde trigger'la tetiklenen bir insert'ü
-- public.profiles'a yapabilmesi RLS ile kısıtlı; fonksiyon tanımlayanın
-- (postgres) yetkisiyle çalışıp bunu aşıyor. kullanici_adi alanına düşen
-- coalesce fallback'i (new.id), Google OAuth gibi bu metadata'yı
-- göndermeyen kayıt yollarında unique/not-null ihlaliyle tüm signUp'ın
-- başarısız olmasını önlemek için var.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, ad, soyad, kullanici_adi)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'ad', ''),
    coalesce(new.raw_user_meta_data ->> 'soyad', ''),
    coalesce(new.raw_user_meta_data ->> 'kullanici_adi', new.id::text)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Avatar yükleme için storage bucket'ı (Gün 12).
-- public true: avatar_url'i doğrudan <public-url> olarak <Image> ile
-- gösterebilmek için (imzalı URL/expiring link yönetmeye gerek kalmıyor).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Herkes okuyabilir (avatarlar zaten public bucket, bu politika olmadan da
-- select çalışır ama storage.objects RLS varsayılan kapalı gelmiyor,
-- açıkça yazmak daha güvenli).
create policy "avatars_herkese_acik_okuma" on storage.objects
  for select using (bucket_id = 'avatars');

-- Yükleme/güncelleme sadece kendi dosyasına: ProfilScreen.tsx dosyaları
-- "<kullanici_id>/avatar.<uzanti>" yoluna yazıyor, storage.foldername ilk
-- klasör segmentini (kullanici_id) döndürüyor.
create policy "avatars_sadece_kendi_yukleme" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_sadece_kendi_guncelleme" on storage.objects
  for update using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- etkinlikler
create table if not exists public.etkinlikler (
  id uuid primary key default gen_random_uuid(),
  organizator_id uuid not null references public.profiles (id) on delete cascade,
  baslik text not null,
  aciklama text not null,
  kategori text not null check (
    kategori in ('muzik', 'spor', 'sanat', 'yemek', 'egitim', 'teknoloji', 'diger')
  ),
  tarih date not null,
  saat time not null,
  konum_adres text not null,
  konum_lat double precision not null,
  konum_lng double precision not null,
  kapasite integer not null check (kapasite > 0),
  kapak_foto_url text,
  created_at timestamptz not null default now()
);

alter table public.etkinlikler enable row level security;

create index if not exists etkinlikler_tarih_idx on public.etkinlikler (tarih);
create index if not exists etkinlikler_organizator_id_idx on public.etkinlikler (organizator_id);

-- etkinlikler RLS politikaları (Gün 14).
-- Okuma herkese açık: Keşfet ekranı giriş yapmamış kullanıcıya da açık
-- olacağı için select politikası auth.uid() kontrolü yapmadan true döner.
create policy "etkinlikler_herkese_acik_okuma" on public.etkinlikler
  for select using (true);

-- Oluşturma: sadece giriş yapmış kullanıcı, ve sadece kendi id'sini
-- organizator_id olarak yazabilir (başkası adına etkinlik açamaz).
create policy "etkinlikler_organizator_olusturma" on public.etkinlikler
  for insert with check (auth.uid() = organizator_id);

-- Güncelleme/silme: sadece etkinliği oluşturan organizatör (Gün 18-19'da
-- düzenleme/iptal formlarının dayanacağı politika).
create policy "etkinlikler_organizator_guncelleme" on public.etkinlikler
  for update using (auth.uid() = organizator_id);

create policy "etkinlikler_organizator_silme" on public.etkinlikler
  for delete using (auth.uid() = organizator_id);

-- Etkinlik kapak fotoğrafı için storage bucket'ı (Gün 16).
-- Foto, henüz etkinlik satırı yokken (insert Gün 17'de) seçiliyor; bu yüzden
-- avatars'taki gibi sabit bir dosya adı yerine organizatörün id'si altında
-- zaman damgalı bir dosya adı kullanılıyor - bkz. EtkinlikOlusturScreen.tsx.
insert into storage.buckets (id, name, public)
values ('etkinlik-kapaklari', 'etkinlik-kapaklari', true)
on conflict (id) do nothing;

create policy "etkinlik_kapaklari_herkese_acik_okuma" on storage.objects
  for select using (bucket_id = 'etkinlik-kapaklari');

-- Yükleme sadece kendi klasörüne: "<organizator_id>/<zaman_damgasi>.<uzanti>".
-- Her seçimde yeni bir dosya adı üretildiği için (avatars'taki gibi upsert ile
-- üzerine yazma yok) update politikasına gerek yok.
create policy "etkinlik_kapaklari_sadece_kendi_yukleme" on storage.objects
  for insert with check (
    bucket_id = 'etkinlik-kapaklari' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Silme sadece kendi klasörüne: EtkinlikOlusturScreen.tsx'teki "Kaldır"
-- butonu (kaldirSec), henüz forma bağlanmamış bir kapak fotoğrafından
-- vazgeçilince storage.remove ile buraya düşüyor. Sekme değiştirip formdan
-- bu şekilde vazgeçme senaryosu (kullanıcı "Kaldır"a hiç basmadan ayrılırsa)
-- bu politikayla silinmiyor - o sahipsiz dosya senaryosunun temizliği
-- kasıtlı olarak kapsam dışı, ileride (Gün 35 cilalama gibi) toplu bir
-- orphan-dosya temizliğiyle ele alınabilir.
create policy "etkinlik_kapaklari_sadece_kendi_silme" on storage.objects
  for delete using (
    bucket_id = 'etkinlik-kapaklari' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- katilimlar: bir kullanıcının bir etkinlikteki katılım kaydı (en fazla bir tane).
create table if not exists public.katilimlar (
  id uuid primary key default gen_random_uuid(),
  etkinlik_id uuid not null references public.etkinlikler (id) on delete cascade,
  kullanici_id uuid not null references public.profiles (id) on delete cascade,
  katilim_tarihi timestamptz not null default now(),
  durum text not null default 'onaylandi' check (durum in ('onaylandi', 'beklemede', 'iptal')),
  unique (etkinlik_id, kullanici_id)
);

alter table public.katilimlar enable row level security;

create index if not exists katilimlar_etkinlik_id_idx on public.katilimlar (etkinlik_id);

-- katilimlar RLS politikaları (Gün 21).
-- Okuma herkese açık: "X/60 katılımcı" sayısını Keşfet'te girişsiz kullanıcı
-- da görebilmeli - etkinlikler_herkese_acik_okuma ile aynı gerekçe.
create policy "katilimlar_herkese_acik_okuma" on public.katilimlar
  for select using (true);

-- Oluşturma: sadece giriş yapmış kullanıcı, ve sadece kendi kullanici_id'siyle
-- (başkası adına katılım kaydı açamaz) - etkinlikler_organizator_olusturma'daki
-- aynı desen.
create policy "katilimlar_sadece_kendi_katilimi" on public.katilimlar
  for insert with check (auth.uid() = kullanici_id);

-- Silme: sadece kendi katılım kaydını. Gün 21'de eklenen EventDetailScreen.tsx
-- > startLeave ("Ayrıl" butonu), services/participations.ts'teki leaveEvent
-- ile bu politikaya dayanan bir .delete() çağırıyor.
create policy "katilimlar_sadece_kendi_silme" on public.katilimlar
  for delete using (auth.uid() = kullanici_id);

-- Gerçek zamanlı katılımcı sayısı (Gün 30). katilimlar tablosunu Supabase'in
-- yerleşik "supabase_realtime" publication'ına ekliyor - bu olmadan
-- postgres_changes aboneliği (bkz. EventDetailScreen.tsx) hiçbir olay
-- almaz. Sadece EventDetail'in ihtiyacı olan tablo eklendi, kapsam kasıtlı
-- olarak dar tutuldu (etkinlikler/profiles gibi diğer tablolar bu günün
-- kapsamında değil).
alter publication supabase_realtime add table public.katilimlar;

-- yorumlar
create table if not exists public.yorumlar (
  id uuid primary key default gen_random_uuid(),
  etkinlik_id uuid not null references public.etkinlikler (id) on delete cascade,
  kullanici_id uuid not null references public.profiles (id) on delete cascade,
  icerik text not null,
  created_at timestamptz not null default now()
);

alter table public.yorumlar enable row level security;

create index if not exists yorumlar_etkinlik_id_idx on public.yorumlar (etkinlik_id);

-- yorumlar RLS politikaları (Gün 31). Okuma herkese açık: etkinlikler/
-- katilimlar/puanlamalar ile aynı desen - Keşfet'e girişsiz gelen bir
-- kullanıcı da etkinlik detayındaki yorumları görebilmeli.
create policy "yorumlar_herkese_acik_okuma" on public.yorumlar
  for select using (true);

-- Oluşturma: sadece giriş yapmış kullanıcı, sadece kendi kullanici_id'siyle -
-- katilimlar_sadece_kendi_katilimi/puanlamalar_sadece_kendi_puani ile aynı
-- gerekçe. Update/delete politikası KASITLI olarak yok - puanlamalar'daki
-- gibi bir yorum gönderildikten sonra değiştirilemez/silinemez (bilinçli bir
-- basitleştirme, düzenleme/moderasyon Gün 32'nin kapsamı).
create policy "yorumlar_sadece_kendi_yorumu" on public.yorumlar
  for insert with check (auth.uid() = kullanici_id);

-- Gerçek zamanlı yorum akışı (Gün 32). katilimlar_realtime (Gün 30) ile aynı
-- gerekçe: yorumlar tablosunu supabase_realtime publication'ına eklemeden
-- postgres_changes aboneliği (bkz. EventDetailScreen.tsx) hiçbir olay almaz.
alter publication supabase_realtime add table public.yorumlar;

-- sikayetler: bir yorumun şikayet edilme kaydı (Gün 32). Kapsam kasıtlı dar
-- tutuldu - inceleyecek bir moderasyon paneli yok, bu yüzden select
-- politikası YOK; istemciler sadece kendi şikayetlerini insert edebiliyor,
-- kimse (şikayet eden dahil) geri okuyamıyor. sebep opsiyonel (nullable) -
-- kullanıcı boş geçebilir.
create table if not exists public.sikayetler (
  id uuid primary key default gen_random_uuid(),
  sikayet_eden_id uuid not null references public.profiles (id) on delete cascade,
  yorum_id uuid not null references public.yorumlar (id) on delete cascade,
  sebep text,
  created_at timestamptz not null default now()
);

alter table public.sikayetler enable row level security;

create policy "sikayetler_sadece_kendi_sikayeti" on public.sikayetler
  for insert with check (auth.uid() = sikayet_eden_id);

-- engellemeler: bir kullanıcının başka bir kullanıcıyı engelleme kaydı
-- (Gün 32). unique(engelleyen_id, engellenen_id) aynı kullanıcıyı iki kez
-- engellemeyi DB seviyesinde engelliyor. Okuma politikası SADECE kendi
-- engelleyen_id'siyle - services/moderation.ts > getBlockedUserIds bunu
-- kullanarak "ben kimi engelledim" listesini çekip services/comments.ts >
-- getComments'te filtrelemek için kullanıyor; başkasının kimi engellediğini
-- okumak kapsam dışı. Unblock (engeli kaldırma) arayüzü kasıtlı olarak yok -
-- Gün 32 kapsamının dışında bırakıldı.
create table if not exists public.engellemeler (
  id uuid primary key default gen_random_uuid(),
  engelleyen_id uuid not null references public.profiles (id) on delete cascade,
  engellenen_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (engelleyen_id, engellenen_id)
);

alter table public.engellemeler enable row level security;

create policy "engellemeler_sadece_kendi_engellemesi_okuma" on public.engellemeler
  for select using (auth.uid() = engelleyen_id);

create policy "engellemeler_sadece_kendi_engellemesi_ekleme" on public.engellemeler
  for insert with check (auth.uid() = engelleyen_id);

-- puanlamalar: bir kullanıcının bir etkinliğe verdiği tek seferlik 1-5 yıldız
-- değerlendirmesi + opsiyonel yorum (Gün 29). Aşağıdaki "yorumlar" tablosundan
-- (Gün 31-32, genel tartışma/yorum akışı) KASITLI olarak ayrı - biri
-- değerlendirme puanı, diğeri serbest tartışma; birbirine karıştırılmamalı.
create table if not exists public.puanlamalar (
  id uuid primary key default gen_random_uuid(),
  etkinlik_id uuid not null references public.etkinlikler (id) on delete cascade,
  kullanici_id uuid not null references public.profiles (id) on delete cascade,
  puan integer not null check (puan between 1 and 5),
  yorum text,
  created_at timestamptz not null default now(),
  unique (etkinlik_id, kullanici_id)
);

alter table public.puanlamalar enable row level security;

create index if not exists puanlamalar_etkinlik_id_idx on public.puanlamalar (etkinlik_id);

-- Okuma herkese açık: diğer tablolarla (etkinlikler, katilimlar) aynı desen -
-- ileride etkinlik detayında ortalama puan/yorumlar gösterilebilsin diye.
create policy "puanlamalar_herkese_acik_okuma" on public.puanlamalar
  for select using (true);

-- Oluşturma: sadece giriş yapmış kullanıcı, sadece kendi kullanici_id'siyle -
-- katilimlar_sadece_kendi_katilimi ile aynı gerekçe. unique(etkinlik_id,
-- kullanici_id) kısıtı "bir kullanıcı bir etkinliği en fazla bir kez
-- puanlayabilir" kuralını DB seviyesinde zaten garanti ediyor - services/
-- ratings.ts > submitRating bu ihlali (Postgres kodu '23505') RatingScreen'de
-- normal bir hata değil, beklenen bir durum olarak ele alıyor. Update/delete
-- politikası kasıtlı yok - bir puanlama verildikten sonra değiştirilemez/
-- silinemez, bu planın kapsamı dışı.
create policy "puanlamalar_sadece_kendi_puani" on public.puanlamalar
  for insert with check (auth.uid() = kullanici_id);

-- favoriler: bir kullanıcının bir etkinliği en fazla bir kez favorileyebilmesi.
create table if not exists public.favoriler (
  id uuid primary key default gen_random_uuid(),
  etkinlik_id uuid not null references public.etkinlikler (id) on delete cascade,
  kullanici_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (etkinlik_id, kullanici_id)
);

alter table public.favoriler enable row level security;

create index if not exists favoriler_kullanici_id_idx on public.favoriler (kullanici_id);

-- favoriler RLS politikaları (Gün 33). katilimlar/yorumlar/puanlamalar'ın
-- aksine okuma da SADECE kendi kullanici_id'siyle - kimin hangi etkinliği
-- favorilediği başkalarına görünmemeli, bu bilinçli bir gizlilik tercihi
-- (bkz. services/favorites.ts > getFavoriteEventIds/getFavoriteEvents,
-- ikisi de zaten sadece giriş yapmış kullanıcının kendi id'siyle sorgu
-- atıyor, bu politika bunu sunucu tarafında da zorunlu kılıyor).
create policy "favoriler_sadece_kendi_favorisi_okuma" on public.favoriler
  for select using (auth.uid() = kullanici_id);

create policy "favoriler_sadece_kendi_favorisi_ekleme" on public.favoriler
  for insert with check (auth.uid() = kullanici_id);

create policy "favoriler_sadece_kendi_favorisi_silme" on public.favoriler
  for delete using (auth.uid() = kullanici_id);
