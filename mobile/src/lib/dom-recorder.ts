// Grabar una pantalla tal como se ve: en cada fotograma se copia lo que hay en
// ella a un lienzo (cajas con su color, esquinas, sombras y bordes; fotos;
// textos con su letra; el planeta, que ya es un lienzo; giros, zooms y
// fundidos tal como estén en ese instante) y el lienzo se graba como vídeo,
// con la voz. Lo marcado con data-rec="skip" (botones…) no sale.

type Ctx = CanvasRenderingContext2D;

/** Para marcar lo que no debe salir en el vídeo (botones…): {...NO_REC}. */
export const NO_REC = { dataSet: { rec: 'skip' } } as object;

const images = new Map<string, HTMLImageElement>();
/** Una imagen por su dirección (se carga una vez; mientras, no se dibuja). */
function imageFor(url: string): HTMLImageElement | null {
  let img = images.get(url);
  if (!img) {
    img = new Image();
    if (!/^(blob:|data:)/.test(url)) img.crossOrigin = 'anonymous';
    img.src = url;
    images.set(url, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}

/** Precarga (con permiso para copiar) las fotos de la pantalla antes de grabar. */
export async function preloadImages(root: HTMLElement, more: (string | undefined)[] = []) {
  const urls = [
    ...[...root.querySelectorAll('img')].map((i) => i.currentSrc || i.src),
    ...more,
  ].filter((u): u is string => !!u);
  await Promise.all(
    urls.map(
      (u) =>
        new Promise<void>((resolve) => {
          imageFor(u);
          const img = images.get(u)!;
          if (img.complete) return resolve();
          img.onload = img.onerror = () => resolve();
          setTimeout(resolve, 4000);
        }),
    ),
  );
}

const svgs = new Map<string, HTMLImageElement>();
/** Un SVG convertido en imagen (se rehace solo si cambia). */
function svgImage(el: SVGElement): HTMLImageElement | null {
  const xml = new XMLSerializer().serializeToString(el);
  let img = svgs.get(xml);
  if (!img) {
    if (svgs.size > 60) svgs.clear();
    img = new Image();
    const sized = xml.includes('xmlns=')
      ? xml
      : xml.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`;
    svgs.set(xml, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}

const px = (v: string) => parseFloat(v) || 0;

function radii(cs: CSSStyleDeclaration, w: number, h: number) {
  const r = [
    px(cs.borderTopLeftRadius),
    px(cs.borderTopRightRadius),
    px(cs.borderBottomRightRadius),
    px(cs.borderBottomLeftRadius),
  ].map((v) => Math.min(v, w / 2, h / 2));
  return r;
}

function boxPath(ctx: Ctx, w: number, h: number, r: number[]) {
  ctx.beginPath();
  ctx.moveTo(r[0], 0);
  ctx.lineTo(w - r[1], 0);
  ctx.arcTo(w, 0, w, r[1], r[1]);
  ctx.lineTo(w, h - r[2]);
  ctx.arcTo(w, h, w - r[2], h, r[2]);
  ctx.lineTo(r[3], h);
  ctx.arcTo(0, h, 0, h - r[3], r[3]);
  ctx.lineTo(0, r[0]);
  ctx.arcTo(0, 0, r[0], 0, r[0]);
  ctx.closePath();
}

/** «0px 18px 40px rgba(…)» → la primera sombra. */
function shadowOf(v: string) {
  if (!v || v === 'none') return null;
  const first = v.split(/,(?![^(]*\))/)[0].trim();
  const color = first.match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}/i)?.[0] ?? 'rgba(0,0,0,0.2)';
  const nums = first.replace(color, '').trim().split(/\s+/).map(px);
  if (first.includes('inset')) return null;
  return { x: nums[0] ?? 0, y: nums[1] ?? 0, blur: nums[2] ?? 0, color };
}

/** linear-gradient(180deg, a 0%, b 100%) → un degradado del lienzo. */
function gradientOf(ctx: Ctx, v: string, w: number, h: number) {
  const m = v.match(/linear-gradient\((.*)\)$/);
  if (!m) return null;
  const parts = m[1].split(/,(?![^(]*\))/).map((s) => s.trim());
  let angle = 180;
  if (/deg$/.test(parts[0])) angle = parseFloat(parts.shift()!);
  else if (/^to /.test(parts[0])) {
    const dir = parts.shift()!;
    angle = dir.includes('right') ? 90 : dir.includes('left') ? 270 : dir.includes('top') ? 0 : 180;
  }
  const rad = ((angle - 90) * Math.PI) / 180;
  const len = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
  const cx = w / 2;
  const cy = h / 2;
  const g = ctx.createLinearGradient(
    cx - (Math.cos(rad) * len) / 2,
    cy - (Math.sin(rad) * len) / 2,
    cx + (Math.cos(rad) * len) / 2,
    cy + (Math.sin(rad) * len) / 2,
  );
  parts.forEach((p, i) => {
    const color = p.match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}|[a-z]+/i)?.[0] ?? 'transparent';
    const at = p.match(/([\d.]+)%/);
    const stop = at ? parseFloat(at[1]) / 100 : parts.length > 1 ? i / (parts.length - 1) : 0;
    try {
      g.addColorStop(Math.max(0, Math.min(1, stop)), color);
    } catch {
      // color que el lienzo no entiende
    }
  });
  return g;
}

/** Dibuja una imagen en su caja según object-fit (cover por defecto). */
function drawFit(
  ctx: Ctx,
  img: CanvasImageSource,
  iw: number,
  ih: number,
  w: number,
  h: number,
  fit: string,
) {
  if (!iw || !ih) return;
  if (fit === 'fill') return ctx.drawImage(img, 0, 0, w, h);
  const s = fit === 'contain' ? Math.min(w / iw, h / ih) : Math.max(w / iw, h / ih);
  const dw = iw * s;
  const dh = ih * s;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

const fontOf = (cs: CSSStyleDeclaration) =>
  `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;

/** Texto (con sus trozos de distinto estilo) repartido en líneas como en la pantalla. */
function drawText(ctx: Ctx, el: HTMLElement, cs: CSSStyleDeclaration, w: number) {
  type Run = { text: string; cs: CSSStyleDeclaration };
  const runs: Run[] = [];
  const walk = (node: Node, style: CSSStyleDeclaration) => {
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) runs.push({ text: n.textContent ?? '', cs: style });
      else if (n instanceof HTMLElement && isInline(n)) walk(n, getComputedStyle(n));
    });
  };
  walk(el, cs);
  if (!runs.some((r) => r.text.trim())) return;
  const size = px(cs.fontSize) || 16;
  const lh = cs.lineHeight === 'normal' ? size * 1.2 : px(cs.lineHeight);
  // Palabras con su estilo, y líneas que caben en el ancho.
  type Word = { text: string; cs: CSSStyleDeclaration; width: number };
  const lines: Word[][] = [[]];
  let lineW = 0;
  for (const r of runs) {
    ctx.font = fontOf(r.cs);
    for (const piece of r.text.split(/(\s+)/)) {
      if (!piece) continue;
      if (/\n/.test(piece)) {
        lines.push([]);
        lineW = 0;
        continue;
      }
      const width = ctx.measureText(piece).width;
      if (lineW + width > w + 0.5 && lineW > 0 && piece.trim()) {
        lines.push([]);
        lineW = 0;
      }
      if (!piece.trim() && lineW === 0) continue;
      lines[lines.length - 1].push({ text: piece, cs: r.cs, width });
      lineW += width;
    }
  }
  const align = cs.textAlign;
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => {
    while (line.length && !line[line.length - 1].text.trim()) line.pop();
    const total = line.reduce((s, x) => s + x.width, 0);
    let x =
      align === 'center' ? (w - total) / 2 : align === 'right' || align === 'end' ? w - total : 0;
    const y = i * lh + lh / 2 + px(cs.paddingTop);
    for (const word of line) {
      ctx.font = fontOf(word.cs);
      ctx.fillStyle = word.cs.color;
      const sh = word.cs.textShadow && word.cs.textShadow !== 'none' ? word.cs.textShadow : '';
      if (sh) {
        const m = shadowOf(sh);
        if (m) {
          ctx.shadowColor = m.color;
          ctx.shadowBlur = m.blur;
          ctx.shadowOffsetX = m.x;
          ctx.shadowOffsetY = m.y;
        }
      }
      ctx.fillText(word.text, x + px(cs.paddingLeft), y);
      ctx.shadowColor = 'transparent';
      x += word.width;
    }
  });
}

const isInline = (n: HTMLElement) =>
  n.tagName === 'SPAN' && getComputedStyle(n).display.startsWith('inline');

/** Dónde está «child» respecto a «parent» (sin contar los giros y zooms). */
function offsetWithin(child: HTMLElement, parent: HTMLElement): [number, number] {
  if (child.offsetParent === parent) return [child.offsetLeft, child.offsetTop];
  if (child.offsetParent === parent.offsetParent)
    return [child.offsetLeft - parent.offsetLeft, child.offsetTop - parent.offsetTop];
  const a = child.getBoundingClientRect();
  const b = parent.getBoundingClientRect();
  return [a.left - b.left, a.top - b.top];
}

function drawNode(ctx: Ctx, el: Element, alpha: number) {
  if (!(el instanceof HTMLElement) && !(el instanceof SVGElement)) return;
  if ((el as HTMLElement).dataset?.rec === 'skip') return;
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden') return;
  const op = alpha * (parseFloat(cs.opacity) || 0);
  if (op <= 0.005) return;

  if (el instanceof SVGElement) {
    if (el.tagName.toLowerCase() !== 'svg') return;
    const r = el.getBoundingClientRect();
    const img = svgImage(el);
    if (img) {
      ctx.globalAlpha = op;
      ctx.drawImage(img, 0, 0, r.width, r.height);
    }
    return;
  }

  const w = el.offsetWidth;
  const h = el.offsetHeight;
  ctx.save();
  // Su propio giro / zoom / desplazamiento, alrededor de su punto de origen.
  if (cs.transform && cs.transform !== 'none') {
    const [ox, oy] = cs.transformOrigin.split(' ').map(px);
    const m = new DOMMatrix(cs.transform);
    ctx.translate(ox, oy);
    ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
    ctx.translate(-ox, -oy);
  }
  ctx.globalAlpha = op;
  const r = radii(cs, w, h);
  const bg = cs.backgroundColor;
  const hasBg = bg && bg !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(bg);
  const shadow = shadowOf(cs.boxShadow);
  if (hasBg || cs.backgroundImage !== 'none') {
    if (shadow && hasBg) {
      ctx.shadowColor = shadow.color;
      ctx.shadowBlur = shadow.blur;
      ctx.shadowOffsetX = shadow.x;
      ctx.shadowOffsetY = shadow.y;
    }
    boxPath(ctx, w, h, r);
    if (hasBg) {
      ctx.fillStyle = bg;
      ctx.fill();
    }
    ctx.shadowColor = 'transparent';
    if (cs.backgroundImage.includes('linear-gradient')) {
      const g = gradientOf(ctx, cs.backgroundImage, w, h);
      if (g) {
        ctx.fillStyle = g;
        ctx.fill();
      }
    } else {
      const url = cs.backgroundImage.match(/url\("?([^")]+)"?\)/)?.[1];
      const img = url ? imageFor(url) : null;
      if (img) {
        ctx.save();
        ctx.clip();
        drawFit(
          ctx,
          img,
          img.naturalWidth,
          img.naturalHeight,
          w,
          h,
          cs.backgroundSize === 'contain' ? 'contain' : 'cover',
        );
        ctx.restore();
      }
    }
  }
  const bw = px(cs.borderTopWidth);
  if (
    bw > 0 &&
    cs.borderTopStyle !== 'none' &&
    cs.borderTopColor &&
    !/rgba\([^)]*,\s*0\)$/.test(cs.borderTopColor)
  ) {
    ctx.save();
    ctx.lineWidth = bw;
    ctx.strokeStyle = cs.borderTopColor;
    if (cs.borderTopStyle === 'dashed') ctx.setLineDash([bw * 3, bw * 2]);
    ctx.translate(bw / 2, bw / 2);
    boxPath(
      ctx,
      w - bw,
      h - bw,
      r.map((x) => Math.max(0, x - bw / 2)),
    );
    ctx.stroke();
    ctx.restore();
  }

  const tag = el.tagName;
  if (tag === 'IMG') {
    // La misma foto, pedida con permiso para copiarla (si no, el navegador
    // bloquearía el vídeo entero).
    const src = (el as HTMLImageElement).currentSrc || (el as HTMLImageElement).src;
    const img = src ? imageFor(src) : null;
    if (img) {
      ctx.save();
      boxPath(ctx, w, h, r);
      ctx.clip();
      try {
        drawFit(ctx, img, img.naturalWidth, img.naturalHeight, w, h, cs.objectFit);
      } catch {
        // imagen sin permiso para copiarse
      }
      ctx.restore();
    }
  } else if (tag === 'CANVAS') {
    try {
      ctx.drawImage(el as HTMLCanvasElement, 0, 0, w, h);
    } catch {
      // lienzo sin permiso
    }
  } else if (tag === 'VIDEO') {
    const v = el as HTMLVideoElement;
    // Solo vídeos locales (los del almacén se ven por su portada).
    const local = /^(blob:|data:)/.test(v.currentSrc) || v.crossOrigin === 'anonymous';
    if (v.videoWidth && local) {
      ctx.save();
      boxPath(ctx, w, h, r);
      ctx.clip();
      drawFit(ctx, v, v.videoWidth, v.videoHeight, w, h, cs.objectFit);
      ctx.restore();
    }
  }

  // Texto propio (el de sus trozos en línea va con él).
  if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim())) {
    drawText(ctx, el, cs, w - px(cs.paddingLeft) - px(cs.paddingRight));
  }

  // Lo de dentro, recortado si no deja salir nada.
  const clip = cs.overflow === 'hidden' || cs.overflowX === 'hidden' || cs.overflow === 'clip';
  if (clip) {
    boxPath(ctx, w, h, r);
    ctx.clip();
  }
  if (el.scrollLeft || el.scrollTop) ctx.translate(-el.scrollLeft, -el.scrollTop);
  for (const child of el.children) {
    if (child instanceof HTMLElement && isInline(child)) continue;
    ctx.save();
    if (child instanceof HTMLElement) {
      const [x, y] = offsetWithin(child, el);
      ctx.translate(x, y);
    } else {
      const a = child.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      ctx.translate(a.left - b.left, a.top - b.top);
    }
    drawNode(ctx, child, op);
    ctx.restore();
  }
  ctx.restore();
}

const VIDEO_TYPES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm',
];

let tested: string | null = null;
let testing: Promise<string> | null = null;

/**
 * Qué formato graba de verdad este navegador (algunos dicen que sí a uno y
 * luego no entregan nada): una prueba de un instante con un lienzo diminuto.
 * Conviene llamarlo al abrir la pantalla, para tenerlo listo al exportar.
 */
export function prepareRecording(): Promise<string> {
  if (tested !== null) return Promise.resolve(tested);
  if (testing) return testing;
  testing = (async () => {
    if (!canRecordScreen()) return (tested = '');
    for (const type of VIDEO_TYPES.filter((t) => MediaRecorder.isTypeSupported(t))) {
      const ok = await new Promise<boolean>((resolve) => {
        try {
          const c = document.createElement('canvas');
          c.width = c.height = 16;
          const g = c.getContext('2d')!;
          const st = c.captureStream(15);
          const r = new MediaRecorder(st, { mimeType: type });
          let size = 0;
          r.ondataavailable = (e) => (size += e.data.size);
          r.onstop = () => resolve(size > 0);
          let n = 0;
          const draw = () => {
            g.fillStyle = n++ % 2 ? '#000' : '#fff';
            g.fillRect(0, 0, 16, 16);
            if (r.state === 'recording') requestAnimationFrame(draw);
          };
          r.start();
          draw();
          setTimeout(() => r.state !== 'inactive' && r.stop(), 600);
        } catch {
          resolve(false);
        }
      });
      if (ok) return (tested = type);
    }
    return (tested = '');
  })();
  return testing;
}

export const canRecordScreen = () =>
  typeof document !== 'undefined' &&
  typeof MediaRecorder !== 'undefined' &&
  typeof HTMLCanvasElement !== 'undefined' &&
  typeof HTMLCanvasElement.prototype.captureStream === 'function';

/**
 * Empieza a grabar «root» tal como se ve, con el sonido de «audio» si se da.
 * Devuelve cómo pararlo (y quedarse con el vídeo) o cancelarlo.
 */
export function recordScreen(
  root: HTMLElement,
  { width = 1080, audio }: { width?: number; audio?: MediaStream | null } = {},
) {
  const rect = root.getBoundingClientRect();
  const scale = width / rect.width;
  const W = Math.round(rect.width * scale);
  const H = Math.round((rect.height * scale) / 2) * 2;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const stream = canvas.captureStream(30);
  audio?.getAudioTracks().forEach((t) => stream.addTrack(t));
  const type = tested ?? VIDEO_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
  const recorder = new MediaRecorder(stream, {
    ...(type ? { mimeType: type } : {}),
    videoBitsPerSecond: 8_000_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  let running = true;
  let warned = false;
  let frames = 0;
  const frame = () => {
    if (!running) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = getComputedStyle(root).backgroundColor || '#FFFFFF';
    ctx.fillRect(0, 0, W, H);
    ctx.scale(scale, scale);
    try {
      drawNode(ctx, root, 1);
    } catch (error) {
      // un fotograma que no se pudo copiar entero: se sigue con el siguiente
      if (!warned) console.warn('junti-rec', error);
      warned = true;
    }
    frames += 1;
    if (frames === 30) {
      try {
        ctx.getImageData(0, 0, 1, 1);
      } catch {
        console.warn('junti-rec', 'el lienzo quedó bloqueado por una imagen sin permiso');
      }
    }
    requestAnimationFrame(frame);
  };
  recorder.start(1000);
  requestAnimationFrame(frame);
  const finish = () =>
    new Promise<Blob>((resolve) => {
      running = false;
      recorder.onstop = () => {
        console.info('junti-rec', { frames, chunks: chunks.length, type: recorder.mimeType });
        stream.getVideoTracks().forEach((t) => t.stop());
        const mime = (recorder.mimeType || type || 'video/webm').split(';')[0];
        resolve(new Blob(chunks, { type: mime }));
      };
      if (recorder.state !== 'inactive') recorder.stop();
    });
  return {
    stop: finish,
    cancel: () => {
      running = false;
      if (recorder.state !== 'inactive') recorder.stop();
    },
  };
}
