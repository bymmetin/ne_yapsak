// Etkinlik Oluştur (Gün 15-17) ve Etkinlik Düzenle (Gün 18) aynı alanları
// (kapak fotoğrafı, başlık, açıklama, kategori, tarih-saat, konum adresi,
// kapasite) aynı validasyonla kullanıyor - tek fark oluşturma/güncelleme
// çağrısı ve gönder butonunun metni. Bu yüzden form burada tek bir yerde
// toplanıp iki ekran de sadece "veri nereden geliyor" ve "gönderilince ne
// olacak" kısmını kendi sağlıyor.

import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
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

import { CATEGORY_LABELS } from './CategoryTag';
import LocationPicker, { LatLng } from './LocationPicker';
import { radius, spacing, typography } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';
import { supabase } from '../services/supabase';
import { Category } from '../types';

const COVER_BUCKET = 'etkinlik-kapaklari';

// CATEGORY_LABELS tek doğruluk kaynağı; z.enum burada yeniden bir kategori
// listesi yazmak yerine onun anahtarlarını kullanıyor ki iki liste birbirinden
// sapmasın.
export const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABELS) as [Category, ...Category[]];

// \p{L}/\p{N} Unicode harf/rakam sınıflarını eşler - Latin alfabesiyle
// sınırlı [a-zA-Z] gibi bir aralık kullanmadığı için ğ/ş/ı/ö/ü/ç ve büyük
// hallerini de kapsar. Buna karşılık emoji ve kontrol karakteri gibi
// istenmeyenler bu sınıfların dışında kaldığı için ayrıca reddedilir.
const TEXT_PATTERN = /^[\p{L}\p{N}\s.,!?'"():;-]*$/u;
const TEXT_PATTERN_MESSAGE = 'Sadece harf, rakam ve temel noktalama işaretleri kullanılabilir.';

export const eventFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, 'Başlık en az 5 karakter olmalı.')
    .max(80, 'Başlık en fazla 80 karakter olabilir.')
    .regex(TEXT_PATTERN, TEXT_PATTERN_MESSAGE),
  description: z
    .string()
    .trim()
    .min(20, 'Açıklama en az 20 karakter olmalı.')
    .max(1000, 'Açıklama en fazla 1000 karakter olabilir.')
    .regex(TEXT_PATTERN, TEXT_PATTERN_MESSAGE),
  category: z.enum(CATEGORY_OPTIONS, { message: 'Bir kategori seç.' }),
  // Test kolaylığı için geçmiş tarih/saat kısıtı kasıtlı olarak kaldırıldı -
  // hem burada hem picker'ın minimumDate'inde (aşağıda). Gerçek kullanıcı
  // akışında bu muhtemelen geri istenecek bir kural.
  dateTime: z.date(),
  locationAddress: z
    .string()
    .trim()
    .min(5, 'Adres en az 5 karakter olmalı.')
    .max(200, 'Adres en fazla 200 karakter olabilir.'),
  // z.coerce.number() yerine düz string + regex/refine tercih edildi: TextInput
  // her zaman string üretir, coerce kullanmak defaultValues/Controller
  // tiplerini (input vs. output) ayırmayı gerektirirdi. Number dönüşümü
  // sadece çağıran ekranda (insert/update payload'ı kurulurken) yapılıyor.
  capacity: z
    .string()
    .trim()
    .regex(/^[0-9]+$/, 'Kapasite sadece rakamlardan oluşmalı.')
    .refine((value) => Number(value) >= 1, 'Kapasite en az 1 olmalı.')
    .refine((value) => Number(value) <= 100000, 'Kapasite en fazla 100000 olabilir.'),
});

export type EventFormData = z.infer<typeof eventFormSchema>;

// Yeni etkinlik için varsayılan tarih: yarın aynı saat. new Date() vermek,
// kullanıcı formu hiç değiştirmeden gönderirse (artık kaldırılmış olsa da
// mantıken) "geçmişte olamaz" hatasının hemen tetiklenmesine yol açardı;
// düzenleme ekranı bu fonksiyonu kullanmıyor, kendi mevcut tarihini geçiyor.
export function defaultDateTime(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date;
}

function formatDate(value: Date): string {
  return value.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatTime(value: Date): string {
  return value.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

// toISOString() kullanmadık: UTC'ye çevirir, Türkiye UTC+3 olduğu için örneğin
// 23:30'daki bir etkinlik ISO string'de ertesi güne kayar. Burada yerel
// tarih/saat bileşenlerini elle okuyup DB'nin date/time kolonlarına
// (tarih/saat, schema.sql) birebir eşliyoruz.
export function dateToDbFormat(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function timeToDbFormat(value: Date): string {
  const hour = String(value.getHours()).padStart(2, '0');
  const minute = String(value.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}:00`;
}

type PickerMode = 'date' | 'time' | null;

type Props = {
  organizerId: string;
  titleText: string;
  initialValues: EventFormData;
  initialCoverPhotoUrl: string | null;
  initialLocation: LatLng | null;
  submitButtonText: string;
  submitting: boolean;
  onSubmit: (data: EventFormData, coverPhotoUrl: string | null, location: LatLng) => void;
};

export default function EventForm({
  organizerId,
  titleText,
  initialValues,
  initialCoverPhotoUrl,
  initialLocation,
  submitButtonText,
  submitting,
  onSubmit,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [openPicker, setOpenPicker] = useState<PickerMode>(null);
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | null>(initialCoverPhotoUrl);
  // Konum lat/lng de kapak fotoğrafı gibi zod şemasının dışında tutuluyor
  // (bkz. LocationPicker.tsx başındaki not) - null iken submit engellenir
  // (aşağıdaki submit fonksiyonu), NOT NULL DB kısıtını (schema.sql) elle
  // karşılamış oluruz.
  const [location, setLocation] = useState<LatLng | null>(initialLocation);
  const [locationError, setLocationError] = useState(false);
  // Sadece bu oturumda yeni yüklenen dosyanın path'i - düzenleme ekranında
  // baştan gelen bir kapak fotoğrafının path'i bilinmiyor (DB'de sadece
  // public URL tutuluyor), bu yüzden removeCover o durumda storage'dan gerçek
  // bir silme yapamıyor, sadece URL'i temizliyor - bkz. removeCover.
  const [coverFilePath, setCoverFilePath] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EventFormData>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: initialValues,
  });

  // Galeriden fotoğraf seçip storage/etkinlik-kapaklari/<organizerId>/<zaman
  // damgası>.<uzanti> yoluna yükler. Etkinlik satırı olmayabilir de olabilir
  // de (oluşturma vs. düzenleme) - bu yüzden sonuç bir DB satırına değil,
  // sadece bu bileşenin state'ine yazılıyor; kaydetme işi çağıran ekranın.
  const pickCover = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('İzin gerekli', 'Kapak fotoğrafı seçmek için galeri erişim izni vermelisin.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.7,
        base64: true,
      });

      if (result.canceled) {
        return;
      }

      const selected = result.assets[0];
      if (!selected.base64) {
        Alert.alert('Fotoğraf okunamadı', 'Lütfen başka bir fotoğraf seçmeyi dene.');
        return;
      }

      const extension = selected.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const filePath = `${organizerId}/${Date.now()}.${extension}`;

      setCoverUploading(true);

      const { error: uploadError } = await supabase.storage
        .from(COVER_BUCKET)
        .upload(filePath, decode(selected.base64), {
          contentType: selected.mimeType ?? 'image/jpeg',
        });

      if (uploadError) {
        setCoverUploading(false);
        Alert.alert('Yükleme başarısız', uploadError.message);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(COVER_BUCKET).getPublicUrl(filePath);

      setCoverUploading(false);
      setCoverPhotoUrl(publicUrl);
      setCoverFilePath(filePath);
    } catch (err) {
      setCoverUploading(false);
      Alert.alert('Bir hata oluştu', err instanceof Error ? err.message : String(err));
    }
  };

  // "Kaldır"a basınca önizleme her zaman temizlenir (kaydedince kapak_foto_url
  // null yazılır). Storage'dan gerçek silme ise sadece bu oturumda biz
  // yüklediysek (coverFilePath doluysa) yapılabiliyor - düzenleme ekranında
  // baştan gelen bir fotoğrafın path'i bilinmediği için o durumda dosya
  // storage'da kalır (Gün 16'daki orphan-dosya notuyla aynı kapsam dışı kabul,
  // Gün 35 cilalama gibi bir günde toplu temizlikle ele alınabilir).
  const removeCover = async () => {
    const pathToDelete = coverFilePath;
    setCoverPhotoUrl(null);
    setCoverFilePath(null);

    if (!pathToDelete) return;

    const { error } = await supabase.storage.from(COVER_BUCKET).remove([pathToDelete]);
    if (error) {
      Alert.alert('Fotoğraf silinemedi', error.message);
    }
  };

  // Konum, react-hook-form'un zod validasyonundan geçmiyor (yukarıdaki not),
  // bu yüzden handleSubmit'in kabul ettiği "geçerli" veriyle birlikte burada
  // elle kontrol ediliyor - reddedilirse submit hiç çağrılmıyor ve
  // locationError true olup haritanın altında errors.title/description'la
  // aynı stildeki kırmızı metni tetikliyor.
  const submit = handleSubmit((data) => {
    if (!location) {
      setLocationError(true);
      return;
    }
    setLocationError(false);
    onSubmit(data, coverPhotoUrl, location);
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{titleText}</Text>

        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Kapak Fotoğrafı (opsiyonel)</Text>
          <Pressable style={styles.coverArea} onPress={pickCover} disabled={coverUploading}>
            {coverUploading ? (
              <ActivityIndicator color={colors.primary} />
            ) : coverPhotoUrl ? (
              <Image source={{ uri: coverPhotoUrl }} style={styles.coverImage} />
            ) : (
              <>
                <Ionicons name="image-outline" size={28} color={colors.textSecondary} />
                <Text style={styles.coverText}>Fotoğraf Seç</Text>
              </>
            )}
          </Pressable>
          {coverPhotoUrl && !coverUploading && (
            <Pressable onPress={removeCover} style={styles.removeCoverButton}>
              <Text style={styles.removeCoverText}>Kaldır</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Başlık</Text>
          <Controller
            control={control}
            name="title"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                style={[styles.input, errors.title && styles.inputError]}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Örn. Sabah Koşusu"
                placeholderTextColor={colors.textSecondary}
              />
            )}
          />
          {errors.title && <Text style={styles.fieldError}>{errors.title.message}</Text>}
        </View>

        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Açıklama</Text>
          <Controller
            control={control}
            name="description"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                style={[
                  styles.input,
                  styles.descriptionInput,
                  errors.description && styles.inputError,
                ]}
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
          {errors.description && (
            <Text style={styles.fieldError}>{errors.description.message}</Text>
          )}
        </View>

        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Kategori</Text>
          <Controller
            control={control}
            name="category"
            render={({ field: { value, onChange } }) => (
              <View style={styles.categoryWrapper}>
                {CATEGORY_OPTIONS.map((option) => {
                  const selected = value === option;
                  return (
                    <Pressable
                      key={option}
                      style={[styles.categoryChip, selected && styles.categoryChipSelected]}
                      onPress={() => onChange(option)}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          selected && styles.categoryChipTextSelected,
                        ]}
                      >
                        {CATEGORY_LABELS[option]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          />
          {errors.category && <Text style={styles.fieldError}>{errors.category.message}</Text>}
        </View>

        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Tarih ve Saat</Text>
          <Controller
            control={control}
            name="dateTime"
            render={({ field: { value, onChange } }) => (
              <>
                <View style={styles.dateTimeRow}>
                  <Pressable
                    style={[styles.dateTimeButton, errors.dateTime && styles.inputError]}
                    onPress={() => setOpenPicker('date')}
                  >
                    <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                    <Text style={styles.dateTimeText}>{formatDate(value)}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.dateTimeButton, errors.dateTime && styles.inputError]}
                    onPress={() => setOpenPicker('time')}
                  >
                    <Ionicons name="time-outline" size={18} color={colors.primary} />
                    <Text style={styles.dateTimeText}>{formatTime(value)}</Text>
                  </Pressable>
                </View>

                {openPicker && (
                  <DateTimePicker
                    value={value}
                    mode={openPicker}
                    is24Hour
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event: DateTimePickerEvent, selectedValue?: Date) => {
                      // Android'de picker bir dialog; her seçimden sonra (veya
                      // iptalde) kendiliğinden kapanır, biz de state'i kapatıp
                      // eşlik etmeliyiz. iOS'ta ise gömülü (spinner) kalıyor,
                      // kullanıcı "Tamam"a basana kadar açık kalmalı.
                      if (Platform.OS === 'android') {
                        setOpenPicker(null);
                      }
                      if (event.type === 'dismissed' || !selectedValue) {
                        return;
                      }
                      const updated = new Date(value);
                      if (openPicker === 'date') {
                        updated.setFullYear(
                          selectedValue.getFullYear(),
                          selectedValue.getMonth(),
                          selectedValue.getDate(),
                        );
                      } else {
                        updated.setHours(selectedValue.getHours(), selectedValue.getMinutes());
                      }
                      onChange(updated);
                    }}
                  />
                )}

                {Platform.OS === 'ios' && openPicker && (
                  <Pressable style={styles.doneButton} onPress={() => setOpenPicker(null)}>
                    <Text style={styles.doneText}>Tamam</Text>
                  </Pressable>
                )}
              </>
            )}
          />
          {errors.dateTime && <Text style={styles.fieldError}>{errors.dateTime.message}</Text>}
        </View>

        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Konum Adresi</Text>
          <Controller
            control={control}
            name="locationAddress"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                style={[styles.input, errors.locationAddress && styles.inputError]}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Örn. Beşiktaş, İstanbul"
                placeholderTextColor={colors.textSecondary}
              />
            )}
          />
          {errors.locationAddress && (
            <Text style={styles.fieldError}>{errors.locationAddress.message}</Text>
          )}
        </View>

        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Konum (Haritada Seç)</Text>
          <LocationPicker
            value={location}
            onChange={(next) => {
              setLocation(next);
              setLocationError(false);
            }}
          />
          {locationError && <Text style={styles.fieldError}>Haritadan bir konum seç.</Text>}
        </View>

        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Kapasite</Text>
          <Controller
            control={control}
            name="capacity"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                style={[styles.input, errors.capacity && styles.inputError]}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Örn. 30"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
              />
            )}
          />
          {errors.capacity && <Text style={styles.fieldError}>{errors.capacity.message}</Text>}
        </View>

        <Pressable
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={submit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>{submitButtonText}</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: spacing.lg,
    },
    title: {
      fontSize: typography.fontSize.xxl,
      fontWeight: typography.fontWeight.bold,
      color: colors.text,
      marginBottom: spacing.lg,
    },
    fieldContainer: {
      marginBottom: spacing.md,
    },
    fieldLabel: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      color: colors.text,
      marginBottom: spacing.xs,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: typography.fontSize.md,
      color: colors.text,
      // Gün 35: eskiden colors.white - input kutusu bir yüzey/kart
      // arkaplanı, temayla birlikte koyulaşmalı (bkz. ThemeContext.tsx > Gün
      // 35 karar notu).
      backgroundColor: colors.surface,
    },
    descriptionInput: {
      minHeight: 100,
      paddingTop: spacing.sm,
    },
    coverArea: {
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
    coverImage: {
      width: '100%',
      height: '100%',
    },
    coverText: {
      marginTop: spacing.xs,
      fontSize: typography.fontSize.sm,
      color: colors.textSecondary,
    },
    removeCoverButton: {
      alignSelf: 'flex-end',
      marginTop: spacing.xs,
    },
    removeCoverText: {
      fontSize: typography.fontSize.xs,
      color: colors.error,
      fontWeight: typography.fontWeight.medium,
    },
    inputError: {
      borderColor: colors.error,
    },
    fieldError: {
      marginTop: spacing.xs,
      fontSize: typography.fontSize.xs,
      color: colors.error,
    },
    categoryWrapper: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    categoryChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      // Gün 35: eskiden colors.white - aynı gerekçe (yukarıdaki input notu).
      backgroundColor: colors.surface,
    },
    categoryChipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    categoryChipText: {
      fontSize: typography.fontSize.sm,
      color: colors.text,
    },
    categoryChipTextSelected: {
      // Seçili chip her zaman colors.primary dolgulu - metin rengi kasıtlı
      // olarak invariant (bkz. Gün 35 karar notu).
      color: colors.white,
      fontWeight: typography.fontWeight.medium,
    },
    dateTimeRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    dateTimeButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      // Gün 35: eskiden colors.white - aynı gerekçe (yukarıdaki input notu).
      backgroundColor: colors.surface,
    },
    dateTimeText: {
      fontSize: typography.fontSize.sm,
      color: colors.text,
    },
    doneButton: {
      alignSelf: 'flex-end',
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
    },
    doneText: {
      color: colors.primary,
      fontWeight: typography.fontWeight.medium,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: colors.white,
      fontWeight: typography.fontWeight.bold,
      fontSize: typography.fontSize.md,
    },
  });
}
