// Gün 17: Keşfet ekranındaki mock veriyi burada gerçek Supabase sorgularıyla
// besliyoruz. Satır -> Etkinlik dönüşümü (snake_case -> camelCase, bkz.
// types/index.ts'teki not) tek yerde toplanıyor ki KesfetScreen ve
// EtkinlikDetayScreen aynı şekli üretsin.

import { supabase } from './supabase';
import { Etkinlik, Kategori } from '../types';

export const ETKINLIK_SAYFA_BOYUTU = 10;

const SECILECEK_ALANLAR =
  'id, organizator_id, baslik, aciklama, kategori, tarih, saat, konum_adres, konum_lat, konum_lng, kapasite, kapak_foto_url, created_at';

type EtkinlikSatiri = {
  id: string;
  organizator_id: string;
  baslik: string;
  aciklama: string;
  kategori: Kategori;
  tarih: string;
  saat: string;
  konum_adres: string;
  konum_lat: number;
  konum_lng: number;
  kapasite: number;
  kapak_foto_url: string | null;
  created_at: string;
};

function satiriEtkinligeDonustur(satir: EtkinlikSatiri): Etkinlik {
  return {
    id: satir.id,
    organizatorId: satir.organizator_id,
    baslik: satir.baslik,
    aciklama: satir.aciklama,
    kategori: satir.kategori,
    tarih: satir.tarih,
    saat: satir.saat,
    konum: {
      adres: satir.konum_adres,
      enlem: satir.konum_lat,
      boylam: satir.konum_lng,
    },
    kapasite: satir.kapasite,
    // katilimlar tablosu henüz yok (Gün 21); gerçek katılımcı sayısı o güne
    // kadar hep 0 - ProfilScreen.tsx'teki katildigiEtkinlikSayisi'yle aynı kabul.
    katilimciSayisi: 0,
    kapakFotoUrl: satir.kapak_foto_url,
    olusturulmaTarihi: satir.created_at,
  };
}

export type EtkinlikSayfasi = {
  etkinlikler: Etkinlik[];
  sonSayfaMi: boolean;
};

// sayfa 0-tabanlı. Yaklaşan etkinlikler önce görünsün diye tarih/saat artan
// sırada listeleniyor; bu güne bir tarih filtresi (geçmiş etkinlikleri gizleme
// gibi) eklenmedi - "Bugün/Bu hafta/Bu ay" filtreleri Gün 26'nın kapsamı.
export async function etkinlikleriGetir(sayfa: number): Promise<EtkinlikSayfasi> {
  const basla = sayfa * ETKINLIK_SAYFA_BOYUTU;
  const bitis = basla + ETKINLIK_SAYFA_BOYUTU - 1;

  const { data, error } = await supabase
    .from('etkinlikler')
    .select(SECILECEK_ALANLAR)
    .order('tarih', { ascending: true })
    .order('saat', { ascending: true })
    .range(basla, bitis);

  if (error) {
    throw error;
  }

  const satirlar = (data ?? []) as EtkinlikSatiri[];
  return {
    etkinlikler: satirlar.map(satiriEtkinligeDonustur),
    sonSayfaMi: satirlar.length < ETKINLIK_SAYFA_BOYUTU,
  };
}

export async function etkinlikGetir(id: string): Promise<Etkinlik | null> {
  const { data, error } = await supabase
    .from('etkinlikler')
    .select(SECILECEK_ALANLAR)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? satiriEtkinligeDonustur(data as EtkinlikSatiri) : null;
}
