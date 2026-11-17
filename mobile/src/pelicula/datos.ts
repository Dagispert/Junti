// De los datos de la app (el resumen, la crónica de la narradora, las
// personas) al guion de la película.

import type { Group, Moment, Narration, Proposal, Question, Song, User } from '@/data/types';
import { type buildStory, gapId, parseGap } from '@/lib/story';
import { localHour } from '@/lib/geo';
import type { buildRecap } from '@/lib/recap';
import { clockIn } from '@/lib/time';

import {
  type DatosPelicula,
  elegirEscenario,
  esEscenario,
  type ExtraPieza,
  type JuegoPieza,
  type Pieza,
  type TipoPieza,
  type Voz,
} from './guion';
import { tag } from './pelicula';

type Recap = ReturnType<typeof buildRecap>;
const DAY = 86_400_000;
const MESES = [
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
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Lo demás que se añade con el «+» (para las piezas que no son momentos). */
export type Extras = {
  questions: Question[];
  proposals: Proposal[];
  songs: Song[];
  moments: Moment[];
  /** lo de cada minijuego (por id de la propuesta), ya cargado */
  juegos?: Record<string, JuegoPieza>;
};

const hace = (t: number) => {
  const años = Math.floor((Date.now() - t) / (365.25 * DAY));
  if (años >= 1) return años === 1 ? 'hace un año' : `hace ${años} años`;
  const meses = Math.floor((Date.now() - t) / (30.4 * DAY));
  return meses >= 1 ? (meses === 1 ? 'hace un mes' : `hace ${meses} meses`) : 'hace poco';
};

/** Qué es un momento (y lo que necesita su animación). */
export function tipoDeMomento(
  m: Moment,
  proposals: Proposal[],
  foto: (uri?: string) => string | undefined,
  first: (id: string) => string,
  moments: Moment[] = [],
): { tipo: TipoPieza; extra?: ExtraPieza } {
  const p = m.proposalId ? proposals.find((x) => x.id === m.proposalId) : undefined;
  const otras = (m.gallery ?? [])
    .map((g) => foto(g.kind === 'photo' ? g.uri : g.poster))
    .filter((u): u is string => !!u)
    .slice(1, 3);
  if (p?.game?.type === 'karaoke')
    return { tipo: 'karaoke', extra: { titulo: p.game.song, artista: p.game.artist } };
  if (p?.kind === 'challenge') {
    const quienes = [
      ...new Set(moments.filter((x) => x.proposalId === p.id).map((x) => first(x.authorId))),
    ];
    return { tipo: 'reto', extra: { titulo: p.title, quienes } };
  }
  if (p?.kind === 'plan') return { tipo: 'plan', extra: { titulo: p.title } };
  if (m.memory && m.imageUri) return { tipo: 'recuerdo', extra: { edad: hace(m.createdAt) } };
  if (otras.length) return { tipo: 'fotos', extra: { fotos: otras } };
  if (m.videoUri) return { tipo: 'video' };
  if (m.imageUri) return { tipo: 'foto' };
  if (m.voice) return { tipo: 'voz' };
  return { tipo: 'texto' };
}

/** Una encuesta, quiz, pregunta, reto o canción como pieza de la película. */
export function piezaExtra(
  ref: string,
  ex: Extras,
  user: (id: string) => User,
  foto: (uri?: string) => string | undefined,
): Pieza | null {
  const first = (id: string) => user(id).name.split(' ')[0];
  const base = (at: number, by: string | undefined, tz?: string) => {
    const d = new Date(at);
    return {
      id: ref,
      at,
      tz: tz ?? user(by ?? '').tz ?? 'UTC',
      author: by ? first(by) : 'Junti',
      badge: String(d.getDate()).padStart(2, '0'),
      when: `${DIAS[d.getDay()]} ${clockIn(tz ?? user(by ?? '').tz ?? 'UTC', at)}`,
      place: by ? user(by).city : undefined,
      comments: [],
      reactions: [],
    };
  };
  if (ref.startsWith('q:')) {
    const q = ex.questions.find((x) => x.id === ref.slice(2));
    if (!q) return null;
    const b = base(q.createdAt, q.createdBy);
    if (q.kind === 'open')
      return {
        ...b,
        tipo: 'pregunta',
        extra: {
          titulo: q.title,
          respuestas: q.answers
            .filter((a) => a.text)
            .slice(0, 3)
            .map((a) => ({ who: first(a.userId), text: a.text! })),
        },
      };
    const opciones = (q.options ?? []).map((texto, i) => ({
      texto,
      votos: q.answers.filter((a) => a.choice === i).length,
      correcta: q.correct === i,
    }));
    return {
      ...b,
      tipo: q.kind === 'quiz' ? 'quiz' : 'encuesta',
      extra: {
        titulo: q.title,
        opciones,
        abierta: q.kind === 'quiz' && (q.correct == null || !q.closesAt || q.closesAt > Date.now()),
      },
    };
  }
  if (ref.startsWith('reto:')) {
    const p = ex.proposals.find((x) => x.id === ref.slice(5));
    if (!p) return null;
    const quienes = [
      ...new Set(ex.moments.filter((m) => m.proposalId === p.id).map((m) => first(m.authorId))),
    ];
    // un minijuego: con su propia animación (las imágenes, ya en la página)
    const j = ex.juegos?.[p.id];
    if (j) {
      const juego: JuegoPieza =
        j.tipo === 'karaoke'
          ? { ...j, portada: foto(j.portada) }
          : j.tipo === 'zoom'
            ? { ...j, foto: foto(j.foto) }
            : j.tipo === 'dibujo'
              ? { ...j, pasos: j.pasos.map((x) => ({ ...x, img: foto(x.img) })) }
              : j;
      return {
        ...base(p.startsAt, p.createdBy),
        tipo: j.tipo === 'karaoke' ? 'karaokeJuego' : j.tipo,
        extra: { titulo: p.title, juego },
      };
    }
    return {
      ...base(p.startsAt, p.createdBy),
      tipo: 'retoNuevo',
      extra: { titulo: p.game?.type === 'karaoke' ? `Karaoke: ${p.game.song}` : p.title, quienes },
    };
  }
  if (ref.startsWith('song:')) {
    const x = ex.songs.find((y) => y.id === ref.slice(5));
    if (!x) return null;
    return {
      ...base(x.createdAt, x.addedBy),
      tipo: 'cancion',
      text: x.note,
      extra: { titulo: x.title, artista: x.artist, portada: foto(x.artwork) },
    };
  }
  return null;
}

/** Las refs de los extras de un periodo (si la narradora no los eligió). */
export function extrasDelPeriodo(ex: Extras, groupId: string, from: number, to: number) {
  return [
    ...ex.questions
      .filter((q) => q.groupId === groupId && q.createdAt >= from && q.createdAt < to)
      .map((q) => ({ ref: `q:${q.id}`, at: q.createdAt })),
    ...ex.proposals
      .filter(
        (p) =>
          p.groupId === groupId && p.kind === 'challenge' && p.startsAt >= from && p.startsAt < to,
      )
      .map((p) => ({ ref: `reto:${p.id}`, at: p.startsAt })),
    ...ex.songs
      .filter((x) => x.groupId === groupId && x.createdAt >= from && x.createdAt < to)
      .map((x) => ({ ref: `song:${x.id}`, at: x.createdAt })),
  ].sort((a, b) => a.at - b.at);
}

function km(a: { lat?: number; lng?: number }, b: { lat?: number; lng?: number }) {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return 0;
  const R = 6371,
    r = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function datosPelicula(
  recap: Recap,
  opts: {
    group: string;
    /** El color del grupo. */
    accent?: string;
    user: (id: string) => User;
    narration?: Narration | null;
    /** El tiempo que hacía en cada momento (código WMO). */
    weather?: Record<string, { code: number; temp: number }>;
    /** Fotos ya copiadas en la página (para poder exportar el vídeo). */
    photos?: Record<string, string>;
    song?: { title: string; artist?: string; artwork?: string };
    ritmo?: { periodo: number; desfase: number } | null;
    /** encuestas, quiz, preguntas, retos y canciones (cada uno con su animación) */
    extras?: Extras;
    groupId?: string;
  },
): DatosPelicula {
  const { user, narration } = opts;
  const first = (id: string) => user(id).name.split(' ')[0];
  const start = new Date(recap.from);

  // Las piezas: los momentos que cuenta la narradora (en su orden) o los elegidos.
  const scenes = narration?.scenes ?? [];
  const byId = new Map(recap.moments.map((m) => [m.id, m]));
  const foto = (uri?: string) => (uri ? (opts.photos?.[uri] ?? uri) : undefined);
  const ex = opts.extras;
  const momentoAPieza = (m: Moment): Pieza => {
    const d = new Date(m.createdAt);
    return {
      id: m.id,
      at: m.createdAt,
      tz: m.authorTz,
      author: first(m.authorId),
      badge: String(d.getDate()).padStart(2, '0'),
      when: `${DIAS[d.getDay()]} ${clockIn(m.authorTz, m.createdAt)}`,
      place: m.place?.name.split(',')[0] ?? user(m.authorId).city,
      text: m.text,
      photo: foto(m.imageUri),
      wave: m.voice?.waveform,
      comments: m.comments.map((c) => ({ who: first(c.userId), text: c.text })),
      reactions: m.reactions.map((r) => r.emoji),
      ...tipoDeMomento(m, ex?.proposals ?? [], foto, first, ex?.moments ?? recap.moments),
    };
  };
  // lo que cuenta la narradora, en su orden: momentos y extras (E1, E2…)
  const refs: string[] = [];
  for (const s of scenes) {
    const id = s.momentId;
    if (!id || refs.includes(id)) continue;
    if (byId.has(id) || /^(q|reto|song):/.test(id)) refs.push(id);
  }
  const max = recap.kind === 'week' ? 15 : 18;
  let pieces: Pieza[];
  if (refs.length) {
    pieces = refs
      .map((id) =>
        byId.has(id) ? momentoAPieza(byId.get(id)!) : ex ? piezaExtra(id, ex, user, foto) : null,
      )
      .filter((p): p is Pieza => !!p)
      .slice(0, max);
    // los minijuegos del periodo salen siempre, aunque la narradora no los cuente
    if (ex && opts.groupId) {
      const faltan = extrasDelPeriodo(ex, opts.groupId, recap.from, recap.to)
        .filter((x) => x.ref.startsWith('reto:') && !refs.includes(x.ref))
        .map((x) => piezaExtra(x.ref, ex, user, foto))
        .filter((p): p is Pieza => !!p?.extra?.juego);
      if (faltan.length) pieces = [...pieces, ...faltan].sort((a, b) => a.at - b.at);
    }
  } else {
    // sin narradora: los momentos elegidos y lo demás del periodo, en orden
    const extras =
      ex && opts.groupId
        ? extrasDelPeriodo(ex, opts.groupId, recap.from, recap.to)
            .map((x) => piezaExtra(x.ref, ex, user, foto))
            .filter((p): p is Pieza => !!p)
            // los minijuegos, siempre (antes que el resto)
            .sort((a, b) => Number(!!b.extra?.juego) - Number(!!a.extra?.juego))
            .slice(0, 4)
        : [];
    pieces = [...recap.picks.map(momentoAPieza), ...extras]
      .sort((a, b) => a.at - b.at)
      .slice(0, max);
  }

  // Las voces: cada escena de la crónica va con su tramo de película. Las
  // escenas generales se suman a la anterior (o a la apertura).
  const voices: DatosPelicula['voices'] = { pieces: {} };
  const times = narration?.audioUrl && narration.sceneTimes?.length ? narration.sceneTimes : null;
  const endOf = (i: number) => times?.[i + 1] ?? narration?.audioDuration ?? undefined;
  let target: 'intro' | 'stats' | 'end' | string = 'intro';
  const SLOTS = ['greeting', 'intro', 'route', 'stats', 'end'] as const;
  const put = (key: string, v: Voz) => {
    const slot = SLOTS.find((x) => x === key);
    const cur = slot ? voices[slot] : voices.pieces[key];
    const next = cur ? { text: `${cur.text} ${v.text}`, from: cur.from, to: v.to } : v;
    if (slot) voices[slot] = next;
    else voices.pieces[key] = next;
  };
  let scenario: string | undefined;
  scenes.forEach((s, i) => {
    const v: Voz = { text: s.text, ...(times ? { from: times[i], to: endOf(i) } : {}) };
    if (s.momentId?.startsWith('ventanilla:')) scenario = s.momentId.slice('ventanilla:'.length);
    if (s.momentId === 'greeting') target = 'greeting';
    else if (s.momentId === 'route') target = 'route';
    else if (s.momentId?.startsWith('ventanilla:') || (!s.momentId && target === 'greeting'))
      target = 'intro';
    else if (s.momentId === 'stats') target = 'stats';
    else if (s.momentId === 'end') target = 'end';
    else if (s.momentId && pieces.some((p) => p.id === s.momentId)) target = s.momentId;
    put(target, v);
  });

  // La vista de la ventanilla: la que eligió la narradora o la del contexto.
  const texts = recap.moments.flatMap((m) => [m.text ?? '', ...m.comments.map((c) => c.text)]);
  const hours = recap.moments.map((m) => localHour(m.authorTz, m.createdAt));
  const codes = Object.values(opts.weather ?? {}).map((w) => w.code);
  const cities = new Set(recap.moments.map((m) => m.place?.name ?? user(m.authorId).city));
  const finalScenario = esEscenario(scenario)
    ? scenario
    : elegirEscenario(texts, hours, start.getMonth(), {
        travel: cities.size > 1 && recap.moments.some((m) => m.place),
        rain: codes.filter((c) => c >= 51 && c < 70).length > codes.length / 3,
        snow: codes.some((c) => c >= 71 && c <= 77),
      });

  // Personas (quien compartió algo) y la mayor distancia entre ellas.
  const people = recap.authors.map((id) => {
    const u = user(id);
    return { id, name: first(id), city: u.city, lat: u.lat, lng: u.lng, tz: u.tz };
  });
  let maxKm = 0;
  for (const a of people) for (const b of people) maxKm = Math.max(maxKm, km(a, b));

  // El reloj: los días del periodo; el gráfico: por día o por semana.
  const days: number[] = [];
  for (let t = recap.from; t < recap.to; t += DAY) days.push(new Date(t).getDate());
  let labels: string[], perDay: number[];
  if (recap.kind === 'week') {
    labels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    perDay = labels.map(() => 0);
    for (const m of recap.moments) perDay[(new Date(m.createdAt).getDay() + 6) % 7] += 1;
  } else {
    const n = days.length,
      weeks = Math.ceil(n / 7);
    labels = Array.from({ length: weeks }, (_, i) => `${i * 7 + 1}`);
    perDay = labels.map(() => 0);
    for (const m of recap.moments)
      perDay[Math.min(weeks - 1, Math.floor((new Date(m.createdAt).getDate() - 1) / 7))] += 1;
  }

  const mes = MESES[start.getMonth()];
  const last = new Date(recap.to - 1);
  const title = narration?.title || (recap.kind === 'week' ? 'Vuestra semana' : 'Vuestro mes');
  return {
    kind: recap.kind,
    from: recap.from,
    to: recap.to,
    range: recap.range,
    title,
    group: opts.group,
    accent: opts.accent,
    clock: days.map((n) => String(n).padStart(2, '0')),
    header: mes.slice(0, 3),
    closing: recap.ongoing
      ? recap.kind === 'week'
        ? 'y la semana sigue…'
        : 'y el mes sigue…'
      : recap.kind === 'week'
        ? '¿qué pasará la semana que viene?'
        : '¿qué pasará el mes que viene?',
    ritmo: opts.ritmo ?? undefined,
    song: opts.song
      ? {
          ...opts.song,
          artwork: opts.song.artwork
            ? (opts.photos?.[opts.song.artwork] ?? opts.song.artwork)
            : undefined,
        }
      : undefined,
    tags: {
      reloj:
        recap.kind === 'week'
          ? tag(
              'del',
              String(start.getDate()),
              'al',
              String(last.getDate()),
              'de',
              MESES[last.getMonth()],
            )
          : tag(mes, String(start.getFullYear())),
      ventanilla: tag(title),
      libreta: maxKm > 30 ? tag(`${Math.round(maxKm)}kmentrevosotros`) : '#todoscerca',
    },
    scenario: finalScenario,
    people,
    mapa: {
      points: people.map((p) => ({ title: p.name, subtitle: p.city, lat: p.lat, lng: p.lng })),
    },
    pieces,
    voices,
    stats: {
      numbers: [
        { n: recap.stats.moments, label: recap.stats.moments === 1 ? 'momento' : 'momentos' },
        { n: recap.stats.photos, label: recap.stats.photos === 1 ? 'foto' : 'fotos' },
        { n: recap.stats.reactions, label: 'reacciones' },
        { n: recap.stats.comments, label: 'comentarios' },
      ],
      chartTitle: recap.kind === 'week' ? 'cada día' : 'cada semana',
      cities: recap.stats.cities,
      perDay,
      labels,
      maxKm,
    },
    lovedId: recap.loved?.id,
    ongoing: recap.ongoing,
  };
}

/** Copia las fotos en la página (en pequeño), para que el vídeo exportado las lleve dentro. */
export async function fotosEnLinea(uris: string[], size = 560): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    uris.map(
      (uri) =>
        new Promise<void>((resolve) => {
          const img = new window.Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            try {
              const s = Math.min(1, size / Math.max(img.naturalWidth, img.naturalHeight));
              const c = document.createElement('canvas');
              c.width = Math.round(img.naturalWidth * s);
              c.height = Math.round(img.naturalHeight * s);
              c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
              out[uri] = c.toDataURL('image/jpeg', 0.78);
            } catch {
              // sin permiso para leerla: se queda la dirección original
            }
            resolve();
          };
          img.onerror = () => resolve();
          img.src = uri;
        }),
    ),
  );
  return out;
}

/**
 * «Nuestra historia» como película: el reloj cuenta los años, la ventanilla
 * se oye con el comienzo (dónde empezó todo), la libreta une los lugares en
 * orden, y el calendario va año a año con cada recuerdo (y los huecos).
 */
export function datosHistoria(
  story: ReturnType<typeof buildStory>,
  opts: {
    group: Group;
    user: (id: string) => User;
    scenes: { momentId: string | null; text: string; chapter?: string }[];
    narration?: Narration | null;
    title: string;
    photos?: Record<string, string>;
    song?: { title: string; artist?: string; artwork?: string };
    ritmo?: { periodo: number; desfase: number } | null;
  },
): DatosPelicula {
  const { user, scenes, narration } = opts;
  const first = (id: string) => user(id).name.split(' ')[0];
  const times =
    narration?.audioUrl && narration.sceneTimes?.length && narration.scenes === (scenes as unknown)
      ? narration.sceneTimes
      : null;
  const endOf = (i: number) => times?.[i + 1] ?? narration?.audioDuration ?? undefined;
  const origin = story.items.find((i) => i.type === 'origin');
  const now = new Date().getFullYear();
  const years = [
    ...(origin?.type === 'origin' && origin.year ? [origin.year] : []),
    ...story.memories.map((m) => new Date(m.createdAt).getFullYear()),
  ];
  const startYear = years.length ? Math.min(...years) : now;

  // Las piezas y sus voces, en el orden de la crónica.
  const pieces: Pieza[] = [];
  const voices: DatosPelicula['voices'] = { pieces: {} };
  let target = 'intro';
  const put = (key: string, v: Voz) => {
    const slot = (['greeting', 'intro', 'end'] as const).find((x) => x === key);
    const cur = slot ? voices[slot] : voices.pieces[key];
    const next = cur ? { text: `${cur.text} ${v.text}`, from: cur.from, to: v.to } : v;
    if (slot) voices[slot] = next;
    else voices.pieces[key] = next;
  };
  const monthYear = (t: number) =>
    new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(t);
  scenes.forEach((s, i) => {
    const v: Voz = { text: s.text, ...(times ? { from: times[i], to: endOf(i) } : {}) };
    const memory = story.memories.find((m) => m.id === s.momentId);
    const gap = parseGap(s.momentId);
    if (memory) {
      const y = new Date(memory.createdAt).getFullYear();
      pieces.push({
        id: memory.id,
        at: memory.createdAt,
        tz: memory.authorTz,
        author: first(memory.authorId),
        badge: String(y),
        when: monthYear(memory.createdAt),
        place: memory.place?.name.split(',')[0],
        text: memory.text,
        photo: memory.imageUri ? (opts.photos?.[memory.imageUri] ?? memory.imageUri) : undefined,
        wave: memory.voice?.waveform,
        comments: [
          ...(memory.additions ?? [])
            .filter((a) => a.text)
            .map((a) => ({ who: first(a.authorId), text: a.text! })),
          ...memory.comments.map((c) => ({ who: first(c.userId), text: c.text })),
        ],
        reactions: memory.reactions.map((r) => r.emoji),
        // (en la historia, cada recuerdo según lo que lleva: foto que se revela,
        // varias fotos, vídeo, voz o texto)
        ...tipoDeMomento(
          memory,
          [],
          (uri) => (uri ? (opts.photos?.[uri] ?? uri) : undefined),
          first,
        ),
      });
      target = memory.id;
    } else if (gap) {
      const id = gapId(gap);
      pieces.push({
        id,
        at: 0,
        tz: 'UTC',
        author: '',
        badge: String(gap.from),
        when: `de ${gap.from} a ${gap.to}`,
        text: `¿Qué pasó entre ${gap.from} y ${gap.to}? Nadie lo ha contado todavía.`,
        comments: [],
        reactions: [],
      });
      target = id;
    } else if (s.momentId === 'end') target = 'end';
    else if (s.momentId === 'greeting') target = 'greeting';
    // el comienzo («origin») se oye mientras se mira por la ventanilla
    else if (s.momentId === 'origin' || target === 'greeting') target = 'intro';
    put(target, v);
  });

  // La libreta: los lugares, en orden, desde donde empezó todo.
  const points: DatosPelicula['mapa']['points'] = [];
  const add = (title: string, subtitle: string, lat?: number, lng?: number) => {
    if (lat == null || lng == null) return;
    const last = points[points.length - 1];
    if (last && last.title === title) return;
    points.push({ title, subtitle, lat, lng });
  };
  if (origin?.type === 'origin')
    add(
      origin.origin.place.split(',')[0],
      origin.year ? String(origin.year) : 'el comienzo',
      origin.origin.lat,
      origin.origin.lng,
    );
  for (const m of story.memories)
    if (m.place)
      add(
        m.place.name.split(',')[0],
        String(new Date(m.createdAt).getFullYear()),
        m.place.lat,
        m.place.lng,
      );

  // El reloj: los años, como mucho doce paradas.
  const span = Math.max(0, now - startYear);
  const n = Math.min(12, span + 1);
  const clock = Array.from({ length: n }, (_, i) =>
    String(Math.round(startYear + (span * i) / Math.max(1, n - 1))),
  );

  // Cifras y gráfico: recuerdos por año (o por épocas, si hay muchos años).
  const memYears = story.memories.map((m) => new Date(m.createdAt).getFullYear());
  const y0 = memYears.length ? Math.min(...memYears) : startYear,
    y1 = memYears.length ? Math.max(...memYears) : now;
  const bins = Math.min(7, y1 - y0 + 1);
  const size = Math.ceil((y1 - y0 + 1) / Math.max(1, bins));
  const labels = Array.from({ length: bins }, (_, i) => String(y0 + i * size).slice(2));
  const perDay = labels.map(() => 0);
  for (const y of memYears) perDay[Math.min(bins - 1, Math.floor((y - y0) / size))] += 1;
  let maxKm = 0;
  for (const a of points) for (const b of points) maxKm = Math.max(maxKm, km(a, b));
  const people = opts.group.memberIds.map((id) => {
    const u = user(id);
    return { id, name: first(id), city: u.city, lat: u.lat, lng: u.lng, tz: u.tz };
  });
  const loved = [...story.memories].sort(
    (a, b) => b.reactions.length + b.comments.length - (a.reactions.length + a.comments.length),
  )[0];
  const texts = story.memories.flatMap((m) => [m.text ?? '']);
  return {
    kind: 'story',
    from: 0,
    to: 0,
    range: `desde ${startYear}`,
    title: opts.title,
    group: opts.group.name,
    accent: opts.group.color,
    clock,
    header: 'AÑO',
    closing: 'y la historia sigue…',
    ritmo: opts.ritmo ?? undefined,
    song: opts.song
      ? {
          ...opts.song,
          artwork: opts.song.artwork
            ? (opts.photos?.[opts.song.artwork] ?? opts.song.artwork)
            : undefined,
        }
      : undefined,
    tags: { reloj: `#desde${startYear}`, ventanilla: tag(opts.title), libreta: '#dondeempezótodo' },
    scenario: elegirEscenario(texts, [], 6, {
      travel: points.length > 2,
      rain: false,
      snow: false,
    }),
    people,
    mapa: { points, chronological: true },
    pieces,
    voices,
    stats: {
      numbers: [
        { n: span, label: span === 1 ? 'año' : 'años' },
        { n: story.memories.length, label: story.memories.length === 1 ? 'recuerdo' : 'recuerdos' },
        { n: new Set(points.map((p) => p.title)).size, label: 'lugares' },
        { n: people.length, label: 'personas' },
      ],
      cities: [...new Set(points.map((p) => p.title))].slice(0, 4),
      perDay,
      labels,
      chartTitle: 'recuerdos por año',
      maxKm,
    },
    lovedId: loved?.id,
    ongoing: true,
  };
}
