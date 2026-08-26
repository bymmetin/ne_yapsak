import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import CategoryTag from './CategoryTag';
import { radius, spacing, typography } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';
import { Event } from '../types';

// Gün 31: EventDetailScreen'deki yorum tarihleri de bunu kullanıyor -
// toLocaleString yerine manuel dizi tercih edildi çünkü codebase genelinde
// (bkz. formatDateTime) cihazın Intl/yerelleştirme desteğine güvenmiyoruz.
export const MONTHS = [
  'Oca',
  'Şub',
  'Mar',
  'Nis',
  'May',
  'Haz',
  'Tem',
  'Ağu',
  'Eyl',
  'Eki',
  'Kas',
  'Ara',
];

export function formatDateTime(date: string, time: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}, ${time}`;
}

// EventEditScreen.tsx'teki buildDateTime ile aynı yerel-zaman
// yaklaşımı - new Date(`${tarih}T${saat}`) kullanmadık çünkü bu, motora göre
// UTC ya da yerel yorumlanabiliyor.
export function isEventPast(date: string, time: string): boolean {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const eventTime = new Date(year, month - 1, day, hour, minute);
  return eventTime.getTime() < Date.now();
}

type Props = {
  event: Event;
  onPress?: () => void;
  // Gün 33: ikisi de opsiyonel - onToggleFavorite verilmezse kalp ikonu hiç
  // render edilmiyor (bkz. aşağıdaki koşul). Bu, EventCard'ı kullanan her
  // ekranın (MyEventsScreen, AttendedEventsScreen gibi) favori durumunu
  // takip etmeye zorlanmadan aynı component'i kullanmaya devam edebilmesi
  // için - favori kalbi şimdilik sadece DiscoverScreen ve FavoritesScreen'de
  // bağlı (bkz. o ekranlardaki kullanım).
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
};

export default function EventCard({ event, onPress, isFavorite, onToggleFavorite }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isPast = isEventPast(event.date, event.time);
  const isFull = event.participantCount >= event.capacity;

  return (
    <Pressable style={[styles.card, isPast && styles.cardPast]} onPress={onPress}>
      <View style={styles.coverWrapper}>
        {event.coverPhotoUrl ? (
          <Image source={{ uri: event.coverPhotoUrl }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]}>
            <Ionicons name="image-outline" size={32} color={colors.textSecondary} />
          </View>
        )}
        {onToggleFavorite && (
          // hitSlop + nested Pressable: RN'in dokunuş sistemi bu iç
          // Pressable'ı responder yaptığı için dıştaki karta onPress (detay
          // sayfasına gitme) tetiklenmiyor, ayrıca stopPropagation gerekmiyor.
          <Pressable onPress={onToggleFavorite} hitSlop={8} style={styles.favoriteButton}>
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={20}
              color={isFavorite ? colors.error : colors.white}
            />
          </Pressable>
        )}
      </View>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <CategoryTag category={event.category} />
          {/* Geçmiş etkinlikte doluluk zaten anlamsız (kart bütünüyle
              soluklaşıyor), bu yüzden rozet sadece gelecekteki dolu
              etkinliklerde gösteriliyor. */}
          {isFull && !isPast && (
            <View style={styles.fullBadge}>
              <Text style={styles.fullBadgeText}>Dolu</Text>
            </View>
          )}
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>
        <View style={styles.row}>
          <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.detailText}>{formatDateTime(event.date, event.time)}</Text>
        </View>
        <View style={styles.row}>
          <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.detailText}>
            {event.participantCount}/{event.capacity} katılımcı
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    card: {
      // Gün 35: kart arkaplanı kasıtlı olarak colors.surface - eskiden
      // colors.white'tı ama bu, "buton üzerindeki beyaz metin" gibi temadan
      // bağımsız kalması gereken bir kullanım değil, gerçek bir yüzey/kart
      // arkaplanıydı (bkz. context/ThemeContext.tsx > Gün 35 karar notu).
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      marginBottom: spacing.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardPast: {
      opacity: 0.55,
    },
    coverWrapper: {
      position: 'relative',
    },
    cover: {
      width: '100%',
      height: 140,
    },
    coverPlaceholder: {
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    favoriteButton: {
      position: 'absolute',
      top: spacing.xs,
      right: spacing.xs,
      width: 32,
      height: 32,
      borderRadius: radius.full,
      backgroundColor: 'rgba(45, 52, 54, 0.4)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      padding: spacing.md,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    fullBadge: {
      backgroundColor: colors.textSecondary,
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    fullBadgeText: {
      // "Dolu" rozeti her zaman colors.textSecondary dolgulu - metin rengi
      // kasıtlı olarak invariant (bkz. Gün 35 karar notu).
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.bold,
      color: colors.white,
    },
    title: {
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.bold,
      color: colors.text,
      marginBottom: spacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: 2,
    },
    detailText: {
      fontSize: typography.fontSize.sm,
      color: colors.textSecondary,
    },
  });
}
