// Gün 29: puanlamalar tablosu erişimi. Gün 31-32'de eklenecek "yorumlar"
// (genel tartışma) tablosundan AYRI bir sorumluluk - bkz. supabase/schema.sql
// > puanlamalar notu ve types/index.ts > Rating.

import { supabase } from './supabase';
import { Rating } from '../types';

type RatingRow = {
  id: string;
  etkinlik_id: string;
  kullanici_id: string;
  puan: number;
  yorum: string | null;
  created_at: string;
};

function rowToRating(row: RatingRow): Rating {
  return {
    id: row.id,
    eventId: row.etkinlik_id,
    userId: row.kullanici_id,
    score: row.puan,
    comment: row.yorum,
    createdAt: row.created_at,
  };
}

// RatingScreen açılışında "zaten değerlendirmiş mi" kontrolü için - varsa
// yıldız seçiciyi hiç göstermeden doğrudan "zaten değerlendirdin" mesajı
// gösteriliyor. submitRating'teki unique-constraint yakalama bunun ikinci bir
// savunma katmanı (ör. iki sekmeden aynı anda gönderme durumu).
export async function getMyRating(eventId: string, userId: string): Promise<Rating | null> {
  const { data, error } = await supabase
    .from('puanlamalar')
    .select('id, etkinlik_id, kullanici_id, puan, yorum, created_at')
    .eq('etkinlik_id', eventId)
    .eq('kullanici_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? rowToRating(data as RatingRow) : null;
}

// unique(etkinlik_id, kullanici_id) kısıtı ihlali Postgres'te '23505' kodu
// olarak dönüyor - RatingScreen bunu yakalayıp "zaten değerlendirdin"
// mesajını normal bir hata değil, beklenen bir durum olarak gösteriyor.
export const ALREADY_RATED_ERROR_CODE = '23505';

export async function submitRating(
  eventId: string,
  userId: string,
  score: number,
  comment: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('puanlamalar')
    .insert({ etkinlik_id: eventId, kullanici_id: userId, puan: score, yorum: comment });

  if (error) {
    throw error;
  }
}
