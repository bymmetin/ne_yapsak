import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import EmptyState from '../components/EmptyState';
import EventForm, {
  EventFormData,
  CATEGORY_OPTIONS,
  timeToDbFormat,
  dateToDbFormat,
  defaultDateTime,
} from '../components/EventForm';
import { LatLng } from '../components/LocationPicker';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';
import type { TabParamList } from '../navigation/TabNavigator';
import { requireLogin } from '../navigation/navigationRef';
import { supabase } from '../services/supabase';

function emptyValues(): EventFormData {
  return {
    title: '',
    description: '',
    category: CATEGORY_OPTIONS[0],
    dateTime: defaultDateTime(),
    locationAddress: '',
    capacity: '',
  };
}

type Props = BottomTabScreenProps<TabParamList, 'EventCreate'>;

export default function EventCreateScreen({ navigation }: Props) {
  const { session } = useAuth();
  const organizerId = session?.user.id ?? null;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [publishing, setPublishing] = useState(false);
  // EventForm'u bu key değişince tamamen yeniden mount ediyoruz -
  // Bottom tab navigator ekranları arka planda mount'lu tuttuğu için, reset
  // olmasa bir önceki ziyaretteki değerler/hatalar sekmeye her dönüşte
  // görünmeye devam ederdi. Stack'e push'lanan EventEditScreen'de bu
  // sorun yok (o ekran gerçekten unmount olup tekrar mount oluyor), bu
  // yüzden remount-key hilesi sadece burada gerekiyor.
  const [formKey, setFormKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setFormKey((k) => k + 1);
    }, []),
  );

  // organizator_id RLS politikasınca (Gün 14) zaten auth.uid()'e eşit olmak
  // zorunda; burada da açıkça geçiyoruz ki tip güvenli olsun ve organizerId
  // null ise (session kaybı gibi bir kenar durum) insert'i hiç denemeyelim.
  const publish = async (data: EventFormData, coverPhotoUrl: string | null, location: LatLng) => {
    if (!organizerId) return;

    setPublishing(true);

    const { error } = await supabase.from('etkinlikler').insert({
      organizator_id: organizerId,
      baslik: data.title,
      aciklama: data.description,
      kategori: data.category,
      tarih: dateToDbFormat(data.dateTime),
      saat: timeToDbFormat(data.dateTime),
      konum_adres: data.locationAddress,
      konum_lat: location.latitude,
      konum_lng: location.longitude,
      kapasite: Number(data.capacity),
      kapak_foto_url: coverPhotoUrl,
    });

    setPublishing(false);

    if (error) {
      Alert.alert('Etkinlik yayınlanamadı', error.message);
      return;
    }

    Alert.alert('Yayınlandı', 'Etkinliğin Keşfet ekranında görünecek.');
    // DiscoverScreen.tsx bu sekmeye her focus'ta ilk sayfayı sessizce yeniden
    // çekiyor (Gün 17), bu yüzden burada listeye elle eklemeye gerek yok -
    // sekmeyi değiştirmek yeterli.
    navigation.navigate('Discover');
  };

  // Gün 38: Guest modu - bu ekranın TEK işi bir aksiyon (etkinlik
  // yayınlamak); kapak fotoğrafı/kapasite gibi alt akışları RLS zaten
  // auth.uid() şart koşuyor (bkz. supabase/schema.sql > etkinlik_kapaklari_
  // sadece_kendi_yukleme), bu yüzden ProfileScreen.tsx'teki aynı gerekçeyle
  // formu göstermek yerine baştan "giriş yap" istemi gösteriliyor.
  if (!organizerId) {
    return (
      <View style={styles.loadingContainer}>
        <EmptyState
          title="Giriş yapmadın"
          message="Etkinlik oluşturmak için giriş yapmalısın."
          actionLabel="Giriş Yap"
          onAction={requireLogin}
        />
      </View>
    );
  }

  return (
    <EventForm
      key={formKey}
      organizerId={organizerId}
      titleText="Etkinlik Oluştur"
      initialValues={emptyValues()}
      initialCoverPhotoUrl={null}
      initialLocation={null}
      submitButtonText="Yayınla"
      submitting={publishing}
      onSubmit={publish}
    />
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
  });
}
