// Gün 23: Etkinlik formundaki "haritadan konum seç" alanı. EventForm'daki
// diğer harici state'ler (kapak fotoğrafı) gibi react-hook-form/zod şemasının
// DIŞINDA tutuluyor - EventForm bunu kendi state'inde saklayıp submit'te
// üçüncü bir argüman olarak iletiyor (bkz. EventForm.tsx > submit).

import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { MapPressEvent, Marker, PROVIDER_DEFAULT } from 'react-native-maps';

import { radius, spacing, typography } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';

export type LatLng = {
  latitude: number;
  longitude: number;
};

// Sadece haritanın başlangıç kamera merkezi (İstanbul genel görünüm) -
// eskiden EventCreateScreen'deki DEFAULT_LOCATION sabiti hem kamerayı
// konumlandırıyor HEM DE hiç dokunulmasa bile olduğu gibi DB'ye yazılıyordu.
// Artık sadece kamera burada başlıyor, submit değeri değil - kullanıcı
// haritaya dokunmadan ya da "Mevcut Konumumu Kullan" demeden konum seçilmiş
// sayılmıyor (bkz. EventForm.tsx > submit, locationError kontrolü).
const DEFAULT_REGION = {
  latitude: 41.0082,
  longitude: 28.9784,
  latitudeDelta: 0.5,
  longitudeDelta: 0.5,
};

const SELECTED_DELTA = 0.01;

type Props = {
  value: LatLng | null;
  onChange: (location: LatLng) => void;
};

export default function LocationPicker({ value, onChange }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const mapRef = useRef<MapView>(null);
  const [locating, setLocating] = useState(false);

  const handleMapPress = (event: MapPressEvent) => {
    onChange(event.nativeEvent.coordinate);
  };

  // "Mevcut Konumumu Kullan" - izin akışı burada isteniyor (harita dokunarak
  // seçim için izin gerekmiyor, bu yüzden izin sadece bu kısayol için
  // gerekli). Reddedilirse sessizce hiçbir şey yapmıyoruz - kullanıcıya NEDEN
  // hiçbir şey olmadığını açıklayan bir Alert gösteriyoruz ve haritaya
  // dokunarak elle seçim yapabileceğini hatırlatıyoruz; pickCover'daki
  // (EventForm.tsx) "izin verilmedi" Alert'iyle aynı yaklaşım.
  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Konum izni verilmedi',
          'Mevcut konumunu kullanabilmek için ayarlardan konum iznini açmalısın. Bunun yerine haritaya dokunarak elle bir nokta seçebilirsin.',
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({});
      const coords: LatLng = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      onChange(coords);
      mapRef.current?.animateToRegion(
        { ...coords, latitudeDelta: SELECTED_DELTA, longitudeDelta: SELECTED_DELTA },
        500,
      );
    } catch (err) {
      Alert.alert('Konum alınamadı', err instanceof Error ? err.message : String(err));
    } finally {
      setLocating(false);
    }
  };

  return (
    <View>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        initialRegion={
          value
            ? { ...value, latitudeDelta: SELECTED_DELTA, longitudeDelta: SELECTED_DELTA }
            : DEFAULT_REGION
        }
        onPress={handleMapPress}
      >
        {value && <Marker coordinate={value} />}
      </MapView>

      <Pressable
        style={styles.locateButton}
        onPress={useCurrentLocation}
        disabled={locating}
        // Gün 35: dikey padding'i olmayan ikon+metin satırı ~18-20px
        // yüksekliğindeydi, 44x44 hedefinin altında kalıyordu.
        hitSlop={13}
      >
        {locating ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : (
          <Ionicons name="locate" size={16} color={colors.primary} />
        )}
        <Text style={styles.locateButtonText}>Mevcut Konumumu Kullan</Text>
      </Pressable>

      <Text style={styles.hint}>
        {value
          ? `Seçilen konum: ${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)}`
          : 'Haritaya dokunarak etkinliğin konumunu seç.'}
      </Text>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    map: {
      width: '100%',
      height: 200,
      borderRadius: radius.md,
      overflow: 'hidden',
    },
    locateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      alignSelf: 'flex-start',
      marginTop: spacing.sm,
    },
    locateButtonText: {
      fontSize: typography.fontSize.sm,
      color: colors.primary,
      fontWeight: typography.fontWeight.medium,
    },
    hint: {
      marginTop: spacing.xs,
      fontSize: typography.fontSize.xs,
      color: colors.textSecondary,
    },
  });
}
