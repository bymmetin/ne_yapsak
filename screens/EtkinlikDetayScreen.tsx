import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatTarihSaat } from '../components/EtkinlikKarti';
import HataDurumu from '../components/HataDurumu';
import KategoriEtiket from '../components/KategoriEtiket';
import YuklemeDurumu from '../components/YuklemeDurumu';
import { colors, radius, spacing, typography } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { etkinlikGetir } from '../services/etkinlikler';
import { supabase } from '../services/supabase';
import { Etkinlik } from '../types';
import type { KesfetStackParamList } from '../types/navigation';

const AVATAR_RENKLERI = [
  colors.primary,
  colors.secondary,
  colors.warning,
  colors.error,
  colors.primaryDark,
];
const GOSTERILECEK_AVATAR_SAYISI = 5;

type Durum = 'yukleniyor' | 'hata' | 'hazir';

type Props = NativeStackScreenProps<KesfetStackParamList, 'EtkinlikDetay'>;

export default function EtkinlikDetayScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [katildim, setKatildim] = useState(false);
  const [etkinlik, setEtkinlik] = useState<Etkinlik | null>(null);
  const [durum, setDurum] = useState<Durum>('yukleniyor');
  const [siliniyor, setSiliniyor] = useState(false);

  const etkinligiGetir = useCallback(async () => {
    setDurum('yukleniyor');
    try {
      const sonuc = await etkinlikGetir(route.params.etkinlikId);
      setEtkinlik(sonuc);
      setDurum('hazir');
    } catch {
      setDurum('hata');
    }
  }, [route.params.etkinlikId]);

  useEffect(() => {
    etkinligiGetir();
  }, [etkinligiGetir]);

  if (durum === 'yukleniyor') {
    return <YuklemeDurumu mesaj="Etkinlik yükleniyor..." />;
  }

  if (durum === 'hata') {
    return <HataDurumu onTekrarDene={etkinligiGetir} />;
  }

  // durum 'hazir' ama etkinlik null: sorgu başarılı çalıştı, satır bulunamadı
  // (örn. silinmiş bir etkinliğin linkiyle gelinmesi) - bu ağ hatasından
  // (durum 'hata') ayrı bir durum, "Tekrar Dene" burada anlamsız olurdu.
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
  const organizatorMu = session?.user.id === etkinlik.organizatorId;

  // RLS zaten sadece organizatörün delete'ine izin veriyor (Gün 14); bu
  // kontrol sadece butonu gizlemek için - ikinci bir savunma katmanı değil,
  // asıl güvenlik sunucu tarafında. Kapak fotoğrafının storage'dan silinmesi
  // bilinçli olarak kapsam dışı - EtkinlikOlusturScreen.tsx'teki "Kaldır"
  // yorumunda bahsedilen orphan-dosya temizliğiyle aynı kategori, ileride
  // (Gün 35 gibi) toplu bir işle ele alınabilir.
  const etkinligiSil = () => {
    Alert.alert('Emin misin?', 'Bu etkinlik kalıcı olarak silinecek.', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          setSiliniyor(true);
          try {
            const { error } = await supabase.from('etkinlikler').delete().eq('id', etkinlik.id);

            if (error) {
              Alert.alert('Silinemedi', error.message);
              return;
            }

            // Keşfet listesine dönüyoruz; KesfetScreen.tsx zaten her focus'ta
            // ilk sayfayı sessizce yeniden çekiyor (Gün 17), bu yüzden silinen
            // etkinlik listeden kendiliğinden düşer.
            navigation.goBack();
          } catch (err) {
            // try/catch olmadan (örn. ağ hatasında) delete() reject olursa
            // setSiliniyor(false) hiç çalışmaz, buton sonsuza dek "yükleniyor"
            // görünür ve kullanıcı hiçbir hata görmeden ekranda kalırdı - bkz.
            // ProfilScreen.tsx'teki avatarSec'te Gün 12'de düzeltilen aynı hata.
            Alert.alert('Bir hata oluştu', err instanceof Error ? err.message : String(err));
          } finally {
            setSiliniyor(false);
          }
        },
      },
    ]);
  };

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
        {organizatorMu && (
          <Pressable
            style={[styles.silButon, siliniyor && styles.silButonPasif]}
            onPress={etkinligiSil}
            disabled={siliniyor}
          >
            {siliniyor ? (
              <ActivityIndicator color={colors.error} />
            ) : (
              <Text style={styles.silButonMetin}>Etkinliği Sil</Text>
            )}
          </Pressable>
        )}
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
  silButon: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  silButonPasif: {
    opacity: 0.6,
  },
  silButonMetin: {
    color: colors.error,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.md,
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
