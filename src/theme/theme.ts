/**
 * Einzige Quelle für Farben, Schriften, Abstände, Rundungen und Schatten.
 * Werte stammen aus homebeat-ui-v8.html. Keine Farbwerte außerhalb dieser Datei.
 */
import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const colors = {
  background: '#0c0d12',
  card: '#161821',
  cardPressed: '#1e212d',
  border: '#252836',
  field: '#0e1017',
  navBar: '#0a0b0f',
  iconTile: '#212432',
  track: '#2a2f3f',
  headerTint: 'rgba(225, 29, 72, 0.07)',

  accent: '#e11d48',
  accentPressed: '#be123c',
  accentSoft: 'rgba(225, 29, 72, 0.14)',
  accentBorder: 'rgba(225, 29, 72, 0.35)',
  accentGlow: 'rgba(225, 29, 72, 0.25)',
  accentText: '#fb7185',
  accentTextSoft: '#fda4af',

  text: '#f3f4f6',
  textMuted: '#9ca3af',
  onAccent: '#ffffff',
  success: '#10b981',
  warning: '#fb923c',
  danger: '#fb7185',

  /** Nur für das Logo. */
  logoRed: '#b30000',
  logoTile: '#ffffff',

  transparent: 'transparent',
  backdrop: 'rgba(5, 6, 9, 0.8)',
  sheet: '#151822',
} as const;

export const fonts = {
  family: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
  size: {
    badge: 9,
    xs: 10,
    sm: 11,
    caption: 12,
    body: 13,
    md: 14,
    lg: 16,
    xl: 19,
    xxl: 20,
  },
  weight: {
    regular: '400' as TextStyle['fontWeight'],
    semibold: '600' as TextStyle['fontWeight'],
    bold: '700' as TextStyle['fontWeight'],
    heavy: '800' as TextStyle['fontWeight'],
  },
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 6,
  md: 9,
  lg: 12,
  xl: 16,
  xxl: 20,
  xxxl: 28,
  /** Seitenrand der Inhalte */
  screen: 20,
} as const;

export const radius = {
  sm: 4,
  md: 9,
  lg: 13,
  xl: 15,
  tile: 11,
  sheet: 24,
  pill: 999,
} as const;

export const sizes = {
  iconButton: 38,
  logo: 40,
  trackIcon: 38,
  playButton: 34,
  icon: 19,
  tabIcon: 22,
  sectionBar: { width: 3, height: 15 },
  tabIndicator: { width: 18, height: 3 },
} as const;

export const shadows: Record<'card' | 'accentGlow' | 'logo', ViewStyle> = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  accentGlow: {
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  logo: {
    shadowColor: colors.accent,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
};

export const theme = { colors, fonts, spacing, radius, sizes, shadows } as const;
export type Theme = typeof theme;
