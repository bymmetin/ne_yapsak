import { Ionicons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { mockEtkinlikler } from '../services/mockData';
import { supabase } from '../services/supabase';

type Profil = {
  id: string;
  ad: string;
  soyad: string;
  kullaniciAdi: string;
  avatarUrl: string | null;
  bio: string | null;
};

const AVATAR_BUCKET = 'avatars';

export default function ProfilScreen() {
  // ProfilScreen sadece session doluyken (TabNavigator içinde) mount olur -
  // bkz. App.tsx > KokNavigasyon. Yine de signOut sırasındaki kısa geçiş
  // anında session null'a düşebileceğinden kullaniciId'yi null'a izin veren
  // bir türle tutup aşağıda güvenli şekilde koruyoruz.
  const { session } = useAuth();
  const kullaniciId = session?.user.id ?? null;

  const [profil, setProfil] = useState<Profil | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [avatarYukleniyor, setAvatarYukleniyor] = useState(false);
  const [cikisYapiliyor, setCikisYapiliyor] = useState(false);

  const profiliGetir = useCallback(async (id: string) => {
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
    setProfil({
      id: data.id,
      ad: data.ad,
      soyad: data.soyad,
      kullaniciAdi: data.kullanici_adi,
      avatarUrl: data.avatar_url,
      bio: data.bio,
    });
  }, []);

  useEffect(() => {
    if (!kullaniciId) return;
    setYukleniyor(true);
    profiliGetir(kullaniciId).finally(() => setYukleniyor(false));
  }, [kullaniciId, profiliGetir]);

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

  // Galeriden fotoğraf seçip storage/avatars/<kullaniciId>/avatar.<uzanti>
  // yoluna yükler, sonra profiles.avatar_url'i günceller. base64: true ile
  // istiyoruz çünkü React Native'de doğrudan Blob upload güvenilir değil;
  // base64 -> ArrayBuffer (base64-arraybuffer) Supabase'in RN için önerdiği
  // yöntem.
  const avatarSec = async (id: string) => {
    console.log('[Avatar] tıklandı');

    try {
      const izin = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('[Avatar] izin durumu:', izin.status);
      if (!izin.granted) {
        Alert.alert('İzin gerekli', 'Avatar seçmek için galeri erişim izni vermelisin.');
        return;
      }

      const sonuc = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });
      console.log('[Avatar] seçim sonucu:', sonuc.canceled, sonuc.assets?.length);

      if (sonuc.canceled) {
        return;
      }

      const secilen = sonuc.assets[0];
      if (!secilen.base64) {
        console.log('[Avatar] seçilen assette base64 yok, iptal ediliyor.');
        return;
      }

      const uzanti = secilen.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const dosyaYolu = `${id}/avatar.${uzanti}`;

      setAvatarYukleniyor(true);
      console.log('[Avatar] yükleniyor...');

      const { data: yuklemeData, error: yuklemeHatasi } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(dosyaYolu, decode(secilen.base64), {
          contentType: secilen.mimeType ?? 'image/jpeg',
          upsert: true,
        });
      console.log('[Avatar] yükleme sonucu:', yuklemeData, yuklemeHatasi);

      if (yuklemeHatasi) {
        setAvatarYukleniyor(false);
        Alert.alert('Yükleme başarısız', yuklemeHatasi.message);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(dosyaYolu);
      // Aynı dosya adına upsert yapılınca istemci/CDN eski görseli
      // cache'leyebiliyor; URL'e zaman damgası ekleyip yeni isteği zorluyoruz.
      const yeniAvatarUrl = `${publicUrl}?t=${Date.now()}`;

      const { error: guncellemeHatasi } = await supabase
        .from('profiles')
        .update({ avatar_url: yeniAvatarUrl })
        .eq('id', id);

      setAvatarYukleniyor(false);

      if (guncellemeHatasi) {
        Alert.alert('Profil güncellenemedi', guncellemeHatasi.message);
        return;
      }

      setProfil((onceki) => (onceki ? { ...onceki, avatarUrl: yeniAvatarUrl } : onceki));
    } catch (err) {
      // Şu ana kadar burada hiçbir catch yoktu; ImagePicker veya storage
      // çağrılarından atılan bir hata sessizce yutulup onPress'in hiçbir şey
      // yapmıyormuş gibi görünmesine yol açıyordu. Artık tam hata görünür.
      setAvatarYukleniyor(false);
      console.log('[Avatar] BEKLENMEYEN HATA:', err);
      Alert.alert('Bir hata oluştu', err instanceof Error ? err.message : String(err));
    }
  };

  if (!kullaniciId || yukleniyor || !profil) {
    return (
      <View style={styles.yukleniyorContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // etkinlikler tablosu henüz mock (Gün 17'de gerçek veriyle bağlanacak), bu
  // yüzden gerçek kullanıcının uuid'siyle eşleşen mock kayıt yok - sayaç 0
  // görünmesi beklenen, geçici bir durum.
  const duzenledigiEtkinlikSayisi = mockEtkinlikler.filter(
    (etkinlik) => etkinlik.organizatorId === kullaniciId,
  ).length;
  // katilimlar tablosu henüz yok (Gün 21), bu yüzden şimdilik sabit.
  const katildigiEtkinlikSayisi = 0;

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.avatarAlani}
        onPress={() => avatarSec(kullaniciId)}
        disabled={avatarYukleniyor}
      >
        <View style={styles.avatar}>
          {avatarYukleniyor ? (
            <ActivityIndicator color={colors.white} />
          ) : profil.avatarUrl ? (
            <Image source={{ uri: profil.avatarUrl }} style={styles.avatarGorsel} />
          ) : (
            <Ionicons name="person" size={40} color={colors.white} />
          )}
        </View>
        <Text style={styles.avatarDuzenle}>Fotoğrafı Değiştir</Text>
      </Pressable>

      <Text style={styles.isim}>
        {profil.ad} {profil.soyad}
      </Text>
      <Text style={styles.kullaniciAdi}>@{profil.kullaniciAdi}</Text>
      {profil.bio && <Text style={styles.bio}>{profil.bio}</Text>}

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
  yukleniyorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  avatarAlani: {
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
  avatarGorsel: {
    width: '100%',
    height: '100%',
  },
  avatarDuzenle: {
    marginTop: spacing.xs,
    fontSize: typography.fontSize.xs,
    color: colors.primary,
    fontWeight: typography.fontWeight.medium,
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
