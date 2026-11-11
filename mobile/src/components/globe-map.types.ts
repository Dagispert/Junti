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

/** Un recuerdo con lugar: se dibuja como una burbuja con su foto. */
export type GlobeMemory = { id: string; lat: number; lng: number; photo?: string; title?: string };

export type GlobeMapProps = {
  people: GlobePerson[];
  height?: number;
  /** false: vista previa que gira sola y no responde a gestos (dentro de una lista). */
  interactive?: boolean;
  /** Persona a la que viajar; null para volver a ver el mundo entero. */
  focusId?: string | null;
  onSelect?: (id: string) => void;
  /** Recuerdos con lugar («mapa de recuerdos»). */
  memories?: GlobeMemory[];
  /** Al tocar una burbuja: los recuerdos de ese sitio. */
  onMemories?: (ids: string[]) => void;
  /** Viajar a un punto (por ejemplo, un grupo de recuerdos) cuando no hay persona elegida. */
  focusPoint?: { lat: number; lng: number } | null;
  /** Ocultar las chinchetas de personas. */
  hidePeople?: boolean;
  /** Esquinas redondeadas (cuando va dentro de una tarjeta). */
  rounded?: boolean;
};
