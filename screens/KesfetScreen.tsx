import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import BosDurum from '../components/BosDurum';
import EtkinlikKarti from '../components/EtkinlikKarti';
import HataDurumu from '../components/HataDurumu';
import YuklemeDurumu from '../components/YuklemeDurumu';
import { colors, radius, spacing, typography } from '../constants/theme';
import { mockEtkinlikler } from '../services/mockData';
import { Etkinlik } from '../types';

// Supabase 'select' sorgusunu taklit eder (Gün 17'de gerçek sorguyla değişecek).
// simulateBos/simulateHata, boş liste ve hata durumlarını __DEV__ panelinden
// tetikleyip test edebilmek için var; gerçek backend geldiğinde kaldırılacak.
function mockEtkinlikleriGetir(opts: {
  simulateBos: boolean;
  simulateHata: boolean;
}): Promise<Etkinlik[]> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (opts.simulateHata) {
        reject(new Error('Etkinlikler yüklenemedi.'));
        return;
      }
      resolve(opts.simulateBos ? [] : mockEtkinlikler);
    }, 700);
  });
}

type TestModu = 'normal' | 'bos' | 'hata';
type Durum = 'yukleniyor' | 'hata' | 'hazir';

const TEST_MODU_ETIKETLERI: Record<TestModu, string> = {
  normal: 'Normal',
  bos: 'Boş',
  hata: 'Hata',
};

export default function KesfetScreen() {
  const [testModu, setTestModu] = useState<TestModu>('normal');
  const [durum, setDurum] = useState<Durum>('yukleniyor');
  const [etkinlikler, setEtkinlikler] = useState<Etkinlik[]>([]);
  const [yenileniyor, setYenileniyor] = useState(false);

  const veriGetir = useCallback(async (mod: TestModu) => {
    try {
      const veri = await mockEtkinlikleriGetir({
        simulateBos: mod === 'bos',
        simulateHata: mod === 'hata',
      });
      setEtkinlikler(veri);
      setDurum('hazir');
    } catch {
      setDurum('hata');
    }
  }, []);

  useEffect(() => {
    setDurum('yukleniyor');
    veriGetir(testModu);
  }, [testModu, veriGetir]);

  const yenile = useCallback(async () => {
    setYenileniyor(true);
    await veriGetir(testModu);
    setYenileniyor(false);
  }, [testModu, veriGetir]);

  return (
    <View style={styles.container}>
      {__DEV__ && (
        <View style={styles.devPanel}>
          {(Object.keys(TEST_MODU_ETIKETLERI) as TestModu[]).map((mod) => (
            <Pressable
              key={mod}
              onPress={() => setTestModu(mod)}
              style={[styles.devButon, testModu === mod && styles.devButonAktif]}
            >
              <Text style={[styles.devButonMetin, testModu === mod && styles.devButonMetinAktif]}>
                {TEST_MODU_ETIKETLERI[mod]}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {durum === 'yukleniyor' && <YuklemeDurumu mesaj="Etkinlikler yükleniyor..." />}
      {durum === 'hata' && <HataDurumu onTekrarDene={() => veriGetir(testModu)} />}
      {durum === 'hazir' && (
        <FlatList
          data={etkinlikler}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <EtkinlikKarti etkinlik={item} />}
          contentContainerStyle={styles.listeIcerik}
          ListEmptyComponent={<BosDurum />}
          refreshControl={
            <RefreshControl
              refreshing={yenileniyor}
              onRefresh={yenile}
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
  devPanel: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  devButon: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  devButonAktif: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  devButonMetin: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  devButonMetinAktif: {
    color: colors.white,
  },
});
