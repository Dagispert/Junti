// El montaje del karaoke como vídeo: se dibuja en un lienzo mientras se ve
// (las voces que cantan, la letra y quién canta) y se graba con el sonido
// mezclado. Así se puede compartir, y al cerrarse el reto es lo único que queda.

import { useEffect, useState } from 'react';

import {
  PEOPLE,
  SQUIRCLE,
  STRIPES,
  THREAD,
  THREAD_LENGTH,
  WORD,
  WORD_H,
  WORD_W,
} from '@/components/logo';
import { Brand } from '@/constants/brand';
import type { KaraokeGame } from '@/data/types';

import { MEDIA_BUCKET, supabase } from './supabase';

/** Qué tomas tiene el montaje (si cambia alguna, hay que volver a grabarlo). */
export function firmaTomas(ids: string[]): string {
  const txt = [...ids].sort().join(',');
  let h = 5381;
  for (let i = 0; i < txt.length; i++) h = ((h << 5) + h + txt.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

/** El enlace (temporal) del montaje guardado y de su portada. */
export function useMontaje(game?: KaraokeGame) {
  const [urls, setUrls] = useState<{ video?: string; poster?: string }>({});
  const path = game?.montaje?.path;
  const poster = game?.montaje?.poster;
  useEffect(() => {
    if (!path) return;
    let vivo = true;
    supabase.storage
      .from(MEDIA_BUCKET)
      .createSignedUrls([path, ...(poster ? [poster] : [])], 3600)
      .then(({ data }) => {
        if (vivo && data)
          setUrls({
            video: data[0]?.signedUrl ?? undefined,
            poster: data[1]?.signedUrl ?? undefined,
          });
      });
    return () => {
      vivo = false;
    };
  }, [path, poster]);
  return urls;
}

/** Sube el montaje grabado y lo deja guardado en el karaoke. */
export async function subirMontaje(args: {
  groupId: string;
  me: string;
  proposalId: string;
  video: Blob;
  poster: Blob | null;
  firma: string;
  duracion: number;
  /** quiénes cantan (para seguir viéndolo cuando se borren las tomas) */
  voces: string[];
}) {
  const { groupId, me, proposalId, video, poster, firma, duracion, voces } = args;
  const ext = /mp4/.test(video.type) ? 'mp4' : 'webm';
  const base = `${groupId}/${me}/karaoke-${proposalId}-${firma}-${Date.now().toString(36)}`;
  const up = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(`${base}.${ext}`, video, { contentType: video.type || `video/${ext}` });
  if (up.error) throw new Error(up.error.message);
  let posterPath: string | null = null;
  if (poster) {
    const p = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(`${base}.jpg`, poster, { contentType: 'image/jpeg' });
    if (!p.error) posterPath = `${base}.jpg`;
  }
  const { error } = await supabase.rpc('guardar_montaje_karaoke', {
    p: proposalId,
    ruta: `${base}.${ext}`,
    portada: posterPath,
    firma,
    duracion: Math.round(duracion * 10) / 10,
    voces,
  });
  if (error) throw new Error(error.message);
}

// ── Dibujo ──────────────────────────────────────────────────────────────────

export const ANCHO = 720;
export const ALTO = 1280;

/** Un vídeo recortado para llenar su hueco (como «object-fit: cover»), en espejo. */
export function pintarVideo(
  c: CanvasRenderingContext2D,
  v: HTMLVideoElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const vw = v.videoWidth;
  const vh = v.videoHeight;
  if (!vw || !vh) {
    c.fillStyle = '#111';
    c.fillRect(x, y, w, h);
    return;
  }
  const s = Math.max(w / vw, h / vh);
  const sw = w / s;
  const sh = h / s;
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  c.translate(x + w, y);
  c.scale(-1, 1);
  try {
    c.drawImage(v, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, w, h);
  } catch {
    // un vídeo sin permiso para dibujarse: se queda en negro
  }
  c.restore();
}

/** Texto centrado en varias líneas, con sombra (para la letra y los títulos). */
export function textoCentrado(
  c: CanvasRenderingContext2D,
  texto: string,
  y: number,
  tam: number,
  peso: number,
  color: string,
  maxW = ANCHO - 80,
) {
  c.font = `${peso} ${tam}px Inter, system-ui, -apple-system, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  const palabras = texto.split(/\s+/);
  const lineas: string[] = [];
  let actual = '';
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (c.measureText(prueba).width > maxW && actual) {
      lineas.push(actual);
      actual = p;
    } else actual = prueba;
  }
  if (actual) lineas.push(actual);
  c.save();
  c.shadowColor = 'rgba(0,0,0,0.75)';
  c.shadowBlur = tam * 0.4;
  c.shadowOffsetY = 2;
  c.fillStyle = color;
  lineas.forEach((l, i) => c.fillText(l, ANCHO / 2, y + i * tam * 1.25));
  c.restore();
  return lineas.length * tam * 1.25;
}

/** Una píldora con las fotos de quien canta y el texto (p. ej. «Canta Diego»). */
export function pildora(
  c: CanvasRenderingContext2D,
  texto: string,
  x: number,
  y: number,
  caras: { img: HTMLImageElement | null | undefined; inicial: string }[] = [],
) {
  c.font = '600 26px Inter, system-ui, -apple-system, sans-serif';
  const r = 19;
  const solape = caras.length > 1 ? r * 1.15 : 0;
  const anchoCaras = caras.length ? 2 * r + (caras.length - 1) * solape + 12 : 0;
  const w = c.measureText(texto).width + 36 + anchoCaras;
  const alto = 52;
  c.fillStyle = 'rgba(0,0,0,0.45)';
  c.beginPath();
  c.roundRect(x, y, w, alto, alto / 2);
  c.fill();
  caras.forEach((f, i) =>
    pintarAvatar(c, f.img, f.inicial, x + 8 + r + i * solape, y + alto / 2, r),
  );
  c.fillStyle = '#FFFFFF';
  c.textAlign = 'left';
  c.textBaseline = 'middle';
  c.fillText(texto, x + 18 + anchoCaras - (caras.length ? 8 : 0), y + alto / 2 + 1);
}

/** Una imagen descargada para poder dibujarla (sin «ensuciar» el lienzo). */
export async function imagenLimpia(src?: string): Promise<HTMLImageElement | null> {
  if (!src) return null;
  try {
    const blob = await (await fetch(src)).blob();
    const img = new Image();
    img.src = URL.createObjectURL(blob);
    await img.decode();
    return img;
  } catch {
    return null;
  }
}

/**
 * La imagen muy difuminada, sin «filter» (el iPhone no lo aplica en el lienzo):
 * se encoge a unos pocos píxeles y, al agrandarla, queda borrosa.
 */
export function difuminar(img: HTMLImageElement): HTMLCanvasElement | null {
  try {
    const pasos = [96, 36, 14];
    let actual: HTMLCanvasElement | HTMLImageElement = img;
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    let out: HTMLCanvasElement | null = null;
    for (const p of pasos) {
      const r = p / Math.max(w, h);
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * r));
      c.height = Math.max(1, Math.round(h * r));
      const x = c.getContext('2d');
      if (!x) return null;
      x.imageSmoothingEnabled = true;
      x.imageSmoothingQuality = 'high';
      x.drawImage(actual, 0, 0, c.width, c.height);
      actual = c;
      w = c.width;
      h = c.height;
      out = c;
    }
    return out;
  } catch {
    return null;
  }
}

// ── El logo de Junti, animado como en la pantalla de carga ─────────────────

const cl = (x: number) => Math.max(0, Math.min(1, x));
const suave = (x: number) => 1 - (1 - x) ** 3;
let trazos: {
  squircle: Path2D;
  stripes: { p: Path2D; right: number }[];
  thread: Path2D;
  word: Path2D;
} | null = null;
const formas = () =>
  (trazos ??= {
    squircle: new Path2D(SQUIRCLE),
    stripes: STRIPES.map((x) => ({ p: new Path2D(x.d), right: x.right })),
    thread: new Path2D(THREAD),
    word: new Path2D(WORD),
  });

/**
 * El icono (en blanco, para fondos oscuros) con su animación: aparece la forma,
 * entran las líneas del planeta, una persona, el surco viaja y la otra.
 * «drawn» va de 0 a 1.
 */
export function pintarLogo(
  c: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  lado: number,
  drawn: number,
) {
  const f = formas();
  const bg = '#FFFFFF';
  const fg = Brand.ink;
  const shape = suave(cl(drawn / 0.25));
  const personA = suave(cl((drawn - 0.52) / 0.12));
  const thread = suave(cl((drawn - 0.6) / 0.28));
  const personB = suave(cl((drawn - 0.86) / 0.14));
  c.save();
  c.translate(cx - lado / 2, cy - lado / 2);
  c.scale(lado / 64, lado / 64);
  // la forma
  c.save();
  c.globalAlpha *= shape;
  c.translate(32, 32);
  c.scale(0.86 + 0.14 * shape, 0.86 + 0.14 * shape);
  c.translate(-32, -32);
  c.fillStyle = bg;
  c.fill(f.squircle);
  c.restore();
  // las líneas del planeta
  c.save();
  c.beginPath();
  c.arc(32, 32, 20, 0, Math.PI * 2);
  c.clip();
  c.fillStyle = fg;
  f.stripes.forEach((s, i) => {
    const p = suave(cl((drawn - 0.1 - i * 0.03) / 0.3));
    if (p <= 0) return;
    c.save();
    c.translate(s.right, 0);
    c.scale(p, 1);
    c.translate(-s.right, 0);
    c.fill(s.p);
    c.restore();
  });
  c.restore();
  // el surco que une a las dos personas
  if (thread > 0) {
    c.save();
    c.strokeStyle = bg;
    c.lineWidth = 2.4;
    c.lineCap = 'round';
    c.setLineDash([THREAD_LENGTH, THREAD_LENGTH]);
    c.lineDashOffset = THREAD_LENGTH * (1 - thread);
    c.stroke(f.thread);
    c.restore();
  }
  PEOPLE.forEach(([x, y], i) => {
    const p = i === 0 ? personA : personB;
    if (p <= 0) return;
    c.fillStyle = bg;
    c.beginPath();
    c.arc(x, y, 5 * p, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = fg;
    c.beginPath();
    c.arc(x, y, 3.2 * p, 0, Math.PI * 2);
    c.fill();
  });
  c.restore();
}

/** «junti» con la letra del logo, centrado en (cx, cy), de este alto. */
export function pintarPalabra(
  c: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  alto: number,
  color = '#FFFFFF',
) {
  const f = formas();
  const k = alto / WORD_H;
  c.save();
  c.translate(cx - (WORD_W * k) / 2, cy - alto / 2);
  c.scale(k, k);
  c.fillStyle = color;
  c.fill(f.word);
  c.restore();
}

/** Una foto de perfil redonda (o la inicial sobre un color, si no hay foto). */
export function pintarAvatar(
  c: CanvasRenderingContext2D,
  img: HTMLImageElement | null | undefined,
  inicial: string,
  cx: number,
  cy: number,
  r: number,
) {
  c.save();
  c.beginPath();
  c.arc(cx, cy, r + 3, 0, Math.PI * 2);
  c.fillStyle = '#FFFFFF';
  c.fill();
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.clip();
  if (img) {
    const s = Math.max((2 * r) / img.naturalWidth, (2 * r) / img.naturalHeight);
    const w = img.naturalWidth * s;
    const h = img.naturalHeight * s;
    c.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  } else {
    c.fillStyle = '#5E7CE2';
    c.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    c.fillStyle = '#FFFFFF';
    c.font = `600 ${Math.round(r)}px Inter, system-ui, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(inicial.slice(0, 1).toUpperCase(), cx, cy + 1);
  }
  c.restore();
}
