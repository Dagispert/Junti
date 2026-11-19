// Karaoke: la canción de un reto, el montaje de las voces y la grabación.
//
// Cada uno graba su vídeo cantando el tramo entero, con la canción sonando a la
// vez. Al verlo, la app reparte el tramo en trozos y va pasando de una voz a
// otra; el final lo cantan todos juntos, en mosaico.

import type { KaraokeGame } from '@/data/types';

import { CACHE_LARGA, firmar, firmarUno } from './firmas';
import { MEDIA_BUCKET, supabase } from './supabase';

/** La dirección del audio: el fragmento de Apple o la pista firmada del almacén. */
export async function trackUrl(game: KaraokeGame): Promise<string | undefined> {
  if (game.trackPath) {
    return firmarUno('media', game.trackPath);
  }
  return game.previewUrl;
}

/** Un trozo del montaje: quién canta (uno, o todos en el final). */
export type Part = { from: number; to: number; singers: string[] };

/** Barajar de forma estable (la misma mezcla para todos y cada vez). */
function shuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Reparte el tramo entre las voces: trozos de 3 a 7 segundos, por turnos (sin
 * repetir a nadie dos veces seguidas) y, si da tiempo, un final con todos.
 */
export function planMontage(duration: number, singers: string[], seed: string): Part[] {
  if (!singers.length || duration <= 0) return [];
  if (singers.length === 1) return [{ from: 0, to: duration, singers }];
  const finale = duration >= 14 ? Math.min(8, Math.max(4, duration * 0.18)) : 0;
  const body = duration - finale;
  const ideal = Math.max(3, Math.min(7, body / (singers.length * 2)));
  const count = Math.max(singers.length, Math.round(body / ideal));
  const step = body / count;
  const order = shuffle(singers, seed);
  const parts: Part[] = [];
  for (let i = 0; i < count; i++)
    parts.push({ from: i * step, to: (i + 1) * step, singers: [order[i % order.length]] });
  if (finale) parts.push({ from: body, to: duration, singers: order });
  return parts;
}

/** El trozo que suena en el segundo «t». */
export function partAt(parts: Part[], t: number): Part | undefined {
  return parts.find((p) => t >= p.from && t < p.to) ?? parts[parts.length - 1];
}

/**
 * La forma de onda del audio (barras de 0 a 1) para la tira del tramo. Si el
 * navegador no puede leerlo, unas barras de adorno.
 */
export async function waveform(url: string, bars = 64): Promise<number[]> {
  const fallback = Array.from({ length: bars }, (_, i) => 0.35 + 0.4 * Math.abs(Math.sin(i * 1.7)));
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return fallback;
    const buffer = await (await fetch(url)).arrayBuffer();
    const ctx = new Ctx();
    const audio = await new Promise<AudioBuffer>((resolve, reject) =>
      ctx.decodeAudioData(buffer, resolve, reject),
    );
    ctx.close().catch(() => {});
    const data = audio.getChannelData(0);
    const size = Math.floor(data.length / bars);
    const peaks: number[] = [];
    for (let b = 0; b < bars; b++) {
      let sum = 0;
      for (let i = b * size; i < (b + 1) * size; i += 32) sum += data[i] * data[i];
      peaks.push(Math.sqrt(sum / (size / 32)));
    }
    const top = Math.max(...peaks, 0.0001);
    return peaks.map((p) => Math.max(0.08, p / top));
  } catch {
    return fallback;
  }
}

/** El mejor formato de vídeo que sabe grabar este navegador (en iPhone, MP4). */
export function recorderType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  // Primero H.264 + AAC (lo ve y lo oye cualquier móvil). Chrome casi nunca
  // sabe AAC: entonces H.264 + Opus (sin «avc1», Chrome elige VP9, que el
  // iPhone no siempre sabe ver).
  for (const t of [
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1,mp4a',
    'video/mp4;codecs=avc1,opus',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ])
    if (MediaRecorder.isTypeSupported?.(t)) return t;
  return '';
}

export const canRecord = () =>
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof MediaRecorder !== 'undefined';

/** Un mezclador para subir y bajar el volumen de vídeos y audio (también en iPhone). */
export function mixer() {
  const Ctx =
    typeof window !== 'undefined'
      ? window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : undefined;
  let ctx: AudioContext | null = null;
  try {
    ctx = Ctx ? new Ctx() : null;
  } catch {
    ctx = null;
  }
  const nodes = new Map<HTMLMediaElement, GainNode>();
  return {
    ctx,
    /** Pasa el elemento por el mezclador (necesita «crossOrigin»). */
    add(el: HTMLMediaElement, level = 1) {
      if (!ctx || nodes.has(el)) return;
      try {
        const gain = ctx.createGain();
        gain.gain.value = level;
        ctx.createMediaElementSource(el).connect(gain);
        gain.connect(ctx.destination);
        nodes.set(el, gain);
      } catch {
        // sin mezclador: se usa «muted»
      }
    },
    /** Volumen, con un pequeño fundido para que no chasquee. */
    set(el: HTMLMediaElement, level: number) {
      const gain = nodes.get(el);
      if (gain && ctx) {
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setTargetAtTime(level, ctx.currentTime, 0.06);
        el.muted = false;
      } else el.muted = level < 0.05;
    },
    resume() {
      if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
    },
    close() {
      ctx?.close().catch(() => {});
    },
  };
}

/* ───────────── La voz de cada toma, para que suene en cualquier móvil ───────────── */

/** ¿El sonido de este tipo de vídeo lo oye todo el mundo (AAC) o es Opus (el iPhone no)? */
export function audioDeTipo(mime: string): 'aac' | 'opus' {
  if (/mp4a|aac/i.test(mime)) return 'aac';
  if (/opus|webm/i.test(mime)) return 'opus';
  // «video/mp4» a secas: el iPhone graba AAC; Chrome, Opus
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return /iPad|iPhone|iPod/.test(ua) || (/Safari/.test(ua) && !/Chrome|Chromium|Android/.test(ua))
    ? 'aac'
    : 'opus';
}

/** ¿El archivo trae el sonido en Opus? (lo que el iPhone no sabe leer) */
export function tieneOpus(bytes: ArrayBuffer): boolean {
  const b = new Uint8Array(bytes);
  // «Opus» (la caja del MP4) o «A_OPUS» (WebM); basta con mirar el principio y el final
  const mira = (desde: number, hasta: number) => {
    for (let i = Math.max(0, desde); i < Math.min(b.length, hasta) - 4; i++)
      if (b[i] === 0x4f && b[i + 1] === 0x70 && b[i + 2] === 0x75 && b[i + 3] === 0x73) return true;
    return false;
  };
  return mira(0, 64 * 1024) || mira(b.length - 256 * 1024, b.length);
}

/** El sonido en WAV (mono, 24 kHz, 16 bits): ~1,5 MB por cada 30 s. */
export function aWav(buf: AudioBuffer, hz = 24000): Blob {
  const paso = buf.sampleRate / hz;
  const n = Math.floor(buf.length / paso);
  const canales = Array.from({ length: buf.numberOfChannels }, (_, i) => buf.getChannelData(i));
  const datos = new DataView(new ArrayBuffer(44 + n * 2));
  const txt = (o: number, t: string) =>
    [...t].forEach((c, i) => datos.setUint8(o + i, c.charCodeAt(0)));
  txt(0, 'RIFF');
  datos.setUint32(4, 36 + n * 2, true);
  txt(8, 'WAVE');
  txt(12, 'fmt ');
  datos.setUint32(16, 16, true);
  datos.setUint16(20, 1, true);
  datos.setUint16(22, 1, true);
  datos.setUint32(24, hz, true);
  datos.setUint32(28, hz * 2, true);
  datos.setUint16(32, 2, true);
  datos.setUint16(34, 16, true);
  txt(36, 'data');
  datos.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const j = Math.floor(i * paso);
    let v = 0;
    for (const c of canales) v += c[j];
    v = Math.max(-1, Math.min(1, v / canales.length));
    datos.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return new Blob([datos], { type: 'audio/wav' });
}

/** Sube la voz en WAV de una toma y la apunta (si ya la tiene, no hace nada). */
export async function guardarVozToma(
  groupId: string,
  me: string,
  momentId: string,
  buf: AudioBuffer,
) {
  const path = `${groupId}/${me}/voz-${momentId}.wav`;
  const up = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, aWav(buf), { contentType: 'audio/wav', upsert: true, cacheControl: CACHE_LARGA });
  if (up.error) throw new Error(up.error.message);
  const { error } = await supabase.from('voces_tomas').insert({ moment_id: momentId, path });
  // si otro móvil se adelantó, vale con la suya
  if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
}

/** Las voces en WAV que ya hay (id de la toma → enlace). */
export async function vocesEnWav(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!ids.length) return out;
  const { data } = await supabase
    .from('voces_tomas')
    .select('moment_id, path')
    .in('moment_id', ids);
  if (!data?.length) return out;
  const firmadas = await firmar(
    MEDIA_BUCKET,
    data.map((d) => d.path),
  );
  data.forEach((d) => {
    const u = firmadas[d.path];
    if (u) out.set(d.moment_id, u);
  });
  return out;
}
