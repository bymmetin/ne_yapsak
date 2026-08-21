import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
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
import { authHataMesaji } from '../services/authHatalari';
import { supabase } from '../services/supabase';
import type { AuthStackParamList } from '../types/navigation';

// expo-web-browser'ın önerdiği kurulum çağrısı (web'de auth session'ı
// kapatmak için gerekli, native'de zararsız no-op).
WebBrowser.maybeCompleteAuthSession();

const EMAIL_DESENI = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const YONLENDIRME_URL = Linking.createURL('auth-callback');

type Props = NativeStackScreenProps<AuthStackParamList, 'Giris'>;

export default function GirisScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [sifre, setSifre] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [googleGonderiliyor, setGoogleGonderiliyor] = useState(false);

  // Başarılı girişten sonra ayrıca bir şey yapmaya gerek yok: AuthContext'in
  // onAuthStateChange aboneliği oturumu yakalayıp App.tsx'teki kökü
  // otomatik olarak TabNavigator'a geçirir, bu ekran kendiliğinden unmount
  // olur.
  const girisYap = async () => {
    setHata(null);

    if (!EMAIL_DESENI.test(email.trim())) {
      setHata('Geçerli bir e-posta adresi gir.');
      return;
    }
    if (sifre.length === 0) {
      setHata('Şifreni gir.');
      return;
    }

    setGonderiliyor(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: sifre,
    });
    setGonderiliyor(false);

    if (error) {
      console.log('[Giriş] signInWithPassword HATA:', {
        message: error.message,
        status: error.status,
        code: error.code,
      });
      setHata(authHataMesaji(error));
    }
  };

  // --- Google ile giriş (Supabase OAuth) -----------------------------
  // NOT: Bu bölüm henüz test EDİLMEDİ. Test edilebilmesi için önce:
  //   1) Google Cloud Console'da bir OAuth client oluşturulmalı,
  //   2) Supabase Dashboard > Authentication > Providers > Google'da
  //      etkinleştirilip client ID/secret girilmeli,
  //   3) Redirect URLs listesinde bu ekranın YONLENDIRME_URL'i olmalı
  //      (Gün 8'de kayıt için eklediğin aynı adres, ek bir şey gerekmiyor).
  // Bu üç adım da Supabase/Google panelinde yapılıyor, kod tarafından
  // yapılamıyor. Akış: signInWithOAuth PKCE URL'i üretir, WebBrowser bunu
  // uygulama içi tarayıcıda açar, kullanıcı Google'da onaylayınca
  // YONLENDIRME_URL'e geri döner ve App.tsx'teki global deep-link
  // dinleyicisi (KayitScreen/ŞifremiUnuttum'la aynı mekanizma)
  // exchangeCodeForSession'ı çağırır.
  const googleIleGirisYap = async () => {
    setHata(null);
    setGoogleGonderiliyor(true);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: YONLENDIRME_URL,
        skipBrowserRedirect: true,
      },
    });

    if (error || !data.url) {
      console.log('[Giriş] signInWithOAuth HATA:', {
        message: error?.message,
        status: error?.status,
        code: error?.code,
      });
      setGoogleGonderiliyor(false);
      setHata(error ? authHataMesaji(error) : 'Google ile giriş başlatılamadı.');
      return;
    }

    const sonuc = await WebBrowser.openAuthSessionAsync(data.url, YONLENDIRME_URL);
    console.log('[Giriş] Google OAuth tarayıcı sonucu:', sonuc.type);
    setGoogleGonderiliyor(false);
  };
  // --- Google ile giriş sonu ------------------------------------------

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.icerik} keyboardShouldPersistTaps="handled">
        <Text style={styles.baslik}>Giriş Yap</Text>

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
        <View style={styles.alanContainer}>
          <Text style={styles.alanEtiket}>Şifre</Text>
          <TextInput style={styles.girdi} value={sifre} onChangeText={setSifre} secureTextEntry />
        </View>

        <Pressable onPress={() => navigation.navigate('SifremiUnuttum')} style={styles.unuttumLink}>
          <Text style={styles.unuttumMetin}>Şifremi Unuttum</Text>
        </Pressable>

        {hata && <Text style={styles.genelHata}>{hata}</Text>}

        <Pressable
          style={[styles.buton, gonderiliyor && styles.butonPasif]}
          onPress={girisYap}
          disabled={gonderiliyor}
        >
          {gonderiliyor ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.butonMetin}>Giriş Yap</Text>
          )}
        </Pressable>

        <View style={styles.ayirici}>
          <View style={styles.ayiriciCizgi} />
          <Text style={styles.ayiriciMetin}>veya</Text>
          <View style={styles.ayiriciCizgi} />
        </View>

        <Pressable
          style={[styles.googleButon, googleGonderiliyor && styles.butonPasif]}
          onPress={googleIleGirisYap}
          disabled={googleGonderiliyor}
        >
          {googleGonderiliyor ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={styles.googleButonMetin}>Google ile Giriş Yap</Text>
          )}
        </Pressable>

        <Pressable onPress={() => navigation.navigate('Kayit')} style={styles.kayitLink}>
          <Text style={styles.kayitMetin}>Hesabın yok mu? Kayıt Ol</Text>
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
    marginBottom: spacing.lg,
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
  unuttumLink: {
    alignSelf: 'flex-end',
    marginBottom: spacing.md,
  },
  unuttumMetin: {
    fontSize: typography.fontSize.sm,
    color: colors.primary,
    fontWeight: typography.fontWeight.medium,
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
  ayirici: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  ayiriciCizgi: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  ayiriciMetin: {
    marginHorizontal: spacing.sm,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  googleButon: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  googleButonMetin: {
    color: colors.text,
    fontWeight: typography.fontWeight.medium,
    fontSize: typography.fontSize.md,
  },
  kayitLink: {
    alignSelf: 'center',
    marginTop: spacing.lg,
  },
  kayitMetin: {
    fontSize: typography.fontSize.sm,
    color: colors.primary,
    fontWeight: typography.fontWeight.medium,
  },
});
