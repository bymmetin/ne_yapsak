// Gün 32: yorum şikayeti (sikayetler) ve kullanıcı engelleme (engellemeler)
// - services/comments.ts'ten (yorum listesi/gönderme) kasıtlı ayrı, çünkü bu
// ikisi comments.ts'in ilgilendiği "yorumlar" tablosundan farklı iki tabloya
// yazıyor/okuyor - participations.ts/ratings.ts'in kendi tablosuna sahip
// olması ile aynı desen.

import { supabase } from './supabase';

// schema.sql > sikayetler_sadece_kendi_sikayeti RLS'i zaten auth.uid() =
// sikayet_eden_id şart koşuyor; reporterId burada da aynı kısıtı tekrarlıyor
// ki yanlışlıkla başka bir kullanıcı adına şikayet oluşturulmasın -
// participations.ts > leaveEvent'teki aynı savunma tekrarı.
export async function reportComment(
  reporterId: string,
  commentId: string,
  reason: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('sikayetler')
    .insert({ sikayet_eden_id: reporterId, yorum_id: commentId, sebep: reason });

  if (error) {
    throw error;
  }
}

// unique(engelleyen_id, engellenen_id) kısıtı (schema.sql) aynı kullanıcıyı
// iki kez engellemeyi DB seviyesinde zaten engelliyor - ratings.ts >
// submitRating'deki unique kısıt kararıyla aynı gerekçe, burada ayrıca bir
// "zaten engellemiş mi" kontrolü tekrarlanmıyor.
export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase
    .from('engellemeler')
    .insert({ engelleyen_id: blockerId, engellenen_id: blockedId });

  if (error) {
    throw error;
  }
}

// services/comments.ts > getComments'in "kendi engellediklerimin yorumlarını
// gösterme" filtresi için - engellemeler_sadece_kendi_engellemesi_okuma RLS'i
// zaten sadece kendi engelleyen_id'sini okumaya izin veriyor, userId
// parametresi burada o filtreyi tekrarlıyor.
export async function getBlockedUserIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('engellemeler')
    .select('engellenen_id')
    .eq('engelleyen_id', userId);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => row.engellenen_id as string);
}
