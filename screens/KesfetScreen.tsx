import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import BosDurum from '../components/BosDurum';
import EtkinlikKarti from '../components/EtkinlikKarti';
import HataDurumu from '../components/HataDurumu';
import YuklemeDurumu from '../components/YuklemeDurumu';
import { colors, spacing } from '../constants/theme';
import { etkinlikleriGetir } from '../services/etkinlikler';
import { Etkinlik } from '../types';
import type { KesfetStackParamList } from '../types/navigation';

type Durum = 'yukleniyor' | 'hata' | 'hazir';

type Props = NativeStackScreenProps<KesfetStackParamList, 'KesfetListesi'>;

export default function KesfetScreen({ navigation }: Props) {
  const [durum, setDurum] = useState<Durum>('yukleniyor');
  const [etkinlikler, setEtkinlikler] = useState<Etkinlik[]>([]);
  const [sayfa, setSayfa] = useState(0);
  const [sonSayfaMi, setSonSayfaMi] = useState(false);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [sonrakiYukleniyor, setSonrakiYukleniyor] = useState(false);

  // sessizce=true iken (odak/pull-to-refresh) ekrandaki liste anlık
  // boşaltılmıyor, sadece RefreshControl spinner'ı dönüyor - aksi halde her
  // sekme değişiminde liste bir anlığına kaybolup YuklemeDurumu görünürdü.
  const ilkSayfayiYukle = useCallback(async (sessizce: boolean) => {
    if (sessizce) {
      setYenileniyor(true);
    } else {
      setDurum('yukleniyor');
    }

    try {
      const sonuc = await etkinlikleriGetir(0);
      setEtkinlikler(sonuc.etkinlikler);
      setSonSayfaMi(sonuc.sonSayfaMi);
      setSayfa(1);
      setDurum('hazir');
    } catch {
      setDurum('hata');
    } finally {
      setYenileniyor(false);
    }
  }, []);

  // Etkinlik Oluştur'dan (Gün 17) yayınlanan yeni bir etkinliğin, ya da
  // ileride düzenleme/iptal (Gün 18-19) sonrası değişikliklerin bu listede
  // görünmesi için sekme her focus aldığında ilk sayfa yeniden çekiliyor;
  // etkinlikler.length > 0 ise (yani bu ilk ziyaret değilse) sessizce yapılıyor.
  useFocusEffect(
    useCallback(() => {
      ilkSayfayiYukle(etkinlikler.length > 0);
    }, [ilkSayfayiYukle, etkinlikler.length]),
  );

  const sonrakiSayfayiYukle = useCallback(async () => {
    if (sonSayfaMi || sonrakiYukleniyor || durum !== 'hazir') return;

    setSonrakiYukleniyor(true);
    try {
      const sonuc = await etkinlikleriGetir(sayfa);
      setEtkinlikler((onceki) => [...onceki, ...sonuc.etkinlikler]);
      setSonSayfaMi(sonuc.sonSayfaMi);
      setSayfa((s) => s + 1);
    } catch {
      // Sayfalama hatası tüm listeyi HataDurumu'na çevirmiyor - kullanıcı
      // FlatList'i tekrar sona kaydırınca (sonrakiYukleniyor false'a döndüğü
      // için) otomatik olarak yeniden denenmiş olur.
    } finally {
      setSonrakiYukleniyor(false);
    }
  }, [sayfa, sonSayfaMi, sonrakiYukleniyor, durum]);

  return (
    <View style={styles.container}>
      {durum === 'yukleniyor' && <YuklemeDurumu mesaj="Etkinlikler yükleniyor..." />}
      {durum === 'hata' && <HataDurumu onTekrarDene={() => ilkSayfayiYukle(false)} />}
      {durum === 'hazir' && (
        <FlatList
          data={etkinlikler}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <EtkinlikKarti
              etkinlik={item}
              onPress={() => navigation.navigate('EtkinlikDetay', { etkinlikId: item.id })}
            />
          )}
          contentContainerStyle={styles.listeIcerik}
          ListEmptyComponent={<BosDurum />}
          onEndReached={sonrakiSayfayiYukle}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            sonrakiYukleniyor ? (
              <ActivityIndicator style={styles.altYukleniyor} color={colors.primary} />
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={yenileniyor}
              onRefresh={() => ilkSayfayiYukle(true)}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listeIcerik: {
    padding: spacing.md,
    flexGrow: 1,
  },
  altYukleniyor: {
    marginVertical: spacing.md,
  },
});
