import {
  Camera,
  ChartColumn,
  CircleHelp,
  Flag,
  History,
  Lightbulb,
  type LucideIcon,
  MessageCircle,
} from 'lucide-react-native';
import { useSyncExternalStore } from 'react';
import { useColorScheme } from 'react-native';

// Las familias: todo lo que se añade con el «+» es de una familia, y cada una
// tiene nombre, icono y color propios para que en «Hoy» se entienda de un
// vistazo qué es cada cosa.

export type FamilyId = 'moment' | 'memory' | 'challenge' | 'poll' | 'quiz' | 'open' | 'prompt';

type Family = {
  label: string;
  icon: LucideIcon;
  /** El color de la familia (texto, iconos, franja), en claro y en oscuro. */
  color: { light: string; dark: string };
  /** El fondo tintado (muy suave), en claro y en oscuro. */
  tint: { light: string; dark: string };
};

export const FAMILIES: Record<FamilyId, Family> = {
  moment: {
    label: 'Momento',
    icon: Camera,
    color: { light: '#4A4E55', dark: '#B9BDC3' },
    tint: { light: '#FFFFFF', dark: '#1B1C1E' },
  },
  memory: {
    label: 'Recuerdo',
    icon: History,
    color: { light: '#A86A1F', dark: '#E0AA62' },
    tint: { light: '#FBF3E6', dark: '#2A2218' },
  },
  challenge: {
    label: 'Reto',
    icon: Flag,
    color: { light: '#D0532C', dark: '#F08A63' },
    tint: { light: '#FDEEE8', dark: '#2C1D18' },
  },
  poll: {
    label: 'Encuesta',
    icon: ChartColumn,
    color: { light: '#2F6FB0', dark: '#7EB0E6' },
    tint: { light: '#EAF2FB', dark: '#17212C' },
  },
  quiz: {
    label: 'Quiz',
    icon: CircleHelp,
    color: { light: '#2F7D4F', dark: '#74C795' },
    tint: { light: '#E9F5EE', dark: '#16241C' },
  },
  open: {
    label: 'Pregunta',
    icon: MessageCircle,
    color: { light: '#B43A6E', dark: '#E888B0' },
    tint: { light: '#FBEAF1', dark: '#2A1820' },
  },
  prompt: {
    label: 'Propuesta',
    icon: Lightbulb,
    color: { light: '#9A7A0C', dark: '#E5C74F' },
    tint: { light: '#FBF6DF', dark: '#28240F' },
  },
};

/** El color y el tinte de una familia en el tema actual. */
export function useFamily(id: FamilyId) {
  const dark = useColorScheme() === 'dark';
  const f = FAMILIES[id];
  return {
    ...f,
    id,
    color: dark ? f.color.dark : f.color.light,
    tint: dark ? f.tint.dark : f.tint.light,
  };
}

// ── Cuánto color se ve (de momento, a elegir en Ajustes para decidir) ──

/** «tinted»: la tarjeta tintada; «accent»: solo la etiqueta y una franja; «plain»: sin color. */
export type FamilyColorMode = 'tinted' | 'accent' | 'plain';
const KEY = 'junti-color-familias';
const listeners = new Set<() => void>();

function read(): FamilyColorMode {
  try {
    const v = globalThis.localStorage?.getItem(KEY);
    return v === 'tinted' || v === 'plain' ? v : 'accent';
  } catch {
    return 'accent';
  }
}
let current: FamilyColorMode = read();

export function setFamilyColorMode(mode: FamilyColorMode) {
  current = mode;
  try {
    globalThis.localStorage?.setItem(KEY, mode);
  } catch {
    // sin almacenamiento: solo esta vez
  }
  listeners.forEach((l) => l());
}

export function useFamilyColorMode(): FamilyColorMode {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => current,
  );
}
