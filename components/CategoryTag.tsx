import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';

import { radius, spacing, typography } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';
import { Category } from '../types';

// EventCard (liste) ve EventDetailScreen'de birebir aynı etiket
// stiliyle tekrarlanıyordu; Gün 6 temizliğinde tek bileşene taşındı.
export const CATEGORY_LABELS: Record<Category, string> = {
  muzik: 'Müzik',
  spor: 'Spor',
  sanat: 'Sanat',
  yemek: 'Yemek',
  egitim: 'Eğitim',
  teknoloji: 'Teknoloji',
  diger: 'Diğer',
};

type Props = {
  category: Category;
};

export default function CategoryTag({ category }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return <Text style={styles.label}>{CATEGORY_LABELS[category]}</Text>;
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    label: {
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
}
