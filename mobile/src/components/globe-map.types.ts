import type { MapPerson } from './world-map';

/** Una persona en el globo: su ciudad y la foto que la representa en la chincheta. */
export type GlobePerson = MapPerson & {
  city?: string;
  /** País, para la etiqueta de la chincheta. */
  country?: string;
  /** Foto de perfil o, si no tiene, su última foto en el grupo. */
  photo?: string;
  color: string;
};

export type GlobeMapProps = {
  people: GlobePerson[];
  height?: number;
  /** false: vista previa que gira sola y no responde a gestos (dentro de una lista). */
  interactive?: boolean;
  /** Persona a la que viajar; null para volver a ver el mundo entero. */
  focusId?: string | null;
  onSelect?: (id: string) => void;
  /** Esquinas redondeadas (cuando va dentro de una tarjeta). */
  rounded?: boolean;
};
