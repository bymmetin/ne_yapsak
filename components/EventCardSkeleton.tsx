import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import SkeletonBox from './SkeletonBox';
import { radius, spacing } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';

// EventCard.tsx'teki gerçek kartla aynı iskelet (kapak yüksekliği 140,
// content padding'i spacing.md) - liste yüklenirken kartların son halinin
// yerini önceden çiziyor, ani bir "zıplama" olmasın diye.
export default function EventCardSkeleton() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.card}>
      <SkeletonBox height={140} borderRadius={0} />
      <View style={styles.content}>
        <SkeletonBox width={72} height={20} borderRadius={radius.full} />
        <SkeletonBox width="70%" height={20} style={styles.title} />
        <SkeletonBox width="55%" height={14} style={styles.row} />
        <SkeletonBox width="40%" height={14} style={styles.row} />
      </View>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      marginBottom: spacing.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    content: {
      padding: spacing.md,
    },
    title: {
      marginTop: spacing.sm,
    },
    row: {
      marginTop: spacing.xs,
    },
  });
}
