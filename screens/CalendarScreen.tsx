// Gün 36: Mock veri yerine gerçek veri - organize edilen (getMyEvents) +
// katılınan (getAttendedEvents) etkinlikler birleştirilip takvimde
// işaretleniyor. CalendarScreen, TabNavigator.tsx'te DOĞRUDAN bir Tab.Screen
// (Discover/Profile'daki gibi bir Stack İÇİNDE değil) - bu navigator'da
// EventDetail rotası yok, bu yüzden panneldeki kartlar AttendedEventsScreen/
// FavoritesScreen'deki gibi tıklanamaz bırakıldı. Bu, "paylaşılan bir
// EventDetail rotası yok" sorununun üçüncü örneği (Favoriler ve Katıldıklarım/
// Etkinliklerim'den sonra) - kalıcı çözüm Gün 38'e bırakıldı.
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';

import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import EventCard from '../components/EventCard';
import LoadingState from '../components/LoadingState';
import { spacing, typography } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';
import { getAttendedEvents, getMyEvents } from '../services/events';
import { Event } from '../types';

type Status = 'loading' | 'error' | 'ready';

const MONTHS_LONG = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

function getTodayDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatLongDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return `${day} ${MONTHS_LONG[month - 1]} ${year}`;
}

// Takvim ilk açıldığında hangi ayın gösterileceğini belirler; modül yüklendiğinde
// bir kez hesaplanır. Bunu her render'da yeniden hesaplamak (veya doğrudan
// selectedDate state'ine bağlamak) react-native-calendars'ın her gün
// dokunuşunda ay görünümünü sıfırlamasına ve gereksiz yeniden render'lara
// yol açıyordu; sabit bir başlangıç değeri kullanmak bunu ortadan kaldırır.
const TODAY = getTodayDate();

// Gün 35: component dışında SABİT bir obje olamıyor artık çünkü colors
// tema bazlı (useTheme() hook'undan geliyor, sadece component içinde
// erişilebilir) - bunun yerine aşağıda useMemo([colors]) ile sarmalanıyor.
// Referans kararlılığı yorumundaki gerekçe (react-native-calendars'ın
// React.memo'lu Day bileşeni) hâlâ geçerli: useMemo, colors değişmediği
// sürece (yani tema değişmediği sürece) her render'da AYNI obje referansını
// döndürmeye devam ediyor - modül sabitiyle aynı garantiyi koruyor.
function createCalendarTheme(colors: ColorPalette) {
  return {
    todayTextColor: colors.primary,
    arrowColor: colors.primary,
    selectedDayBackgroundColor: colors.primary,
    selectedDayTextColor: colors.white,
    dotColor: colors.primary,
    textDayFontSize: typography.fontSize.sm,
    textMonthFontWeight: typography.fontWeight.bold,
    // Gün 35 düzeltmesi: react-native-calendars bu anahtarlar boş bırakılırsa
    // kendi sabit (koyu modda okunmaz) varsayılanlarını kullanıyordu -
    // yukarıdaki yedi anahtar takvimin "vurgu" renklerini (bugün/seçili gün/
    // ok) kapsıyor ama kendi arkaplanını ve normal gün metnini hiç
    // temalandırmıyordu.
    backgroundColor: colors.background,
    // calendar: {styles.container'ın (colors.background) DEVAMI gibi
    // görünsün diye colors.surface değil colors.background - takvim burada
    // bir kart değil, ekranın kendisi (bkz. styles.container).
    calendarBackground: colors.background,
    dayTextColor: colors.text,
    // Sun/Mon/Tue... satır başlıkları.
    textSectionTitleColor: colors.textSecondary,
    // "Ağustos 2026" ay başlığı.
    monthTextColor: colors.text,
    // Önceki/sonraki aya ait soluk günler - colors.textSecondary/text kadar
    // belirgin olmamalı; kütüphanenin kendi varsayılanı (~#d9e1e8) zaten
    // colors.border'a çok yakın bir açık gri, bu yüzden colors.border hem
    // açık modda aynı soluk görünümü koruyor hem de koyu modda otomatik
    // olarak koyulaşıyor.
    textDisabledColor: colors.border,
  };
}

type DayMark = {
  marked?: boolean;
  dotColor?: string;
  selected?: boolean;
  selectedColor?: string;
  selectedTextColor?: string;
};

export default function CalendarScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const calendarTheme = useMemo(() => createCalendarTheme(colors), [colors]);
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [status, setStatus] = useState<Status>('loading');
  const [events, setEvents] = useState<Event[]>([]);

  // Organize ettiklerim + katıldıklarım aynı takvimde tek renkli bir nokta
  // olarak işaretleniyor (plan maddesi: "organizatör/katılımcı ayrımı
  // yapma"). İki ayrı sorgu (services/events.ts > getMyEvents/
  // getAttendedEvents) döndüğü için aynı etkinlik teorik olarak iki listede
  // de görünebilir - id bazlı bir Map ile tekilleştiriliyor.
  const loadEvents = useCallback(async () => {
    if (!userId) return;
    setStatus('loading');
    try {
      const [organized, attended] = await Promise.all([
        getMyEvents(userId),
        getAttendedEvents(userId),
      ]);
      const merged = new Map<string, Event>();
      [...organized, ...attended].forEach((event) => merged.set(event.id, event));
      setEvents(Array.from(merged.values()));
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [userId]);

  // EventDetailScreen/DiscoverScreen'deki aynı desen - EventCreate/EventEdit'ten
  // dönüşte ya da başka bir etkinliğe yeni katılınca takvim tazelensin diye
  // düz useEffect yerine useFocusEffect.
  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [loadEvents]),
  );

  const markedDays = useMemo(() => {
    const days: Record<string, DayMark> = {};
    events.forEach((event) => {
      days[event.date] = { marked: true, dotColor: colors.primary };
    });
    days[selectedDate] = {
      ...days[selectedDate],
      selected: true,
      selectedColor: colors.primary,
      selectedTextColor: colors.white,
    };
    return days;
  }, [selectedDate, colors, events]);

  const selectedDayEvents = useMemo(
    () => events.filter((event) => event.date === selectedDate),
    [events, selectedDate],
  );

  const onDayPress = useCallback((day: DateData) => {
    setSelectedDate(day.dateString);
  }, []);

  return (
    <View style={styles.container}>
      <Calendar
        initialDate={TODAY}
        markedDates={markedDays}
        onDayPress={onDayPress}
        theme={calendarTheme}
        style={styles.calendar}
      />
      {!userId ? (
        <EmptyState title="Giriş yapmadın" message="Etkinliklerini görmek için giriş yap." />
      ) : status === 'loading' ? (
        <LoadingState message="Etkinliklerin yükleniyor..." />
      ) : status === 'error' ? (
        <ErrorState onRetry={loadEvents} />
      ) : (
        // AttendedEventsScreen/FavoritesScreen'deki aynı gerekçe: kartlar
        // tıklanamaz - bkz. bu ekranın başındaki Gün 36 notu (CalendarScreen'in
        // navigator'ında bir EventDetail rotası yok).
        <FlatList
          data={selectedDayEvents}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <EventCard event={item} />}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={<Text style={styles.dayTitle}>{formatLongDate(selectedDate)}</Text>}
          ListEmptyComponent={
            <EmptyState
              title="Bu tarihte etkinlik yok"
              message="Takvimden başka bir gün seçerek etkinliklerini görebilirsin."
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
    calendar: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    listContent: {
      padding: spacing.md,
      flexGrow: 1,
    },
    dayTitle: {
      fontSize: typography.fontSize.md,
      fontWeight: typography.fontWeight.bold,
      color: colors.text,
      marginBottom: spacing.sm,
    },
  });
}
