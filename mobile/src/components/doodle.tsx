import type { CSSProperties } from 'react';

import type { DoodleSpec } from '@/lib/doodles';

// Los dibujos a mano animados solo existen en la web (doodle.web.tsx): miden
// los trazados con el DOM. Fuera de la web no se dibuja nada.

export type DoodleColors = { ink: string; accent: string; paper: string };

export function Doodle(_props: {
  spec: DoodleSpec;
  size?: number;
  colors: DoodleColors;
  delay?: number;
  paused?: boolean;
  leaving?: boolean;
  style?: CSSProperties;
}) {
  return null;
}

export const canDoodle = () => false;
