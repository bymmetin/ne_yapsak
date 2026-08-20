import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatTarihSaat } from '../components/EtkinlikKarti';
import KategoriEtiket from '../components/KategoriEtiket';
import { colors, radius, spacing, typography } from '../constants/theme';
import { mockEtkinlikler } from '../services/mockData';
import type { KesfetStackParamList } from '../types/navigation';

const AVATAR_RENKLERI = [
  colors.primary,
  colors.secondary,
  colors.warning,
  colors.error,
  colors.primaryDark,
];
const GOSTERILECEK_AVATAR_SAYISI = 5;

type Props = NativeStackScreenProps<KesfetStackParamList, 'EtkinlikDetay'>;

export default function EtkinlikDetayScreen({ route }: Props) {
  const insets = useSafeAreaInsets();
  const [katildim, setKatildim] = useState(false);
  const etkinlik = mockEtkinlikler.find((e) => e.id === route.params.etkinlikId);

  if (!etkinlik) {
    return (
      <View style={styles.bulunamadi}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
        <Text style={styles.bulunamadiMetin}>Etkinlik bulunamadı.</Text>
      </View>
    );
  }

  const gosterilecekAvatarSayisi = Math.min(GOSTERILECEK_AVATAR_SAYISI, etkinlik.katilimciSayisi);
  const kalanKatilimci = etkinlik.katilimciSayisi - gosterilecekAvatarSayisi;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollIcerik}>
        {etkinlik.kapakFotoUrl ? (
          <Image source={{ uri: etkinlik.kapakFotoUrl }} style={styles.kapak} />
        ) : (
          <View style={[styles.kapak, styles.kapakPlaceholder]}>
            <Ionicons name="image-outline" size={48} color={colors.textSecondary} />
          </View>
        )}

        <View style={styles.icerik}>
          <KategoriEtiket kategori={etkinlik.kategori} />
          <Text style={styles.baslik}>{etkinlik.baslik}</Text>

          <View style={styles.satir}>
            <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.satirMetin}>{formatTarihSaat(etkinlik.tarih, etkinlik.saat)}</Text>
          </View>
          <View style={styles.satir}>
            <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.satirMetin}>{etkinlik.konum.adres}</Text>
          </View>

          <Text style={styles.bolumBasligi}>Açıklama</Text>
          <Text style={styles.aciklama}>{etkinlik.aciklama}</Text>

          <Text style={styles.bolumBasligi}>Katılımcılar</Text>
          <View style={styles.avatarSatiri}>
            {Array.from({ length: gosterilecekAvatarSayisi }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.avatar,
                  {
                    backgroundColor: AVATAR_RENKLERI[index % AVATAR_RENKLERI.length],
                    marginLeft: index === 0 ? 0 : -spacing.sm,
                  },
                ]}
              >
                <Ionicons name="person" size={16} color={colors.white} />
              </View>
            ))}
            {kalanKatilimci > 0 && (
              <View style={[styles.avatar, styles.avatarFazla, { marginLeft: -spacing.sm }]}>
                <Text style={styles.avatarFazlaMetin}>+{kalanKatilimci}</Text>
              </View>
            )}
          </View>
          <Text style={styles.katilimciSayisi}>
            {etkinlik.katilimciSayisi}/{etkinlik.kapasite} katılımcı
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
        <Pressable
          style={[styles.katilButon, katildim && styles.katilButonAktif]}
          onPress={() => setKatildim((v) => !v)}
        >
          <Text style={[styles.katilButonMetin, katildim && styles.katilButonMetinAktif]}>
            {katildim ? 'Katıldın ✓' : 'Katıl'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollIcerik: {
    paddingBottom: spacing.xl,
  },
  kapak: {
    width: '100%',
    height: 220,
  },
  kapakPlaceholder: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icerik: {
    padding: spacing.md,
  },
  baslik: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  satirMetin: {
    fontSize: typography.fontSize.md,
    color: colors.textSecondary,
  },
  bolumBasligi: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  aciklama: {
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
    color: colors.text,
  },
  avatarSatiri: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  avatarFazla: {
    backgroundColor: colors.surface,
  },
  avatarFazlaMetin: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.textSecondary,
  },
  katilimciSayisi: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  katilButon: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  katilButonAktif: {
    backgroundColor: colors.success,
  },
  katilButonMetin: {
    color: colors.white,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.md,
  },
  katilButonMetinAktif: {
    color: colors.white,
  },
  bulunamadi: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  bulunamadiMetin: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.md,
    color: colors.textSecondary,
  },
});
