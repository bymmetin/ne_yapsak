import { StyleSheet, Text } from 'react-native';

import { colors, radius, spacing, typography } from '../constants/theme';
import { Kategori } from '../types';

// EtkinlikKarti (liste) ve EtkinlikDetayScreen'de birebir aynı etiket
// stiliyle tekrarlanıyordu; Gün 6 temizliğinde tek bileşene taşındı.
export const KATEGORI_ETIKETLERI: Record<Kategori, string> = {
  muzik: 'Müzik',
  spor: 'Spor',
  sanat: 'Sanat',
  yemek: 'Yemek',
  egitim: 'Eğitim',
  teknoloji: 'Teknoloji',
  diger: 'Diğer',
};

type Props = {
  kategori: Kategori;
};

export default function KategoriEtiket({ kategori }: Props) {
  return <Text style={styles.etiket}>{KATEGORI_ETIKETLERI[kategori]}</Text>;
}

const styles = StyleSheet.create({
  etiket: {
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
});
