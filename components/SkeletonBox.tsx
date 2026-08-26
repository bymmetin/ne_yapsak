import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { radius } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

// Gün 35: Yeni kütüphane eklemeden basit skeleton - Animated API ile 0.4-1
// arası opacity pulse. Renk için ayrı bir tema token'ı eklemedik, colors.border
// (zaten iki temada da nötr/gri bir ton) yeniden kullanıldı - EventCard.tsx
// gibi yerlerde de kart kenarlığı için aynı ton kullanılıyor.
type Props = {
  width?: number | `${number}%`;
  // Opsiyonel: verilmezse yükseklik style'dan (ör. flex: 1 ile ekranı
  // dolduran bir harita alanı) belirlenir - bkz. MapScreen.tsx kullanımı.
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

export default function SkeletonBox({ width = '100%', height, borderRadius = radius.sm, style }: Props) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      // Ekran okuyucu için gösterilecek bir içerik değil - gerçek kart
      // yüklenince zaten yerini alacak, kullanıcıya boş bir kutu
      // duyurulmasın diye erişilebilirlik ağacından çıkarıldı.
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius, backgroundColor: colors.border, opacity }, style]}
    />
  );
}
