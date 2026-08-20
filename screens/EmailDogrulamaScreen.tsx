import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../constants/theme';
import { supabase } from '../services/supabase';
import type { AuthStackParamList } from '../types/navigation';

const TEKRAR_GONDERME_BEKLEME_SANIYE = 30;

type Durum = 'bekleniyor' | 'dogrulandi';

type Props = NativeStackScreenProps<AuthStackParamList, 'EmailDogrulama'>;

export default function EmailDogrulamaScreen({ route }: Props) {
  const { email } = route.params;
  const [durum, setDurum] = useState<Durum>('bekleniyor');
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [beklemeSaniye, setBeklemeSaniye] = useState(0);
  const [mesaj, setMesaj] = useState<string | null>(null);

  // Doğrulama linkine tıklanınca uygulama neyapsak://auth-callback?code=...
  // ile açılır. exchangeCodeForSession sadece kodu bekler, tüm URL'i değil.
  useEffect(() => {
    const kodDenetle = async (gelenUrl: string | null) => {
      if (!gelenUrl) return;
      const { queryParams } = Linking.parse(gelenUrl);
      const kod = typeof queryParams?.code === 'string' ? queryParams.code : null;
      if (!kod) return;

      const { error } = await supabase.auth.exchangeCodeForSession(kod);
      if (!error) {
        setDurum('dogrulandi');
      }
    };

    const abonelik = Linking.addEventListener('url', ({ url }) => {
      kodDenetle(url);
    });
    Linking.getInitialURL().then(kodDenetle);

    return () => abonelik.remove();
  }, []);

  useEffect(() => {
    if (beklemeSaniye <= 0) return;
    const zamanlayici = setTimeout(() => setBeklemeSaniye((s) => s - 1), 1000);
    return () => clearTimeout(zamanlayici);
  }, [beklemeSaniye]);

  const tekrarGonder = async () => {
    setGonderiliyor(true);
    setMesaj(null);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setGonderiliyor(false);

    if (error) {
      setMesaj(error.message);
      return;
    }
    setMesaj('Doğrulama e-postası tekrar gönderildi.');
    setBeklemeSaniye(TEKRAR_GONDERME_BEKLEME_SANIYE);
  };

  if (durum === 'dogrulandi') {
    return (
      <View style={styles.container}>
        <Ionicons name="checkmark-circle" size={64} color={colors.success} />
        <Text style={styles.baslik}>E-postan doğrulandı!</Text>
        <Text style={styles.aciklama}>
          Artık giriş yapabilirsin — giriş ekranı Gün 9&apos;da eklenecek.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Ionicons name="mail-outline" size={64} color={colors.primary} />
      <Text style={styles.baslik}>E-postanı kontrol et</Text>
      <Text style={styles.aciklama}>
        <Text style={styles.email}>{email}</Text> adresine bir doğrulama linki gönderdik. Linke
        tıklayınca bu ekrana otomatik döneceksin.
      </Text>

      {mesaj && <Text style={styles.bilgiMesaji}>{mesaj}</Text>}

      <Pressable
        style={[styles.buton, (gonderiliyor || beklemeSaniye > 0) && styles.butonPasif]}
        onPress={tekrarGonder}
        disabled={gonderiliyor || beklemeSaniye > 0}
      >
        {gonderiliyor ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.butonMetin}>
            {beklemeSaniye > 0 ? `Tekrar Gönder (${beklemeSaniye}s)` : 'Tekrar Gönder'}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  baslik: {
    marginTop: spacing.lg,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
  },
  aciklama: {
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
  bilgiMesaji: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.sm,
    color: colors.primary,
    textAlign: 'center',
  },
  buton: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
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
});
