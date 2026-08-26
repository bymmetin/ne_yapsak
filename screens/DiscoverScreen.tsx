import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import EmptyState from '../components/EmptyState';
import EventCard from '../components/EventCard';
import EventListSkeleton from '../components/EventListSkeleton';
import ErrorState from '../components/ErrorState';
import { dateToDbFormat } from '../components/EventForm';
import { radius, spacing, typography } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';
import { requireLogin } from '../navigation/navigationRef';
import { EventFilters, getEvents } from '../services/events';
import { addFavorite, getFavoriteEventIds, removeFavorite } from '../services/favorites';
import { Event } from '../types';
import type { DiscoverStackParamList } from '../types/navigation';

type Status = 'loading' | 'error' | 'ready';

// Gün 26: "Bugün/Bu hafta/Bu ay" tarih filtresi. null = "Tümü" (varsayılan,
// filtresiz) - MapScreen'deki kategori filtresinin "Tümü" davranışıyla aynı
// desen (bkz. MapScreen.tsx > selectedCategory).
type DateFilterValue = 'today' | 'week' | 'month' | null;

const DATE_FILTER_OPTIONS: { value: DateFilterValue; label: string }[] = [
  { value: null, label: 'Tümü' },
  { value: 'today', label: 'Bugün' },
  { value: 'week', label: 'Bu Hafta' },
  { value: 'month', label: 'Bu Ay' },
];

// Aralığın başlangıcı her zaman bugün - bu ekran yaklaşan etkinlikleri
// keşfetmek için, geçmiş günler bu filtrelerin kapsamı dışı. "Bu hafta"
// Pazartesi başlangıçlı kabul edilip içinde bulunulan haftanın Pazar'ında,
// "Bu ay" ise içinde bulunulan takvim ayının son günü ile bitiyor.
// dateToDbFormat (EventForm.tsx) ile aynı yerel-tarih yaklaşımı kullanılıyor
// - toISOString() timezone kaymasına yol açabileceği için kasıtlı olarak yok.
function computeDateRange(filter: DateFilterValue): { from: string; to: string } | null {
  if (!filter) {
    return null;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (filter === 'today') {
    return { from: dateToDbFormat(today), to: dateToDbFormat(today) };
  }

  if (filter === 'week') {
    const mondayBasedDay = (today.getDay() + 6) % 7; // 0=Pazartesi ... 6=Pazar
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (6 - mondayBasedDay));
    return { from: dateToDbFormat(today), to: dateToDbFormat(endOfWeek) };
  }

  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: dateToDbFormat(today), to: dateToDbFormat(endOfMonth) };
}

type Props = NativeStackScreenProps<DiscoverStackParamList, 'DiscoverList'>;

export default function DiscoverScreen({ navigation }: Props) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [status, setStatus] = useState<Status>('loading');
  const [events, setEvents] = useState<Event[]>([]);
  const [page, setPage] = useState(0);
  const [isLastPage, setIsLastPage] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(null);
  // Gün 27: loadFirstPage/loadNextPage arasındaki yarış durumuna (race
  // condition) karşı - bkz. bu iki fonksiyondaki requestId kontrolleri.
  // Kullanıcı bir sayfa isteği havadayken (loadNextPage) filtreyi değiştirirse
  // (loadFirstPage yeni filtreyle tetiklenir) iki istek sırasız dönebilir;
  // eski isteğin sonucu yeni filtrenin sonucunun üzerine yazılabilirdi.
  const requestIdRef = useRef(0);

  // ~400ms debounce - kullanıcı her tuşa bastığında sorgu atmamak için.
  // searchInput 400ms boyunca değişmeden kalırsa debouncedSearch güncellenir;
  // bu da aşağıdaki loadFirstPage'in kimliğini değiştirip altındaki useEffect
  // üzerinden (bkz. o effect'in yorumu) otomatik bir yeniden sorguyu tetikler
  // - ayrı bir "filtre değişti" effect'i yazmaya gerek kalmadı.
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchInput.trim()), 400);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const hasActiveFilters = debouncedSearch.length > 0 || dateFilter !== null;

  const buildFilters = useCallback((): EventFilters => {
    const dateRange = computeDateRange(dateFilter);
    return {
      search: debouncedSearch,
      dateFrom: dateRange?.from,
      dateTo: dateRange?.to,
    };
  }, [debouncedSearch, dateFilter]);

  // Gün 24: Harita ikonu - EventDetailScreen'deki paylaş butonuyla aynı
  // desen (navigation.setOptions ile headerRight). Ayrı bir bottom tab değil,
  // DiscoverStack üzerinden Map ekranına push (bkz. DiscoverStack.tsx).
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate('Map')}
          hitSlop={12}
          style={styles.headerButton}
        >
          <Ionicons name="map-outline" size={22} color={colors.white} />
        </Pressable>
      ),
    });
  }, [navigation, colors, styles]);

  // silent=true iken (odak/pull-to-refresh) ekrandaki liste anlık
  // boşaltılmıyor, sadece RefreshControl spinner'ı dönüyor - aksi halde her
  // sekme değişiminde liste bir anlığına kaybolup LoadingState görünürdü.
  // Gün 26: her zaman 0. sayfadan başlıyor ve events'i BAŞTAN yazıyor (append
  // değil) - arama/tarih filtresi değiştiğinde eski sayfayla yeni filtrenin
  // sonuçları karışmasın diye sayfalama böylece sıfırlanmış olur.
  const loadFirstPage = useCallback(
    async (silent: boolean) => {
      const requestId = ++requestIdRef.current;
      if (silent) {
        setRefreshing(true);
      } else {
        setStatus('loading');
      }

      try {
        const result = await getEvents(0, buildFilters());
        // Bu bekleme sırasında daha yeni bir istek başlamışsa (requestIdRef
        // ilerlemiş demektir) sonucu uygulamıyoruz - aksi halde eski
        // filtrenin sonucu yeni filtrenin üzerine yazılabilir.
        if (requestIdRef.current !== requestId) return;
        setEvents(result.events);
        setIsLastPage(result.isLastPage);
        setPage(1);
        setStatus('ready');
      } catch {
        if (requestIdRef.current === requestId) {
          setStatus('error');
        }
      } finally {
        setRefreshing(false);
      }
    },
    [buildFilters],
  );

  // Gerçek ilk mount'ta ilk sayfa çekilir; arama/tarih filtresi
  // değiştiğinde (loadFirstPage'in kimliği buildFilters üzerinden değişince)
  // sessizce yeniden çekilir. Bilerek useFocusEffect DEĞİL, düz bir
  // useEffect - eskiden useFocusEffect kullanılıyordu ve ekran her focus
  // aldığında (ör. başka bir sekmeye gidip geri dönünce) da tetikleniyordu;
  // bu da o ana kadar infinite-scroll ile yüklenmiş sayfaları ve scroll
  // pozisyonunu sessizce 1. sayfaya resetliyordu. didMountRef, sadece "gerçek
  // ilk mount" ile "sonraki bir filtre değişikliği"ni ayırt etmek için var -
  // events.length KASITLI OLARAK dependency değil (infinite-scroll'un kendi
  // setEvents çağrıları da events.length'i değiştirir, bu da bu efekti
  // gereksiz yere tekrar tetikleyip sayfalamayı sıfırlardı).
  const didMountRef = useRef(false);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      loadFirstPage(false);
      return;
    }
    loadFirstPage(true);
  }, [loadFirstPage]);

  const loadNextPage = useCallback(async () => {
    if (isLastPage || loadingMore || status !== 'ready') return;

    const requestId = ++requestIdRef.current;
    setLoadingMore(true);
    try {
      const result = await getEvents(page, buildFilters());
      // loadFirstPage'deki aynı koruma: bu bekleme sırasında filtre değişip
      // requestIdRef ilerlemişse bu sayfa artık geçersiz bir filtreyle
      // gelmiş demektir - events'e eklemiyoruz.
      if (requestIdRef.current !== requestId) return;
      setEvents((prev) => [...prev, ...result.events]);
      setIsLastPage(result.isLastPage);
      setPage((p) => p + 1);
    } catch {
      // Sayfalama hatası tüm listeyi ErrorState'e çevirmiyor - kullanıcı
      // FlatList'i tekrar sona kaydırınca (loadingMore false'a döndüğü
      // için) otomatik olarak yeniden denenmiş olur.
    } finally {
      setLoadingMore(false);
    }
  }, [page, isLastPage, loadingMore, status, buildFilters]);

  // Gün 33: kalp ikonlarının başlangıç durumu - sayfalanan events listesinden
  // bağımsız, ayrı bir effect (loadFirstPage'in tetiklediği her sayfa
  // isteğinde tekrar tekrar çekilmesin diye sadece userId değişince/odak
  // alınca çalışıyor). Girişsiz kullanıcı için boş Set - favoriler_sadece_
  // kendi_favorisi_okuma RLS'i (schema.sql) zaten girişsiz erişimde boş
  // dönerdi, burada ayrıca sorgu atmadan aynı sonuca varıyoruz.
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      if (!userId) {
        setFavoriteIds(new Set());
        return;
      }
      getFavoriteEventIds(userId)
        .then((ids) => setFavoriteIds(new Set(ids)))
        .catch(() => {
          // Sessizce yut: kalp ikonlarının başlangıç durumu ikincil bir
          // gösterim, ana listeyi (events) engellemeye değmez.
        });
    }, [userId]),
  );

  // EventDetailScreen.tsx > Gün 32 "Kullanıcıyı Engelle" akışındaki aynı
  // "başarılı mutasyondan sonra local state'i güncelle" deseni - tam
  // pre-network optimistic + rollback yerine, await sonrası anında güncelleme
  // (startJoin'deki participantCount bump'ıyla aynı "iyimser" tanım, bkz. o
  // ekrandaki yorum).
  const toggleFavorite = async (eventId: string) => {
    // Gün 38: Guest modu - kalp ikonu artık kartta her zaman görünür (bkz.
    // aşağıdaki EventCard kullanımı), dokununca Giriş ekranına yönlendiriliyor.
    if (!userId) {
      requireLogin();
      return;
    }
    const isFavorite = favoriteIds.has(eventId);

    try {
      if (isFavorite) {
        await removeFavorite(userId, eventId);
      } else {
        await addFavorite(userId, eventId);
      }
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (isFavorite) {
          next.delete(eventId);
        } else {
          next.add(eventId);
        }
        return next;
      });
    } catch (err) {
      Alert.alert('İşlem başarısız', err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <View style={styles.container}>
      {/* Gün 26: Arama + tarih filtresi status'un (loading/error/ready)
          DIŞINDA - MapScreen'deki kategori filtresiyle aynı gerekçe (bkz. o
          ekrandaki yorum): aksi halde filtre her değiştiğinde (loadFirstPage
          yeniden çalışıp status 'loading'e dönünce) bu çubuk bir anlığına
          kaybolup kullanıcının arama yazmaya/filtre değiştirmeye devam
          etmesini engellerdi. */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Etkinlik ara..."
          placeholderTextColor={colors.textSecondary}
          returnKeyType="search"
        />
        {searchInput.length > 0 && (
          <Pressable
            onPress={() => setSearchInput('')}
            // Gün 35: eskiden hitSlop 8 - ikon (18) ile birlikte dokunma
            // alanı ~34x34 kalıyordu, 44x44 hedefinin altında.
            hitSlop={13}
            accessibilityRole="button"
            accessibilityLabel="Aramayı temizle"
          >
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterBarContent}
      >
        {DATE_FILTER_OPTIONS.map((option) => {
          const selected = dateFilter === option.value;
          return (
            <Pressable
              key={option.label}
              style={[styles.categoryChip, selected && styles.categoryChipSelected]}
              onPress={() => setDateFilter(option.value)}
            >
              <Text style={[styles.categoryChipText, selected && styles.categoryChipTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {status === 'loading' && <EventListSkeleton />}
      {status === 'error' && <ErrorState onRetry={() => loadFirstPage(false)} />}
      {status === 'ready' && (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <EventCard
              event={item}
              onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
              isFavorite={favoriteIds.has(item.id)}
              onToggleFavorite={() => toggleFavorite(item.id)}
            />
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            // Gün 26: "eşleşen etkinlik bulunamadı" ile "henüz hiç etkinlik
            // yok" farklı durumlar - biri filtre/arama sonucunun boş olması,
            // diğeri veritabanının gerçekten boş olması. Karıştırmamak için
            // hangi filtre aktifse ona göre ayrı bir mesaj gösteriliyor.
            <EmptyState
              title={hasActiveFilters ? 'Eşleşen etkinlik bulunamadı' : undefined}
              message={
                hasActiveFilters ? 'Farklı bir arama terimi ya da tarih filtresi dene.' : undefined
              }
            />
          }
          onEndReached={loadNextPage}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator style={styles.footerLoading} color={colors.primary} />
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadFirstPage(true)}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerButton: {
      paddingHorizontal: spacing.xs,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginHorizontal: spacing.md,
      marginTop: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      // Gün 35: eskiden colors.white - yüzey arkaplanı, temayla koyulaşmalı
      // (bkz. EventForm.tsx > input notu, aynı gerekçe).
      backgroundColor: colors.surface,
    },
    searchInput: {
      flex: 1,
      fontSize: typography.fontSize.md,
      color: colors.text,
      padding: 0,
    },
    // MapScreen.tsx'teki kategori filtre çubuğuyla (kendisi EventForm.tsx'teki
    // kategori chip'leriyle) aynı görsel dil - üç ayrı dosyada bilerek
    // tekrarlandı, stiller export edilmiyor ve tek bir chip için paylaşılan bir
    // bileşen çıkarmak bu günün kapsamını aşardı (bkz. MapScreen.tsx'teki aynı
    // gerekçe).
    filterBar: {
      flexGrow: 0,
      marginTop: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    filterBarContent: {
      flexDirection: 'row',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
    },
    categoryChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    categoryChipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    categoryChipText: {
      fontSize: typography.fontSize.sm,
      color: colors.text,
    },
    categoryChipTextSelected: {
      color: colors.white,
      fontWeight: typography.fontWeight.medium,
    },
    listContent: {
      padding: spacing.md,
      flexGrow: 1,
    },
    footerLoading: {
      marginVertical: spacing.md,
    },
  });
}
