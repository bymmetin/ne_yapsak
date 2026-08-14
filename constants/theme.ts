// Renk paleti ve tipografi sabitleri — tüm ekranlar/component'lar buradan beslenir.
// Amaç: renk/font değerlerini tek dosyada toplayıp tutarlılığı garanti etmek,
// ileride dark mode eklerken (Gün 36) tek yerden yönetebilmek.

export const colors = {
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
