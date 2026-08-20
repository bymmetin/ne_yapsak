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
