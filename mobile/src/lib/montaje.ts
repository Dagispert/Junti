// El montaje del karaoke como vídeo: se dibuja en un lienzo mientras se ve
// (las voces que cantan, la letra y quién canta) y se graba con el sonido
// mezclado. Así se puede compartir, y al cerrarse el reto es lo único que queda.

import { useEffect, useState } from 'react';

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

/** Una píldora con texto (p. ej. «Canta Diego»). */
export function pildora(c: CanvasRenderingContext2D, texto: string, x: number, y: number) {
  c.font = '600 26px Inter, system-ui, -apple-system, sans-serif';
  const w = c.measureText(texto).width + 36;
  c.fillStyle = 'rgba(0,0,0,0.45)';
  c.beginPath();
  c.roundRect(x, y, w, 46, 23);
  c.fill();
  c.fillStyle = '#FFFFFF';
  c.textAlign = 'left';
  c.textBaseline = 'middle';
  c.fillText(texto, x + 18, y + 24);
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
