import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { radius, spacing, typography } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';
import { authErrorMessage } from '../services/authErrors';
import { supabase } from '../services/supabase';
import type { AuthStackParamList } from '../types/navigation';

// expo-web-browser'ın önerdiği kurulum çağrısı (web'de auth session'ı
// kapatmak için gerekli, native'de zararsız no-op).
WebBrowser.maybeCompleteAuthSession();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REDIRECT_URL = Linking.createURL('auth-callback');

// RegisterScreen.tsx > validateForm ile aynı gerekçe: network'ten bağımsız,
// Jest ile (Gün 37) test edilebilir saf bir fonksiyon olarak ayrıştırıldı.
export function validateLoginForm(email: string, password: string): string | null {
  if (!EMAIL_PATTERN.test(email.trim())) {
    return 'Geçerli bir e-posta adresi gir.';
  }
  if (password.length === 0) {
    return 'Şifreni gir.';
  }
  return null;
}

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  // Başarılı girişten sonra ayrıca bir şey yapmaya gerek yok: AuthContext'in
  // onAuthStateChange aboneliği oturumu yakalayıp App.tsx'teki kökü
  // otomatik olarak TabNavigator'a geçirir, bu ekran kendiliğinden unmount
  // olur.
  const login = async () => {
    setError(null);

    const validationError = validateLoginForm(email, password);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setSubmitting(false);

    if (signInError) {
      console.log('[Giriş] signInWithPassword HATA:', {
        message: signInError.message,
        status: signInError.status,
        code: signInError.code,
      });
      setError(authErrorMessage(signInError));
    }
  };

  // --- Google ile giriş (Supabase OAuth) -----------------------------
  // NOT: Bu bölüm henüz test EDİLMEDİ. Test edilebilmesi için önce:
  //   1) Google Cloud Console'da bir OAuth client oluşturulmalı,
  //   2) Supabase Dashboard > Authentication > Providers > Google'da
  //      etkinleştirilip client ID/secret girilmeli,
  //   3) Redirect URLs listesinde bu ekranın REDIRECT_URL'i olmalı
  //      (Gün 8'de kayıt için eklediğin aynı adres, ek bir şey gerekmiyor).
  // Bu üç adım da Supabase/Google panelinde yapılıyor, kod tarafından
  // yapılamıyor. Akış: signInWithOAuth PKCE URL'i üretir, WebBrowser bunu
  // uygulama içi tarayıcıda açar, kullanıcı Google'da onaylayınca
  // REDIRECT_URL'e geri döner ve App.tsx'teki global deep-link
  // dinleyicisi (RegisterScreen/ForgotPassword'la aynı mekanizma)
  // exchangeCodeForSession'ı çağırır.
  const loginWithGoogle = async () => {
    setError(null);
    setGoogleSubmitting(true);

    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: REDIRECT_URL,
        skipBrowserRedirect: true,
      },
    });

    if (oauthError || !data.url) {
      console.log('[Giriş] signInWithOAuth HATA:', {
        message: oauthError?.message,
        status: oauthError?.status,
        code: oauthError?.code,
      });
      setGoogleSubmitting(false);
      setError(oauthError ? authErrorMessage(oauthError) : 'Google ile giriş başlatılamadı.');
      return;
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URL);
    console.log('[Giriş] Google OAuth tarayıcı sonucu:', result.type);
    setGoogleSubmitting(false);
  };
  // --- Google ile giriş sonu ------------------------------------------

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Giriş Yap</Text>

        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>E-posta</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Şifre</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgotLink}>
          <Text style={styles.forgotText}>Şifremi Unuttum</Text>
        </Pressable>

        {error && <Text style={styles.generalError}>{error}</Text>}

        <Pressable
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={login}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Giriş Yap</Text>
          )}
        </Pressable>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>veya</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable
          style={[styles.googleButton, googleSubmitting && styles.buttonDisabled]}
          onPress={loginWithGoogle}
          disabled={googleSubmitting}
        >
          {googleSubmitting ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={styles.googleButtonText}>Google ile Giriş Yap</Text>
          )}
        </Pressable>

        <Pressable onPress={() => navigation.navigate('Register')} style={styles.registerLink}>
          <Text style={styles.registerText}>Hesabın yok mu? Kayıt Ol</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: spacing.lg,
    },
    title: {
      fontSize: typography.fontSize.xxl,
      fontWeight: typography.fontWeight.bold,
      color: colors.text,
      marginBottom: spacing.lg,
    },
    fieldContainer: {
      marginBottom: spacing.md,
    },
    fieldLabel: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      color: colors.text,
      marginBottom: spacing.xs,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: typography.fontSize.md,
      color: colors.text,
      // Gün 35: eskiden colors.white - yüzey arkaplanı, temayla koyulaşmalı
      // (bkz. EventForm.tsx > input notu, aynı gerekçe).
      backgroundColor: colors.surface,
    },
    forgotLink: {
      alignSelf: 'flex-end',
      marginBottom: spacing.md,
    },
    forgotText: {
      fontSize: typography.fontSize.sm,
      color: colors.primary,
      fontWeight: typography.fontWeight.medium,
    },
    generalError: {
      marginBottom: spacing.md,
      fontSize: typography.fontSize.sm,
      color: colors.error,
      textAlign: 'center',
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
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
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: spacing.lg,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerText: {
      marginHorizontal: spacing.sm,
      fontSize: typography.fontSize.xs,
      color: colors.textSecondary,
    },
    googleButton: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      // Gün 35: eskiden colors.white - aynı gerekçe (yukarıdaki input notu).
      backgroundColor: colors.surface,
    },
    googleButtonText: {
      color: colors.text,
      fontWeight: typography.fontWeight.medium,
      fontSize: typography.fontSize.md,
    },
    registerLink: {
      alignSelf: 'center',
      marginTop: spacing.lg,
    },
    registerText: {
      fontSize: typography.fontSize.sm,
      color: colors.primary,
      fontWeight: typography.fontWeight.medium,
    },
  });
}
