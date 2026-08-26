// Gün 33: favoriler tablosu erişimi. katilimlar/participations.ts ile benzer
// bir "kullanıcı x etkinlik" ilişkisi ama anlamı farklı (katılım niyeti
// değil, sadece bir işaretleme) - bu yüzden participations.ts'e değil kendi
// dosyasına konuldu. getFavoriteEvents ise services/events.ts >
// getAttendedEvents ile birebir aynı iki-adımlı desen (önce etkinlik_id'ler,
// sonra eventsQuery().in()) - eventsQuery/EventRow/rowToEvent oradan import
// ediliyor, aynı satır<->Event dönüşümünü burada tekrarlamamak için.

import { supabase } from './supabase';
import { eventsQuery, EventRow, rowToEvent } from './events';
import { Event } from '../types';

// EventCard/DiscoverScreen'deki kalp ikonlarının dolu/boş durumunu belirlemek
// için - listedeki her etkinlik için ayrı ayrı sorgu atmak yerine tüm favori
// id'leri tek seferde çekip Set'e çeviriyor (bkz. DiscoverScreen'deki
// kullanım).
export async function getFavoriteEventIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('favoriler')
    .select('etkinlik_id')
    .eq('kullanici_id', userId);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => row.etkinlik_id as string);
}

// EventDetailScreen'de tek bir etkinlik için - services/participations.ts >
// getParticipationStatus ile aynı desen (liste yerine tek satır sorgusu).
export async function isEventFavorited(eventId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('favoriler')
    .select('id')
    .eq('etkinlik_id', eventId)
    .eq('kullanici_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data !== null;
}

// unique(etkinlik_id, kullanici_id) kısıtı (schema.sql) aynı etkinliği iki
// kez favorilemeyi DB seviyesinde zaten engelliyor - services/ratings.ts >
// submitRating'deki aynı gerekçe, burada ayrıca "zaten favorilenmiş mi"
// kontrolü tekrarlanmıyor.
export async function addFavorite(userId: string, eventId: string): Promise<void> {
  const { error } = await supabase
    .from('favoriler')
    .insert({ etkinlik_id: eventId, kullanici_id: userId });

  if (error) {
    throw error;
  }
}

// RLS (favoriler_sadece_kendi_favorisi_silme, schema.sql) zaten auth.uid() =
// kullanici_id olmasını şart koşuyor; iki eq burada da aynı kısıtı
// tekrarlıyor - services/participations.ts > leaveEvent'teki aynı savunma.
export async function removeFavorite(userId: string, eventId: string): Promise<void> {
  const { error } = await supabase
    .from('favoriler')
    .delete()
    .eq('etkinlik_id', eventId)
    .eq('kullanici_id', userId);

  if (error) {
    throw error;
  }
}

// Gün 33: "Favorilerim" ekranı için. services/events.ts > getAttendedEvents
// ile birebir aynı iki-adımlı desen ve aynı gerekçe: favoriler -> etkinlikler
// embed'ini PostgREST'te çift yönlü kurmak yerine önce etkinlik_id'ler, sonra
// o id'lerle tam etkinlik satırları çekiliyor.
export async function getFavoriteEvents(userId: string): Promise<Event[]> {
  const { data: favoriteRows, error: favoriteError } = await supabase
    .from('favoriler')
    .select('etkinlik_id')
    .eq('kullanici_id', userId)
    .order('created_at', { ascending: false });

  if (favoriteError) {
    throw favoriteError;
  }

  const eventIds = (favoriteRows ?? []).map((row) => row.etkinlik_id as string);
  if (eventIds.length === 0) {
    return [];
  }

  const { data, error } = await eventsQuery().in('id', eventIds);

  if (error) {
    throw error;
  }

  // .in() sonucu created_at sırasını korumaz; en son favorilenen en üstte
  // görünsün diye yukarıdaki eventIds sırası burada elle uygulanıyor -
  // getAttendedEvents'teki aynı düzeltme.
  const rows = (data ?? []) as EventRow[];
  const rowMap = new Map(rows.map((row) => [row.id, row]));
  return eventIds
    .map((id) => rowMap.get(id))
    .filter((row): row is EventRow => row !== undefined)
    .map(rowToEvent);
}
