import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../constants/theme';
import { Etkinlik, Kategori } from '../types';

const KATEGORI_ETIKETLERI: Record<Kategori, string> = {
  muzik: 'Müzik',
  spor: 'Spor',
  sanat: 'Sanat',
  yemek: 'Yemek',
  egitim: 'Eğitim',
  teknoloji: 'Teknoloji',
  diger: 'Diğer',
};

const AYLAR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

function formatTarihSaat(tarih: string, saat: string): string {
  const [yil, ay, gun] = tarih.split('-').map(Number);
  return `${gun} ${AYLAR[ay - 1]} ${yil}, ${saat}`;
}

type Props = {
  etkinlik: Etkinlik;
};

export default function EtkinlikKarti({ etkinlik }: Props) {
  return (
    <View style={styles.card}>
      {etkinlik.kapakFotoUrl ? (
        <Image source={{ uri: etkinlik.kapakFotoUrl }} style={styles.kapak} />
      ) : (
        <View style={[styles.kapak, styles.kapakPlaceholder]}>
          <Ionicons name="image-outline" size={32} color={colors.textSecondary} />
        </View>
      )}
      <View style={styles.icerik}>
        <Text style={styles.kategoriEtiket}>{KATEGORI_ETIKETLERI[etkinlik.kategori]}</Text>
        <Text style={styles.baslik} numberOfLines={2}>
          {etkinlik.baslik}
        </Text>
        <View style={styles.satir}>
          <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.detayMetin}>{formatTarihSaat(etkinlik.tarih, etkinlik.saat)}</Text>
        </View>
        <View style={styles.satir}>
          <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.detayMetin}>
            {etkinlik.katilimciSayisi}/{etkinlik.kapasite} katılımcı
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  kapak: {
    width: '100%',
    height: 140,
  },
  kapakPlaceholder: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icerik: {
    padding: spacing.md,
  },
  kategoriEtiket: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    color: colors.primary,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  baslik: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  detayMetin: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
});
