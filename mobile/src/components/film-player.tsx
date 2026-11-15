import type { DatosPelicula } from '@/pelicula/guion';

// La película solo existe en la web (se dibuja con SVG en el DOM).
export type FilmControl = { seek: (t: number) => void; time: () => number };
export function FilmPlayer(_props: {
  data: DatosPelicula;
  voice?: unknown;
  paused: boolean;
  muted?: boolean;
  onTime?: (t: number, total: number) => void;
  onEnd?: () => void;
  control?: { current: FilmControl | null };
}) {
  return null;
}
