import '@/global.css';

import { Platform, useColorScheme } from 'react-native';

export const Colors = {
  light: {
    text: '#2B2622',
    textSecondary: '#7A7067',
    background: '#FAF6F0',
    card: '#FFFFFF',
    border: '#EBE3D9',
    accent: '#D9663F',
    onAccent: '#FFFFFF',
  },
  dark: {
    text: '#F4EEE6',
    textSecondary: '#A89E93',
    background: '#1A1714',
    card: '#26221E',
    border: '#3A342E',
    accent: '#E8845F',
    onAccent: '#1A1714',
  },
} as const;

export type Theme = { [K in keyof typeof Colors.light]: string };

export function useTheme(): Theme {
  return Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', serif: 'ui-serif' },
  web: { sans: 'var(--font-display)', serif: 'var(--font-serif)' },
  default: { sans: 'normal', serif: 'serif' },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
} as const;
export const Radius = { small: 10, medium: 18, large: 26 } as const;
export const MaxContentWidth = 560;
