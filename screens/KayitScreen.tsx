import type { NativeStackScreenProps } from '@react-navigation/native-stack';
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
import { supabase } from '../services/supabase';
import type { AuthStackParamList } from '../types/navigation';

// Doğrulama linkine tıklanınca kullanıcının geri döneceği adres. Expo Go'da
// exp://<ip>:8081/--/auth-callback, development/production build'de
// neyapsak://auth-callback üretir - Linking.createURL ortamı kendisi
// algılar. TANI AMAÇLI: Supabase Dashboard > Authentication > URL
// Configuration > Redirect URLs'e eklenecek tam değeri görmek için
// konsola yazdırılıyor; adres doğrulanınca bu log kaldırılabilir.
const EMAIL_YONLENDIRME_URL = Linking.createURL('auth-callback');
console.log('[Kayıt] emailRedirectTo:', EMAIL_YONLENDIRME_URL);

type FormAlanlari = {
  ad: string;
  soyad: string;
  kullaniciAdi: string;
  email: string;
  sifre: string;
  sifreTekrar: string;
};

type FormHatalari = Partial<Record<keyof FormAlanlari, string>>;

const BOS_FORM: FormAlanlari = {
  ad: '',
  soyad: '',
  kullaniciAdi: '',
  email: '',
  sifre: '',
  sifreTekrar: '',
};

const KULLANICI_ADI_DESENI = /^[a-z0-9_]{3,20}$/;
const EMAIL_DESENI = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formuDogrula(alanlar: FormAlanlari): FormHatalari {
  const hatalar: FormHatalari = {};

  if (alanlar.ad.trim().length < 2) {
    hatalar.ad = 'Ad en az 2 karakter olmalı.';
  }
  if (alanlar.soyad.trim().length < 2) {
    hatalar.soyad = 'Soyad en az 2 karakter olmalı.';
  }
  if (!KULLANICI_ADI_DESENI.test(alanlar.kullaniciAdi.trim())) {
    hatalar.kullaniciAdi = '3-20 karakter, sadece küçük harf, rakam ve alt çizgi.';
  }
  if (!EMAIL_DESENI.test(alanlar.email.trim())) {
    hatalar.email = 'Geçerli bir e-posta adresi gir.';
  }
  if (alanlar.sifre.length < 6) {
    hatalar.sifre = 'Şifre en az 6 karakter olmalı.';
  }
  if (alanlar.sifreTekrar !== alanlar.sifre) {
    hatalar.sifreTekrar = 'Şifreler eşleşmiyor.';
  }

  return hatalar;
}

type Props = NativeStackScreenProps<AuthStackParamList, 'Kayit'>;

export default function KayitScreen({ navigation }: Props) {
  const [alanlar, setAlanlar] = useState<FormAlanlari>(BOS_FORM);
  const [hatalar, setHatalar] = useState<FormHatalari>({});
  const [genelHata, setGenelHata] = useState<string | null>(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const alanGuncelle = (alan: keyof FormAlanlari, deger: string) => {
    setAlanlar((onceki) => ({ ...onceki, [alan]: deger }));
  };

  const kayitOl = async () => {
    const yeniHatalar = formuDogrula(alanlar);
    setHatalar(yeniHatalar);
    setGenelHata(null);

    if (Object.keys(yeniHatalar).length > 0) {
      return;
    }

    setGonderiliyor(true);
    const email = alanlar.email.trim();
    const { error } = await supabase.auth.signUp({
      email,
      password: alanlar.sifre,
      options: {
        // Gün 12'deki profil oluşturma trigger'ı bu metadata'yı okuyacak.
        data: {
          ad: alanlar.ad.trim(),
          soyad: alanlar.soyad.trim(),
          kullanici_adi: alanlar.kullaniciAdi.trim(),
        },
        emailRedirectTo: EMAIL_YONLENDIRME_URL,
      },
    });
    setGonderiliyor(false);

    if (error) {
      setGenelHata(error.message);
      return;
    }

    navigation.navigate('EmailDogrulama', { email });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.icerik} keyboardShouldPersistTaps="handled">
        <Text style={styles.baslik}>Kayıt Ol</Text>

        <FormAlani
          etiket="Ad"
          deger={alanlar.ad}
          onDegisti={(v) => alanGuncelle('ad', v)}
          hata={hatalar.ad}
        />
        <FormAlani
          etiket="Soyad"
          deger={alanlar.soyad}
          onDegisti={(v) => alanGuncelle('soyad', v)}
          hata={hatalar.soyad}
        />
        <FormAlani
          etiket="Kullanıcı Adı"
          deger={alanlar.kullaniciAdi}
          onDegisti={(v) => alanGuncelle('kullaniciAdi', v.toLowerCase())}
          hata={hatalar.kullaniciAdi}
          autoCapitalize="none"
        />
        <FormAlani
          etiket="E-posta"
          deger={alanlar.email}
          onDegisti={(v) => alanGuncelle('email', v)}
          hata={hatalar.email}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <FormAlani
          etiket="Şifre"
          deger={alanlar.sifre}
          onDegisti={(v) => alanGuncelle('sifre', v)}
          hata={hatalar.sifre}
          gizli
        />
        <FormAlani
          etiket="Şifre (Tekrar)"
          deger={alanlar.sifreTekrar}
          onDegisti={(v) => alanGuncelle('sifreTekrar', v)}
          hata={hatalar.sifreTekrar}
          gizli
        />

        {genelHata && <Text style={styles.genelHata}>{genelHata}</Text>}

        <Pressable
          style={[styles.buton, gonderiliyor && styles.butonPasif]}
          onPress={kayitOl}
          disabled={gonderiliyor}
        >
          {gonderiliyor ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.butonMetin}>Kayıt Ol</Text>
          )}
        </Pressable>

        <Pressable onPress={() => navigation.navigate('Giris')} style={styles.girisLink}>
          <Text style={styles.girisMetin}>Zaten hesabın var mı? Giriş Yap</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type FormAlaniProps = {
  etiket: string;
  deger: string;
  onDegisti: (deger: string) => void;
  hata?: string;
  gizli?: boolean;
  autoCapitalize?: 'none' | 'sentences';
  keyboardType?: 'default' | 'email-address';
};

function FormAlani({
  etiket,
  deger,
  onDegisti,
  hata,
  gizli,
  autoCapitalize = 'sentences',
  keyboardType = 'default',
}: FormAlaniProps) {
  return (
    <View style={styles.alanContainer}>
      <Text style={styles.alanEtiket}>{etiket}</Text>
      <TextInput
        style={[styles.girdi, hata && styles.girdiHatali]}
        value={deger}
        onChangeText={onDegisti}
        secureTextEntry={gizli}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
      />
      {hata && <Text style={styles.alanHata}>{hata}</Text>}
    </View>
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
  girdiHatali: {
    borderColor: colors.error,
  },
  alanHata: {
    marginTop: spacing.xs,
    fontSize: typography.fontSize.xs,
    color: colors.error,
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
    marginTop: spacing.sm,
  },
  butonPasif: {
    opacity: 0.6,
  },
  butonMetin: {
    color: colors.white,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.md,
  },
  girisLink: {
    alignSelf: 'center',
    marginTop: spacing.lg,
  },
  girisMetin: {
    fontSize: typography.fontSize.sm,
    color: colors.primary,
    fontWeight: typography.fontWeight.medium,
  },
});
