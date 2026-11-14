import type { Moment } from '@/data/types';

import { distanceKm, formatKm, localHour } from './geo';

// El «director» del resumen narrado: de lo que cuenta cada escena (qué se
// compartió, dónde, a qué hora, qué tiempo hacía, de qué habla) saca cómo se
// ve: el cielo, el ambiente que flota en el aire y el tipo de plano.

/** Lo que flota en el aire de una escena. */
export type Mood =
  | 'calma'
  | 'alegria'
  | 'fiesta'
  | 'comida'
  | 'viaje'
  | 'lluvia'
  | 'nieve'
  | 'mar'
  | 'naturaleza'
  | 'musica'
  | 'amor'
  | 'noche'
  | 'nostalgia';

export const MOODS: Mood[] = [
  'calma',
  'alegria',
  'fiesta',
  'comida',
  'viaje',
  'lluvia',
  'nieve',
  'mar',
  'naturaleza',
  'musica',
  'amor',
  'noche',
  'nostalgia',
];

/** Palabras que delatan el ambiente (sobre texto sin tildes y en minúsculas). */
const HINTS: [Mood, RegExp][] = [
  [
    'fiesta',
    /cumple|fiesta|celebr|brind|boda|aniversari|enhorabuena|felicidades|ganamos|campeon|🎉|🥳|🎂/,
  ],
  ['lluvia', /lluvi|llov|llueve|tormenta|paraguas|chaparron|diluvi|☔|🌧/],
  ['nieve', /\bnieve|nevad|nevando|esqui|❄|⛄/],
  ['mar', /playa|\bmar\b|\bolas?\b|costa|barco|velero|puerto|surf|arena|piscina|bucea|🏖|🌊/],
  [
    'comida',
    /\bcena|comida|comer|desayun|almuerz|ramen|pizza|paella|cafe\b|cocin|receta|tarta|pastel|tapas|\bvino|cerveza|merienda|restaurante|sushi|\bmate\b|tortilla|🍜|🍕|☕|🍰/,
  ],
  [
    'viaje',
    /viaj|avion|vuelo|aeropuerto|\btren\b|maleta|carretera|\bruta\b|vacacion|turist|hotel|excursion|✈|🧳/,
  ],
  ['musica', /musica|cancion|concierto|guitarra|piano|bail|cantar|cantando|festival|🎶|🎵|🎸/],
  [
    'naturaleza',
    /monte|montana|bosque|\bcampo\b|parque|sender|jardin|\bflor|arbol|\brio\b|\blago\b|otono|primavera|🌳|🌿|🍂/,
  ],
  [
    'amor',
    /te quiero|os quiero|\bamor\b|\bbeso|abrazo|echo de menos|os echo|extran|carino|❤|🥰|😍/,
  ],
  ['noche', /\bnoche|madrugada|\bluna\b|estrellas|insomnio|desvel|🌙|✨/],
  ['nostalgia', /recuerd|hace anos|aquel|anor|infancia|viejos tiempos|como antes|de pequen/],
  ['alegria', /\brisa|reir|riendo|jaja|feliz|content|genial|divertid|😂|🤣|😄/],
];

const plain = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** El ambiente que sugiere un texto (o null si no dice nada claro). */
export function moodOf(...texts: (string | undefined | null)[]): Mood | null {
  const text = plain(texts.filter(Boolean).join(' · '));
  if (!text.trim()) return null;
  for (const [mood, re] of HINTS) if (re.test(text)) return mood;
  return null;
}

/** El tiempo que hacía: qué cae del cielo y cuánto se tapa. */
export type Sky = {
  /** Hora local (0–24, con decimales) del sitio de la escena. */
  hour: number;
  /** 0 despejado … 1 cubierto. */
  cover: number;
  precip: 'none' | 'rain' | 'snow';
  fog: boolean;
};

/** Código WMO de Open-Meteo → cielo. */
export function skyFromWeather(hour: number, code?: number | null): Sky {
  if (code == null) return { hour, cover: 0.15, precip: 'none', fog: false };
  const rain = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
  const snow = (code >= 71 && code <= 77) || code === 85 || code === 86;
  return {
    hour,
    cover: code === 0 ? 0 : code === 1 ? 0.2 : code === 2 ? 0.45 : rain || snow ? 0.95 : 0.8,
    precip: snow ? 'snow' : rain ? 'rain' : 'none',
    fog: code === 45 || code === 48,
  };
}

/** Cómo se dice el tiempo que hacía, en pasado («llovía», «hacía sol»). */
export function weatherWords(code: number, temp: number, hour: number): string {
  const night = hour < 6.5 || hour >= 21;
  const what =
    code === 0
      ? night
        ? 'cielo despejado'
        : 'hacía sol'
      : code <= 2
        ? 'algo nublado'
        : code === 3
          ? 'nublado'
          : code === 45 || code === 48
            ? 'había niebla'
            : code >= 95
              ? 'había tormenta'
              : (code >= 71 && code <= 77) || code === 85 || code === 86
                ? 'nevaba'
                : code >= 51 && code <= 57
                  ? 'lloviznaba'
                  : 'llovía';
  return `${what}, ${Math.round(temp)}°`;
}

/** Colores del cielo (arriba y abajo) a lo largo del día. */
const SKY_KEYS: [number, string, string][] = [
  [0, '#0A1030', '#232B5C'],
  [4.5, '#141B48', '#3D3A78'],
  [6.2, '#5D62AE', '#FFB38A'],
  [7.6, '#74B4E6', '#FFE2C2'],
  [10, '#5BAEEA', '#CDE9FA'],
  [14, '#4FA6E6', '#C4E4F8'],
  [17.5, '#5C9FD8', '#F8DDB4'],
  [19.4, '#59468F', '#F58F52'],
  [20.6, '#2A2F68', '#8A5A8C'],
  [22, '#111741', '#2C3468'],
  [24, '#0A1030', '#232B5C'],
];

const rgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];
const mix = (a: number[], b: number[], k: number): [number, number, number] => [
  a[0] + (b[0] - a[0]) * k,
  a[1] + (b[1] - a[1]) * k,
  a[2] + (b[2] - a[2]) * k,
];

/** El cielo de una hora, con su cobertura: colores de arriba y abajo (RGB). */
export function skyColors(sky: Sky): {
  top: [number, number, number];
  bottom: [number, number, number];
} {
  const h = ((sky.hour % 24) + 24) % 24;
  let i = 0;
  while (i < SKY_KEYS.length - 2 && SKY_KEYS[i + 1][0] <= h) i++;
  const [h0, t0, b0] = SKY_KEYS[i];
  const [h1, t1, b1] = SKY_KEYS[i + 1];
  const k = (h - h0) / Math.max(0.001, h1 - h0);
  let top = mix(rgb(t0), rgb(t1), k);
  let bottom = mix(rgb(b0), rgb(b1), k);
  // Nublado: el cielo se agrisa (de día, hacia un gris claro; de noche, más cerrado).
  const grey = sky.cover * (sky.precip !== 'none' ? 0.75 : 0.5) + (sky.fog ? 0.3 : 0);
  if (grey > 0) {
    const lum = (c: number[]) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
    const g = (c: [number, number, number]) => {
      const l = lum(c) * (sky.precip !== 'none' ? 0.86 : 0.97);
      return mix(c, [l * 0.96, l, l * 1.05], Math.min(0.85, grey));
    };
    top = g(top);
    bottom = g(bottom);
  }
  return { top, bottom };
}

/** ¿El cielo es oscuro? (para escribir encima en claro). */
export function isDark(sky: Sky): boolean {
  const { top, bottom } = skyColors(sky);
  const c = mix(top, bottom, 0.6);
  return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2] < 120;
}

/** Cuánta noche hay (0 de día … 1 noche cerrada), para las estrellas. */
export function nightness(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 21.5 || h < 5) return 1;
  if (h >= 20) return (h - 20) / 1.5;
  if (h < 6.5) return 1 - (h - 5) / 1.5;
  return 0;
}

/** El tipo de plano de una escena. */
export type Shot =
  | 'title'
  | 'montage'
  | 'lines'
  | 'hero'
  | 'polaroid'
  | 'collage'
  | 'quote'
  | 'voice'
  | 'numbers'
  | 'finale';

/** El viaje desde la escena anterior, si cambia de ciudad. */
export type Travel = { key: string; from: string; to: string; km: string; hours: number };

export type SceneLook = {
  shot: Shot;
  sky: Sky;
  mood: Mood;
  dark: boolean;
  /** Dónde y cuándo: «La Habana», «martes · 09:10». */
  place?: string;
  when?: string;
  travel?: Travel;
};

type Who = { city?: string; lat?: number; lng?: number; tz?: string };

/** Dónde pasó un momento: su lugar o, si no, la ciudad de quien lo compartió. */
export function whereOf(moment: Moment, author: Who) {
  const name = moment.place?.name.split(',')[0] ?? author.city;
  const lat = moment.place?.lat ?? author.lat;
  const lng = moment.place?.lng ?? author.lng;
  return { name: name || undefined, lat, lng };
}

/** El plano que mejor cuenta un momento, alternando para que no se repita. */
export function shotFor(moment: Moment, nth: number): Shot {
  const pictures = moment.gallery?.length ?? moment.photos?.length ?? 0;
  if (pictures >= 2 && !moment.videoUri) return 'collage';
  if (moment.imageUri || moment.videoUri) return nth % 2 === 0 ? 'hero' : 'polaroid';
  if (moment.text) return 'quote';
  if (moment.voice) return 'voice';
  return 'quote';
}

/** El viaje entre dos sitios (si están a más de 60 km). */
export function travelBetween(
  from: { name?: string; lat?: number; lng?: number; tz?: string } | null,
  to: { name?: string; lat?: number; lng?: number; tz?: string },
  at: number,
  key: string,
): Travel | undefined {
  if (!from?.name || !to.name || from.name === to.name) return undefined;
  if (from.lat == null || from.lng == null || to.lat == null || to.lng == null) return undefined;
  const km = distanceKm({ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng });
  if (km < 60) return undefined;
  let hours = 0;
  if (from.tz && to.tz) {
    hours = Math.round(localHour(to.tz, at) - localHour(from.tz, at));
    if (hours > 12) hours -= 24;
    if (hours < -12) hours += 24;
  }
  return { key, from: from.name, to: to.name, km: formatKm(km), hours };
}
