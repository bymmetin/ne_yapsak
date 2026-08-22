import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';

import BosDurum from '../components/BosDurum';
import EtkinlikKarti from '../components/EtkinlikKarti';
import { colors, spacing, typography } from '../constants/theme';
import { mockEtkinlikler } from '../services/mockData';

const AYLAR_UZUN = [
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

function bugununTarihi(): string {
  const bugun = new Date();
  const yil = bugun.getFullYear();
  const ay = String(bugun.getMonth() + 1).padStart(2, '0');
  const gun = String(bugun.getDate()).padStart(2, '0');
  return `${yil}-${ay}-${gun}`;
}

function formatUzunTarih(tarihStr: string): string {
  const [yil, ay, gun] = tarihStr.split('-').map(Number);
  return `${gun} ${AYLAR_UZUN[ay - 1]} ${yil}`;
}

// Takvim ilk açıldığında hangi ayın gösterileceğini belirler; modül yüklendiğinde
// bir kez hesaplanır. Bunu her render'da yeniden hesaplamak (veya doğrudan
// secilenTarih state'ine bağlamak) react-native-calendars'ın her gün
// dokunuşunda ay görünümünü sıfırlamasına ve gereksiz yeniden render'lara
// yol açıyordu; sabit bir başlangıç değeri kullanmak bunu ortadan kaldırır.
const BUGUN = bugununTarihi();

// Component dışında sabit: her render'da yeni bir obje oluşmasını önler.
// (react-native-calendars'ın Day bileşeni React.memo ile sarılı; theme
// objesinin her render'da yeni referans alması tüm günlerin gereksiz yere
// yeniden render olmasına, dolayısıyla dokunmaların bazı cihazlarda es
// geçilmesine yol açabiliyordu.)
const TAKVIM_TEMASI = {
  todayTextColor: colors.primary,
  arrowColor: colors.primary,
  selectedDayBackgroundColor: colors.primary,
  selectedDayTextColor: colors.white,
  dotColor: colors.primary,
  textDayFontSize: typography.fontSize.sm,
  textMonthFontWeight: typography.fontWeight.bold,
};

type GunIsareti = {
  marked?: boolean;
  dotColor?: string;
  selected?: boolean;
  selectedColor?: string;
  selectedTextColor?: string;
};

export default function TakvimScreen() {
  const [secilenTarih, setSecilenTarih] = useState(BUGUN);

  const isaretliGunler = useMemo(() => {
    const gunler: Record<string, GunIsareti> = {};
    mockEtkinlikler.forEach((etkinlik) => {
      gunler[etkinlik.tarih] = { marked: true, dotColor: colors.primary };
    });
    gunler[secilenTarih] = {
      ...gunler[secilenTarih],
      selected: true,
      selectedColor: colors.primary,
      selectedTextColor: colors.white,
    };
    return gunler;
  }, [secilenTarih]);

  const secilenGunEtkinlikleri = useMemo(
    () => mockEtkinlikler.filter((etkinlik) => etkinlik.tarih === secilenTarih),
    [secilenTarih],
  );

  const gunSecildi = useCallback((gun: DateData) => {
    setSecilenTarih(gun.dateString);
  }, []);

  return (
    <View style={styles.container}>
      <Calendar
        initialDate={BUGUN}
        markedDates={isaretliGunler}
        onDayPress={gunSecildi}
        theme={TAKVIM_TEMASI}
        style={styles.takvim}
      />
      <FlatList
        data={secilenGunEtkinlikleri}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <EtkinlikKarti etkinlik={item} />}
        contentContainerStyle={styles.listeIcerik}
        ListHeaderComponent={<Text style={styles.gunBasligi}>{formatUzunTarih(secilenTarih)}</Text>}
        ListEmptyComponent={
          <BosDurum
            baslik="Bu tarihte etkinlik yok"
            mesaj="Takvimden başka bir gün seçerek etkinlikleri görebilirsin."
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  takvim: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listeIcerik: {
    padding: spacing.md,
    flexGrow: 1,
  },
  gunBasligi: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
});
