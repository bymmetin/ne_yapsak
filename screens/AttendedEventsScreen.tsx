import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import EmptyState from '../components/EmptyState';
import EventCard from '../components/EventCard';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import { spacing } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';
import { getAttendedEvents } from '../services/events';
import { Event } from '../types';
import type { ProfileStackParamList } from '../types/navigation';

type Status = 'loading' | 'error' | 'ready';

type Props = NativeStackScreenProps<ProfileStackParamList, 'AttendedEvents'>;

// MyEventsScreen.tsx (Gün 18) ile aynı desen - fark sorgu (kendi
// oluşturduklarım yerine katıldıklarım). Kartlar artık DiscoverScreen'deki
// aynı desenle EventDetail'e tıklanabilir (bkz. types/navigation.ts >
// ProfileStackParamList ve navigation/ProfileStack.tsx).
export default function AttendedEventsScreen({ navigation }: Props) {
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
        const result = await getAttendedEvents(userId);
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

  return (
    <View style={styles.container}>
      {status === 'loading' && <LoadingState message="Etkinlikler yükleniyor..." />}
      {status === 'error' && <ErrorState onRetry={() => loadData(false)} />}
      {status === 'ready' && (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <EventCard
              event={item}
              onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
            />
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState
              title="Henüz bir etkinliğe katılmadın"
              message="Keşfet sekmesinden ilgini çeken bir etkinliğe katıl."
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
