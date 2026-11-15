import type { Moment } from '@/data/types';

import { FilmRoll } from './film-roll';

// Fuera de la web, el carrete de siempre (el 3D se dibuja con WebGL en la web).
export function FilmRoll3D(props: { moments: Moment[]; label: string; index?: number; groupId?: string }) {
  return <FilmRoll {...props} />;
}
