// Gün 17: Keşfet ekranındaki mock veriyi burada gerçek Supabase sorgularıyla
// besliyoruz. Satır -> Event dönüşümü (snake_case -> camelCase, bkz.
// types/index.ts'teki not) tek yerde toplanıyor ki DiscoverScreen ve
// EventDetailScreen aynı şekli üretsin.

import { supabase } from './supabase';
import { Event, Category } from '../types';

export const EVENT_PAGE_SIZE = 10;

// katilimlar(count): PostgREST'in embedded count aggregate'i - her etkinlik
// satırıyla birlikte tek sorguda o etkinliğin katilimlar tablosundaki satır
// sayısını da getirir (N+1 sorguya gerek kalmaz). Gün 21'de eklenen
// katilimlar_herkese_acik_okuma RLS politikası bunu girişsiz kullanıcı için
// de çalışır kılıyor.
const SELECTED_FIELDS =
  'id, organizator_id, baslik, aciklama, kategori, tarih, saat, konum_adres, konum_lat, konum_lng, kapasite, kapak_foto_url, created_at, katilimlar(count)';

// Gün 21: Bekleme listesi eklenince katilimlar artık sadece onaylı
// katılımcıları değil, durum='beklemede' satırlarını da içerebiliyor -
// bunlar "X/kapasite katılımcı" sayısına ve isFull kontrolüne dahil
// edilmemeli. PostgREST'te embedded kaynağa nokta-notasyonuyla filtre
// uygulamak (katilimlar.durum) satırı "!inner" yapmadan sadece count
// aggregate'inin neyi saydığını daraltır - etkinliğin kendisi hiç
// katılımcısı olmasa (ya da hepsi beklemede olsa) bile listede kalmaya
// devam eder, sadece sayı 0 döner.
// Gün 33: export edildi - services/favorites.ts > getFavoriteEvents,
// getAttendedEvents'teki (aşağıda) aynı iki-adımlı deseni (önce
// etkinlik_id'ler, sonra eventsQuery().in()) tekrarlıyor, satır<->Event
// dönüşümünü burada ikinci kez yazmamak için bunu ve rowToEvent'i buradan
// import ediyor.
export function eventsQuery() {
  return supabase.from('etkinlikler').select(SELECTED_FIELDS).eq('katilimlar.durum', 'onaylandi');
}

export type EventRow = {
  id: string;
  organizator_id: string;
  baslik: string;
  aciklama: string;
  kategori: Category;
  tarih: string;
  saat: string;
  konum_adres: string;
  konum_lat: number;
  konum_lng: number;
  kapasite: number;
  kapak_foto_url: string | null;
  created_at: string;
  katilimlar: { count: number }[];
};

export function rowToEvent(row: EventRow): Event {
  return {
    id: row.id,
    organizerId: row.organizator_id,
    title: row.baslik,
    description: row.aciklama,
    category: row.kategori,
    date: row.tarih,
    time: row.saat,
    location: {
      address: row.konum_adres,
      latitude: row.konum_lat,
      longitude: row.konum_lng,
    },
    capacity: row.kapasite,
    participantCount: row.katilimlar[0]?.count ?? 0,
    coverPhotoUrl: row.kapak_foto_url,
    createdAt: row.created_at,
  };
}

export type EventPage = {
  events: Event[];
  isLastPage: boolean;
};

// Gün 26: DiscoverScreen'deki arama input'u + "Bugün/Bu hafta/Bu ay" tarih
// filtresi için. search, .ilike ile sadece başlık/açıklamada aranıyor;
// dateFrom/dateTo (YYYY-MM-DD) DiscoverScreen tarafında client-side
// hesaplanıp burada tarih sütununa gte/lte olarak uygulanıyor - hangi
// gün/hafta/ay aralığının kastedildiği (bugünün yerel tarihi, haftanın
// Pazartesi'den başlaması vb.) bir UI kararı, servis katmanının bilmesi
// gerekmiyor.
export type EventFilters = {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
};

// '%'/'_' ilike'ın kendi joker karakterleri olduğu için kullanıcının arama
// metninde LİTERAL olarak geçerse kaçırılıyor (aksi halde "%50 indirim" gibi
// bir arama her şeyle eşleşirdi). ','/'('/')' ise PostgREST'in or() filtre
// string'inde ayraç/parantez anlamı taşıyor (bkz. aşağıdaki .or() çağrısı) -
// kaçırma yöntemi olmadığı için tamamen kaldırılıyor; aksi halde örneğin
// "kahve, sohbet" araması or() string'ini bozup sorgu hatasına yol açardı.
function sanitizeSearchTerm(value: string): string {
  return value.replace(/[%_]/g, '\\$&').replace(/[,()]/g, '');
}

// sayfa 0-tabanlı. Yaklaşan etkinlikler önce görünsün diye tarih/saat artan
// sırada listeleniyor.
export async function getEvents(page: number, filters: EventFilters = {}): Promise<EventPage> {
  const start = page * EVENT_PAGE_SIZE;
  const end = start + EVENT_PAGE_SIZE - 1;

  let query = eventsQuery();

  const search = sanitizeSearchTerm(filters.search?.trim() ?? '');
  if (search) {
    query = query.or(`baslik.ilike.%${search}%,aciklama.ilike.%${search}%`);
  }

  if (filters.dateFrom) {
    query = query.gte('tarih', filters.dateFrom);
  }

  if (filters.dateTo) {
    query = query.lte('tarih', filters.dateTo);
  }

  const { data, error } = await query
    .order('tarih', { ascending: true })
    .order('saat', { ascending: true })
    .range(start, end);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as EventRow[];
  return {
    events: rows.map(rowToEvent),
    isLastPage: rows.length < EVENT_PAGE_SIZE,
  };
}

export async function getEvent(id: string): Promise<Event | null> {
  const { data, error } = await eventsQuery().eq('id', id).maybeSingle();

  if (error) {
    throw error;
  }

  return data ? rowToEvent(data as EventRow) : null;
}

// Gün 18: "Etkinliklerim" ekranı için. Bir kullanıcının kendi düzenlediği
// etkinlik sayısı doğası gereği küçük olacağından (Keşfet'in aksine)
// sayfalama eklenmedi.
export async function getMyEvents(organizerId: string): Promise<Event[]> {
  const { data, error } = await eventsQuery()
    .eq('organizator_id', organizerId)
    .order('tarih', { ascending: true })
    .order('saat', { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as EventRow[]).map(rowToEvent);
}

// Gün 24: Harita ekranı için. Sayfalama kasıtlı olarak yok - şimdilik makul
// bir üst sınırla (ilk 50, tarih/saat artan sırada) tek seferde çekiliyor
// (kümeleme Gün 25'te react-native-map-clustering ile MapScreen tarafında
// eklendi, bu sorguyu etkilemiyor - hâlâ aynı 50 etkinlik çekiliyor, sadece
// haritada kümeleniyor). eventsQuery() burada da getEvents/getEvent ile aynı
// temel sorgu - durum='onaylandi' filtresi hangi etkinliklerin döneceğini
// değil, katilimlar(count) aggregate'inin neyi saydığını daraltıyor (bkz.
// eventsQuery yorumu); yani harita da diğer listeler gibi tüm etkinlikleri
// gösterir, sadece "X/kapasite katılımcı" sayısı tutarlı kalır. Gün 25: isteğe
// bağlı category filtresi - MapScreen'deki kategori chip'lerinin "Tümü"
// dışındaki bir seçimi burada .eq('kategori', ...) olarak uygulanıyor.
export const MAP_EVENT_LIMIT = 50;

export async function getMapEvents(category?: Category): Promise<Event[]> {
  let query = eventsQuery();
  if (category) {
    query = query.eq('kategori', category);
  }

  const { data, error } = await query
    .order('tarih', { ascending: true })
    .order('saat', { ascending: true })
    .limit(MAP_EVENT_LIMIT);

  if (error) {
    throw error;
  }

  return ((data ?? []) as EventRow[]).map(rowToEvent);
}

// Gün 21: "Katıldığım" ekranı için. katilimlar -> etkinlikler embed'iyle tek
// sorguda gitmek yerine iki adıma bölündü: PostgREST'te aynı FK'yı hem geriye
// (katilimlar -> etkinlikler) hem ileriye (etkinlikler -> katilimlar(count),
// SELECTED_FIELDS içinde) çift yönlü iç içe kullanmak kırılgan olurdu; bu
// yüzden önce etkinlik_id'ler, sonra o id'lerle tam etkinlik satırları
// çekiliyor.
export async function getAttendedEvents(userId: string): Promise<Event[]> {
  const { data: participationRows, error: participationError } = await supabase
    .from('katilimlar')
    .select('etkinlik_id')
    .eq('kullanici_id', userId)
    .order('katilim_tarihi', { ascending: false });

  if (participationError) {
    throw participationError;
  }

  const eventIds = (participationRows ?? []).map((row) => row.etkinlik_id as string);
  if (eventIds.length === 0) {
    return [];
  }

  const { data, error } = await eventsQuery().in('id', eventIds);

  if (error) {
    throw error;
  }

  // .in() sonucu katilim_tarihi sırasını korumaz; en son katılınan en üstte
  // görünsün diye yukarıdaki eventIds sırası burada elle uygulanıyor.
  const rows = (data ?? []) as EventRow[];
  const rowMap = new Map(rows.map((row) => [row.id, row]));
  return eventIds
    .map((id) => rowMap.get(id))
    .filter((row): row is EventRow => row !== undefined)
    .map(rowToEvent);
}
