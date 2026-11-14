// Exportar para compartir fuera de Junti: las narraciones como vídeo vertical
// (para stories, reels o WhatsApp) y una foto con su nota como imagen 4:5.
// Todo se compone en un lienzo en el propio teléfono; nada sale de él hasta
// que la persona lo comparte. Solo en la web (la app es una web instalada).

const HAND = 'Caveat_600SemiBold';
const HAND_BOLD = 'Caveat_700Bold';
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const INK = '#1F2124';
const ROSE = '#C2477A';

export const canExport = () =>
  typeof document !== 'undefined' && typeof HTMLCanvasElement !== 'undefined';

export const canRecordVideo = () =>
  canExport() &&
  typeof MediaRecorder !== 'undefined' &&
  typeof HTMLCanvasElement.prototype.captureStream === 'function';

/** Una imagen lista para dibujar (se pide como archivo para no «manchar» el lienzo). */
async function loadImage(url?: string): Promise<ImageBitmap | null> {
  if (!url) return null;
  try {
    const blob = await (await fetch(url)).blob();
    return await createImageBitmap(blob);
  } catch {
    return null;
  }
}

async function ensureFonts() {
  try {
    await Promise.all([
      document.fonts.load(`60px ${HAND}`),
      document.fonts.load(`60px ${HAND_BOLD}`),
    ]);
  } catch {
    // con la letra del sistema
  }
}

/** Parte un texto en líneas que caben en «max» píxeles. */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > max && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Dibuja una imagen recortada para cubrir el recuadro (con zoom y desplazamiento). */
function cover(
  ctx: CanvasRenderingContext2D,
  img: ImageBitmap,
  x: number,
  y: number,
  w: number,
  h: number,
  zoom = 1,
  pan = 0,
) {
  const s = Math.max(w / img.width, h / img.height) * zoom;
  const dw = img.width * s;
  const dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) / 2 + pan * (dw - w) * 0.5, y + (h - dh) / 2, dw, dh);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function paper(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#FBF7F0');
  g.addColorStop(1, '#EFE4D2');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function watermark(ctx: CanvasRenderingContext2D, w: number, h: number, size = 40) {
  ctx.save();
  ctx.font = `${size}px ${HAND_BOLD}`;
  ctx.fillStyle = 'rgba(31,33,36,0.55)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('hecho con Junti', w - 48, h - 44);
  ctx.restore();
}

/** Una polaroid con su foto, inclinada, con pie escrito a mano. */
function polaroid(
  ctx: CanvasRenderingContext2D,
  img: ImageBitmap | null,
  cx: number,
  top: number,
  size: number,
  rotate: number,
  caption?: string,
  zoom = 1,
  pan = 0,
  fallbackText?: string,
) {
  const pad = size * 0.045;
  const w = size + pad * 2;
  const h = size + pad + size * 0.16;
  ctx.save();
  ctx.translate(cx, top + h / 2);
  ctx.rotate((rotate * Math.PI) / 180);
  ctx.shadowColor = 'rgba(60,40,10,0.28)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 22;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.shadowColor = 'transparent';
  ctx.save();
  ctx.beginPath();
  ctx.rect(-w / 2 + pad, -h / 2 + pad, size, size);
  ctx.clip();
  if (img) cover(ctx, img, -w / 2 + pad, -h / 2 + pad, size, size, zoom, pan);
  else {
    ctx.fillStyle = '#F7F0E2';
    ctx.fillRect(-w / 2 + pad, -h / 2 + pad, size, size);
    if (fallbackText) {
      ctx.fillStyle = '#3C3F44';
      ctx.font = `${size * 0.075}px ${HAND}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lines = wrap(ctx, fallbackText, size * 0.8).slice(0, 7);
      lines.forEach((l, i) =>
        ctx.fillText(l, 0, -h / 2 + pad + size / 2 + (i - (lines.length - 1) / 2) * size * 0.085),
      );
    }
  }
  ctx.restore();
  if (caption) {
    ctx.fillStyle = '#2A2A2A';
    ctx.font = `${size * 0.07}px ${HAND}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(caption, 0, h / 2 - size * 0.08, size);
  }
  ctx.restore();
}

/** Una nota adhesiva con su presilla, con el texto ajustado a su tamaño. */
function stickyNote(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  w: number,
  rotate: number,
) {
  const h = w * 0.78;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate((rotate * Math.PI) / 180);
  ctx.shadowColor = 'rgba(20,22,26,0.2)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = '#BFE3EE';
  roundRect(ctx, -w / 2, -h / 2, w, h, 8);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  // La presilla
  ctx.strokeStyle = '#9AA3AA';
  ctx.lineWidth = 5;
  roundRect(ctx, w / 2 - w * 0.2, -h / 2 - w * 0.07, w * 0.08, w * 0.18, w * 0.04);
  ctx.stroke();
  // El texto, cuanto más largo más pequeño
  ctx.fillStyle = '#3D5C66';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = w * 0.16;
  let lines: string[] = [];
  for (; size > w * 0.06; size -= 2) {
    ctx.font = `${size}px ${HAND}`;
    lines = wrap(ctx, text, w * 0.82);
    if (lines.length * size * 1.0 <= h * 0.72) break;
  }
  const maxLines = Math.floor((h * 0.72) / size);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '…');
  }
  lines.forEach((l, i) => ctx.fillText(l, 0, h * 0.06 + (i - (lines.length - 1) / 2) * size));
  ctx.restore();
}

/** Compartir el archivo (menú del teléfono) o, si no se puede, descargarlo. */
export async function shareFile(
  blob: Blob,
  name: string,
  title: string,
): Promise<'shared' | 'saved'> {
  const file = new File([blob], name, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title });
      return 'shared';
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return 'shared';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return 'saved';
}

// ───────────────────────────── La foto ─────────────────────────────

/** Una foto con su nota, lista para redes (1080 × 1350). */
export async function renderMomentImage(m: {
  image?: string;
  note?: string;
  stickers: string[];
  footer: string;
}): Promise<Blob> {
  await ensureFonts();
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  paper(ctx, W, H);
  const img = await loadImage(m.image);
  polaroid(ctx, img, W / 2, 150, 820, -2.2, undefined, 1, 0, m.note);
  if (m.note && img) stickyNote(ctx, m.note, W - 430, 70, 360, 5);
  m.stickers.slice(0, 3).forEach((e, i) => {
    const x = W - 170 - i * 130;
    const y = 1080;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(((-10 + i * 12) * Math.PI) / 180);
    ctx.shadowColor = 'rgba(20,22,26,0.18)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, 0, 62, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.font = `72px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(e, 0, 4);
    ctx.restore();
  });
  ctx.fillStyle = '#5A6168';
  ctx.font = `500 34px ${SANS}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(m.footer, 60, H - 48, W - 460);
  watermark(ctx, W, H, 46);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('sin imagen'))), 'image/jpeg', 0.92),
  );
}

// ───────────────────────────── El vídeo ─────────────────────────────

export type VideoScene = {
  text: string;
  image?: string;
  /** Encima de la foto: el año o una etiqueta corta. */
  kicker?: string;
  /** Pie de la foto (el lugar). */
  caption?: string;
  /** Si con esta escena empieza un capítulo: su número y nombre. */
  chapter?: { n: number; name: string };
  /** Sin foto: una frase grande (cifras, despedida…). */
  big?: string;
};

const VIDEO_TYPES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

/**
 * Graba la narración como vídeo vertical (1080 × 1920): portada, una escena por
 * foto con un leve movimiento, los capítulos, subtítulos escritos a mano y la
 * voz de la narradora. Se graba en tiempo real (tarda lo que dura).
 */
export async function renderStoryVideo(opts: {
  title: string;
  subtitle: string;
  scenes: VideoScene[];
  audioUrl?: string | null;
  sceneTimes?: number[] | null;
  audioDuration?: number | null;
  onProgress?: (p: number) => void;
  signal?: AbortSignal;
}): Promise<{ blob: Blob; ext: string }> {
  // El sonido se prepara dentro del toque (Safari solo deja empezarlo ahí).
  const AC = window.AudioContext ?? (window as any).webkitAudioContext;
  const audio: AudioContext | null = AC ? new AC() : null;
  await ensureFonts();
  const W = 1080;
  const H = 1920;
  const FPS = 30;
  const COVER = 3.2;
  const OUTRO = 3;
  const FADE = 0.45;

  const images = await Promise.all(opts.scenes.map((s) => loadImage(s.image)));

  // Cuándo empieza y acaba cada escena (con la voz, sus tramos; si no, por texto).
  let buffer: AudioBuffer | null = null;
  if (audio && opts.audioUrl) {
    try {
      const data = await (await fetch(opts.audioUrl)).arrayBuffer();
      buffer = await audio.decodeAudioData(data);
    } catch {
      buffer = null;
    }
  }
  const times: { start: number; end: number }[] = [];
  if (buffer && opts.sceneTimes?.length === opts.scenes.length) {
    const total = opts.audioDuration ?? buffer.duration;
    opts.scenes.forEach((_, i) =>
      times.push({
        start: COVER + opts.sceneTimes![i],
        end: COVER + (opts.sceneTimes![i + 1] ?? total),
      }),
    );
  } else {
    buffer = null;
    let t = COVER;
    for (const s of opts.scenes) {
      const d = Math.max(3.2, s.text.length / 14 + 1.8);
      times.push({ start: t, end: t + d });
      t += d;
    }
  }
  const total = (times[times.length - 1]?.end ?? COVER) + OUTRO;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const stream = canvas.captureStream(FPS);
  if (audio && buffer) {
    const dest = audio.createMediaStreamDestination();
    const src = audio.createBufferSource();
    src.buffer = buffer;
    src.connect(dest);
    src.start(audio.currentTime + COVER);
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  }
  const type = VIDEO_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
  const recorder = new MediaRecorder(stream, {
    ...(type ? { mimeType: type } : {}),
    videoBitsPerSecond: 6_000_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  const drawSubtitle = (text: string, said: number) => {
    // La frase que se está diciendo, escrita a mano en un panel claro.
    const at = Math.floor(text.length * said);
    const parts = [...text.matchAll(/[^.?!…]+[.?!…»]*/g)].map((m) => ({
      start: m.index! + (m[0].length - m[0].trimStart().length),
      end: m.index! + m[0].length,
    }));
    const cur = [...parts].reverse().find((p) => p.start <= Math.max(at, 1)) ?? parts[0];
    if (!cur) return;
    const sentence = text.slice(cur.start, cur.end).trim();
    ctx.font = `64px ${HAND}`;
    const lines = wrap(ctx, sentence, W - 220).slice(0, 4);
    const lh = 70;
    const boxH = lines.length * lh + 60;
    const y = H - 300 - boxH;
    ctx.fillStyle = 'rgba(255,255,255,0.86)';
    roundRect(ctx, 70, y, W - 140, boxH, 36);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, W / 2, y + 30 + lh / 2 + i * lh));
  };

  const drawHeader = () => {
    ctx.fillStyle = 'rgba(31,33,36,0.6)';
    ctx.font = `600 34px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(opts.subtitle, W / 2, 120, W - 160);
  };

  const drawScene = (i: number, local: number, dur: number) => {
    const s = opts.scenes[i];
    paper(ctx, W, H);
    drawHeader();
    const img = images[i];
    const k = Math.min(1, local / dur);
    if (img || !s.big) {
      if (s.kicker) {
        ctx.fillStyle = ROSE;
        ctx.font = `110px ${HAND_BOLD}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(s.kicker, W / 2, 300);
      }
      polaroid(
        ctx,
        img,
        W / 2,
        360,
        780,
        i % 2 ? 2.2 : -2.2,
        s.caption,
        1 + 0.08 * k,
        (i % 2 ? 1 : -1) * 0.3 * k,
        img ? undefined : s.text,
      );
    } else {
      ctx.fillStyle = INK;
      ctx.font = `120px ${HAND_BOLD}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      wrap(ctx, s.big, W - 200)
        .slice(0, 5)
        .forEach((l, j, all) => ctx.fillText(l, W / 2, 760 + (j - (all.length - 1) / 2) * 130));
    }
    drawSubtitle(s.text, Math.min(1, local / Math.max(0.5, dur - 0.6)));
    // Entrada de capítulo, como en un libro.
    if (s.chapter && local < 2.6) {
      const a = local < 0.4 ? local / 0.4 : local > 2 ? (2.6 - local) / 0.6 : 1;
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(250,247,240,0.96)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#A86A1F';
      ctx.font = `700 40px ${SANS}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`CAPÍTULO ${s.chapter.n}`, W / 2, H / 2 - 150);
      ctx.fillStyle = INK;
      ctx.font = `130px ${HAND_BOLD}`;
      wrap(ctx, s.chapter.name, W - 180)
        .slice(0, 3)
        .forEach((l, j) => ctx.fillText(l, W / 2, H / 2 - 20 + j * 135));
      ctx.globalAlpha = 1;
    }
    watermark(ctx, W, H);
  };

  const drawCover = (local: number) => {
    paper(ctx, W, H);
    const fan = images.filter(Boolean).slice(0, 3) as ImageBitmap[];
    fan.forEach((img, j) =>
      polaroid(ctx, img, W / 2 + (j - (fan.length - 1) / 2) * 110, 330 + j * 20, 560, (j - 1) * 7),
    );
    const a = Math.min(1, local / 0.8);
    ctx.globalAlpha = a;
    ctx.fillStyle = INK;
    ctx.font = `128px ${HAND_BOLD}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    wrap(ctx, opts.title, W - 160)
      .slice(0, 3)
      .forEach((l, j) => ctx.fillText(l, W / 2, 1230 + j * 135));
    ctx.fillStyle = '#5A6168';
    ctx.font = `600 40px ${SANS}`;
    ctx.fillText(opts.subtitle, W / 2, 1640, W - 160);
    ctx.globalAlpha = 1;
    watermark(ctx, W, H);
  };

  const drawOutro = (local: number) => {
    paper(ctx, W, H);
    ctx.globalAlpha = Math.min(1, local / 0.6);
    ctx.fillStyle = INK;
    ctx.font = `120px ${HAND_BOLD}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Junti', W / 2, H / 2 - 40);
    ctx.fillStyle = '#5A6168';
    ctx.font = `500 40px ${SANS}`;
    ctx.fillText('Para los que están lejos', W / 2, H / 2 + 70);
    ctx.globalAlpha = 1;
  };

  const frameAt = (t: number) => {
    if (t < COVER) return drawCover(t);
    const i = times.findIndex((x) => t < x.end);
    if (i < 0) return drawOutro(t - (total - OUTRO));
    const { start, end } = times[i];
    const local = t - start;
    drawScene(i, local, end - start);
  };

  // Fundido: se dibuja la anterior encima con transparencia que se va.
  const fadeCanvas = document.createElement('canvas');
  fadeCanvas.width = W;
  fadeCanvas.height = H;
  const fctx = fadeCanvas.getContext('2d')!;
  let lastIndex = -2;

  await new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = () => reject(new Error('No se ha podido grabar el vídeo.'));
    recorder.start(1000);
    if (audio?.state === 'suspended') audio.resume().catch(() => {});
    const t0 = performance.now();
    const tick = () => {
      if (opts.signal?.aborted) {
        recorder.stop();
        return;
      }
      const t = (performance.now() - t0) / 1000;
      if (t >= total) {
        recorder.stop();
        return;
      }
      const index = t < COVER ? -1 : times.findIndex((x) => t < x.end);
      if (index !== lastIndex) {
        // Se guarda el último fotograma para fundirlo con la escena nueva.
        fctx.drawImage(canvas, 0, 0);
        lastIndex = index;
      }
      frameAt(t);
      const since =
        index >= 0 && index < times.length
          ? t - times[index].start
          : t >= total - OUTRO
            ? t - (total - OUTRO)
            : 1;
      if (since < FADE && t > 0.1) {
        ctx.globalAlpha = 1 - since / FADE;
        ctx.drawImage(fadeCanvas, 0, 0);
        ctx.globalAlpha = 1;
      }
      opts.onProgress?.(Math.min(1, t / total));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  audio?.close().catch(() => {});
  stream.getTracks().forEach((t) => t.stop());
  if (opts.signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
  const mime = recorder.mimeType || type || 'video/webm';
  return {
    blob: new Blob(chunks, { type: mime.split(';')[0] }),
    ext: mime.includes('mp4') ? 'mp4' : 'webm',
  };
}
