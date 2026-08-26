import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typography } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';

type Props = {
  title?: string;
  message?: string;
  // Gün 38: guest modda ProfileScreen/EventCreateScreen'in "giriş yapmalısın"
  // istemini de bu bileşenle göstermek için eklendi - ErrorState.tsx'teki
  // onRetry butonuyla aynı görsel dil (radius.md/colors.primary), ikisi de
  // opsiyonel: verilmezse buton hiç render edilmiyor (EventCard.tsx >
  // onToggleFavorite'teki aynı "opsiyonel prop = özelliği gizle" deseni).
  actionLabel?: string;
  onAction?: () => void;
};

export default function EmptyState({
  title = 'Henüz etkinlik yok',
  message = 'Yeni bir etkinlik oluşturarak ilk sen başlat.',
  actionLabel,
  onAction,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Ionicons name="calendar-outline" size={48} color={colors.textSecondary} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction && (
        <Pressable style={styles.button} onPress={onAction}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    title: {
      marginTop: spacing.md,
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.bold,
      color: colors.text,
    },
    message: {
      marginTop: spacing.xs,
      fontSize: typography.fontSize.sm,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    button: {
      marginTop: spacing.lg,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
    },
    buttonText: {
      color: colors.white,
      fontWeight: typography.fontWeight.bold,
      fontSize: typography.fontSize.sm,
    },
  });
}
