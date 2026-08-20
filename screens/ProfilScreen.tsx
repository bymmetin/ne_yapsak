import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../constants/theme';
import { mockEtkinlikler, mockKullanicilar } from '../services/mockData';

// Gün 10'da AuthContext kurulunca oturum açan gerçek kullanıcıyla değişecek.
const gecerliKullanici = mockKullanicilar[0];

export default function ProfilScreen() {
  const duzenledigiEtkinlikSayisi = mockEtkinlikler.filter(
    (etkinlik) => etkinlik.organizatorId === gecerliKullanici.id,
  ).length;
  // katilimlar tablosu henüz yok (Gün 21), bu yüzden şimdilik sabit.
  const katildigiEtkinlikSayisi = 0;

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
});
