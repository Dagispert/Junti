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

const base =
  typeof window !== 'undefined' && window.location?.pathname.startsWith('/Junti') ? '/Junti' : '';

/** La firma: el logo de Junti y su nombre, abajo a la derecha. */
async function watermark(ctx: CanvasRenderingContext2D, w: number, h: number, size = 40) {
  // El SVG va como imagen normal (no todos los navegadores lo convierten de otra forma).
  const logo = await new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    fetch(`${base}/logo.svg`)
      .then((r) => r.text())
      .then((svg) => (img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`))
      .catch(() => resolve(null));
  });
  ctx.save();
  ctx.font = `700 ${size}px ${SANS}`;
  ctx.fillStyle = 'rgba(31,33,36,0.8)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const y = h - 44 - size / 2;
  ctx.fillText('Junti', w - 48, y);
  const tw = ctx.measureText('Junti').width;
  if (logo) ctx.drawImage(logo, w - 48 - tw - size * 1.35, y - size * 0.6, size * 1.2, size * 1.2);
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

/**
 * Una foto con su nota, lista para redes: 1080 × 1350 (publicación) o, con
 * los comentarios, 1080 × 1920 (para stories), con ellos debajo.
 */
export async function renderMomentImage(m: {
  image?: string;
  note?: string;
  stickers: string[];
  footer: string;
  comments?: { name: string; text: string; color: string }[];
}): Promise<Blob> {
  await ensureFonts();
  const W = 1080;
  const withComments = !!m.comments?.length;
  // Con comentarios, la imagen crece lo justo para ellos (como mucho, formato story).
  let commentsH = 0;
  if (withComments) {
    const probe = document.createElement('canvas').getContext('2d')!;
    probe.font = `600 36px ${SANS}`;
    for (const c of m.comments!.slice(0, 5)) {
      const h = wrap(probe, `${c.name}  ${c.text}`, W - 220).slice(0, 3).length * 46 + 34 + 18;
      if (1260 + commentsH + h > 1920 - 150) break;
      commentsH += h;
    }
  }
  const H = withComments ? Math.min(1920, Math.max(1350, 1260 + commentsH + 130)) : 1350;
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
  if (withComments) {
    // Los comentarios, como en la app: nombre en negrita y su texto.
    let y = 1260;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    for (const c of m.comments!.slice(0, 5)) {
      ctx.font = `600 36px ${SANS}`;
      const lines = wrap(ctx, `${c.name}  ${c.text}`, W - 220).slice(0, 3);
      const boxH = lines.length * 46 + 34;
      if (y + boxH > H - 100) break;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      roundRect(ctx, 60, y, W - 120, boxH, 26);
      ctx.fill();
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.arc(100, y + boxH / 2, 18, 0, Math.PI * 2);
      ctx.fill();
      lines.forEach((l, i) => {
        const yy = y + 50 + i * 46;
        if (i === 0) {
          ctx.fillStyle = INK;
          ctx.font = `700 36px ${SANS}`;
          ctx.fillText(c.name, 136, yy);
          const nw = ctx.measureText(`${c.name}  `).width;
          ctx.fillStyle = '#4A4E55';
          ctx.font = `400 36px ${SANS}`;
          ctx.fillText(l.slice(c.name.length).trim(), 136 + nw, yy);
        } else {
          ctx.fillStyle = '#4A4E55';
          ctx.font = `400 36px ${SANS}`;
          ctx.fillText(l, 136, yy);
        }
      });
      y += boxH + 18;
    }
  }
  ctx.fillStyle = '#5A6168';
  ctx.font = `500 34px ${SANS}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(m.footer, 60, H - 48, W - 460);
  await watermark(ctx, W, H, 40);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('sin imagen'))), 'image/jpeg', 0.92),
  );
}
