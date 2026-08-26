// Gün 35: Açık/koyu tema. constants/theme.ts'teki spacing/typography/radius
// sabit kalıyor (bkz. o dosya) - sadece renkler tema bazlı, bu yüzden colors
// artık theme.ts'ten değil buradan geliyor. AuthContext.tsx ile aynı Context
// API deseni (Provider + useX hook, context dışında kullanılırsa throw).

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import type { ColorSchemeName } from 'react-native';

const lightColors = {
  primary: '#6C5CE7',
  primaryDark: '#4834D4',
  secondary: '#00B894',
  background: '#FFFFFF',
  surface: '#F5F6FA',
  text: '#2D3436',
  textSecondary: '#636E72',
  border: '#DFE6E9',
  error: '#D63031',
  warning: '#FDCB6E',
  success: '#00B894',
  white: '#FFFFFF',
  black: '#000000',
} as const;

// Marka renkleri (primary/primaryDark/secondary/error/warning/success)
// kasıtlı olarak iki palette'te de AYNI - marka tutarlılığı için, sadece
// nötr/yüzey skalası (background/surface/text/textSecondary/border)
// koyulaşıyor. white/black de kasıtlı olarak sabit (invariant) bırakıldı -
// bunlar "renkli bir buton üzerindeki beyaz metin/ikon" gibi temadan
// bağımsız kullanımlar için (ör. headerTintColor, buton üzerindeki
// ActivityIndicator). Bu refactor'da "kart/input arkaplanı" niyetiyle
// colors.white/colors.black kullanan yerler (backgroundColor/borderColor)
// colors.surface'a taşındı - artık burada, bu iki sabit değerde değiller.
const darkColors = {
  primary: lightColors.primary,
  primaryDark: lightColors.primaryDark,
  secondary: lightColors.secondary,
  background: '#121212',
  surface: '#1E1E24',
  text: '#F5F6FA',
  textSecondary: '#A0A4A8',
  border: '#38383A',
  error: lightColors.error,
  warning: lightColors.warning,
  success: lightColors.success,
  white: lightColors.white,
  black: lightColors.black,
} as const;

// Record<keyof typeof lightColors, string> - typeof lightColors DEĞİL:
// darkColors'ın alanları farklı literal hex string'ler taşıyor (ör.
// background '#FFFFFF' değil '#121212'), typeof lightColors kullansaydık
// TypeScript her alanı lightColors'taki TAM literal değere daraltır ve
// darkColors bu tipe uymazdı.
export type ColorPalette = Record<keyof typeof lightColors, string>;
export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedScheme = 'light' | 'dark';

// notifications.ts > NOTIFICATION_STORAGE_KEY ile aynı isimlendirme deseni
// ('@ne_yapsak/...').
const THEME_STORAGE_KEY = '@ne_yapsak/tema_tercihi';

type ThemeContextValue = {
  colors: ColorPalette;
  scheme: ResolvedScheme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// null/undefined (Appearance henüz belirlenememişse) açık temaya düşer -
// diğer "bilinmeyen durumda güvenli varsayılan" kararlarıyla (ör.
// participationStatus null -> "Katıl" butonu) aynı yaklaşım.
function resolveScheme(systemScheme: ColorSchemeName): ResolvedScheme {
  return systemScheme === 'dark' ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // 'system': kullanıcı hiç manuel seçim yapmamış - cihazın temasını takip
  // eder. Varsayılan bu, plan maddesi 2'nin şartı.
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(Appearance.getColorScheme());

  // AsyncStorage'daki kaydedilmiş tercihi oku - AuthContext.tsx >
  // supabase.auth.getSession() ile aynı "başlangıçta bir kere oku" deseni.
  // Bu okuma sonuçlanana kadar geçen kısa an için 'system' varsayılanı
  // kullanılıyor; kayıtlı tercih 'light'/'dark' ise (ki 'system'den farklı
  // bir sistem temesindeysek) bir anlık yanlış tema görünüp doğrusuna
  // dönebilir - AsyncStorage okuması çok hızlı olduğu için kasıtlı olarak
  // bunu engelleyen ayrı bir "loading" bekletmesi eklenmedi (AuthContext'in
  // tüm uygulamayı bloke eden loading'inden farklı, kapsamı aşardı).
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPreferenceState(stored);
      }
    });
  }, []);

  // preference 'system' iken cihaz teması (kullanıcı cihaz ayarlarından)
  // değişince anlık güncellensin diye - plan maddesi 2'nin şartı.
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => subscription.remove();
  }, []);

  // AuthContext.tsx > completePasswordRecovery ile aynı desen - useCallback
  // sarmalanmadı, o dosyada da yok.
  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch((err) => {
      console.warn('Tema tercihi kaydedilemedi:', err);
    });
  };

  const scheme: ResolvedScheme = preference === 'system' ? resolveScheme(systemScheme) : preference;
  const colors = scheme === 'dark' ? darkColors : lightColors;

  const value = useMemo(
    () => ({ colors, scheme, preference, setPreference }),
    [colors, scheme, preference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useTheme, ThemeProvider içinde kullanılmalı.');
  }
  return value;
}
