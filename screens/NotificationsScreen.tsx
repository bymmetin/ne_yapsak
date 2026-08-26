// Gün 28: Bildirim izni akışı. Şimdilik bu ekranın tek işi bu - gerçek
// bildirim LİSTESİ (ör. "X etkinliğine katıldın" geçmişi) bu planın kapsamında
// yok, sadece izin durumu ve push token toplama altyapısı gösteriliyor.

import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typography } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';
import { registerForPushNotificationsAsync, saveExpoPushToken } from '../services/notifications';

type Status = 'yukleniyor' | 'izin-verildi' | 'izin-reddedildi';

export default function NotificationsScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [status, setStatus] = useState<Status>('yukleniyor');

  // LocationPicker.tsx > useCurrentLocation ile aynı gerekçe: izin reddi bir
  // hata değil, bu yüzden burada da Alert yerine ekranda kalıcı bir durum
  // mesajı gösteriyoruz - kullanıcı "Tekrar Dene"ye basıp ayarlardan izni
  // açtıktan sonra buraya dönebilsin.
  const attemptRegistration = useCallback(async () => {
    setStatus('yukleniyor');
    const result = await registerForPushNotificationsAsync();

    if (!result.granted) {
      setStatus('izin-reddedildi');
      return;
    }

    setStatus('izin-verildi');

    // Token bu ortamda alınamamış olabilir (bkz. registerForPushNotifications-
    // Async > Gün 28 notu, EAS projectId yok) - o durumda kaydedecek bir şey
    // yok, izin yine de "verildi" sayılıyor.
    if (userId && result.expoPushToken) {
      saveExpoPushToken(userId, result.expoPushToken);
    }
  }, [userId]);

  useEffect(() => {
    attemptRegistration();
  }, [attemptRegistration]);

  return (
    <View style={styles.container}>
      {status === 'yukleniyor' && (
        <>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.message}>Bildirim izni kontrol ediliyor...</Text>
        </>
      )}

      {status === 'izin-verildi' && (
        <>
          <Ionicons name="notifications" size={40} color={colors.primary} />
          <Text style={styles.title}>Bildirimler açık</Text>
          <Text style={styles.message}>
            Etkinlik hatırlatmaları ve güncellemeler için bildirim izni verildi.
          </Text>
        </>
      )}

      {status === 'izin-reddedildi' && (
        <>
          <Ionicons name="notifications-off-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.title}>Bildirim izni verilmedi</Text>
          <Text style={styles.message}>
            Etkinlik hatırlatmalarını alabilmek için ayarlardan bildirim iznini açman gerekiyor.
          </Text>
          <Pressable style={styles.retryButton} onPress={attemptRegistration}>
            <Text style={styles.retryButtonText}>Tekrar Dene</Text>
          </Pressable>
        </>
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
      backgroundColor: colors.background,
      padding: spacing.lg,
    },
    title: {
      marginTop: spacing.md,
      fontSize: typography.fontSize.xl,
      fontWeight: typography.fontWeight.bold,
      color: colors.text,
    },
    message: {
      marginTop: spacing.sm,
      fontSize: typography.fontSize.sm,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    retryButton: {
      marginTop: spacing.lg,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.primary,
      borderRadius: radius.md,
    },
    retryButtonText: {
      color: colors.white,
      fontWeight: typography.fontWeight.medium,
    },
  });
}
