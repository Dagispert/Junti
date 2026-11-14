import type { GroupOrigin, Moment } from '@/data/types';

// «Nuestra historia»: dónde empezó todo y, después, los recuerdos (lo que
// pasó antes de Junti) en orden. Entre medias, los años de los que nadie ha
// contado nada, para pedirlos.

export type Gap = { from: number; to: number };

export type StoryItem =
  | { type: 'origin'; origin: GroupOrigin; year?: number }
  | { type: 'memory'; moment: Moment; year: number }
  | { type: 'gap'; gap: Gap };

export const gapId = (g: Gap) => `gap:${g.from}-${g.to}`;

/** «gap:2013-2017» → {from: 2013, to: 2017}. */
export function parseGap(id: string | null | undefined): Gap | null {
  const m = /^gap:(\d{4})-(\d{4})$/.exec(id ?? '');
  return m ? { from: Number(m[1]), to: Number(m[2]) } : null;
}

export const gapLabel = (g: Gap) => (g.from === g.to ? `${g.from}` : `${g.from}–${g.to}`);

/**
 * Años sin recuerdos: dos o más seguidos, como mucho los tres huecos más
 * largos. «until» es el año en que empezasteis con Junti (desde ahí, los
 * carretes de cada mes ya lo cuentan).
 */
export function storyGaps(years: number[], until: number): Gap[] {
  const ys = [...new Set(years)].sort((a, b) => a - b);
  if (!ys.length) return [];
  const gaps: Gap[] = [];
  for (let i = 0; i < ys.length; i++) {
    const next = i + 1 < ys.length ? ys[i + 1] : until;
    if (next - ys[i] >= 3) gaps.push({ from: ys[i] + 1, to: next - 1 });
  }
  return gaps
    .sort((a, b) => b.to - b.from - (a.to - a.from))
    .slice(0, 3)
    .sort((a, b) => a.from - b.from);
}

/** La historia en orden: origen, recuerdos y huecos donde tocan. */
export function buildStory(origins: GroupOrigin[], groupMoments: Moment[]) {
  const memories = groupMoments.filter((m) => m.memory).sort((a, b) => a.createdAt - b.createdAt);
  const live = groupMoments.filter((m) => !m.memory);
  const until = live.length
    ? new Date(Math.min(...live.map((m) => m.createdAt))).getFullYear()
    : new Date().getFullYear();
  const sorted = [...origins].sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
  const gaps = storyGaps(
    [
      ...sorted.map((o) => o.year).filter((y): y is number => !!y),
      ...memories.map((m) => new Date(m.createdAt).getFullYear()),
    ],
    until,
  );

  const timed: { at: number; item: StoryItem }[] = [
    ...sorted.map((origin, i) => ({
      // Sin año, el origen va el primero de todo.
      at: origin.year ? origin.year - 0.9 + i * 0.01 : -1e9 + i,
      item: { type: 'origin' as const, origin, year: origin.year },
    })),
    ...memories.map((moment) => {
      const d = new Date(moment.createdAt);
      return {
        at: d.getFullYear() + d.getMonth() / 12,
        item: { type: 'memory' as const, moment, year: d.getFullYear() },
      };
    }),
    ...gaps.map((gap) => ({ at: gap.from - 0.05, item: { type: 'gap' as const, gap } })),
  ];
  timed.sort((a, b) => a.at - b.at);
  return { items: timed.map((x) => x.item), memories, gaps };
}

/**
 * Capítulos por épocas, sin narradora: con cuatro recuerdos o más, la historia
 * se corta donde hay huecos («De 2008 a 2011»). Devuelve, para cada posición de
 * la historia donde empieza un capítulo, su nombre.
 */
export function autoChapters(items: StoryItem[]): Map<number, string> {
  const out = new Map<number, string>();
  if (items.filter((i) => i.type === 'memory').length < 4) return out;
  const yearOf = (i: StoryItem) =>
    i.type === 'memory' ? i.year : i.type === 'origin' ? i.year : undefined;
  let start = -1;
  let years: number[] = [];
  const close = () => {
    if (start >= 0 && years.length) {
      const from = Math.min(...years);
      const to = Math.max(...years);
      out.set(start, from === to ? `${from}` : `De ${from} a ${to}`);
    }
    start = -1;
    years = [];
  };
  items.forEach((it, i) => {
    if (it.type === 'gap') return close();
    if (start < 0) start = i;
    const y = yearOf(it);
    if (y) years.push(y);
  });
  close();
  return out.size > 1 ? out : new Map();
}

const monthYear = (t: number) => {
  const s = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(t);
  return s[0].toUpperCase() + s.slice(1);
};

/** La historia contada sin la narradora (si no está activada): frases sencillas. */
export function templateScenes(
  items: StoryItem[],
): { momentId: string | null; text: string; chapter?: string }[] {
  const chapters = autoChapters(items);
  const scenes: { momentId: string | null; text: string; chapter?: string }[] = [];
  if (items[0]?.type !== 'origin') {
    scenes.push({
      momentId: 'origin',
      text: 'Esta es vuestra historia, desde el primer recuerdo.',
    });
  }
  for (const [i, it] of items.entries()) {
    const chapter = chapters.get(i);
    const before = scenes.length;
    if (it.type === 'origin') {
      const place = it.origin.place.split(',')[0];
      scenes.push({
        momentId: 'origin',
        text: `Todo empezó en ${place}${it.year ? `, en ${it.year}` : ''}.${it.origin.story ? ` ${it.origin.story}` : ''}`,
      });
    } else if (it.type === 'memory') {
      const m = it.moment;
      const place = m.place?.name.split(',')[0];
      scenes.push({
        momentId: m.id,
        text: `${monthYear(m.createdAt)}${place ? `, en ${place}` : ''}${m.text ? `: «${m.text.trim().slice(0, 90)}»` : '.'}`,
      });
    } else {
      scenes.push({
        momentId: gapId(it.gap),
        text: `De ${it.gap.from} a ${it.gap.to} no me habéis contado nada. ¿Qué pasó esos años?`,
      });
    }
    if (chapter && scenes[before]) scenes[before].chapter = chapter;
  }
  scenes.push({
    momentId: 'end',
    text: 'Y la historia sigue, ahora aquí. Cuando os acordéis de algo, añadidlo.',
  });
  return scenes;
}
