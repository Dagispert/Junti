// El guion de la película: qué se cuenta y cuándo. Todo sale de los datos del
// periodo y de la crónica de la narradora; cada tramo dura lo que tarda ella
// en contarlo (o lo que se tarda en leerlo, si no hay voz).

import { moodOf } from '@/lib/film';

/** Las 20 vistas posibles de la ventanilla (la narradora elige una). */
export const ESCENARIOS = [
  {
    id: 'campo',
    vehiculo: 'tren',
    desc: 'campo tranquilo pasando por la ventana del tren (una semana tranquila, rutina)',
  },
  {
    id: 'nubes',
    vehiculo: 'avion',
    desc: 'mar de nubes desde la ventanilla del avión (viajes, distancia, alguien vuela)',
  },
  {
    id: 'lluvia',
    vehiculo: 'tren',
    desc: 'gotas de lluvia en el cristal (días grises, nostalgia, lluvia)',
  },
  { id: 'nieve', vehiculo: 'tren', desc: 'paisaje nevado con pinos (frío, invierno, nieve)' },
  { id: 'playa', vehiculo: 'tren', desc: 'playa con sol y olas (vacaciones, verano, mar)' },
  {
    id: 'montana',
    vehiculo: 'tren',
    desc: 'montañas con cumbres nevadas (excursiones, naturaleza, retos)',
  },
  {
    id: 'ciudad_noche',
    vehiculo: 'tren',
    desc: 'ciudad de noche con ventanas encendidas (noches, desvelos, salir)',
  },
  {
    id: 'ciudad',
    vehiculo: 'tren',
    desc: 'ciudad de día con edificios (trabajo, prisas, vida diaria)',
  },
  {
    id: 'fiesta',
    vehiculo: 'tren',
    desc: 'globos y banderines (cumpleaños, celebraciones, buenas noticias)',
  },
  {
    id: 'cena',
    vehiculo: 'tren',
    desc: 'una mesa con velas y dos copas (cenas, comidas juntos, brindis)',
  },
  { id: 'cafe', vehiculo: 'tren', desc: 'café humeante al amanecer (mañanas, desayunos, calma)' },
  {
    id: 'musica',
    vehiculo: 'tren',
    desc: 'notas musicales flotando (canciones, conciertos, bailar)',
  },
  {
    id: 'deporte',
    vehiculo: 'tren',
    desc: 'un balón botando en un campo (deporte, partidos, moverse)',
  },
  {
    id: 'otono',
    vehiculo: 'tren',
    desc: 'árboles soltando hojas (otoño, cambios, despedidas suaves)',
  },
  {
    id: 'primavera',
    vehiculo: 'tren',
    desc: 'flores que se abren y una mariposa (primavera, comienzos, alegría)',
  },
  {
    id: 'estrellas',
    vehiculo: 'tren',
    desc: 'cielo estrellado con luna y estrella fugaz (deseos, noches tranquilas, echar de menos)',
  },
  {
    id: 'tormenta',
    vehiculo: 'tren',
    desc: 'tormenta con rayos (semana difícil, líos, días intensos)',
  },
  {
    id: 'mar',
    vehiculo: 'barco',
    desc: 'el mar desde el ojo de buey de un barco (lejanía entre países, travesías)',
  },
  {
    id: 'anden',
    vehiculo: 'tren',
    desc: 'un andén donde dos personas se abrazan (reencuentros, visitas, os visteis)',
  },
  {
    id: 'casa',
    vehiculo: 'casa',
    desc: 'la ventana de casa con una planta y un gato dormido (hogar, quedarse en casa, cuidarse)',
  },
] as const;
export type Escenario = (typeof ESCENARIOS)[number]['id'];
export const esEscenario = (s: string | undefined | null): s is Escenario =>
  !!s && ESCENARIOS.some((e) => e.id === s);

export type Persona = {
  id: string;
  name: string;
  city?: string;
  lat?: number;
  lng?: number;
  tz?: string;
};

/** Qué es cada pieza: cada cosa que se añade con el «+» tiene su animación. */
export type TipoPieza =
  | 'foto'
  | 'fotos'
  | 'video'
  | 'voz'
  | 'texto'
  | 'recuerdo'
  | 'reto'
  | 'karaoke'
  | 'plan'
  | 'encuesta'
  | 'quiz'
  | 'pregunta'
  | 'cancion'
  | 'retoNuevo';

/** Lo que necesita la animación de cada tipo. */
export type ExtraPieza = {
  titulo?: string;
  /** encuesta y quiz: las opciones y sus votos */
  opciones?: { texto: string; votos: number; correcta?: boolean }[];
  /** quiz abierto: no se dice la respuesta */
  abierta?: boolean;
  /** pregunta abierta: lo que contestó cada uno */
  respuestas?: { who: string; text: string }[];
  /** varias fotos: las demás (la primera va en «photo») */
  fotos?: string[];
  /** canción */
  artista?: string;
  portada?: string;
  /** reto: quién se animó */
  quienes?: string[];
  /** recuerdo: «hace 3 años» */
  edad?: string;
};

export type Pieza = {
  id: string;
  tipo?: TipoPieza;
  extra?: ExtraPieza;
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
  /** El color del grupo: todo el acento de la película sale de él. */
  accent?: string;
  /** Lo que cuenta el reloj de paletas (días o años, mismo largo) y la cabecera (el mes). */
  clock: string[];
  header: string;
  /** La pregunta del final. */
  closing: string;
  /** El pulso de la música (para mover las cosas a su ritmo). */
  ritmo?: { periodo: number; desfase: number };
  /** La banda sonora: su carátula y su nombre salen en el final. */
  song?: { title: string; artist?: string; artwork?: string };
  /** Rótulos: bajo el reloj, la ventanilla y la libreta. */
  tags: { reloj: string; ventanilla: string; libreta: string };
  scenario: Escenario;
  people: Persona[];
  /** La página de la libreta: puntos que la pluma une (casas o lugares). */
  mapa: {
    points: { title: string; subtitle?: string; lat?: number; lng?: number }[];
    chronological?: boolean;
  };
  pieces: Pieza[];
  /** greeting: el saludo sobre el reloj; route: la frase de la ruta sobre la libreta. */
  voices: {
    greeting?: Voz;
    intro?: Voz;
    route?: Voz;
    pieces: Record<string, Voz>;
    stats?: Voz;
    end?: Voz;
  };
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
  // La voz manda y no se para: cada frase empieza justo donde acaba la
  // anterior, y las escenas se estiran para caber en lo que dura cada una.
  const V = d.voices;
  // 1. El saludo, mientras corren las fechas en el reloj.
  // (termina justo cuando sube la persiana, para que la apertura le siga sin pausa)
  const v0 = Math.max(4.3, 0.4 + durVoz(V.greeting));
  say(v0 - durVoz(V.greeting), V.greeting);
  const reloj: Tramo = [0, v0 - 1.5];
  const persiana: Tramo = [v0 - 1.8, v0 + 0.4];
  // 2. La apertura, mirando por la ventanilla.
  const introStart = V.greeting ? v0 : v0 + 0.8;
  const introEnd = introStart + durVoz(V.intro);
  say(introStart, V.intro);
  const ventanilla: Tramo = [
    v0,
    Math.max(v0 + 4.5, V.route ? introEnd : introStart + durVoz(V.intro) * 0.6),
  ];
  // 3. La ruta en la libreta (con su frase, si la hay).
  const routeStart = Math.max(introEnd, ventanilla[1] - 0.6);
  say(routeStart, V.route);
  const libreta: Tramo = [
    ventanilla[1] - 0.6,
    Math.max(ventanilla[1] - 0.6 + 4.6, routeStart + durVoz(V.route)),
  ];
  const c0 = libreta[1] - 0.4;
  // 4. El calendario y la cámara; la primera frase empieza ya durante el flash.
  let tv = V.route ? routeStart + durVoz(V.route) : introEnd; // donde acaba la última frase
  // (en la semana y el mes, un poco más: el calendario vuela hasta la mesa)
  let t = c0 + 2.6;
  const piezas = d.pieces.map((p, i) => {
    const v = d.voices.pieces[p.id];
    const a = t;
    const vs = i === 0 ? Math.min(a, Math.max(tv, c0)) : Math.max(a, tv);
    say(vs, v);
    tv = vs + durVoz(v);
    const b = Math.max(a + 3.0, tv);
    t = b;
    return { id: p.id, a, b };
  });
  const calendario: Tramo = [c0, t];
  // 5. Las cifras y la despedida.
  const recuerdos: Tramo = [t, t + Math.max(5.5, durVoz(V.stats))];
  say(t, V.stats);
  // (el final: estallido, anillo, el nombre escribiéndose y dos segundos quieto)
  const final: Tramo = [recuerdos[1], recuerdos[1] + Math.max(6.6, durVoz(V.end) + 0.8)];
  say(final[0], V.end);
  return {
    reloj,
    persiana,
    ventanilla,
    libreta,
    calendario,
    piezas,
    recuerdos,
    final,
    total: final[1] + 0.3,
    voces,
  };
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
      return month >= 8 && month <= 10
        ? 'otono'
        : month >= 2 && month <= 4
          ? 'primavera'
          : 'montana';
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
