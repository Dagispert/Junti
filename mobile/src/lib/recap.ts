import type { GroupEvent, Moment, Proposal, Song, User } from '@/data/types';

import { happensOn, KINDS } from './calendar';

import { distanceKm } from './geo';

// Resúmenes de una semana o un mes, construidos a partir de lo compartido.
// Sin inteligencia artificial: selección equilibrada y frases con plantillas.
// La narración con IA (Fase 3) partirá de esto mismo.

export type Recap = {
  kind: 'week' | 'month';
  from: number;
  to: number;
  title: string;
  /** Rango legible: «3–9 de noviembre». */
  range: string;
  /** Si el periodo aún no ha terminado. */
  ongoing: boolean;
  moments: Moment[];
  /** Los elegidos para la historia, como mucho uno o dos por persona. */
  picks: Moment[];
  /** El que más cariño recibió. */
  loved?: Moment;
  story: string[];
  stats: {
    moments: number;
    photos: number;
    reactions: number;
    comments: number;
    people: number;
    cities: string[];
  };
  authors: string[];
  songs: Song[];
};

const DAY = 86_400_000;

/** Lunes 00:00 (hora local) de la semana que contiene «at». */
export function weekStart(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  const shift = (d.getDay() + 6) % 7;
  return d.getTime() - shift * DAY;
}

export function monthStart(at: number): number {
  const d = new Date(at);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

function nextMonth(at: number): number {
  const d = new Date(at);
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
}

function rangeLabel(from: number, to: number, kind: 'week' | 'month'): string {
  const f = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' });
  if (kind === 'month') {
    const m = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(from);
    return m[0].toUpperCase() + m.slice(1);
  }
  const a = new Date(from);
  const b = new Date(to - 1);
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${f.format(b)}`;
  return `${f.format(a)} – ${f.format(b)}`;
}

const score = (m: Moment) =>
  m.reactions.length * 2 + m.comments.length * 3 + (m.imageUri ? 4 : 0) + (m.text ? 1 : 0);

const join = (list: string[]) =>
  list.length <= 1 ? (list[0] ?? '') : `${list.slice(0, -1).join(', ')} y ${list[list.length - 1]}`;

const quote = (t: string) => `«${t.trim().replace(/[.…]+$/, '')}»`;

function pickVerb(m: Moment, i: number, proposals: Proposal[]) {
  const proposal = proposals.find((p) => p.id === m.proposalId);
  if (proposal && !m.imageUri) return `respondió a ${quote(proposal.title)}`;
  if (proposal?.kind === 'challenge') return `se sumó al reto ${quote(proposal.title)}`;
  if (!m.imageUri)
    return (
      ['nos contó', 'escribió', 'nos dejó'][i % 3] +
      (m.text ? ` ${quote(m.text)}` : ' unas palabras')
    );
  return (
    ['nos enseñó', 'compartió', 'nos trajo'][i % 3] + (m.text ? ` ${quote(m.text)}` : ' una foto')
  );
}

export function buildRecap(
  kind: 'week' | 'month',
  from: number,
  all: Moment[],
  user: (id: string) => User,
  proposals: Proposal[],
  songs: Song[],
  events: GroupEvent[] = [],
): Recap {
  const to = kind === 'week' ? from + 7 * DAY : nextMonth(from);
  const moments = all
    .filter((m) => m.createdAt >= from && m.createdAt < to)
    .sort((a, b) => a.createdAt - b.createdAt);

  // Selección equilibrada: por turnos entre personas, lo mejor de cada una primero.
  const byAuthor = new Map<string, Moment[]>();
  for (const m of moments) byAuthor.set(m.authorId, [...(byAuthor.get(m.authorId) ?? []), m]);
  for (const list of byAuthor.values()) list.sort((a, b) => score(b) - score(a));
  const max = kind === 'week' ? 8 : 12;
  const picks: Moment[] = [];
  for (let round = 0; picks.length < max && round < 6; round++) {
    for (const list of byAuthor.values())
      if (list[round] && picks.length < max) picks.push(list[round]);
  }
  picks.sort((a, b) => a.createdAt - b.createdAt);

  const loved = [...moments].sort(
    (a, b) => b.reactions.length + b.comments.length - (a.reactions.length + a.comments.length),
  )[0];
  const authors = [...byAuthor.keys()];
  const first = (id: string) => user(id).name.split(' ')[0];
  const cities = [...new Set(authors.map((id) => user(id).city).filter(Boolean))];
  const periodSongs = songs.filter((s) => s.createdAt >= from && s.createdAt < to);

  const story: string[] = [];
  if (moments.length) {
    const lines = authors.map(
      (id, i) => `${first(id)} ${pickVerb(byAuthor.get(id)![0], i, proposals)}`,
    );
    story.push(`${kind === 'week' ? 'Esta semana' : 'Este mes'} ${join(lines)}.`);
    if (loved && loved.reactions.length + loved.comments.length > 0) {
      const n = loved.reactions.length + loved.comments.length;
      story.push(
        `Lo que más os llegó fue ${loved.text ? quote(loved.text) : 'la foto'} de ${first(loved.authorId)}, con ${n} ${n === 1 ? 'muestra' : 'muestras'} de cariño.`,
      );
    }
    const coords = authors.map((id) => user(id)).filter((u) => u.lat != null && u.lng != null);
    let far = 0;
    for (const a of coords)
      for (const b of coords) far = Math.max(far, distanceKm(a as never, b as never));
    if (cities.length > 1) {
      story.push(
        far > 1500
          ? `Desde ${join(cities)}, con océanos de por medio, seguisteis asomándoos a la vida de los demás.`
          : `Desde ${join(cities)}, cada uno en su sitio y todos un poco más cerca.`,
      );
    }
    const visited = [
      ...new Set(moments.filter((m) => m.place).map((m) => m.place!.name.split(',')[0])),
    ];
    if (visited.length) {
      story.push(`Hubo momentos desde ${join(visited.slice(0, 5))}.`);
    }
    // Lo que había apuntado en el calendario durante el periodo.
    const marked = events.filter((e) => {
      for (let t = from; t < to; t += DAY) if (happensOn(e, new Date(t))) return true;
      return false;
    });
    if (marked.length) {
      story.push(
        `En el calendario: ${join(marked.map((e) => `${KINDS[e.kind].emoji} ${e.title}`))}.`,
      );
    }
    if (periodSongs.length) {
      story.push(`Y la banda sonora creció con ${join(periodSongs.map((s) => quote(s.title)))}.`);
    }
  }

  const now = Date.now();
  return {
    kind,
    from,
    to,
    title: kind === 'week' ? 'Vuestra semana' : 'Vuestro mes',
    range: rangeLabel(from, to, kind),
    ongoing: now < to,
    moments,
    picks,
    loved,
    story,
    stats: {
      moments: moments.length,
      photos: moments.filter((m) => m.imageUri).length,
      reactions: moments.reduce((s, m) => s + m.reactions.length, 0),
      comments: moments.reduce((s, m) => s + m.comments.length, 0),
      people: authors.length,
      cities,
    },
    authors,
    songs: periodSongs,
  };
}

/** El resumen que toca enseñar: el de la semana pasada si tuvo vida; si no, el de esta semana. */
export function featuredWeek(all: Moment[], now = Date.now()) {
  const thisWeek = weekStart(now);
  const lastWeek = thisWeek - 7 * DAY;
  const last = all.filter((m) => m.createdAt >= lastWeek && m.createdAt < thisWeek).length;
  if (last >= 2) return lastWeek;
  const current = all.filter((m) => m.createdAt >= thisWeek).length;
  return current >= 1 ? thisWeek : null;
}

/**
 * «Tal día como hoy»: momentos de este mismo día en años anteriores (con un día
 * de margen). Mientras no haya un año de historia, lo de hace un mes.
 */
export function onThisDay(
  all: Moment[],
  now = Date.now(),
): { label: string; moments: Moment[] } | null {
  const today = new Date(now);
  const years: { years: number; list: Moment[] }[] = [];
  for (const m of all) {
    const d = new Date(m.createdAt);
    const yearsAgo = today.getFullYear() - d.getFullYear();
    if (yearsAgo < 1) continue;
    const sameDay = new Date(today.getFullYear(), d.getMonth(), d.getDate()).getTime();
    if (
      Math.abs(
        sameDay - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime(),
      ) > DAY
    )
      continue;
    const entry =
      years.find((y) => y.years === yearsAgo) ??
      years[years.push({ years: yearsAgo, list: [] }) - 1];
    entry.list.push(m);
  }
  if (years.length) {
    years.sort((a, b) => a.years - b.years);
    const y = years[0];
    return {
      label: `Tal día como hoy, hace ${y.years === 1 ? 'un año' : `${y.years} años`}`,
      moments: y.list,
    };
  }
  const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate()).getTime();
  const list = all.filter(
    (m) => Math.abs(new Date(m.createdAt).setHours(0, 0, 0, 0) - monthAgo) <= DAY,
  );
  return list.length ? { label: 'Hace un mes', moments: list } : null;
}
