// En la app nativa todavía no hay globo 3D: se usa el mapa de puntos de luz.
// La versión web (globe-map.web.tsx) usa MapLibre con relieve y edificios en 3D.
import type { GlobeMapProps } from './globe-map.types';
import { WorldMap } from './world-map';

export type { GlobeMemory, GlobePerson } from './globe-map.types';

export function GlobeMap({ people, height = 260 }: GlobeMapProps) {
  return <WorldMap people={people} height={height} />;
}
