import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useState } from 'react';
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

import { colors, radius, spacing, typography } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';

const EMAIL_DESENI = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Durum = 'email-gir' | 'link-gonderildi' | 'tamamlandi';

export default function SifremiUnuttumScreen() {
  // Sıfırlama linkinin kendisi (deep link) App.tsx'te kökte yakalanıp
  // exchangeCodeForSession ile işleniyor; PASSWORD_RECOVERY olayı
  // AuthContext'te global olarak dinlenip sifreKurtarmaModu'na yansıtılıyor
  // (bkz. context/AuthContext.tsx). Bu true olduğu sürece App.tsx zaten
  // AuthStack'te kalıyor, biz de burada yeni şifre formuna geçiyoruz.
  const { sifreKurtarmaModu, sifreKurtarmaTamamlandi } = useAuth();
  const [durum, setDurum] = useState<Durum>('email-gir');
  const [email, setEmail] = useState('');
  const [yeniSifre, setYeniSifre] = useState('');
  const [yeniSifreTekrar, setYeniSifreTekrar] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const linkGonder = async () => {
    setHata(null);

    if (!EMAIL_DESENI.test(email.trim())) {
      setHata('Geçerli bir e-posta adresi gir.');
      return;
    }

    setGonderiliyor(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: Linking.createURL('auth-callback'),
    });
    setGonderiliyor(false);

    if (error) {
      console.log('[ŞifremiUnuttum] resetPasswordForEmail HATA:', {
        message: error.message,
        status: error.status,
        code: error.code,
      });
      setHata(error.message);
      return;
    }

    console.log('[ŞifremiUnuttum] resetPasswordForEmail BAŞARILI.');
    setDurum('link-gonderildi');
  };

  const sifreyiGuncelle = async () => {
    setHata(null);

    if (yeniSifre.length < 6) {
      setHata('Şifre en az 6 karakter olmalı.');
      return;
    }
    if (yeniSifre !== yeniSifreTekrar) {
      setHata('Şifreler eşleşmiyor.');
      return;
    }

    setGonderiliyor(true);
    const { error } = await supabase.auth.updateUser({ password: yeniSifre });
    setGonderiliyor(false);

    if (error) {
      console.log('[ŞifremiUnuttum] updateUser HATA:', {
        message: error.message,
        status: error.status,
        code: error.code,
      });
      setHata(error.message);
      return;
    }

    console.log('[ŞifremiUnuttum] updateUser BAŞARILI.');
    setDurum('tamamlandi');
    // sifreKurtarmaModu'nu kapatır; App.tsx kökü artık TabNavigator'a
    // geçebilir (session zaten PASSWORD_RECOVERY'den beri mevcuttu).
    sifreKurtarmaTamamlandi();
  };

  if (durum === 'tamamlandi') {
    return (
      <View style={styles.durumContainer}>
        <Ionicons name="checkmark-circle" size={64} color={colors.success} />
        <Text style={styles.durumBaslik}>Şifren güncellendi!</Text>
        <Text style={styles.durumMetin}>Yeni şifrenle giriş yapabilirsin.</Text>
      </View>
    );
  }

  if (sifreKurtarmaModu) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.icerik} keyboardShouldPersistTaps="handled">
          <Text style={styles.baslik}>Yeni Şifre Belirle</Text>

          <View style={styles.alanContainer}>
            <Text style={styles.alanEtiket}>Yeni Şifre</Text>
            <TextInput
              style={styles.girdi}
              value={yeniSifre}
              onChangeText={setYeniSifre}
              secureTextEntry
            />
          </View>
          <View style={styles.alanContainer}>
            <Text style={styles.alanEtiket}>Yeni Şifre (Tekrar)</Text>
            <TextInput
              style={styles.girdi}
              value={yeniSifreTekrar}
              onChangeText={setYeniSifreTekrar}
              secureTextEntry
            />
          </View>

          {hata && <Text style={styles.genelHata}>{hata}</Text>}

          <Pressable
            style={[styles.buton, gonderiliyor && styles.butonPasif]}
            onPress={sifreyiGuncelle}
            disabled={gonderiliyor}
          >
            {gonderiliyor ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.butonMetin}>Şifreyi Güncelle</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (durum === 'link-gonderildi') {
    return (
      <View style={styles.durumContainer}>
        <Ionicons name="mail-outline" size={64} color={colors.primary} />
        <Text style={styles.durumBaslik}>E-postanı kontrol et</Text>
        <Text style={styles.durumMetin}>
          <Text style={styles.email}>{email.trim()}</Text> adresine bir şifre sıfırlama linki
          gönderdik. Linke tıklayınca bu ekrana otomatik döneceksin.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.icerik} keyboardShouldPersistTaps="handled">
        <Text style={styles.baslik}>Şifremi Unuttum</Text>
        <Text style={styles.aciklama}>
          Hesabına kayıtlı e-posta adresini gir, sana bir sıfırlama linki gönderelim.
        </Text>

        <View style={styles.alanContainer}>
          <Text style={styles.alanEtiket}>E-posta</Text>
          <TextInput
            style={styles.girdi}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        {hata && <Text style={styles.genelHata}>{hata}</Text>}

        <Pressable
          style={[styles.buton, gonderiliyor && styles.butonPasif]}
          onPress={linkGonder}
          disabled={gonderiliyor}
        >
          {gonderiliyor ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.butonMetin}>Sıfırlama Linki Gönder</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  icerik: {
    padding: spacing.lg,
  },
  baslik: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  aciklama: {
    fontSize: typography.fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: typography.lineHeight.md,
  },
  alanContainer: {
    marginBottom: spacing.md,
  },
  alanEtiket: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  girdi: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.md,
    color: colors.text,
    backgroundColor: colors.white,
  },
  genelHata: {
    marginBottom: spacing.md,
    fontSize: typography.fontSize.sm,
    color: colors.error,
    textAlign: 'center',
  },
  buton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  butonPasif: {
    opacity: 0.6,
  },
  butonMetin: {
    color: colors.white,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.md,
  },
  durumContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  durumBaslik: {
    marginTop: spacing.lg,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
  },
  durumMetin: {
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
