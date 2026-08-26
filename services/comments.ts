// Gün 31: yorumlar tablosu erişimi (İngilizce dosya adı - Gün 21'deki
// services/ dosyalarını İngilizceleştirme kararına uygun). puanlamalar
// (Gün 29, tek seferlik 1-5 yıldız değerlendirmesi) ile KARIŞTIRMA - bu,
// etkinlik detayındaki serbest tartışma/yorum akışı.

import { supabase } from './supabase';
import { getBlockedUserIds } from './moderation';

// profiles(ad, soyad, avatar_url) embed'i tek satır dönüyor çünkü
// kullanici_id -> profiles.id çoktan-bire bir ilişki - services/
// participations.ts > getConfirmedParticipants'taki aynı desen.
type CommentRow = {
  id: string;
  etkinlik_id: string;
  kullanici_id: string;
  icerik: string;
  created_at: string;
  profiles: { ad: string; soyad: string; avatar_url: string | null } | null;
};

// types/index.ts > Comment'e yazarın adı/avatarı eklenmiş hali - liste
// gösterimi bunlar olmadan anlamsız olurdu, EventDetailScreen'de ayrıca bir
// profiles sorgusu yapmaya gerek kalmasın diye tek sorguda embed ediliyor.
export type CommentWithAuthor = {
  id: string;
  eventId: string;
  userId: string;
  content: string;
  createdAt: string;
  authorFirstName: string;
  authorLastName: string;
  authorAvatarUrl: string | null;
};

function rowToComment(row: CommentRow): CommentWithAuthor {
  return {
    id: row.id,
    eventId: row.etkinlik_id,
    userId: row.kullanici_id,
    content: row.icerik,
    createdAt: row.created_at,
    authorFirstName: row.profiles?.ad ?? '',
    authorLastName: row.profiles?.soyad ?? '',
    authorAvatarUrl: row.profiles?.avatar_url ?? null,
  };
}

// created_at ARTAN sırada (en eski üstte) - bir sohbet gibi okunsun diye,
// diğer listelerin (ör. getAttendedEvents) çoğunlukla kullandığı "en yeni
// üstte" sıralamasının tersi, bilinçli bir tercih.
//
// Gün 32: currentUserId verilirse (girişsiz kullanıcı için null/undefined
// geçilebilir - engellemeler_sadece_kendi_engellemesi_okuma RLS'i zaten
// girişsiz erişimde boş döner), kullanıcının engellediği kişilerin yorumları
// sonuçtan çıkarılır. Bu istemci tarafında bir filtre - RLS seviyesinde değil
// (yorumlar_herkese_acik_okuma hâlâ true, bkz. schema.sql) çünkü engelleme
// kişiye özel bir görünürlük tercihi, herkesten gizlenmesi gereken bir veri
// değil.
export async function getComments(
  eventId: string,
  currentUserId?: string | null,
): Promise<CommentWithAuthor[]> {
  const { data, error } = await supabase
    .from('yorumlar')
    .select('id, etkinlik_id, kullanici_id, icerik, created_at, profiles(ad, soyad, avatar_url)')
    .eq('etkinlik_id', eventId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  const comments = ((data ?? []) as unknown as CommentRow[]).map(rowToComment);

  if (!currentUserId) {
    return comments;
  }

  const blockedUserIds = await getBlockedUserIds(currentUserId);
  if (blockedUserIds.length === 0) {
    return comments;
  }

  const blocked = new Set(blockedUserIds);
  return comments.filter((comment) => !blocked.has(comment.userId));
}

export async function addComment(eventId: string, userId: string, content: string): Promise<void> {
  const { error } = await supabase
    .from('yorumlar')
    .insert({ etkinlik_id: eventId, kullanici_id: userId, icerik: content });

  if (error) {
    throw error;
  }
}
