import type { Moment } from '@/data/types';

import type { SceneLook } from './film';

// El «director de dibujos»: lee lo que cuenta cada escena (la fecha, la hora,
// el tiempo que hacía, si hubo viaje, de qué se habla, las cifras) y decide
// qué dibujo a mano la acompaña, como los mosaicos de la animación «Rumbo a
// ti»: un calendario que se arranca, un reloj de paletas, una pluma que traza
// la ruta, un sol con su anillo de puntos, un gráfico que se dibuja…

export type Weather = 'sol' | 'nubes' | 'lluvia' | 'nieve' | 'niebla' | 'luna';
export type Feeling = 'comida' | 'amor' | 'musica' | 'mar' | 'fiesta';

export type DoodleSpec = { caption?: string } & (
  | { kind: 'reloj'; time: string; before: string }
  | { kind: 'calendario'; month: string; days: string[] }
  | { kind: 'mes'; month: string; days: number; offset: number; marked: number[] }
  | { kind: 'ruta'; from: string; to: string; km: string }
  | { kind: 'tiempo'; sky: Weather; temp?: number }
  | { kind: 'animo'; feeling: Feeling }
  | { kind: 'barras'; labels: string[]; values: number[] }
  | { kind: 'anios'; from: number; to: number }
  | { kind: 'hueco'; from: number; to: number }
  | { kind: 'origen' }
);

/** «La Habana» → «#rumboalahabana». Sin espacios ni signos. */
export const tag = (...words: string[]) =>
  '#' +
  words
    .join('')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');

const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const pad = (n: number) => String(n).padStart(2, '0');

/** La hora local de un momento (hh:mm) y la del minuto anterior, para que la paleta caiga. */
function clockOf(tz: string | undefined, at: number) {
  const fmt = (ms: number) => {
    try {
      return new Intl.DateTimeFormat('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: tz,
      }).format(ms);
    } catch {
      const d = new Date(ms);
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  };
  return { time: fmt(at), before: fmt(at - 60_000) };
}

/** El cielo que se dibuja según el código WMO del tiempo que hacía. */
function weatherOf(code: number, hour: number): Weather {
  if (code === 45 || code === 48) return 'niebla';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'nieve';
  if (code >= 51) return 'lluvia';
  if (hour < 6.5 || hour >= 21) return 'luna';
  return code <= 1 ? 'sol' : 'nubes';
}
const WEATHER_TAG: Record<Weather, string> = {
  sol: '#hacíasol',
  nubes: '#nublado',
  lluvia: '#llovía',
  nieve: '#nevaba',
  niebla: '#niebla',
  luna: '#denoche',
};
const FEELING_TAG: Record<Feeling, string> = {
  comida: '#sobremesa',
  amor: '#conmuchoamor',
  musica: '#bandasonora',
  mar: '#olorasal',
  fiesta: '#celebración',
};

/**
 * El dibujo de un momento. Prioridad: el viaje (si cambió de ciudad), lo que
 * caía del cielo, de qué habla, el tiempo que hacía y, si no, la hora: el
 * reloj marca la hora local de quien lo compartió. Alterna para no repetir.
 */
export function momentDoodle(
  moment: Moment,
  look: SceneLook,
  nth: number,
  weather?: { code: number; temp: number },
  /** El dibujo de la escena anterior, para no repetir el mismo dos veces seguidas. */
  previous?: DoodleSpec['kind'] | null,
): DoodleSpec {
  if (look.travel && previous !== 'ruta')
    return {
      kind: 'ruta',
      from: look.travel.from,
      to: look.travel.to,
      km: look.travel.km,
      caption: tag('rumboa', look.travel.to),
    };
  const hour = look.sky.hour;
  if (weather && weather.code >= 45 && previous !== 'tiempo') {
    const sky = weatherOf(weather.code, hour);
    return { kind: 'tiempo', sky, temp: Math.round(weather.temp), caption: WEATHER_TAG[sky] };
  }
  const feeling = (['comida', 'amor', 'musica', 'mar', 'fiesta'] as Feeling[]).find(
    (f) => f === look.mood,
  );
  if (feeling && previous !== 'animo')
    return { kind: 'animo', feeling, caption: FEELING_TAG[feeling] };
  if (weather && (nth % 2 === 1 || previous === 'reloj')) {
    const sky = weatherOf(weather.code, hour);
    return { kind: 'tiempo', sky, temp: Math.round(weather.temp), caption: WEATHER_TAG[sky] };
  }
  const day = WEEKDAYS[new Date(moment.createdAt).getDay()];
  return { kind: 'reloj', ...clockOf(moment.authorTz, moment.createdAt), caption: tag(day) };
}

const DAY = 86_400_000;

/**
 * La portada: la semana es un taco de calendario que se arranca hoja a hoja
 * (del primer día al último); el mes, su cuadrícula con los días en que
 * compartisteis algo marcados uno a uno.
 */
export function coverDoodle(
  kind: 'week' | 'month',
  from: number,
  to: number,
  moments: Moment[],
): DoodleSpec {
  const start = new Date(from);
  if (kind === 'week') {
    const end = Math.min(to - 1, Date.now());
    const days: string[] = [];
    for (let at = from; at <= end && days.length < 7; at += DAY)
      days.push(String(new Date(at).getDate()));
    return {
      kind: 'calendario',
      month: MONTHS[start.getMonth()],
      days,
      caption: tag('nuestrasemana'),
    };
  }
  const days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const offset = (new Date(start.getFullYear(), start.getMonth(), 1).getDay() + 6) % 7; // lunes = 0
  const marked = [...new Set(moments.map((m) => new Date(m.createdAt).getDate()))].sort(
    (a, b) => a - b,
  );
  return {
    kind: 'mes',
    month: MONTH_NAMES[start.getMonth()],
    days,
    offset,
    marked,
    caption: tag(MONTH_NAMES[start.getMonth()], String(start.getFullYear())),
  };
}

/**
 * El gráfico de las cifras: cuántos momentos hubo cada día de la semana (o
 * cada semana del mes). La barra más alta se rodea a mano, y el rótulo dice
 * cuál fue el día (o la semana) con más vida.
 */
export function statsChart(
  kind: 'week' | 'month',
  from: number,
  moments: Moment[],
): DoodleSpec | null {
  if (moments.length < 2) return null;
  let labels: string[];
  let values: number[];
  if (kind === 'week') {
    labels = SHORT;
    values = SHORT.map(() => 0);
    for (const m of moments) values[(new Date(m.createdAt).getDay() + 6) % 7] += 1;
  } else {
    const start = new Date(from);
    const days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    const weeks = Math.ceil(days / 7);
    labels = Array.from({ length: weeks }, (_, i) => `${i * 7 + 1}–${Math.min(days, i * 7 + 7)}`);
    values = labels.map(() => 0);
    for (const m of moments)
      values[Math.min(weeks - 1, Math.floor((new Date(m.createdAt).getDate() - 1) / 7))] += 1;
  }
  const top = values.indexOf(Math.max(...values));
  const caption =
    kind === 'week'
      ? `El ${['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'][top]} fue el día con más vida`
      : `La semana del ${labels[top]} fue la de más vida`;
  return { kind: 'barras', labels, values, caption };
}

/** «Nuestra historia»: los años pasan como un contador de paletas. */
export const yearDoodle = (from: number | undefined, to: number): DoodleSpec => ({
  kind: 'anios',
  from: from ?? to,
  to,
});
export const gapDoodle = (from: number, to: number): DoodleSpec => ({
  kind: 'hueco',
  from,
  to,
  caption: '#quépasó',
});
export const originDoodle = (): DoodleSpec => ({ kind: 'origen', caption: '#aquíempezótodo' });
