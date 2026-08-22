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
