import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { z } from 'zod';

import { KATEGORI_ETIKETLERI } from '../components/KategoriEtiket';
import { colors, radius, spacing, typography } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import type { TabParamList } from '../navigation/TabNavigator';
import { supabase } from '../services/supabase';
import { Kategori } from '../types';

const KAPAK_BUCKET = 'etkinlik-kapaklari';

// Haritadan gerçek konum seçimi Gün 23'ün kapsamı (expo-location + harita).
// O güne kadar konum_lat/konum_lng NOT NULL kısıtını karşılamak için sabit
// bir merkez nokta (İstanbul/Taksim) kullanılıyor; kullanıcı sadece adresi
// serbest metin olarak giriyor. Gün 23'te bu sabitin yerini gerçek
// koordinatlar alacak.
const VARSAYILAN_KONUM = { lat: 41.0082, lng: 28.9784 };

// KATEGORI_ETIKETLERI tek doğruluk kaynağı; z.enum burada yeniden bir kategori
// listesi yazmak yerine onun anahtarlarını kullanıyor ki iki liste birbirinden
// sapmasın.
const KATEGORI_SECENEKLERI = Object.keys(KATEGORI_ETIKETLERI) as [Kategori, ...Kategori[]];

// \p{L}/\p{N} Unicode harf/rakam sınıflarını eşler - Latin alfabesiyle
// sınırlı [a-zA-Z] gibi bir aralık kullanmadığı için ğ/ş/ı/ö/ü/ç ve büyük
// hallerini de kapsar. Buna karşılık emoji ve kontrol karakteri gibi
// istenmeyenler bu sınıfların dışında kaldığı için ayrıca reddedilir.
const METIN_DESENI = /^[\p{L}\p{N}\s.,!?'"():;-]*$/u;
const METIN_DESENI_MESAJI = 'Sadece harf, rakam ve temel noktalama işaretleri kullanılabilir.';

const formSemasi = z.object({
  baslik: z
    .string()
    .trim()
    .min(5, 'Başlık en az 5 karakter olmalı.')
    .max(80, 'Başlık en fazla 80 karakter olabilir.')
    .regex(METIN_DESENI, METIN_DESENI_MESAJI),
  aciklama: z
    .string()
    .trim()
    .min(20, 'Açıklama en az 20 karakter olmalı.')
    .max(1000, 'Açıklama en fazla 1000 karakter olabilir.')
    .regex(METIN_DESENI, METIN_DESENI_MESAJI),
  kategori: z.enum(KATEGORI_SECENEKLERI, { message: 'Bir kategori seç.' }),
  // Test kolaylığı için geçmiş tarih/saat kısıtı kasıtlı olarak kaldırıldı -
  // hem burada hem picker'ın minimumDate'inde (aşağıda). Gerçek kullanıcı
  // akışında bu muhtemelen geri istenecek bir kural.
  tarihSaat: z.date(),
  konumAdres: z
    .string()
    .trim()
    .min(5, 'Adres en az 5 karakter olmalı.')
    .max(200, 'Adres en fazla 200 karakter olabilir.'),
  // z.coerce.number() yerine düz string + regex/refine tercih edildi: TextInput
  // her zaman string üretir, coerce kullanmak defaultValues/Controller
  // tiplerini (input vs. output) ayırmayı gerektirirdi. Number dönüşümü
  // sadece insert'e geçerken (yayinla içinde) yapılıyor.
  kapasite: z
    .string()
    .trim()
    .regex(/^[0-9]+$/, 'Kapasite sadece rakamlardan oluşmalı.')
    .refine((deger) => Number(deger) >= 1, 'Kapasite en az 1 olmalı.')
    .refine((deger) => Number(deger) <= 100000, 'Kapasite en fazla 100000 olabilir.'),
});

type FormVerisi = z.infer<typeof formSemasi>;

// Varsayılan tarih: yarın aynı saat. new Date() versemek, kullanıcı formu
// hiç değiştirmeden gönderirse "geçmişte olamaz" hatasının hemen tetiklenmesine
// (hatta picker açılana kadarki birkaç saniyede bile) yol açardı.
function varsayilanTarihSaat(): Date {
  const tarih = new Date();
  tarih.setDate(tarih.getDate() + 1);
  return tarih;
}

function formatTarih(deger: Date): string {
  return deger.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatSaat(deger: Date): string {
  return deger.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

// toISOString() kullanmadık: UTC'ye çevirir, Türkiye UTC+3 olduğu için örneğin
// 23:30'daki bir etkinlik ISO string'de ertesi güne kayar. Burada yerel
// tarih/saat bileşenlerini elle okuyup DB'nin date/time kolonlarına
// (tarih/saat, schema.sql) birebir eşliyoruz.
function tarihDbFormati(deger: Date): string {
  const yil = deger.getFullYear();
  const ay = String(deger.getMonth() + 1).padStart(2, '0');
  const gun = String(deger.getDate()).padStart(2, '0');
  return `${yil}-${ay}-${gun}`;
}

function saatDbFormati(deger: Date): string {
  const saat = String(deger.getHours()).padStart(2, '0');
  const dakika = String(deger.getMinutes()).padStart(2, '0');
  return `${saat}:${dakika}:00`;
}

type PickerModu = 'date' | 'time' | null;

type Props = BottomTabScreenProps<TabParamList, 'EtkinlikOlustur'>;

export default function EtkinlikOlusturScreen({ navigation }: Props) {
  const { session } = useAuth();
  const organizatorId = session?.user.id ?? null;

  const [acikPicker, setAcikPicker] = useState<PickerModu>(null);
  const [kapakFotoUrl, setKapakFotoUrl] = useState<string | null>(null);
  const [kapakDosyaYolu, setKapakDosyaYolu] = useState<string | null>(null);
  const [kapakYukleniyor, setKapakYukleniyor] = useState(false);
  const [yayinlaniyor, setYayinlaniyor] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormVerisi>({
    resolver: zodResolver(formSemasi),
    defaultValues: {
      baslik: '',
      aciklama: '',
      kategori: KATEGORI_SECENEKLERI[0],
      tarihSaat: varsayilanTarihSaat(),
      konumAdres: '',
      kapasite: '',
    },
  });

  // Bottom tab navigator ekranları arka planda mount'lu tutar; reset()
  // çağrılmazsa bir önceki ziyaretteki değerler ve hatalar (values + errors)
  // sekmeye her dönüşte görünmeye devam eder. useFocusEffect her focus'ta
  // formu (ve açık kalmış olabilecek picker'ı) sıfırlıyor ki her girişte
  // temiz bir form karşılasın.
  useFocusEffect(
    useCallback(() => {
      reset({
        baslik: '',
        aciklama: '',
        kategori: KATEGORI_SECENEKLERI[0],
        tarihSaat: varsayilanTarihSaat(),
        konumAdres: '',
        kapasite: '',
      });
      setAcikPicker(null);
      // NOT: sekme değiştirip formdan bu şekilde vazgeçmek, storage'a zaten
      // yüklenmiş olabilecek kapak dosyasını silmiyor (aşağıdaki kaldirSec'in
      // aksine burada bir remove çağrısı yok) - kullanıcı hiç "Kaldır"a
      // basmadan sekmeyi değiştirirse dosya bucket'ta sahipsiz kalır. Bu
      // senaryonun temizliği kasıtlı olarak kapsam dışı bırakıldı; ileride
      // (Gün 35 cilalama gibi) organizator_id bazlı, DB'deki hiçbir
      // etkinliğe referans vermeyen dosyaları temizleyen toplu bir iş bunu
      // ele alabilir.
      setKapakFotoUrl(null);
      setKapakDosyaYolu(null);
    }, [reset]),
  );

  // Galeriden fotoğraf seçip storage/etkinlik-kapaklari/<organizatorId>/<zaman
  // damgası>.<uzanti> yoluna yükler. Etkinlik satırı henüz yok (insert Gün
  // 17'de), bu yüzden ProfilScreen'deki avatarSec'in aksine burada sonuç bir
  // DB satırına değil, sadece bu ekranın state'ine (kapakFotoUrl) yazılıyor;
  // Gün 17'de insert'e kapak_foto_url olarak geçilecek. Silme işleminin
  // (kaldirSec) doğru path'i bulabilmesi için dosya yolu da ayrıca
  // kapakDosyaYolu'nda tutuluyor - publicUrl'den path'i geri türetmek yerine.
  const kapakSec = async () => {
    if (!organizatorId) return;

    try {
      const izin = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!izin.granted) {
        Alert.alert('İzin gerekli', 'Kapak fotoğrafı seçmek için galeri erişim izni vermelisin.');
        return;
      }

      const sonuc = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.7,
        base64: true,
      });

      if (sonuc.canceled) {
        return;
      }

      const secilen = sonuc.assets[0];
      if (!secilen.base64) {
        return;
      }

      const uzanti = secilen.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const dosyaYolu = `${organizatorId}/${Date.now()}.${uzanti}`;

      setKapakYukleniyor(true);

      const { error: yuklemeHatasi } = await supabase.storage
        .from(KAPAK_BUCKET)
        .upload(dosyaYolu, decode(secilen.base64), {
          contentType: secilen.mimeType ?? 'image/jpeg',
        });

      if (yuklemeHatasi) {
        setKapakYukleniyor(false);
        Alert.alert('Yükleme başarısız', yuklemeHatasi.message);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(KAPAK_BUCKET).getPublicUrl(dosyaYolu);

      setKapakYukleniyor(false);
      setKapakFotoUrl(publicUrl);
      setKapakDosyaYolu(dosyaYolu);
    } catch (err) {
      setKapakYukleniyor(false);
      Alert.alert('Bir hata oluştu', err instanceof Error ? err.message : String(err));
    }
  };

  // "Kaldır"a basınca sadece ekrandaki önizlemeyi değil, storage'a zaten
  // yüklenmiş dosyayı da siler - aksi halde kullanıcı birkaç kez foto
  // değiştirip son kararını "Kaldır" ile verdiğinde bucket'ta kullanılmayan
  // dosyalar birikir.
  const kaldirSec = async () => {
    if (!kapakDosyaYolu) return;

    setKapakFotoUrl(null);
    setKapakDosyaYolu(null);

    const { error } = await supabase.storage.from(KAPAK_BUCKET).remove([kapakDosyaYolu]);
    if (error) {
      Alert.alert('Fotoğraf silinemedi', error.message);
    }
  };

  // organizatör_id RLS politikasınca (Gün 14) zaten auth.uid()'e eşit olmak
  // zorunda; burada da açıkça geçiyoruz ki tip güvenli olsun ve organizatorId
  // null ise (session kaybı gibi bir kenar durum) insert'i hiç denemeyelim.
  const yayinla = async (veri: FormVerisi) => {
    if (!organizatorId) return;

    setYayinlaniyor(true);

    const { error } = await supabase.from('etkinlikler').insert({
      organizator_id: organizatorId,
      baslik: veri.baslik,
      aciklama: veri.aciklama,
      kategori: veri.kategori,
      tarih: tarihDbFormati(veri.tarihSaat),
      saat: saatDbFormati(veri.tarihSaat),
      konum_adres: veri.konumAdres,
      konum_lat: VARSAYILAN_KONUM.lat,
      konum_lng: VARSAYILAN_KONUM.lng,
      kapasite: Number(veri.kapasite),
      kapak_foto_url: kapakFotoUrl,
    });

    setYayinlaniyor(false);

    if (error) {
      Alert.alert('Etkinlik yayınlanamadı', error.message);
      return;
    }

    Alert.alert('Yayınlandı', 'Etkinliğin Keşfet ekranında görünecek.');
    // KesfetScreen.tsx bu sekmeye her focus'ta ilk sayfayı sessizce yeniden
    // çekiyor (Gün 17), bu yüzden burada listeye elle eklemeye gerek yok -
    // sekmeyi değiştirmek yeterli.
    navigation.navigate('Kesfet');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.icerik} keyboardShouldPersistTaps="handled">
        <Text style={styles.baslik}>Etkinlik Oluştur</Text>

        <View style={styles.alanContainer}>
          <Text style={styles.alanEtiket}>Kapak Fotoğrafı (opsiyonel)</Text>
          <Pressable
            style={styles.kapakAlani}
            onPress={kapakSec}
            disabled={kapakYukleniyor || !organizatorId}
          >
            {kapakYukleniyor ? (
              <ActivityIndicator color={colors.primary} />
            ) : kapakFotoUrl ? (
              <Image source={{ uri: kapakFotoUrl }} style={styles.kapakGorsel} />
            ) : (
              <>
                <Ionicons name="image-outline" size={28} color={colors.textSecondary} />
                <Text style={styles.kapakMetin}>Fotoğraf Seç</Text>
              </>
            )}
          </Pressable>
          {kapakFotoUrl && !kapakYukleniyor && (
            <Pressable onPress={kaldirSec} style={styles.kapakKaldirButon}>
              <Text style={styles.kapakKaldirMetin}>Kaldır</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.alanContainer}>
          <Text style={styles.alanEtiket}>Başlık</Text>
          <Controller
            control={control}
            name="baslik"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                style={[styles.girdi, errors.baslik && styles.girdiHatali]}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Örn. Sabah Koşusu"
                placeholderTextColor={colors.textSecondary}
              />
            )}
          />
          {errors.baslik && <Text style={styles.alanHata}>{errors.baslik.message}</Text>}
        </View>

        <View style={styles.alanContainer}>
          <Text style={styles.alanEtiket}>Açıklama</Text>
          <Controller
            control={control}
            name="aciklama"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                style={[styles.girdi, styles.aciklamaGirdi, errors.aciklama && styles.girdiHatali]}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Etkinlik hakkında birkaç cümle yaz..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            )}
          />
          {errors.aciklama && <Text style={styles.alanHata}>{errors.aciklama.message}</Text>}
        </View>

        <View style={styles.alanContainer}>
          <Text style={styles.alanEtiket}>Kategori</Text>
          <Controller
            control={control}
            name="kategori"
            render={({ field: { value, onChange } }) => (
              <View style={styles.kategoriSarmalayici}>
                {KATEGORI_SECENEKLERI.map((secenek) => {
                  const secili = value === secenek;
                  return (
                    <Pressable
                      key={secenek}
                      style={[styles.kategoriChip, secili && styles.kategoriChipSecili]}
                      onPress={() => onChange(secenek)}
                    >
                      <Text
                        style={[styles.kategoriChipMetin, secili && styles.kategoriChipMetinSecili]}
                      >
                        {KATEGORI_ETIKETLERI[secenek]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          />
          {errors.kategori && <Text style={styles.alanHata}>{errors.kategori.message}</Text>}
        </View>

        <View style={styles.alanContainer}>
          <Text style={styles.alanEtiket}>Tarih ve Saat</Text>
          <Controller
            control={control}
            name="tarihSaat"
            render={({ field: { value, onChange } }) => (
              <>
                <View style={styles.tarihSaatSatiri}>
                  <Pressable
                    style={[styles.tarihSaatButon, errors.tarihSaat && styles.girdiHatali]}
                    onPress={() => setAcikPicker('date')}
                  >
                    <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                    <Text style={styles.tarihSaatMetin}>{formatTarih(value)}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.tarihSaatButon, errors.tarihSaat && styles.girdiHatali]}
                    onPress={() => setAcikPicker('time')}
                  >
                    <Ionicons name="time-outline" size={18} color={colors.primary} />
                    <Text style={styles.tarihSaatMetin}>{formatSaat(value)}</Text>
                  </Pressable>
                </View>

                {acikPicker && (
                  <DateTimePicker
                    value={value}
                    mode={acikPicker}
                    is24Hour
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event: DateTimePickerEvent, secilenDeger?: Date) => {
                      // Android'de picker bir dialog; her seçimden sonra (veya
                      // iptalde) kendiliğinden kapanır, biz de state'i kapatıp
                      // eşlik etmeliyiz. iOS'ta ise gömülü (spinner) kalıyor,
                      // kullanıcı "Tamam"a basana kadar açık kalmalı.
                      if (Platform.OS === 'android') {
                        setAcikPicker(null);
                      }
                      if (event.type === 'dismissed' || !secilenDeger) {
                        return;
                      }
                      const guncellenmis = new Date(value);
                      if (acikPicker === 'date') {
                        guncellenmis.setFullYear(
                          secilenDeger.getFullYear(),
                          secilenDeger.getMonth(),
                          secilenDeger.getDate(),
                        );
                      } else {
                        guncellenmis.setHours(secilenDeger.getHours(), secilenDeger.getMinutes());
                      }
                      onChange(guncellenmis);
                    }}
                  />
                )}

                {Platform.OS === 'ios' && acikPicker && (
                  <Pressable style={styles.tamamButon} onPress={() => setAcikPicker(null)}>
                    <Text style={styles.tamamMetin}>Tamam</Text>
                  </Pressable>
                )}
              </>
            )}
          />
          {errors.tarihSaat && <Text style={styles.alanHata}>{errors.tarihSaat.message}</Text>}
        </View>

        <View style={styles.alanContainer}>
          <Text style={styles.alanEtiket}>Konum Adresi</Text>
          <Controller
            control={control}
            name="konumAdres"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                style={[styles.girdi, errors.konumAdres && styles.girdiHatali]}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Örn. Beşiktaş, İstanbul"
                placeholderTextColor={colors.textSecondary}
              />
            )}
          />
          {errors.konumAdres && <Text style={styles.alanHata}>{errors.konumAdres.message}</Text>}
        </View>

        <View style={styles.alanContainer}>
          <Text style={styles.alanEtiket}>Kapasite</Text>
          <Controller
            control={control}
            name="kapasite"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                style={[styles.girdi, errors.kapasite && styles.girdiHatali]}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Örn. 30"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
              />
            )}
          />
          {errors.kapasite && <Text style={styles.alanHata}>{errors.kapasite.message}</Text>}
        </View>

        <Pressable
          style={[styles.buton, yayinlaniyor && styles.butonPasif]}
          onPress={handleSubmit(yayinla)}
          disabled={yayinlaniyor}
        >
          {yayinlaniyor ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.butonMetin}>Yayınla</Text>
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
  aciklamaGirdi: {
    minHeight: 100,
    paddingTop: spacing.sm,
  },
  kapakAlani: {
    height: 160,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  kapakGorsel: {
    width: '100%',
    height: '100%',
  },
  kapakMetin: {
    marginTop: spacing.xs,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  kapakKaldirButon: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
  },
  kapakKaldirMetin: {
    fontSize: typography.fontSize.xs,
    color: colors.error,
    fontWeight: typography.fontWeight.medium,
  },
  girdiHatali: {
    borderColor: colors.error,
  },
  alanHata: {
    marginTop: spacing.xs,
    fontSize: typography.fontSize.xs,
    color: colors.error,
  },
  kategoriSarmalayici: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  kategoriChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  kategoriChipSecili: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  kategoriChipMetin: {
    fontSize: typography.fontSize.sm,
    color: colors.text,
  },
  kategoriChipMetinSecili: {
    color: colors.white,
    fontWeight: typography.fontWeight.medium,
  },
  tarihSaatSatiri: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tarihSaatButon: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
  },
  tarihSaatMetin: {
    fontSize: typography.fontSize.sm,
    color: colors.text,
  },
  tamamButon: {
    alignSelf: 'flex-end',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  tamamMetin: {
    color: colors.primary,
    fontWeight: typography.fontWeight.medium,
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
});
