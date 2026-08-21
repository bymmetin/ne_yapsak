import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../constants/theme';
import { mockEtkinlikler, mockKullanicilar } from '../services/mockData';
import { supabase } from '../services/supabase';

// Gün 12'de profiles tablosu bağlanınca oturum açan gerçek kullanıcıyla
// değişecek.
const gecerliKullanici = mockKullanicilar[0];

export default function ProfilScreen() {
  const [cikisYapiliyor, setCikisYapiliyor] = useState(false);

  const duzenledigiEtkinlikSayisi = mockEtkinlikler.filter(
    (etkinlik) => etkinlik.organizatorId === gecerliKullanici.id,
  ).length;
  // katilimlar tablosu henüz yok (Gün 21), bu yüzden şimdilik sabit.
  const katildigiEtkinlikSayisi = 0;

  // Başarılı signOut sonrası ayrıca bir şey yapmaya gerek yok: AuthContext'in
  // onAuthStateChange aboneliği session'ı null yapıp App.tsx'teki kökü
  // otomatik olarak AuthStack'e geçirir.
  const cikisYap = async () => {
    setCikisYapiliyor(true);
    const { error } = await supabase.auth.signOut();
    setCikisYapiliyor(false);

    if (error) {
      Alert.alert('Çıkış yapılamadı', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        {gecerliKullanici.avatarUrl ? (
          <Image source={{ uri: gecerliKullanici.avatarUrl }} style={styles.avatarGorsel} />
        ) : (
          <Ionicons name="person" size={40} color={colors.white} />
        )}
      </View>
      <Text style={styles.isim}>
        {gecerliKullanici.ad} {gecerliKullanici.soyad}
      </Text>
      <Text style={styles.kullaniciAdi}>@{gecerliKullanici.kullaniciAdi}</Text>
      {gecerliKullanici.bio && <Text style={styles.bio}>{gecerliKullanici.bio}</Text>}

      <View style={styles.sayaclar}>
        <View style={styles.sayacKutusu}>
          <Text style={styles.sayacDeger}>{duzenledigiEtkinlikSayisi}</Text>
          <Text style={styles.sayacEtiket}>Düzenlediğim</Text>
        </View>
        <View style={styles.ayirici} />
        <View style={styles.sayacKutusu}>
          <Text style={styles.sayacDeger}>{katildigiEtkinlikSayisi}</Text>
          <Text style={styles.sayacEtiket}>Katıldığım</Text>
        </View>
      </View>

      <Pressable
        style={[styles.cikisButon, cikisYapiliyor && styles.cikisButonPasif]}
        onPress={cikisYap}
        disabled={cikisYapiliyor}
      >
        {cikisYapiliyor ? (
          <ActivityIndicator color={colors.error} />
        ) : (
          <>
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={styles.cikisMetin}>Çıkış Yap</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarGorsel: {
    width: '100%',
    height: '100%',
  },
  isim: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  kullaniciAdi: {
    marginTop: 2,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  bio: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.sm,
    color: colors.text,
    textAlign: 'center',
  },
  sayaclar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    width: '100%',
  },
  sayacKutusu: {
    flex: 1,
    alignItems: 'center',
  },
  ayirici: {
    width: 1,
    height: '100%',
    backgroundColor: colors.border,
  },
  sayacDeger: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  sayacEtiket: {
    marginTop: 2,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  cikisButon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.md,
  },
  cikisButonPasif: {
    opacity: 0.6,
  },
  cikisMetin: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    color: colors.error,
  },
});
