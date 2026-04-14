import { Platform } from 'react-native';

// ───────────────────────────────────────────────────────────
// RiftTrack Design System — League of Legends palette
// ───────────────────────────────────────────────────────────

export const LoL = {
  // Backgrounds
  bg: '#010A13', // Deepest dark — root background
  bgSurface: '#0A1428', // Screen background
  bgElevated: '#1E2D3E', // Cards / modals
  bgHighlight: '#1A3A5C', // Hover / selected state

  // Gold hierarchy (LoL signature)
  goldLight: '#F0E6D3', // Warm cream — primary text
  gold: '#C8AA6E', // Main gold — active / accent
  goldMid: '#C89B3C', // Button fills / highlights
  goldDark: '#785A28', // Borders / dividers
  goldDeep: '#463714', // Subtle fills / tints

  // Hextech blue
  hextech: '#0AC8B9', // Teal accent
  hextechBright: '#0BC4E3', // Bright cyan — links / CTAs

  // Text
  textPrimary: '#F0E6D3', // Main readable text
  textSecondary: '#A09B8C', // Labels / captions
  textMuted: '#5B5A56', // Placeholders / disabled

  // Status
  win: '#0AC8B9', // Victory — hextech teal
  loss: '#C6483C', // Defeat — red

  // Tab bar
  tabBg: '#010A13',
  tabBorder: '#785A28',
  tabActive: '#C8AA6E',
  tabInactive: '#5B5A56',
} as const

// ───────────────────────────────────────────────────────────
// Colors map (keeps compatibility with existing useColorScheme hooks)
// The app is dark-only — both modes use the same LoL palette.
// ───────────────────────────────────────────────────────────

export const Colors = {
  light: {
    text: LoL.textPrimary,
    background: LoL.bgSurface,
    tint: LoL.gold,
    icon: LoL.textSecondary,
    tabIconDefault: LoL.tabInactive,
    tabIconSelected: LoL.tabActive,
  },
  dark: {
    text: LoL.textPrimary,
    background: LoL.bg,
    tint: LoL.gold,
    icon: LoL.textSecondary,
    tabIconDefault: LoL.tabInactive,
    tabIconSelected: LoL.tabActive,
  },
} as const;

// ───────────────────────────────────────────────────────────
// Typography
// ───────────────────────────────────────────────────────────

// LoL display font (Cinzel — closest free equivalent to Beaufort for LOL)
export const LoLFont = {
  bold: 'Cinzel_700Bold',
  black: 'Cinzel_900Black',
} as const

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'system-ui, -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif',
    serif: 'Georgia, \'Times New Roman\', serif',
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: 'SFMono-Regular, Menlo, Monaco, Consolas, \'Liberation Mono\', \'Courier New\', monospace',
  },
});

export const FontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  base: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  hero: 36,
} as const

// ───────────────────────────────────────────────────────────
// Spacing
// ───────────────────────────────────────────────────────────

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const

// ───────────────────────────────────────────────────────────
// Border radius
// ───────────────────────────────────────────────────────────

export const Radius = {
  sm: 4,
  md: 8,
  lg: 12,
  full: 999,
} as const
