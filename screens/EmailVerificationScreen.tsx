import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typography } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';
import { supabase } from '../services/supabase';
import type { AuthStackParamList } from '../types/navigation';

const RESEND_WAIT_SECONDS = 30;

type Props = NativeStackScreenProps<AuthStackParamList, 'EmailVerification'>;

// Doğrulama linkinin kendisi (deep link) App.tsx'te kökte yakalanıp
// exchangeCodeForSession ile işleniyor; oturum kurulunca AuthContext'in
// global onAuthStateChange aboneliği bunu yakalayıp App.tsx'teki kökü
// otomatik olarak TabNavigator'a geçirir — bu ekran hangi anda mount
// olursa olsun kendiliğinden unmount olur, burada ayrıca bir şey
// dinlemeye gerek yok.
export default function EmailVerificationScreen({ route }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { email } = route.params;
  const [submitting, setSubmitting] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (waitSeconds <= 0) return;
    const timer = setTimeout(() => setWaitSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [waitSeconds]);

  const resend = async () => {
    setSubmitting(true);
    setMessage(null);
    const { data, error } = await supabase.auth.resend({ type: 'signup', email });
    setSubmitting(false);

    if (error) {
      console.log('[EmailDogrulama] resend HATA:', {
        message: error.message,
        status: error.status,
        code: error.code,
      });
      setMessage(error.message);
      return;
    }

    console.log('[EmailDogrulama] resend BAŞARILI:', data);
    setMessage('Doğrulama e-postası tekrar gönderildi.');
    setWaitSeconds(RESEND_WAIT_SECONDS);
  };

  return (
    <View style={styles.container}>
      <Ionicons name="mail-outline" size={64} color={colors.primary} />
      <Text style={styles.title}>E-postanı kontrol et</Text>
      <Text style={styles.description}>
        <Text style={styles.email}>{email}</Text> adresine bir doğrulama linki gönderdik. Linke
        tıklayınca bu ekrana otomatik döneceksin.
      </Text>

      {message && <Text style={styles.infoMessage}>{message}</Text>}

      <Pressable
        style={[styles.button, (submitting || waitSeconds > 0) && styles.buttonDisabled]}
        onPress={resend}
        disabled={submitting || waitSeconds > 0}
      >
        {submitting ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.buttonText}>
            {waitSeconds > 0 ? `Tekrar Gönder (${waitSeconds}s)` : 'Tekrar Gönder'}
          </Text>
        )}
      </Pressable>
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
      padding: spacing.xl,
    },
    title: {
      marginTop: spacing.lg,
      fontSize: typography.fontSize.xl,
      fontWeight: typography.fontWeight.bold,
      color: colors.text,
      textAlign: 'center',
    },
    description: {
      marginTop: spacing.sm,
      fontSize: typography.fontSize.md,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: typography.lineHeight.md,
    },
    email: {
      fontWeight: typography.fontWeight.bold,
      color: colors.text,
    },
    infoMessage: {
      marginTop: spacing.md,
      fontSize: typography.fontSize.sm,
      color: colors.primary,
      textAlign: 'center',
    },
    button: {
      marginTop: spacing.xl,
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      alignItems: 'center',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: colors.white,
      fontWeight: typography.fontWeight.bold,
      fontSize: typography.fontSize.md,
    },
  });
}
