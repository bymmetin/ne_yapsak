// Gün 21: Katılım mantığı. katilimlar tablosuna insert ve "zaten katıldım mı"
// kontrolü burada - events.ts'teki satır<->Event dönüşümünden ayrı bir
// sorumluluk olduğu için kendi dosyasında tutuluyor.

import { supabase } from './supabase';
import { getBlockedUserIds } from './moderation';

// schema.sql'deki katilimlar.durum kısıtıyla aynı (iptal burada yok - "ayrılma"
// satırı silerek yapılıyor, durumu 'iptal'e çekmiyor, bkz. leaveEvent).
export type ParticipationStatus = 'onaylandi' | 'beklemede';

// EventDetailScreen açılışında "Katıl" butonunun doğru durumda (Katıldın ✓ /
// Bekleme Listesindesin / Katıl) başlayabilmesi için - kullanıcı bu etkinliğe
// daha önce (örn. farklı bir oturumda ya da scripts/demo-seed.js ile)
// katılmış ya da bekleme listesine girmiş olabilir.
export async function getParticipationStatus(
  eventId: string,
  userId: string,
): Promise<ParticipationStatus | null> {
  const { data, error } = await supabase
    .from('katilimlar')
    .select('durum')
    .eq('etkinlik_id', eventId)
    .eq('kullanici_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? (data.durum as ParticipationStatus) : null;
}

// EventDetailScreen > startJoin'in kapasite kararı - network'ten bağımsız,
// saf bir fonksiyon olarak burada tutuluyor ki Jest ile (Gün 37) mock
// Supabase'e ihtiyaç duymadan test edilebilsin. ">=" kasıtlı: kapasite
// participantCount'a eşitse (son yer az önce dolmuşsa) de bekleme listesine
// düşülüyor, sadece kapasiteyi AŞANLAR değil.
export function resolveJoinStatus(participantCount: number, capacity: number): ParticipationStatus {
  return participantCount >= capacity ? 'beklemede' : 'onaylandi';
}

// unique (etkinlik_id, kullanici_id) kısıtı (schema.sql) aynı kullanıcının
// aynı etkinliğe iki kez katılmasını zaten engelliyor; burada ayrıca bir
// "zaten katılmış mı" kontrolü tekrarlanmıyor - çağıran ekran
// (EventDetailScreen) zaten bir durum varken "Katıl"/"Bekleme Listesine
// Katıl" butonunu hiç göstermiyor. Kapasite dolulukunun kontrolü (dolu ->
// durum='beklemede', boş -> durum='onaylandi') de kasıtlı olarak burada
// değil, çağıran ekranda (client-side) yapılıyor - DB seviyesinde bir
// kapasite kısıtı yok, bu yüzden aynı anda iki kişinin son kontenjanı
// doldurması teorik olarak mümkün; bunu DB seviyesinde (örn. trigger ile)
// tam çözmek bu günün kapsamı dışı.
export async function joinEvent(
  eventId: string,
  userId: string,
  durum: ParticipationStatus = 'onaylandi',
): Promise<void> {
  const { error } = await supabase
    .from('katilimlar')
    .insert({ etkinlik_id: eventId, kullanici_id: userId, durum });

  if (error) {
    throw error;
  }
}

// Gün 21: Biri (onaylı bir katılımcı) etkinlikten ayrılınca sıradaki bekleme
// listesi kaydına bildirim tetiklemek (bkz. services/notifications.ts) için
// "sırada kim var" sorusunu cevaplar. katilim_tarihi artan sırada - ilk
// bekleyen kazanır (FIFO). Otomatik olarak 'onaylandi'ya yükseltmiyoruz,
// sadece bildirimin taslağını tetikliyoruz - gerçek promosyon mantığı
// (ve kullanıcının teklifi kabul/red etmesi) bu günün kapsamı dışı.
export async function getNextWaitlistedUserId(eventId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('katilimlar')
    .select('kullanici_id')
    .eq('etkinlik_id', eventId)
    .eq('durum', 'beklemede')
    .order('katilim_tarihi', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? (data.kullanici_id as string) : null;
}

// Gün 19: Bir etkinlik silinirken katılımcılara iptal bildirimi tetiklemek
// (bkz. services/notifications.ts) için "kime gidecek" listesini çıkarır. Bu
// SİLMEDEN ÖNCE çağrılmalı - schema.sql'deki katilimlar.etkinlik_id "on
// delete cascade" olduğu için etkinlik satırı silinince bu tablodaki
// kayıtlar da kendiliğinden yok olur, silme sonrasında sorgulamak boş liste
// döndürür.
export async function getEventParticipantIds(eventId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('katilimlar')
    .select('kullanici_id')
    .eq('etkinlik_id', eventId);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => row.kullanici_id as string);
}

export type Participant = {
  id: string;
  avatarUrl: string | null;
};

// Gün 22: Etkinlik detayındaki katılımcı bölümü için - SADECE onaylı
// katılımcılar (durum='onaylandi'), bekleme listesindekiler kasıtlı olarak
// hariç (bkz. EventDetailScreen'in avatar listesi/sayacı, events.ts'teki
// participantCount ile aynı gerekçe: eventsQuery de aynı filtreyi uyguluyor).
// profiles(avatar_url) embed'i tek satır dönüyor çünkü kullanici_id ->
// profiles.id çoktan-bire bir ilişki (katilimlar_herkese_acik_okuma ve
// profiles_herkese_acik_okuma RLS politikaları girişsiz kullanıcı için de
// buna izin veriyor).
type ConfirmedParticipantRow = {
  kullanici_id: string;
  profiles: { avatar_url: string | null } | null;
};

// Gün 34: currentUserId verilirse (services/comments.ts > getComments'teki
// aynı desen ve aynı gerekçe), kullanıcının engellediği kişiler listeden
// çıkarılır. Bu SADECE avatar listesini daraltıyor - EventDetailScreen'deki
// "X/kapasite katılımcı" sayısı bu fonksiyondan gelmiyor, services/events.ts >
// eventsQuery'deki ayrı katilimlar(count) aggregate'inden geliyor ve ondan
// hiç etkilenmiyor; yani gerçek doluluk oranı (isFull hesaplaması dahil)
// engellemeden bağımsız, olduğu gibi doğru kalmaya devam ediyor - engelleme
// sadece kimin GÖRÜNDÜĞÜNÜ etkiliyor, kapasite/doluluk mantığını değil.
export async function getConfirmedParticipants(
  eventId: string,
  currentUserId?: string | null,
): Promise<Participant[]> {
  const { data, error } = await supabase
    .from('katilimlar')
    .select('kullanici_id, profiles(avatar_url)')
    .eq('etkinlik_id', eventId)
    .eq('durum', 'onaylandi')
    .order('katilim_tarihi', { ascending: true });

  if (error) {
    throw error;
  }

  const participants = ((data ?? []) as unknown as ConfirmedParticipantRow[]).map((row) => ({
    id: row.kullanici_id,
    avatarUrl: row.profiles?.avatar_url ?? null,
  }));

  if (!currentUserId) {
    return participants;
  }

  const blockedUserIds = await getBlockedUserIds(currentUserId);
  if (blockedUserIds.length === 0) {
    return participants;
  }

  const blocked = new Set(blockedUserIds);
  return participants.filter((participant) => !blocked.has(participant.id));
}

// "Ayrıl" - kullanıcının kendi katılım kaydını siler. RLS
// (katilimlar_sadece_kendi_silme, schema.sql) zaten auth.uid() = kullanici_id
// olmasını şart koşuyor; iki eq burada da aynı kısıtı tekrarlıyor ki
// yanlışlıkla farklı bir kullanıcının kaydı hedeflenmesin.
export async function leaveEvent(eventId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('katilimlar')
    .delete()
    .eq('etkinlik_id', eventId)
    .eq('kullanici_id', userId);

  if (error) {
    throw error;
  }
}
