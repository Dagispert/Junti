// Karaoke: la canción de un reto, el montaje de las voces y la grabación.
//
// Cada uno graba su vídeo cantando el tramo entero, con la canción sonando a la
// vez. Al verlo, la app reparte el tramo en trozos y va pasando de una voz a
// otra; el final lo cantan todos juntos, en mosaico.

import type { KaraokeGame } from '@/data/types';

import { supabase } from './supabase';

/** La dirección del audio: el fragmento de Apple o la pista firmada del almacén. */
export async function trackUrl(game: KaraokeGame): Promise<string | undefined> {
  if (game.trackPath) {
    const { data } = await supabase.storage.from('media').createSignedUrl(game.trackPath, 3600);
    return data?.signedUrl;
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
  for (const t of [
    'video/mp4;codecs=avc1,mp4a',
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
