// Gün 24: Harita ekranı - temel. Gün 3'te kararlaştırılan 5 sekmelik
// navigasyon iskeletini bozmamak için ayrı bir bottom tab DEĞİL; bu ekran
// DiscoverScreen'in header'ındaki harita ikonundan DiscoverStack'e push
// ediliyor (EventDetail'in push edildiği aynı yöntem, bkz. DiscoverStack.tsx
// ve types/navigation.ts > DiscoverStackParamList).

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
// Gün 25: MapView'in kendisi react-native-map-clustering'den geliyor -
// react-native-maps'in MapView'ini sarıp aynı props'ları (initialRegion,
// onPress, provider, children olarak Marker'lar...) kabul eden, üstüne
// kümeleme ekleyen bir bileşen. Marker/PROVIDER_DEFAULT/Region hâlâ
// react-native-maps'ten - kütüphane bunları yeniden export etmiyor.
import MapView from 'react-native-map-clustering';
import { Marker, PROVIDER_DEFAULT, Region } from 'react-native-maps';

import { CATEGORY_LABELS } from '../components/CategoryTag';
import { formatDateTime } from '../components/EventCard';
import { CATEGORY_OPTIONS } from '../components/EventForm';
import ErrorState from '../components/ErrorState';
import SkeletonBox from '../components/SkeletonBox';
import { radius, spacing, typography } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';
import { getMapEvents } from '../services/events';
import { Category, Event } from '../types';
import type { DiscoverStackParamList } from '../types/navigation';

type Status = 'loading' | 'error' | 'ready';

const FALLBACK_REGION: Region = {
  latitude: 41.0082,
  longitude: 28.9784,
  latitudeDelta: 0.5,
  longitudeDelta: 0.5,
};

// Konum verisi eksik/hatalı bir etkinlik olursa (schema.sql'deki konum_lat/
// konum_lng NOT NULL kısıtı yüzünden olmamalı, ama savunma amaçlı) haritayı
// çökertmemek/o pini sessizce atlamak için - Marker'a geçersiz koordinat
// (NaN, aralık dışı) verilirse native tarafta hataya yol açabiliyor.
function isValidLatLng(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

// Tüm pinleri tek bakışta gösteren bir başlangıç kamerası hesaplar - min/max
// enlem-boylamın ortası + aralarındaki farka göre bir zoom seviyesi. Tek
// etkinlik varsa (fark 0) ya da hiç yoksa PADDING/minimum delta ile makul bir
// yakınlığa/İstanbul'a düşer.
function computeRegion(events: Event[]): Region {
  if (events.length === 0) {
    return FALLBACK_REGION;
  }

  const latitudes = events.map((event) => event.location.latitude);
  const longitudes = events.map((event) => event.location.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const PADDING = 1.4;
  const MIN_DELTA = 0.05;

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * PADDING, MIN_DELTA),
    longitudeDelta: Math.max((maxLng - minLng) * PADDING, MIN_DELTA),
  };
}

type Props = NativeStackScreenProps<DiscoverStackParamList, 'Map'>;

export default function MapScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [status, setStatus] = useState<Status>('loading');
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  // Gün 25: null = "Tümü" (varsayılan, filtresiz). Kalıcı bir tercih değil -
  // bu ekranın kendi state'i, ekrandan çıkınca (unmount) sıfırlanması
  // beklenen davranış; AsyncStorage vb. bilerek kullanılmadı.
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  const fetchMapEvents = useCallback(async () => {
    setStatus('loading');
    // Filtre değişince önceki seçimin info kartı açık kalmasın - seçili pin
    // yeni filtrede hiç görünmüyor olabilir (bkz. EventDetailScreen'deki
    // benzer "durum değişince eski state'i temizle" mantığı).
    setSelectedEvent(null);
    try {
      const result = await getMapEvents(selectedCategory ?? undefined);
      setEvents(
        result.filter((event) => isValidLatLng(event.location.latitude, event.location.longitude)),
      );
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [selectedCategory]);

  // Gün 27: düz useEffect yerine useFocusEffect - DiscoverScreen.tsx'teki
  // aynı desen (bkz. o dosyadaki yorum). Kullanıcı bir pin'in kartından
  // EventDetail'e gidip katılıp/ayrılıp geri döndüğünde (Map ekranı stack'te
  // mount'lu kalıyor, sadece focus değişiyor) harita da güncel katılımcı
  // sayısıyla tazelenmiş olsun diye - düz useEffect sadece ilk mount'ta
  // çalışırdı.
  useFocusEffect(
    useCallback(() => {
      fetchMapEvents();
    }, [fetchMapEvents]),
  );

  return (
    <View style={styles.container}>
      {/* Gün 25: Kategori filtresi durum/harita ne gösterirse göstersin
          (yükleniyor/hata/hazır) her zaman görünür ve dokunulabilir olmalı -
          aksi halde filtre değiştirince (fetchMapEvents yeniden çalışıp
          status 'loading'e dönünce) çubuk bir anlığına kaybolup kullanıcının
          art arda filtre değiştirmesini engellerdi. Bu yüzden aşağıdaki
          status kontrolünün DIŞINDA, ayrı bir alanda. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterBarContent}
      >
        <Pressable
          style={[styles.categoryChip, selectedCategory === null && styles.categoryChipSelected]}
          onPress={() => setSelectedCategory(null)}
        >
          <Text
            style={[
              styles.categoryChipText,
              selectedCategory === null && styles.categoryChipTextSelected,
            ]}
          >
            Tümü
          </Text>
        </Pressable>
        {CATEGORY_OPTIONS.map((option) => {
          const selected = selectedCategory === option;
          return (
            <Pressable
              key={option}
              style={[styles.categoryChip, selected && styles.categoryChipSelected]}
              onPress={() => setSelectedCategory(option)}
            >
              <Text style={[styles.categoryChipText, selected && styles.categoryChipTextSelected]}>
                {CATEGORY_LABELS[option]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.mapArea}>
        {/* Kart listeleri gibi (Discover/Favorites > EventListSkeleton) burada
            da içeriğin gerçek şeklini (haritanın kendisi) taklit ediyoruz -
            haritada "kart" değil tek bir dolu alan yükleniyor, bu yüzden tek
            bir SkeletonBox mapArea'yı dolduruyor. */}
        {status === 'loading' && <SkeletonBox borderRadius={0} style={styles.mapSkeleton} />}
        {status === 'error' && <ErrorState onRetry={fetchMapEvents} />}
        {status === 'ready' && (
          <MapView
            provider={PROVIDER_DEFAULT}
            style={styles.map}
            initialRegion={computeRegion(events)}
            onPress={() => setSelectedEvent(null)}
          >
            {events.map((event) => (
              <Marker
                key={event.id}
                coordinate={{
                  latitude: event.location.latitude,
                  longitude: event.location.longitude,
                }}
                title={event.title}
                onPress={() => setSelectedEvent(event)}
              />
            ))}
          </MapView>
        )}

        {selectedEvent && (
          <Pressable
            style={styles.card}
            onPress={() => navigation.navigate('EventDetail', { eventId: selectedEvent.id })}
          >
            {selectedEvent.coverPhotoUrl ? (
              <Image source={{ uri: selectedEvent.coverPhotoUrl }} style={styles.cardImage} />
            ) : (
              <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
                <Ionicons name="image-outline" size={24} color={colors.textSecondary} />
              </View>
            )}
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {selectedEvent.title}
              </Text>
              <Text style={styles.cardDetail}>
                {formatDateTime(selectedEvent.date, selectedEvent.time)}
              </Text>
              <Text style={styles.cardDetail}>
                {selectedEvent.participantCount}/{selectedEvent.capacity} katılımcı
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    filterBar: {
      flexGrow: 0,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    filterBarContent: {
      flexDirection: 'row',
      gap: spacing.xs,
      padding: spacing.sm,
    },
    // EventForm.tsx'teki categoryChip/categoryChipSelected ile aynı görsel
    // dil (aynı renk/radius tokenleri) - iki ayrı dosyada bilerek tekrarlandı,
    // EventForm'un stilleri export edilmiyor ve tek bir chip için paylaşılan
    // bir bileşen çıkarmak bu günün kapsamını aşardı.
    categoryChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      // Gün 35: eskiden colors.white - EventForm.tsx > input notundaki aynı
      // gerekçe (yüzey arkaplanı, temayla koyulaşmalı).
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
    mapArea: {
      flex: 1,
    },
    map: {
      flex: 1,
    },
    mapSkeleton: {
      flex: 1,
    },
    card: {
      position: 'absolute',
      left: spacing.md,
      right: spacing.md,
      bottom: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      // Gün 35: eskiden colors.white - aynı gerekçe (yukarıdaki categoryChip
      // notu), haritanın üzerinde yüzen bir bilgi kartı.
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 4,
    },
    cardImage: {
      width: 56,
      height: 56,
      borderRadius: radius.sm,
    },
    cardImagePlaceholder: {
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardInfo: {
      flex: 1,
    },
    cardTitle: {
      fontSize: typography.fontSize.md,
      fontWeight: typography.fontWeight.bold,
      color: colors.text,
    },
    cardDetail: {
      fontSize: typography.fontSize.xs,
      color: colors.textSecondary,
      marginTop: 2,
    },
  });
}
