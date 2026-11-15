// El guion de la película: qué se cuenta y cuándo. Todo sale de los datos del
// periodo y de la crónica de la narradora; cada tramo dura lo que tarda ella
// en contarlo (o lo que se tarda en leerlo, si no hay voz).

import { moodOf } from '@/lib/film';

/** Las 20 vistas posibles de la ventanilla (la narradora elige una). */
export const ESCENARIOS = [
  { id: 'campo', vehiculo: 'tren', desc: 'campo tranquilo pasando por la ventana del tren (una semana tranquila, rutina)' },
  { id: 'nubes', vehiculo: 'avion', desc: 'mar de nubes desde la ventanilla del avión (viajes, distancia, alguien vuela)' },
  { id: 'lluvia', vehiculo: 'tren', desc: 'gotas de lluvia en el cristal (días grises, nostalgia, lluvia)' },
  { id: 'nieve', vehiculo: 'tren', desc: 'paisaje nevado con pinos (frío, invierno, nieve)' },
  { id: 'playa', vehiculo: 'tren', desc: 'playa con sol y olas (vacaciones, verano, mar)' },
  { id: 'montana', vehiculo: 'tren', desc: 'montañas con cumbres nevadas (excursiones, naturaleza, retos)' },
  { id: 'ciudad_noche', vehiculo: 'tren', desc: 'ciudad de noche con ventanas encendidas (noches, desvelos, salir)' },
  { id: 'ciudad', vehiculo: 'tren', desc: 'ciudad de día con edificios (trabajo, prisas, vida diaria)' },
  { id: 'fiesta', vehiculo: 'tren', desc: 'globos y banderines (cumpleaños, celebraciones, buenas noticias)' },
  { id: 'cena', vehiculo: 'tren', desc: 'una mesa con velas y dos copas (cenas, comidas juntos, brindis)' },
  { id: 'cafe', vehiculo: 'tren', desc: 'café humeante al amanecer (mañanas, desayunos, calma)' },
  { id: 'musica', vehiculo: 'tren', desc: 'notas musicales flotando (canciones, conciertos, bailar)' },
  { id: 'deporte', vehiculo: 'tren', desc: 'un balón botando en un campo (deporte, partidos, moverse)' },
  { id: 'otono', vehiculo: 'tren', desc: 'árboles soltando hojas (otoño, cambios, despedidas suaves)' },
  { id: 'primavera', vehiculo: 'tren', desc: 'flores que se abren y una mariposa (primavera, comienzos, alegría)' },
  { id: 'estrellas', vehiculo: 'tren', desc: 'cielo estrellado con luna y estrella fugaz (deseos, noches tranquilas, echar de menos)' },
  { id: 'tormenta', vehiculo: 'tren', desc: 'tormenta con rayos (semana difícil, líos, días intensos)' },
  { id: 'mar', vehiculo: 'barco', desc: 'el mar desde el ojo de buey de un barco (lejanía entre países, travesías)' },
  { id: 'anden', vehiculo: 'tren', desc: 'un andén donde dos personas se abrazan (reencuentros, visitas, os visteis)' },
  { id: 'casa', vehiculo: 'casa', desc: 'la ventana de casa con una planta y un gato dormido (hogar, quedarse en casa, cuidarse)' },
] as const;
export type Escenario = (typeof ESCENARIOS)[number]['id'];
export const esEscenario = (s: string | undefined | null): s is Escenario =>
  !!s && ESCENARIOS.some((e) => e.id === s);

export type Persona = { id: string; name: string; city?: string; lat?: number; lng?: number; tz?: string };

export type Pieza = {
  id: string;
  at: number;
  tz: string;
  author: string;
  /** Lo que enseña el calendario (el día, o el año) y «miércoles 00:45». */
  badge: string;
  when: string;
  place?: string;
  text?: string;
  photo?: string;
  wave?: number[];
  comments: { who: string; text: string }[];
  reactions: string[];
};

/** Un tramo de voz: el texto y, si hay audio, de qué segundo a qué segundo. */
export type Voz = { text: string; from?: number; to?: number };

export type DatosPelicula = {
  kind: 'week' | 'month' | 'story';
  from: number;
  to: number;
  range: string;
  title: string;
  group: string;
  /** Lo que cuenta el reloj de paletas (días o años, mismo largo) y la cabecera (el mes). */
  clock: string[];
  header: string;
  /** La pregunta del final. */
  closing: string;
  /** Rótulos: bajo el reloj, la ventanilla y la libreta. */
  tags: { reloj: string; ventanilla: string; libreta: string };
  scenario: Escenario;
  people: Persona[];
  /** La página de la libreta: puntos que la pluma une (casas o lugares). */
  mapa: { points: { title: string; subtitle?: string; lat?: number; lng?: number }[]; chronological?: boolean };
  pieces: Pieza[];
  voices: { intro?: Voz; pieces: Record<string, Voz>; stats?: Voz; end?: Voz };
  stats: {
    /** Cuatro cifras: arriba (2) y a los lados (corazón, bocadillo). */
    numbers: { n: number; label: string }[];
    cities: string[];
    perDay: number[];
    labels: string[];
    chartTitle: string;
    maxKm: number;
  };
  lovedId?: string;
  ongoing: boolean;
};

export type Tramo = [number, number];
export type Plan = {
  reloj: Tramo;
  persiana: Tramo;
  ventanilla: Tramo;
  libreta: Tramo;
  calendario: Tramo;
  piezas: { id: string; a: number; b: number }[];
  recuerdos: Tramo;
  final: Tramo;
  total: number;
  voces: { a: number; b: number; voz: Voz }[];
};

/** Cuánto dura un tramo de voz (el audio, o lo que se tarda en leer). */
export const durVoz = (v?: Voz) =>
  !v ? 0 : v.from != null && v.to != null ? Math.max(0.5, v.to - v.from) : v.text.length / 14 + 0.8;

export function planificar(d: DatosPelicula): Plan {
  const voces: Plan['voces'] = [];
  const say = (a: number, v?: Voz) => {
    if (v) voces.push({ a, b: a + durVoz(v), voz: v });
  };
  // La voz manda: los tramos se ajustan a lo que dura y entre una frase y la
  // siguiente apenas hay silencio. La apertura sigue sonando sobre la libreta.
  const reloj: Tramo = [0, 2.8];
  const persiana: Tramo = [2.5, 4.7];
  const v0 = 4.3;
  const introStart = v0 + 0.8;
  const introEnd = introStart + durVoz(d.voices.intro);
  say(introStart, d.voices.intro);
  const ventanilla: Tramo = [v0, Math.max(v0 + 5.5, introStart + durVoz(d.voices.intro) * 0.6)];
  const libreta: Tramo = [ventanilla[1] - 0.6, ventanilla[1] - 0.6 + 6.2];
  const c0 = libreta[1] - 0.4;
  // Primero el calendario y el flash de la cámara; luego, un momento tras otro.
  let t = Math.max(c0 + 2.2, introEnd - 0.4);
  const piezas = d.pieces.map((p) => {
    const v = d.voices.pieces[p.id];
    const a = t;
    say(a + 0.5, v);
    const b = a + Math.max(3.8, 0.5 + durVoz(v) + 0.5 + Math.min(2, p.comments.length) * 0.3);
    t = b;
    return { id: p.id, a, b };
  });
  const calendario: Tramo = [c0, t];
  const recuerdos: Tramo = [t, t + Math.max(6.5, durVoz(d.voices.stats) + 1.4)];
  say(t + 0.7, d.voices.stats);
  const final: Tramo = [recuerdos[1], recuerdos[1] + Math.max(4.5, durVoz(d.voices.end) + 1.2)];
  say(final[0] + 0.4, d.voices.end);
  return { reloj, persiana, ventanilla, libreta, calendario, piezas, recuerdos, final, total: final[1] + 0.3, voces };
}

/** Si la narradora no eligió vista, se elige por el contexto del periodo. */
export function elegirEscenario(
  texts: string[],
  hours: number[],
  month: number,
  opts: { travel: boolean; rain: boolean; snow: boolean },
): Escenario {
  if (opts.snow) return 'nieve';
  const all = texts.join(' · ');
  const plain = all.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/tormenta|rayo|truen/.test(plain)) return 'tormenta';
  if (/futbol|partido|\bgol\b|correr|gimnas|\bbici|entren|deporte/.test(plain)) return 'deporte';
  if (/nos vimos|reencuentro|vinisteis|visita|llegue|aterric|abrazo/.test(plain)) return 'anden';
  if (/barco|ferry|crucero|navega/.test(plain)) return 'mar';
  const count = new Map<string, number>();
  for (const x of texts) {
    const m = moodOf(x);
    if (m) count.set(m, (count.get(m) ?? 0) + 1);
  }
  const top = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const night = hours.filter((h) => h < 6.5 || h >= 21).length > hours.length / 2;
  switch (top) {
    case 'viaje':
      return opts.travel ? 'nubes' : 'campo';
    case 'lluvia':
      return 'lluvia';
    case 'nieve':
      return 'nieve';
    case 'mar':
      return 'playa';
    case 'comida':
      return hours.filter((h) => h < 12).length > hours.length / 2 ? 'cafe' : 'cena';
    case 'fiesta':
      return 'fiesta';
    case 'musica':
      return 'musica';
    case 'naturaleza':
      return month >= 8 && month <= 10 ? 'otono' : month >= 2 && month <= 4 ? 'primavera' : 'montana';
    case 'amor':
      return 'estrellas';
    case 'noche':
      return 'ciudad_noche';
    case 'nostalgia':
      return 'casa';
    case 'alegria':
      return 'ciudad';
  }
  if (opts.rain) return 'lluvia';
  if (opts.travel) return 'nubes';
  if (night) return 'ciudad_noche';
  return 'campo';
}
