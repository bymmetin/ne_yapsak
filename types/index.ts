// Uygulama genelinde kullanılan temel veri modelleri.
// supabase/schema.sql'deki tablolara karşılık gelir (Gün 7). Gerçek sorgular
// bağlanınca (Gün 17+) snake_case DB satırlarından bu camelCase tiplere
// dönüşüm burada değil, ilgili servis fonksiyonunda yapılacak.

export type Kategori = 'muzik' | 'spor' | 'sanat' | 'yemek' | 'egitim' | 'teknoloji' | 'diger';

export interface Kullanici {
  id: string;
  ad: string;
  soyad: string;
  kullaniciAdi: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  olusturulmaTarihi: string;
}

export interface Etkinlik {
  id: string;
  organizatorId: string;
  baslik: string;
  aciklama: string;
  kategori: Kategori;
  tarih: string;
  saat: string;
  konum: {
    adres: string;
    enlem: number;
    boylam: number;
  };
  kapasite: number;
  katilimciSayisi: number;
  kapakFotoUrl: string | null;
  olusturulmaTarihi: string;
}

export interface Katilim {
  id: string;
  etkinlikId: string;
  kullaniciId: string;
  katilimTarihi: string;
  durum: 'onaylandi' | 'beklemede' | 'iptal';
}

export interface Yorum {
  id: string;
  etkinlikId: string;
  kullaniciId: string;
  icerik: string;
  olusturulmaTarihi: string;
}

export interface Favori {
  id: string;
  etkinlikId: string;
  kullaniciId: string;
  olusturulmaTarihi: string;
}
