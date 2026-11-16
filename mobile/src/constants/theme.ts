import '@/global.css';

import { Platform } from 'react-native';

import { type TemaId, useEsquema, useTema } from '@/lib/appearance';

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

const nocheOscura: Theme = {
  text: '#E9EEFB',
  textSecondary: '#8F9AB8',
  background: '#0B1026',
  card: '#141B38',
  soft: '#1C2447',
  border: '#252E55',
  accent: '#9DB4FF',
  onAccent: '#0B1026',
  shadow: '0 18px 40px rgba(0, 0, 0, 0.5)',
};

/**
 * Los temas de colores (cada persona elige el suyo en Ajustes). Cada uno tiene
 * su versión clara y oscura; el color de cada grupo y las fotos no cambian.
 */
export const TEMAS: Record<TemaId, { nombre: string; lema: string; light: Theme; dark: Theme }> = {
  junti: { nombre: 'Junti', lema: 'El de siempre: neutro, que mandan las fotos', ...Colors },
  peonia: {
    nombre: 'Peonía',
    lema: 'Rosas suaves y frambuesa',
    light: {
      text: '#2B1D24',
      textSecondary: '#7A6370',
      background: '#FBF3F5',
      card: '#FFFFFF',
      soft: '#F5E6EB',
      border: '#F0DCE3',
      accent: '#C2416B',
      onAccent: '#FFFFFF',
      shadow: '0 18px 40px rgba(120, 40, 70, 0.10)',
    },
    dark: {
      text: '#F8EDF1',
      textSecondary: '#B396A2',
      background: '#1A1216',
      card: '#251A1F',
      soft: '#30222A',
      border: '#3A2932',
      accent: '#F08CAE',
      onAccent: '#2A1019',
      shadow: '0 18px 40px rgba(0, 0, 0, 0.5)',
    },
  },
  tinta: {
    nombre: 'Tinta',
    lema: 'Sobrio: grises y azul marino',
    light: {
      text: '#14213D',
      textSecondary: '#5E6779',
      background: '#F2F3F5',
      card: '#FFFFFF',
      soft: '#E6E9EE',
      border: '#DDE1E8',
      accent: '#1B2A4A',
      onAccent: '#FFFFFF',
      shadow: '0 14px 32px rgba(15, 25, 45, 0.10)',
    },
    dark: {
      text: '#E8ECF3',
      textSecondary: '#8E97A8',
      background: '#0D111A',
      card: '#161C28',
      soft: '#1F2635',
      border: '#283041',
      accent: '#C9D4E8',
      onAccent: '#0D111A',
      shadow: '0 18px 40px rgba(0, 0, 0, 0.5)',
    },
  },
  salvia: {
    nombre: 'Salvia',
    lema: 'Verdes tranquilos, como papel natural',
    light: {
      text: '#1F2A22',
      textSecondary: '#5F6E63',
      background: '#F3F5EF',
      card: '#FCFDF9',
      soft: '#E6EBDF',
      border: '#DCE3D3',
      accent: '#3F6B4E',
      onAccent: '#FFFFFF',
      shadow: '0 18px 40px rgba(40, 60, 40, 0.10)',
    },
    dark: {
      text: '#EAF0E6',
      textSecondary: '#93A396',
      background: '#111612',
      card: '#1A211C',
      soft: '#232C25',
      border: '#2C362E',
      accent: '#A9CDB1',
      onAccent: '#122016',
      shadow: '0 18px 40px rgba(0, 0, 0, 0.5)',
    },
  },
  atardecer: {
    nombre: 'Atardecer',
    lema: 'Cálido, entre melocotón y terracota',
    light: {
      text: '#2E1E16',
      textSecondary: '#7C6153',
      background: '#FBF4EE',
      card: '#FFFFFF',
      soft: '#F5E6DA',
      border: '#F0DCCC',
      accent: '#B94A33',
      onAccent: '#FFFFFF',
      shadow: '0 18px 40px rgba(120, 60, 30, 0.10)',
    },
    dark: {
      text: '#F7ECE4',
      textSecondary: '#B39B8C',
      background: '#1A1310',
      card: '#251C17',
      soft: '#30241E',
      border: '#3A2C24',
      accent: '#F2A27E',
      onAccent: '#2A140C',
      shadow: '0 18px 40px rgba(0, 0, 0, 0.5)',
    },
  },
  noche: {
    nombre: 'Noche',
    lema: 'Azul profundo, siempre oscuro',
    light: nocheOscura,
    dark: nocheOscura,
  },
};

export function useTheme(): Theme {
  return TEMAS[useTema()][useEsquema()];
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
