// Tipografi/spacing/radius sabitleri — tüm ekranlar/component'lar buradan
// beslenir. Gün 35: renk paleti buradan context/ThemeContext.tsx'e taşındı
// (açık/koyu tema desteği için `colors` artık statik bir sabit değil,
// useTheme() hook'undan geliyor) - spacing/typography/radius temadan
// bağımsız olduğu için burada, sabit kaldı.

export const typography = {
  fontFamily: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
  },
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 22,
    xxl: 28,
  },
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    bold: '700' as const,
  },
  lineHeight: {
    sm: 18,
    md: 22,
    lg: 26,
    xl: 32,
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  full: 999,
} as const;
