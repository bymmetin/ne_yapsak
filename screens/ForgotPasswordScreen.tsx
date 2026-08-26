import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Linking from 'expo-linking';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
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
import { z } from 'zod';

import { radius, spacing, typography } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';
import { authErrorMessage } from '../services/authErrors';
import { supabase } from '../services/supabase';
import type { AuthStackParamList } from '../types/navigation';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// EmailVerificationScreen.tsx > RESEND_WAIT_SECONDS ile aynı değer/gerekçe -
// Supabase'in over_email_send_rate_limit'ine takılmadan art arda "Kodu
// Tekrar Gönder"e basılmasını engellemek için.
const RESEND_WAIT_SECONDS = 30;

// Gün 38: link yerine 8 haneli kod akışı. Kendi kod üretme/saklama mantığımız
// yok - Supabase'in native OTP'si kullanılıyor (supabase.auth.verifyOtp,
// type: 'recovery'), e-posta şablonu Dashboard'dan ayrıca güncellendi.
// Uzunluk düzeltmesi: Supabase'in {{ .Token }}'ı bu tür OTP'ler için
// varsayılan olarak 6 değil 8 hane üretiyor - bağlantı sorunu değildi,
// baştaki 6 haneli varsayım yanlıştı.
const codeFormSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[0-9]{8}$/, 'Kod 8 haneli olmalı ve sadece rakam içermeli.'),
    newPassword: z.string().min(6, 'Şifre en az 6 karakter olmalı.'),
    newPasswordConfirm: z.string(),
  })
  .refine((data) => data.newPassword === data.newPasswordConfirm, {
    message: 'Şifreler eşleşmiyor.',
    path: ['newPasswordConfirm'],
  });

type CodeFormData = z.infer<typeof codeFormSchema>;

type Status = 'enter-email' | 'enter-code' | 'completed';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  // Sıfırlama linkinin kendisi (deep link) App.tsx'te kökte yakalanıp
  // exchangeCodeForSession ile işleniyor; PASSWORD_RECOVERY olayı
  // AuthContext'te global olarak dinlenip passwordRecoveryMode'a yansıtılıyor
  // (bkz. context/AuthContext.tsx). Bu true olduğu sürece App.tsx zaten
  // AuthStack'te kalıyor, biz de burada yeni şifre formuna geçiyoruz. Gün 38
  // notu: bu, aşağıdaki YENİ kod akışından (enter-code/submitCode) TAMAMEN
  // ayrı bir yol - deep-link'e hiç ihtiyaç duymuyor. AuthContext'in
  // PASSWORD_RECOVERY dinleme mantığına dokunulmadı; verifyOtp'nin de aynı
  // event'i tetikleyip tetiklemediği (tetiklerse kök passwordRecoveryMode'a
  // geçip bu ekranı bare AuthStack'e sıfırlayabilir) gerçek cihaz testinde
  // görülecek.
  const { passwordRecoveryMode, completePasswordRecovery } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [status, setStatus] = useState<Status>('enter-email');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [resendWaitSeconds, setResendWaitSeconds] = useState(0);

  const {
    control: codeControl,
    handleSubmit: handleCodeSubmit,
    formState: { errors: codeErrors },
  } = useForm<CodeFormData>({
    resolver: zodResolver(codeFormSchema),
    defaultValues: { code: '', newPassword: '', newPasswordConfirm: '' },
  });

  // EmailVerificationScreen.tsx'teki aynı geri sayım deseni.
  useEffect(() => {
    if (resendWaitSeconds <= 0) return;
    const timer = setTimeout(() => setResendWaitSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendWaitSeconds]);

  // Gün 38: resetPasswordForEmail çağrısının kendisi (endpoint, argümanlar,
  // hata ele alma) DEĞİŞMEDİ - tek fark başarı durumunda gidilen adım
  // ('link-sent' yerine 'enter-code') ve resendCode'un bu fonksiyonu tekrar
  // kullanabilmesi için eklenen boolean dönüş değeri.
  const sendLink = async (): Promise<boolean> => {
    setError(null);

    if (!EMAIL_PATTERN.test(email.trim())) {
      setError('Geçerli bir e-posta adresi gir.');
      return false;
    }

    setSubmitting(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: Linking.createURL('auth-callback'),
    });
    setSubmitting(false);

    if (resetError) {
      console.log('[ŞifremiUnuttum] resetPasswordForEmail HATA:', {
        message: resetError.message,
        status: resetError.status,
        code: resetError.code,
      });
      setError(resetError.message);
      return false;
    }

    console.log('[ŞifremiUnuttum] resetPasswordForEmail BAŞARILI.');
    setStatus('enter-code');
    return true;
  };

  const resendCode = async () => {
    if (submitting || resendWaitSeconds > 0) return;
    const success = await sendLink();
    if (success) {
      setCodeError(null);
      setResendWaitSeconds(RESEND_WAIT_SECONDS);
    }
  };

  // Gün 38: yeni akış - kod + yeni şifre tek formda, sırayla verifyOtp
  // (kodu doğrular, geçici bir recovery session kurar) ve updateUser
  // (o session'ı kullanarak şifreyi günceller).
  const submitCode = async (data: CodeFormData) => {
    setCodeError(null);
    setSubmitting(true);

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: data.code.trim(),
      type: 'recovery',
    });

    if (verifyError) {
      setSubmitting(false);
      console.log('[ŞifremiUnuttum] verifyOtp HATA:', {
        message: verifyError.message,
        status: verifyError.status,
        code: verifyError.code,
      });
      setCodeError(authErrorMessage(verifyError));
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: data.newPassword,
    });
    setSubmitting(false);

    if (updateError) {
      console.log('[ŞifremiUnuttum] updateUser (kod sonrası) HATA:', {
        message: updateError.message,
        status: updateError.status,
        code: updateError.code,
      });
      setCodeError(authErrorMessage(updateError));
      return;
    }

    console.log('[ŞifremiUnuttum] Kod doğrulandı + şifre güncellendi.');
    setStatus('completed');
    // verifyOtp({type:'recovery'}) de deep-link akışıyla aynı şekilde
    // PASSWORD_RECOVERY event'ini tetikleyip passwordRecoveryMode'u true
    // yapıyor (bkz. AuthContext.tsx). Bu YENİ akış onu geri false'a
    // çekmeden bırakırsa App.tsx kökü kalıcı olarak bare AuthStack'te kilitli
    // kalır (session kurulsa/Giriş Yap yapılsa bile TabNavigator'a hiç
    // geçilmez) - eski akıştaki updatePassword() bunu zaten yapıyordu, burada
    // eksikti.
    completePasswordRecovery();
  };

  // Deep-link/passwordRecoveryMode akışının kendi "Şifreyi Güncelle" formu -
  // Gün 38'de DOKUNULMADI, aşağıdaki YENİ 'enter-code' adımından bağımsız.
  const updatePassword = async () => {
    setError(null);

    if (newPassword.length < 6) {
      setError('Şifre en az 6 karakter olmalı.');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setError('Şifreler eşleşmiyor.');
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setSubmitting(false);

    if (updateError) {
      console.log('[ŞifremiUnuttum] updateUser HATA:', {
        message: updateError.message,
        status: updateError.status,
        code: updateError.code,
      });
      setError(updateError.message);
      return;
    }

    console.log('[ŞifremiUnuttum] updateUser BAŞARILI.');
    setStatus('completed');
    // passwordRecoveryMode'u kapatır; App.tsx kökü artık TabNavigator'a
    // geçebilir (session zaten PASSWORD_RECOVERY'den beri mevcuttu).
    completePasswordRecovery();
  };

  if (status === 'completed') {
    return (
      <View style={styles.statusContainer}>
        <Ionicons name="checkmark-circle" size={64} color={colors.success} />
        <Text style={styles.statusTitle}>Şifren güncellendi!</Text>
        <Text style={styles.statusText}>Yeni şifrenle giriş yapabilirsin.</Text>
        <Pressable
          style={[styles.button, styles.statusButton]}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.buttonText}>Giriş Yap</Text>
        </Pressable>
      </View>
    );
  }

  if (passwordRecoveryMode) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Yeni Şifre Belirle</Text>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Yeni Şifre</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
          </View>
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Yeni Şifre (Tekrar)</Text>
            <TextInput
              style={styles.input}
              value={newPasswordConfirm}
              onChangeText={setNewPasswordConfirm}
              secureTextEntry
            />
          </View>

          {error && <Text style={styles.generalError}>{error}</Text>}

          <Pressable
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={updatePassword}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Şifreyi Güncelle</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (status === 'enter-code') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Kodu Gir</Text>
          <Text style={styles.description}>
            <Text style={styles.email}>{email.trim()}</Text> adresine 8 haneli bir kod gönderdik.
            Kodu ve yeni şifreni aşağıya gir.
          </Text>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Doğrulama Kodu</Text>
            <Controller
              control={codeControl}
              name="code"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextInput
                  style={[styles.input, codeErrors.code && styles.inputError]}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="number-pad"
                  maxLength={8}
                  placeholder="12345678"
                  placeholderTextColor={colors.textSecondary}
                />
              )}
            />
            {codeErrors.code && <Text style={styles.fieldError}>{codeErrors.code.message}</Text>}
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Yeni Şifre</Text>
            <Controller
              control={codeControl}
              name="newPassword"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextInput
                  style={[styles.input, codeErrors.newPassword && styles.inputError]}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry
                />
              )}
            />
            {codeErrors.newPassword && (
              <Text style={styles.fieldError}>{codeErrors.newPassword.message}</Text>
            )}
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Yeni Şifre (Tekrar)</Text>
            <Controller
              control={codeControl}
              name="newPasswordConfirm"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextInput
                  style={[styles.input, codeErrors.newPasswordConfirm && styles.inputError]}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry
                />
              )}
            />
            {codeErrors.newPasswordConfirm && (
              <Text style={styles.fieldError}>{codeErrors.newPasswordConfirm.message}</Text>
            )}
          </View>

          {codeError && <Text style={styles.generalError}>{codeError}</Text>}

          <Pressable
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={handleCodeSubmit(submitCode)}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Şifreyi Güncelle</Text>
            )}
          </Pressable>

          <Pressable
            onPress={resendCode}
            style={styles.resendLink}
            disabled={submitting || resendWaitSeconds > 0}
          >
            <Text
              style={[
                styles.resendText,
                (submitting || resendWaitSeconds > 0) && styles.resendTextDisabled,
              ]}
            >
              {resendWaitSeconds > 0
                ? `Kodu Tekrar Gönder (${resendWaitSeconds}s)`
                : 'Kodu Tekrar Gönder'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Şifremi Unuttum</Text>
        <Text style={styles.description}>
          Hesabına kayıtlı e-posta adresini gir, sana 8 haneli bir doğrulama kodu gönderelim.
        </Text>

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

        {error && <Text style={styles.generalError}>{error}</Text>}

        <Pressable
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={sendLink}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Kod Gönder</Text>
          )}
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
      marginBottom: spacing.sm,
    },
    description: {
      fontSize: typography.fontSize.md,
      color: colors.textSecondary,
      marginBottom: spacing.lg,
      lineHeight: typography.lineHeight.md,
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
    inputError: {
      borderColor: colors.error,
    },
    fieldError: {
      marginTop: spacing.xs,
      fontSize: typography.fontSize.xs,
      color: colors.error,
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
    statusButton: {
      marginTop: spacing.xl,
      paddingHorizontal: spacing.xl,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: colors.white,
      fontWeight: typography.fontWeight.bold,
      fontSize: typography.fontSize.md,
    },
    resendLink: {
      alignSelf: 'center',
      marginTop: spacing.lg,
    },
    resendText: {
      fontSize: typography.fontSize.sm,
      color: colors.primary,
      fontWeight: typography.fontWeight.medium,
    },
    resendTextDisabled: {
      color: colors.textSecondary,
    },
    statusContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      padding: spacing.xl,
    },
    statusTitle: {
      marginTop: spacing.lg,
      fontSize: typography.fontSize.xl,
      fontWeight: typography.fontWeight.bold,
      color: colors.text,
      textAlign: 'center',
    },
    statusText: {
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
  });
}
