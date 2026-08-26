import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
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
import { authErrorMessage, EMAIL_ALREADY_REGISTERED_MESSAGE } from '../services/authErrors';
import { supabase } from '../services/supabase';
import type { AuthStackParamList } from '../types/navigation';

// Doğrulama linkine tıklanınca kullanıcının geri döneceği adres. Expo Go'da
// exp://<ip>:8081/--/auth-callback, development/production build'de
// neyapsak://auth-callback üretir - Linking.createURL ortamı kendisi
// algılar. TANI AMAÇLI: Supabase Dashboard > Authentication > URL
// Configuration > Redirect URLs'e eklenecek tam değeri görmek için
// konsola yazdırılıyor; adres doğrulanınca bu log kaldırılabilir.
const EMAIL_REDIRECT_URL = Linking.createURL('auth-callback');
console.log('[Kayıt] emailRedirectTo:', EMAIL_REDIRECT_URL);

export type FormFields = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  passwordConfirm: string;
};

type FormErrors = Partial<Record<keyof FormFields, string>>;

const EMPTY_FORM: FormFields = {
  firstName: '',
  lastName: '',
  username: '',
  email: '',
  password: '',
  passwordConfirm: '',
};

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Jest ile (Gün 37) test edilebilmesi için export edildi - network'ten
// bağımsız saf bir fonksiyon.
export function validateForm(fields: FormFields): FormErrors {
  const errors: FormErrors = {};

  if (fields.firstName.trim().length < 2) {
    errors.firstName = 'Ad en az 2 karakter olmalı.';
  }
  if (fields.lastName.trim().length < 2) {
    errors.lastName = 'Soyad en az 2 karakter olmalı.';
  }
  if (!USERNAME_PATTERN.test(fields.username.trim())) {
    errors.username = '3-20 karakter, sadece küçük harf, rakam ve alt çizgi.';
  }
  if (!EMAIL_PATTERN.test(fields.email.trim())) {
    errors.email = 'Geçerli bir e-posta adresi gir.';
  }
  if (fields.password.length < 6) {
    errors.password = 'Şifre en az 6 karakter olmalı.';
  }
  if (fields.passwordConfirm !== fields.password) {
    errors.passwordConfirm = 'Şifreler eşleşmiyor.';
  }

  return errors;
}

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [fields, setFields] = useState<FormFields>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const updateField = (field: keyof FormFields, value: string) => {
    setFields((prev) => ({ ...prev, [field]: value }));
  };

  const register = async () => {
    const newErrors = validateForm(fields);
    setErrors(newErrors);
    setGeneralError(null);

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    const email = fields.email.trim();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: fields.password,
      options: {
        // Gün 12'deki profil oluşturma trigger'ı bu metadata'yı okuyacak.
        data: {
          ad: fields.firstName.trim(),
          soyad: fields.lastName.trim(),
          kullanici_adi: fields.username.trim(),
        },
        emailRedirectTo: EMAIL_REDIRECT_URL,
      },
    });
    setSubmitting(false);

    if (error) {
      setGeneralError(authErrorMessage(error));
      return;
    }

    // Supabase e-posta numaralandırma koruması: e-posta zaten kayıtlıysa
    // signUp hata döndürmez, data.user dolu gelir ama identities dizisi boş
    // olur (yeni kullanıcıda en az bir "email" identity'si bulunur). Bu,
    // "zaten kayıtlı" durumunu ayırt etmek için elimizdeki tek güvenilir
    // sinyal.
    console.log('[Kayıt] identities uzunluğu:', data.user?.identities?.length);
    if (data.user && data.user.identities?.length === 0) {
      setGeneralError(EMAIL_ALREADY_REGISTERED_MESSAGE);
      return;
    }

    navigation.navigate('EmailVerification', { email });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Kayıt Ol</Text>

        <FormField
          styles={styles}
          label="Ad"
          value={fields.firstName}
          onChange={(v) => updateField('firstName', v)}
          error={errors.firstName}
        />
        <FormField
          styles={styles}
          label="Soyad"
          value={fields.lastName}
          onChange={(v) => updateField('lastName', v)}
          error={errors.lastName}
        />
        <FormField
          styles={styles}
          label="Kullanıcı Adı"
          value={fields.username}
          onChange={(v) => updateField('username', v.toLowerCase())}
          error={errors.username}
          autoCapitalize="none"
        />
        <FormField
          styles={styles}
          label="E-posta"
          value={fields.email}
          onChange={(v) => updateField('email', v)}
          error={errors.email}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <FormField
          styles={styles}
          label="Şifre"
          value={fields.password}
          onChange={(v) => updateField('password', v)}
          error={errors.password}
          secure
        />
        <FormField
          styles={styles}
          label="Şifre (Tekrar)"
          value={fields.passwordConfirm}
          onChange={(v) => updateField('passwordConfirm', v)}
          error={errors.passwordConfirm}
          secure
        />

        {generalError && <Text style={styles.generalError}>{generalError}</Text>}

        <Pressable
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={register}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Kayıt Ol</Text>
          )}
        </Pressable>

        <Pressable onPress={() => navigation.navigate('Login')} style={styles.loginLink}>
          <Text style={styles.loginText}>Zaten hesabın var mı? Giriş Yap</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Gün 35: RegisterScreen'in bileşen dışında (modül seviyesinde) tanımlı
// olduğu için - her render'da yeniden tanımlanıp React'in onu farklı bir
// component tipi sanıp gereksiz yere remount etmesini önlemek adına
// RegisterScreen'in İÇİNE taşınmadı - artık tema-bağımlı `styles`'a kendi
// başına (bir hook ile) erişemiyor, bu yüzden çağıran yerden prop olarak
// alıyor.
type FormFieldProps = {
  styles: ReturnType<typeof createStyles>;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  secure?: boolean;
  autoCapitalize?: 'none' | 'sentences';
  keyboardType?: 'default' | 'email-address';
};

function FormField({
  styles,
  label,
  value,
  onChange,
  error,
  secure,
  autoCapitalize = 'sentences',
  keyboardType = 'default',
}: FormFieldProps) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, error && styles.inputError]}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
      />
      {error && <Text style={styles.fieldError}>{error}</Text>}
    </View>
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
      marginTop: spacing.sm,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: colors.white,
      fontWeight: typography.fontWeight.bold,
      fontSize: typography.fontSize.md,
    },
    loginLink: {
      alignSelf: 'center',
      marginTop: spacing.lg,
    },
    loginText: {
      fontSize: typography.fontSize.sm,
      color: colors.primary,
      fontWeight: typography.fontWeight.medium,
    },
  });
}
