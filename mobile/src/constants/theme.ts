import '@/global.css';

import { Platform, useColorScheme } from 'react-native';

// Estilo: minimalista y neutro. El color lo ponen las fotos; la interfaz es
// blanco, grises suaves y tinta casi negra, con esquinas muy redondeadas.
export const Colors = {
  light: {
    text: '#1D1F22',
    textSecondary: '#686C73',
    background: '#F6F6F7',
    card: '#FFFFFF',
    soft: '#EDEDEF',
    border: '#E9E9EC',
    accent: '#1F2124',
    onAccent: '#FFFFFF',
    shadow: '0 18px 40px rgba(20, 22, 26, 0.10)',
  },
  dark: {
    text: '#F3F3F4',
    textSecondary: '#8B9096',
    background: '#0F1011',
    card: '#1B1C1E',
    soft: '#242528',
    border: '#2B2C30',
    accent: '#F3F3F4',
    onAccent: '#141517',
    shadow: '0 18px 40px rgba(0, 0, 0, 0.45)',
  },
} as const;

export type Theme = { [K in keyof typeof Colors.light]: string };

export function useTheme(): Theme {
  return Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', mono: 'ui-monospace' },
  web: { sans: 'var(--font-display)', mono: 'var(--font-mono)' },
  default: { sans: 'normal', mono: 'monospace' },
});

/** Letra manuscrita para notas, pies de foto y pegatinas (Caveat, licencia OFL). */
export const Hand = 'Caveat_600SemiBold';
export const HandBold = 'Caveat_700Bold';
/** Letra con serifa (Fraunces, la de la palabra «junti»), para momentos especiales. */
export const Serif = 'Fraunces_500Medium';
export const SerifItalic = 'Fraunces_400Regular_Italic';

export const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32 } as const;
/** frame: marco exterior de las tarjetas · inner: la foto que va dentro · pill: botones. */
// Radios encajados: la foto (inner) = marco (frame) − relleno de la tarjeta (12).
export const Radius = { small: 12, medium: 16, inner: 20, frame: 32, pill: 999 } as const;
export const MaxContentWidth = 520;
