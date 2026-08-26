import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import EventForm, { EventFormData, timeToDbFormat, dateToDbFormat } from '../components/EventForm';
import { LatLng } from '../components/LocationPicker';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import { useAuth } from '../context/AuthContext';
import { getEvent } from '../services/events';
import { supabase } from '../services/supabase';
import { Event } from '../types';
import type { ProfileStackParamList } from '../types/navigation';

type Status = 'loading' | 'error' | 'ready';

// dateToDbFormat/timeToDbFormat'nin (Date -> string) tersi: DB'den gelen
// "YYYY-MM-DD" + "HH:mm:ss" çiftini formun tek bir dateTime alanına
// koyabilmek için yerel bir Date'e geri çeviriyor. new Date(`${tarih}T${saat}`)
// kullanmadık - bu, tarayıcıya/motora göre UTC ya da yerel yorumlanabiliyor;
// bileşenleri elle okumak dateToDbFormat'taki aynı yerel-zaman varsayımıyla
// tutarlı kalıyor.
function buildDateTime(date: string, time: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

type Props = NativeStackScreenProps<ProfileStackParamList, 'EventEdit'>;

export default function EventEditScreen({ route, navigation }: Props) {
  const { session } = useAuth();
  const organizerId = session?.user.id ?? null;

  const [event, setEvent] = useState<Event | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [saving, setSaving] = useState(false);

  const fetchEvent = useCallback(async () => {
    setStatus('loading');
    try {
      const result = await getEvent(route.params.eventId);
      setEvent(result);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [route.params.eventId]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  // organizator_id RLS politikası (Gün 14) zaten sadece organizatörün update
  // yapabilmesini garanti ediyor; bu satır ikinci bir savunma katmanı değil,
  // sadece organizerId null ise (session kaybı gibi bir kenar durum)
  // update'i hiç denememek için.
  const update = async (data: EventFormData, coverPhotoUrl: string | null, location: LatLng) => {
    if (!organizerId || !event) return;

    setSaving(true);

    const { error } = await supabase
      .from('etkinlikler')
      .update({
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
      })
      .eq('id', event.id);

    setSaving(false);

    if (error) {
      Alert.alert('Güncellenemedi', error.message);
      return;
    }

    Alert.alert('Kaydedildi', 'Etkinlik güncellendi.');
    // Etkinliklerim ekranı her focus'ta listeyi sessizce yeniden çekiyor
    // (aynı desen DiscoverScreen.tsx'te, Gün 17), bu yüzden geri dönmek yeterli.
    navigation.goBack();
  };

  if (status === 'loading' || !organizerId) {
    return <LoadingState message="Etkinlik yükleniyor..." />;
  }

  if (status === 'error' || !event) {
    return <ErrorState onRetry={fetchEvent} />;
  }

  return (
    <EventForm
      organizerId={organizerId}
      titleText="Etkinliği Düzenle"
      initialValues={{
        title: event.title,
        description: event.description,
        category: event.category,
        dateTime: buildDateTime(event.date, event.time),
        locationAddress: event.location.address,
        capacity: String(event.capacity),
      }}
      initialCoverPhotoUrl={event.coverPhotoUrl}
      initialLocation={{
        latitude: event.location.latitude,
        longitude: event.location.longitude,
      }}
      submitButtonText="Kaydet"
      submitting={saving}
      onSubmit={update}
    />
  );
}
