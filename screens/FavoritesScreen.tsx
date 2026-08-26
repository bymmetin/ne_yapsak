import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import EmptyState from '../components/EmptyState';
import EventCard from '../components/EventCard';
import EventListSkeleton from '../components/EventListSkeleton';
import ErrorState from '../components/ErrorState';
import { spacing } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';
import { getFavoriteEvents, removeFavorite } from '../services/favorites';
import { Event } from '../types';
import type { ProfileStackParamList } from '../types/navigation';

type Status = 'loading' | 'error' | 'ready';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Favorites'>;

// AttendedEventsScreen.tsx (Gün 21) ile aynı iskelet - fark sorgu
// (getFavoriteEvents) ve her kartın kalp ikonuyla listeden anında
// çıkarılabilmesi (bu ekrandaki her etkinlik zaten favori olduğu için
// isFavorite hep true, kalbe basmak "favoriden çıkar" anlamına geliyor).
// Kartlar artık DiscoverScreen'deki aynı desenle EventDetail'e tıklanabilir
// (bkz. types/navigation.ts > ProfileStackParamList ve
// navigation/ProfileStack.tsx - EventDetail artık burada da tanımlı).
export default function FavoritesScreen({ navigation }: Props) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [status, setStatus] = useState<Status>('loading');
  const [events, setEvents] = useState<Event[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(
    async (silent: boolean) => {
      if (!userId) return;

      if (silent) {
        setRefreshing(true);
      } else {
        setStatus('loading');
      }

      try {
        const result = await getFavoriteEvents(userId);
        setEvents(result);
        setStatus('ready');
      } catch {
        setStatus('error');
      } finally {
        setRefreshing(false);
      }
    },
    [userId],
  );

  useFocusEffect(
    useCallback(() => {
      loadData(events.length > 0);
    }, [loadData, events.length]),
  );

  // Yeniden fetch yerine client-side filtre - EventDetailScreen.tsx > Gün 32
  // "Kullanıcıyı Engelle" akışıyla aynı gerekçe: bu ekranda bir etkinlik
  // favoriden çıkınca zaten listede kalmasının hiçbir anlamı yok, ekstra bir
  // ağ isteğine gerek bırakmadan anında kaybolması gerekiyor.
  const unfavorite = async (eventId: string) => {
    if (!userId) return;
    try {
      await removeFavorite(userId, eventId);
      setEvents((prev) => prev.filter((event) => event.id !== eventId));
    } catch (err) {
      Alert.alert('Favoriden çıkarılamadı', err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <View style={styles.container}>
      {status === 'loading' && <EventListSkeleton />}
      {status === 'error' && <ErrorState onRetry={() => loadData(false)} />}
      {status === 'ready' && (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <EventCard
              event={item}
              onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
              isFavorite
              onToggleFavorite={() => unfavorite(item.id)}
            />
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState
              title="Henüz favori etkinliğin yok"
              message="Keşfet sekmesinde beğendiğin etkinliklerin kalbine dokunarak buraya ekleyebilirsin."
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadData(true)}
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
    listContent: {
      padding: spacing.md,
      flexGrow: 1,
    },
  });
}
