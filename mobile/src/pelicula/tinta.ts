// El taller de la película: crear SVG, trazar a mano con hervor, revelar
// trazos, transformar. Es imperativo (como la animación «Rumbo a ti»): se
// construye una vez y en cada fotograma solo se cambian atributos.

import { clamp, hand, type HandOpts } from '@/lib/doodle-ink';

export const NS = 'http://www.w3.org/2000/svg';

export function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | null | undefined> = {},
  parent?: Element,
): SVGElementTagNameMap[K] {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, String(v));
  parent?.appendChild(n);
  return n;
}

let counter = 0;
export const uid = (p = 'p') => `${p}${++counter}`;

/** Un taller por película: guarda los trazos que hierven. */
export class Taller {
  private boiling: { node: SVGPathElement; variants: string[]; last?: string }[] = [];
  private seed = 11;

  nextSeed() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed + 1;
  }

  /** Un trazo a mano. Devuelve el <path> (o un <g> si es doble). */
  tinta(
    parent: Element,
    d: string,
    o: {
      color?: string;
      width?: number;
      fill?: string;
      double?: boolean;
      opacity?: number;
      dash?: string;
      cap?: 'round' | 'butt';
    } & HandOpts = {},
  ): SVGPathElement | SVGGElement {
    const { color = 'currentColor', width = 2, fill = 'none', double, opacity, dash, cap = 'round', ...h } = o;
    const seed = h.seed ?? this.nextSeed();
    const g = double ? el('g', { opacity }, parent) : null;
    const p = el(
      'path',
      {
        fill,
        stroke: width ? color : 'none',
        'stroke-width': width || null,
        'stroke-linecap': cap,
        'stroke-linejoin': 'round',
        'stroke-dasharray': dash,
        opacity: double ? null : opacity,
      },
      g ?? parent,
    );
    this.register(p, hand(d, { ...h, seed }));
    if (g) {
      const p2 = el('path', { fill: 'none', stroke: color, 'stroke-width': width * 0.55, 'stroke-linecap': 'round', opacity: 0.85 }, g);
      this.register(p2, hand(d, { ...h, seed: seed + 999, amp: (h.amp ?? 1) * 1.5 + 0.5 }));
    }
    return g ?? p;
  }

  private register(node: SVGPathElement, variants: string[]) {
    node.setAttribute('d', variants[0] ?? '');
    this.boiling.push({ node, variants });
  }

  /** Cambia de variante (8 veces por segundo); solo lo que se ve. */
  private lastFrame = -1;
  hervir(t: number) {
    const f = Math.floor(Math.max(0, t) * 8) % 3;
    // Solo 8 veces por segundo: entre medias no cambia nada.
    if (f === this.lastFrame) return;
    this.lastFrame = f;
    for (const b of this.boiling) {
      const d = b.variants[f];
      if (d && b.last !== d && b.node.isConnected && visible(b.node)) {
        b.node.setAttribute('d', d);
        b.last = d;
      }
    }
  }
}

/** Visible si ningún antepasado está oculto (display:none). */
function visible(n: Element): boolean {
  for (let x: Element | null = n; x && x.tagName !== 'svg'; x = x.parentElement)
    if ((x as SVGElement).style?.display === 'none') return false;
  return true;
}

/** Muestra la parte k (0…1) de los trazos, como si se dibujaran. */
export function revelar(node: Element, k: number) {
  const paths = node.tagName === 'path' ? [node as SVGPathElement] : [...node.querySelectorAll('path')];
  for (const p of paths) {
    if (p.getAttribute('stroke-dasharray')) continue; // los discontinuos se revelan con máscara
    if (!p.hasAttribute('pathLength')) p.setAttribute('pathLength', '1');
    if (k >= 0.999) {
      p.style.strokeDasharray = 'none';
      p.style.visibility = '';
    } else {
      p.style.strokeDasharray = '1 2';
      p.style.strokeDashoffset = String(1 - k);
      p.style.visibility = k <= 0.001 ? 'hidden' : '';
    }
  }
}

export type Pose = { x?: number; y?: number; s?: number; sx?: number; sy?: number; r?: number; ox?: number; oy?: number; ky?: number };

/** Mueve/escala/gira alrededor de un origen. */
export function mover(n: Element, { x = 0, y = 0, s = 1, sx = s, sy = s, r = 0, ox = 0, oy = 0, ky = 0 }: Pose = {}) {
  n.setAttribute(
    'transform',
    `translate(${(x + ox).toFixed(2)},${(y + oy).toFixed(2)}) rotate(${r.toFixed(2)}) matrix(1,${ky.toFixed(4)},0,1,0,0) scale(${sx.toFixed(4)},${sy.toFixed(4)}) translate(${-ox},${-oy})`,
  );
}

export const ver = (n: Element, on: boolean) => {
  (n as SVGElement).style.display = on ? '' : 'none';
};
export const opacidad = (n: Element, v: number) => {
  (n as SVGElement).style.opacity = String(clamp(v));
};

/** Volteo sobre una bisagra horizontal (hojas de calendario, fotos). */
export function voltearY(n: Element, ang: number, hingeY: number, cx: number, persp = 0.12) {
  const c = Math.cos(ang), s = Math.sin(ang);
  mover(n, { ox: cx, oy: hingeY, sy: Math.abs(c) < 0.02 ? 0.02 * Math.sign(c || 1) : c, sx: 1 + s * persp });
  return c >= 0;
}

/** Volteo sobre una bisagra vertical (la tapa de la libreta). */
export function voltearX(n: Element, ang: number, hingeX: number, cy: number, persp = 0.16) {
  const c = Math.cos(ang), s = Math.sin(ang);
  mover(n, { ox: hingeX, oy: cy, sx: Math.abs(c) < 0.02 ? 0.02 * Math.sign(c || 1) : c, sy: 1 + s * 0.1, ky: -s * persp * Math.sign(c || 1) });
  return c >= 0;
}

/** Texto (con la letra manuscrita de la app o la de palo seco). */
export function texto(
  parent: Element,
  s: string,
  o: { x: number; y: number; size?: number; hand?: boolean; weight?: number; color?: string; anchor?: 'start' | 'middle' | 'end'; spacing?: number },
) {
  const t = el(
    'text',
    {
      x: o.x,
      y: o.y,
      'font-size': o.size ?? 24,
      'font-family': o.hand === false ? 'system-ui, -apple-system, sans-serif' : 'Caveat_600SemiBold, Caveat, cursive',
      'font-weight': o.weight,
      fill: o.color ?? 'currentColor',
      'text-anchor': o.anchor ?? 'middle',
      'letter-spacing': o.spacing,
    },
    parent,
  );
  t.textContent = s;
  return t;
}

/** Parte un texto en líneas de como mucho «max» caracteres. */
export function lineas(s: string, max: number, maxLines = 8): string[] {
  const out: string[] = [];
  let cur = '';
  for (const w of s.split(/\s+/)) {
    if ((cur + ' ' + w).trim().length > max && cur) {
      out.push(cur);
      cur = w;
    } else cur = (cur + ' ' + w).trim();
  }
  if (cur) out.push(cur);
  if (out.length > maxLines) {
    const cut = out.slice(0, maxLines);
    cut[maxLines - 1] = cut[maxLines - 1].replace(/\s*\S*$/, '') + '…';
    return cut;
  }
  return out;
}
