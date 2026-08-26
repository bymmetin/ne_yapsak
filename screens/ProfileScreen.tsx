import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import EmptyState from '../components/EmptyState';
import { radius, spacing, typography } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette, ThemePreference } from '../context/ThemeContext';
import { requireLogin } from '../navigation/navigationRef';
import { supabase } from '../services/supabase';
import type { ProfileStackParamList } from '../types/navigation';

// Gün 35: üç seçenekli tema seçici - context/ThemeContext.tsx > ThemePreference
// ile birebir aynı üç değer. DiscoverScreen.tsx > DATE_FILTER_OPTIONS ile aynı
// "değer + etiket" listesi deseni.
const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Açık' },
  { value: 'dark', label: 'Koyu' },
  { value: 'system', label: 'Sistem' },
];

type ProfileData = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
};

const AVATAR_BUCKET = 'avatars';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileHome'>;

export default function ProfileScreen({ navigation }: Props) {
  // ProfileScreen sadece session doluyken (TabNavigator içinde) mount olur -
  // bkz. App.tsx > RootNavigation. Yine de signOut sırasındaki kısa geçiş
  // anında session null'a düşebileceğinden userId'yi null'a izin veren
  // bir türle tutup aşağıda güvenli şekilde koruyoruz.
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const { colors, preference, setPreference } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [organizedEventCount, setOrganizedEventCount] = useState(0);
  const [attendedEventCount, setAttendedEventCount] = useState(0);

  const fetchProfile = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, ad, soyad, kullanici_adi, avatar_url, bio')
      .eq('id', id)
      .single();

    if (error) {
      console.log('[Profil] profil çekme HATA:', error.message);
      return;
    }

    console.log('[Profil] profiles satırı geldi:', data);
    setProfile({
      id: data.id,
      firstName: data.ad,
      lastName: data.soyad,
      username: data.kullanici_adi,
      avatarUrl: data.avatar_url,
      bio: data.bio,
    });
  }, []);

  // etkinlikler artık gerçek bir tablo (Gün 17); head: true ile satırların
  // kendisini çekmeden sadece sayısını istiyoruz (count'un tek amacı bu
  // sayaç olduğu için satır verisini indirmek gereksiz).
  const fetchEventCount = useCallback(async (id: string) => {
    const { count, error } = await supabase
      .from('etkinlikler')
      .select('id', { count: 'exact', head: true })
      .eq('organizator_id', id);

    if (error) {
      console.log('[Profil] etkinlik sayısı çekme HATA:', error.message);
      return;
    }

    setOrganizedEventCount(count ?? 0);
  }, []);

  // Gün 21: katilimlar tablosu ve herkese_acik_okuma RLS politikası eklendi,
  // artık gerçek bir sayı - yukarıdaki fetchEventCount'le aynı desen.
  const fetchParticipationCount = useCallback(async (id: string) => {
    const { count, error } = await supabase
      .from('katilimlar')
      .select('id', { count: 'exact', head: true })
      .eq('kullanici_id', id);

    if (error) {
      console.log('[Profil] katılım sayısı çekme HATA:', error.message);
      return;
    }

    setAttendedEventCount(count ?? 0);
  }, []);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    Promise.all([
      fetchProfile(userId),
      fetchEventCount(userId),
      fetchParticipationCount(userId),
    ]).finally(() => setLoading(false));
  }, [userId, fetchProfile, fetchEventCount, fetchParticipationCount]);

  // Etkinlik Oluştur (başka bir sekme) veya Etkinliklerim/Katıldıklarım/
  // Etkinlik Detay üzerinden etkinlik ekleyip silmek ya da bir etkinliğe
  // katılmak bu sayıları değiştirebilir; yukarıdaki tek seferlik useEffect
  // bunu yakalayamaz. Profil sekmesine her dönüşte sessizce tazeliyoruz -
  // loading'i tetiklemiyor, sadece sayılar güncelleniyor.
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      fetchEventCount(userId);
      fetchParticipationCount(userId);
    }, [userId, fetchEventCount, fetchParticipationCount]),
  );

  // Başarılı signOut sonrası ayrıca bir şey yapmaya gerek yok: AuthContext'in
  // onAuthStateChange aboneliği session'ı null yapıp App.tsx'teki kökü
  // otomatik olarak AuthStack'e geçirir.
  const signOut = async () => {
    setSigningOut(true);
    const { error } = await supabase.auth.signOut();
    setSigningOut(false);

    if (error) {
      Alert.alert('Çıkış yapılamadı', error.message);
    }
  };

  // Galeriden fotoğraf seçip storage/avatars/<userId>/avatar.<uzanti>
  // yoluna yükler, sonra profiles.avatar_url'i günceller. base64: true ile
  // istiyoruz çünkü React Native'de doğrudan Blob upload güvenilir değil;
  // base64 -> ArrayBuffer (base64-arraybuffer) Supabase'in RN için önerdiği
  // yöntem.
  const pickAvatar = async (id: string) => {
    console.log('[Avatar] tıklandı');

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('[Avatar] izin durumu:', permission.status);
      if (!permission.granted) {
        Alert.alert('İzin gerekli', 'Avatar seçmek için galeri erişim izni vermelisin.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });
      console.log('[Avatar] seçim sonucu:', result.canceled, result.assets?.length);

      if (result.canceled) {
        return;
      }

      const selected = result.assets[0];
      if (!selected.base64) {
        console.log('[Avatar] seçilen assette base64 yok, iptal ediliyor.');
        return;
      }

      const extension = selected.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const filePath = `${id}/avatar.${extension}`;

      setAvatarUploading(true);
      console.log('[Avatar] yükleniyor...');

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(filePath, decode(selected.base64), {
          contentType: selected.mimeType ?? 'image/jpeg',
          upsert: true,
        });
      console.log('[Avatar] yükleme sonucu:', uploadData, uploadError);

      if (uploadError) {
        setAvatarUploading(false);
        Alert.alert('Yükleme başarısız', uploadError.message);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);
      // Aynı dosya adına upsert yapılınca istemci/CDN eski görseli
      // cache'leyebiliyor; URL'e zaman damgası ekleyip yeni isteği zorluyoruz.
      const newAvatarUrl = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: newAvatarUrl })
        .eq('id', id);

      setAvatarUploading(false);

      if (updateError) {
        Alert.alert('Profil güncellenemedi', updateError.message);
        return;
      }

      setProfile((prev) => (prev ? { ...prev, avatarUrl: newAvatarUrl } : prev));
    } catch (err) {
      // Şu ana kadar burada hiçbir catch yoktu; ImagePicker veya storage
      // çağrılarından atılan bir hata sessizce yutulup onPress'in hiçbir şey
      // yapmıyormuş gibi görünmesine yol açıyordu. Artık tam hata görünür.
      setAvatarUploading(false);
      console.log('[Avatar] BEKLENMEYEN HATA:', err);
      Alert.alert('Bir hata oluştu', err instanceof Error ? err.message : String(err));
    }
  };

  // Gün 38: Guest modu - Profil sekmesi artık gizlenmiyor (kökten hiç
  // AuthStack'e düşülmüyor, bkz. App.tsx > RootNavigation), ama gösterecek
  // bir profili yok. İki seçenek vardı: (a) burada kendi giriş formunu
  // göstermek ya da (b) dokunulunca Giriş ekranına atmak - (b) seçildi, daha
  // az değişiklik gerektiriyor (LoginScreen'in form/validasyon/hata mantığını
  // burada tekrarlamaya gerek yok) ve EventCreateScreen'deki aynı guest
  // istemiyle (bkz. o dosya) tutarlı.
  if (!userId) {
    return (
      <View style={styles.loadingContainer}>
        <EmptyState
          title="Giriş yapmadın"
          message="Profilini görmek için giriş yapmalısın."
          actionLabel="Giriş Yap"
          onAction={requireLogin}
        />
      </View>
    );
  }

  if (loading || !profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.avatarArea}
        onPress={() => pickAvatar(userId)}
        disabled={avatarUploading}
      >
        <View style={styles.avatar}>
          {avatarUploading ? (
            <ActivityIndicator color={colors.white} />
          ) : profile.avatarUrl ? (
            <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person" size={40} color={colors.white} />
          )}
        </View>
        <Text style={styles.avatarEditText}>Fotoğrafı Değiştir</Text>
      </Pressable>

      <Text style={styles.name}>
        {profile.firstName} {profile.lastName}
      </Text>
      <Text style={styles.username}>@{profile.username}</Text>
      {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}

      <View style={styles.counters}>
        <Pressable style={styles.counterBox} onPress={() => navigation.navigate('MyEvents')}>
          <Text style={styles.counterValue}>{organizedEventCount}</Text>
          <View style={styles.counterLabelRow}>
            <Text style={styles.counterLabel}>Düzenlediğim</Text>
            <Ionicons name="chevron-forward" size={12} color={colors.textSecondary} />
          </View>
        </Pressable>
        <View style={styles.divider} />
        <Pressable style={styles.counterBox} onPress={() => navigation.navigate('AttendedEvents')}>
          <Text style={styles.counterValue}>{attendedEventCount}</Text>
          <View style={styles.counterLabelRow}>
            <Text style={styles.counterLabel}>Katıldığım</Text>
            <Ionicons name="chevron-forward" size={12} color={colors.textSecondary} />
          </View>
        </Pressable>
      </View>

      {/* Gün 33: Favorilerim - counters'daki (Düzenlediğim/Katıldığım) gibi
          bir sayaç değil, çünkü favori sayısını göstermek ayrı bir sorgu
          gerektirirdi ve plan bunu istemiyor ("bir liste öğesi/buton olarak
          eriş") - basit bir navigasyon satırı yeterli. */}
      <Pressable style={styles.favoritesRow} onPress={() => navigation.navigate('Favorites')}>
        <Ionicons name="heart-outline" size={20} color={colors.primary} />
        <Text style={styles.favoritesRowText}>Favorilerim</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </Pressable>

      {/* Gün 35: dark/light mode seçici - context/ThemeContext.tsx >
          setPreference çağrılınca hem anlık uygulanıyor hem de AsyncStorage'a
          yazılıp bir sonraki açılışta hatırlanıyor. "Sistem" seçiliyken cihaz
          teması değişince (Appearance.addChangeListener) bu üç chip'in
          seçili olanı DEĞİŞMEZ ("Sistem" seçili kalır) - sadece hangi
          chip'in aktif olduğu preference'a bağlı, çözümlenmiş renklere değil. */}
      <View style={styles.themeSection}>
        <Text style={styles.themeSectionTitle}>Görünüm</Text>
        <View style={styles.themeOptions}>
          {THEME_OPTIONS.map((option) => {
            const selected = preference === option.value;
            return (
              <Pressable
                key={option.value}
                style={[styles.themeChip, selected && styles.themeChipSelected]}
                onPress={() => setPreference(option.value)}
              >
                <Text style={[styles.themeChipText, selected && styles.themeChipTextSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable
        style={[styles.signOutButton, signingOut && styles.signOutButtonDisabled]}
        onPress={signOut}
        disabled={signingOut}
      >
        {signingOut ? (
          <ActivityIndicator color={colors.error} />
        ) : (
          <>
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={styles.signOutText}>Çıkış Yap</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      backgroundColor: colors.background,
      padding: spacing.lg,
      paddingTop: spacing.xl,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    avatarArea: {
      alignItems: 'center',
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
    avatarImage: {
      width: '100%',
      height: '100%',
    },
    avatarEditText: {
      marginTop: spacing.xs,
      fontSize: typography.fontSize.xs,
      color: colors.primary,
      fontWeight: typography.fontWeight.medium,
    },
    name: {
      marginTop: spacing.md,
      fontSize: typography.fontSize.xl,
      fontWeight: typography.fontWeight.bold,
      color: colors.text,
    },
    username: {
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
    counters: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.xl,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      width: '100%',
    },
    counterBox: {
      flex: 1,
      alignItems: 'center',
    },
    divider: {
      width: 1,
      height: '100%',
      backgroundColor: colors.border,
    },
    counterValue: {
      fontSize: typography.fontSize.xl,
      fontWeight: typography.fontWeight.bold,
      color: colors.primary,
    },
    counterLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      marginTop: 2,
    },
    counterLabel: {
      fontSize: typography.fontSize.xs,
      color: colors.textSecondary,
    },
    favoritesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      width: '100%',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
    },
    favoritesRowText: {
      flex: 1,
      fontSize: typography.fontSize.md,
      fontWeight: typography.fontWeight.medium,
      color: colors.text,
    },
    themeSection: {
      width: '100%',
      marginTop: spacing.lg,
    },
    themeSectionTitle: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    // DiscoverScreen.tsx > categoryChip ile aynı görsel dil (chip grubu).
    themeOptions: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    themeChip: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    themeChipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    themeChipText: {
      fontSize: typography.fontSize.sm,
      color: colors.text,
    },
    themeChipTextSelected: {
      color: colors.white,
      fontWeight: typography.fontWeight.medium,
    },
    signOutButton: {
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
    signOutButtonDisabled: {
      opacity: 0.6,
    },
    signOutText: {
      fontSize: typography.fontSize.md,
      fontWeight: typography.fontWeight.medium,
      color: colors.error,
    },
  });
}
