// Letras para el karaoke, de LRCLIB (lrclib.net): un catálogo abierto y
// gratuito, sin clave, con muchas letras sincronizadas (cada línea con su
// segundo). Si no está sincronizada, se marca el ritmo a mano.

/** Una línea de la letra y cuándo empieza (en segundos dentro del audio). */
export type LyricLine = { t: number; text: string };

export type FoundLyrics = {
  /** con su tiempo, si LRCLIB la tiene sincronizada */
  lines?: LyricLine[];
  plain?: string;
  /** cuánto dura la canción en LRCLIB (para saber si cuadra con la pista) */
  duration?: number;
};

type Row = {
  trackName?: string;
  artistName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
};

/** Lee el formato LRC: «[01:02.34] texto». */
export function parseLrc(lrc: string): LyricLine[] {
  const out: LyricLine[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    if (!stamps.length) continue;
    const text = raw.replace(/\[[^\]]*\]/g, '').trim();
    if (!text) continue;
    for (const s of stamps) {
      const frac = s[3] ? Number(s[3]) / 10 ** s[3].length : 0;
      out.push({ t: Number(s[1]) * 60 + Number(s[2]) + frac, text });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

const norm = (s = '') =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)|\[.*?\]|-.*remaster.*$/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Busca la letra por canción y artista. Prefiere la sincronizada y, si se
 * sabe, la versión que dura lo mismo que la pista.
 */
export async function findLyrics(
  song: string,
  artist?: string,
  duration?: number,
  signal?: AbortSignal,
): Promise<FoundLyrics | null> {
  const params = new URLSearchParams({ track_name: song });
  if (artist) params.set('artist_name', artist);
  let rows: Row[] = [];
  try {
    const r = await fetch(`https://lrclib.net/api/search?${params}`, { signal });
    if (r.ok) rows = await r.json();
    // sin artista (o mal escrito), solo por el título
    if (!rows.length && artist) {
      const r2 = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(song)}`, {
        signal,
      });
      if (r2.ok) rows = await r2.json();
    }
  } catch {
    return null;
  }
  const want = norm(song);
  const usable = rows.filter(
    (x) => !x.instrumental && (x.syncedLyrics || x.plainLyrics) && norm(x.trackName) === want,
  );
  const pool = usable.length ? usable : rows.filter((x) => x.syncedLyrics || x.plainLyrics);
  if (!pool.length) return null;
  const score = (x: Row) =>
    (x.syncedLyrics ? 0 : 1000) +
    (duration && x.duration ? Math.abs(x.duration - duration) : 50) +
    (artist && norm(x.artistName) !== norm(artist) ? 200 : 0);
  const best = [...pool].sort((a, b) => score(a) - score(b))[0];
  const lines = best.syncedLyrics ? parseLrc(best.syncedLyrics) : undefined;
  return {
    lines: lines?.length ? lines : undefined,
    plain: best.plainLyrics ?? lines?.map((l) => l.text).join('\n'),
    duration: best.duration,
  };
}

/** La línea que suena en el segundo «t» (−1: aún no ha empezado ninguna). */
export function lineAt(lines: LyricLine[], t: number): number {
  let i = -1;
  for (let k = 0; k < lines.length; k++) if (lines[k].t <= t) i = k;
  return i;
}
