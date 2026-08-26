import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typography } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';

type Props = {
  message?: string;
  onRetry?: () => void;
};

export default function ErrorState({
  message = 'Etkinlikler yüklenirken bir sorun oluştu.',
  onRetry,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <Pressable style={styles.button} onPress={onRetry}>
          <Text style={styles.buttonText}>Tekrar Dene</Text>
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
    message: {
      marginTop: spacing.md,
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
      // Buton her zaman colors.primary arkaplanlı - metin rengi kasıtlı
      // olarak invariant (bkz. context/ThemeContext.tsx > Gün 35 karar notu).
      color: colors.white,
      fontWeight: typography.fontWeight.bold,
      fontSize: typography.fontSize.sm,
    },
  });
}
