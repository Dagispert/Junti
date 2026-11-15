// El trazo a mano de los dibujos animados (la misma lógica que la animación
// «Rumbo a ti», en public/animacion): cualquier trazado SVG limpio se pasa a
// rotulador, con pulso, extremos que no cierran del todo y tres variantes
// para que la línea «hierva». Solo funciona en la web (mide con el DOM).

/** Azar con semilla: el mismo dibujo en cada carga. */
export function seeded(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Pt = [number, number];

let probe: SVGPathElement | null = null;
function measure(): SVGPathElement | null {
  if (typeof document === 'undefined') return null;
  if (!probe) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    svg.style.visibility = 'hidden';
    probe = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    svg.appendChild(probe);
    document.body.appendChild(svg);
  }
  return probe;
}

/** Puntos repartidos por cada subtrazado. */
function sample(d: string, step: number) {
  const m = measure();
  const subs = d.match(/M[^M]*/g) ?? [];
  return subs.map((sub) => {
    const closed = /Z\s*$/i.test(sub.trim());
    if (!m) return { pts: [] as Pt[], closed };
    m.setAttribute('d', sub);
    const L = m.getTotalLength();
    const n = Math.max(2, Math.ceil(L / step));
    const pts: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const p = m.getPointAtLength((L * i) / n);
      pts.push([p.x, p.y]);
    }
    return { pts, closed };
  });
}

/** El pulso: dos ondas lentas (la forma de la mano) + temblor fino por variante. */
function wobble(pts: Pt[], amp: number, seed: number, variant: number, boil: number): Pt[] {
  const r = seeded(seed);
  const fa = 1 / (30 + r() * 40),
    fb = 1 / (9 + r() * 8),
    pa = r() * 6.28,
    pb = r() * 6.28;
  const rv = seeded(seed * 7 + variant * 131 + 3);
  const fv = 1 / (7 + rv() * 6),
    pv = rv() * 6.28;
  let s = 0;
  return pts.map(([x, y], i) => {
    if (i) s += Math.hypot(x - pts[i - 1][0], y - pts[i - 1][1]);
    const a = pts[Math.max(0, i - 1)],
      b = pts[Math.min(pts.length - 1, i + 1)];
    let nx = -(b[1] - a[1]),
      ny = b[0] - a[0];
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl;
    ny /= nl;
    const o =
      amp * (0.65 * Math.sin(s * fa * 6.283 + pa) + 0.35 * Math.sin(s * fb * 6.283 + pb)) +
      (variant ? boil * Math.sin(s * fv * 6.283 + pv) : 0);
    return [x + nx * o, y + ny * o];
  });
}

/** Un contorno a mano nunca cierra exacto: se pasa un poco hacia fuera. */
function overlap(p: Pt[], len = 10): Pt[] {
  const out = p.slice();
  const cx = p.reduce((a, q) => a + q[0], 0) / p.length;
  const cy = p.reduce((a, q) => a + q[1], 0) / p.length;
  let s = 0;
  for (let i = 1; i < p.length && s < len; i++) {
    s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    const dx = p[i][0] - cx,
      dy = p[i][1] - cy,
      dl = Math.hypot(dx, dy) || 1;
    out.push([p[i][0] + (dx / dl) * 1.4 * (s / len), p[i][1] + (dy / dl) * 1.4 * (s / len)]);
  }
  return out;
}

const f = ([x, y]: Pt) => `${x.toFixed(1)},${y.toFixed(1)}`;

/** Curva suave por los puntos (Catmull-Rom → Bézier). */
function smooth(p: Pt[], close: boolean): string {
  if (p.length < 3) return p.length ? `M${f(p[0])}L${f(p[p.length - 1])}` : '';
  let d = `M${f(p[0])}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i],
      p1 = p[i],
      p2 = p[i + 1],
      p3 = p[i + 2] ?? p2;
    d += `C${f([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${f([
      p2[0] - (p3[0] - p1[0]) / 6,
      p2[1] - (p3[1] - p1[1]) / 6,
    ])} ${f(p2)}`;
  }
  return close ? d + 'Z' : d;
}

export type HandOpts = {
  amp?: number;
  step?: number;
  seed?: number;
  boil?: number;
  close?: boolean;
};

const cache = new Map<string, string[]>();

/** Las tres variantes a mano de un trazado (se guardan: dibujar es barato). */
export function hand(
  d: string,
  { amp = 1, step = 5, seed = 7, boil = 0.45, close = true }: HandOpts = {},
) {
  const key = `${d}|${amp}|${step}|${seed}|${boil}|${close}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const subs = sample(d, step);
  const out = [0, 1, 2].map((v) =>
    subs
      .map((sub, j) => {
        if (!sub.pts.length) return '';
        let p = wobble(sub.pts, amp, seed + j * 17, v, boil);
        if (sub.closed && close) p = overlap(p);
        return smooth(p, sub.closed && !close);
      })
      .join(''),
  );
  if (cache.size > 900) cache.clear();
  if (subs.some((s) => s.pts.length)) cache.set(key, out);
  return out;
}

// ── Formas base ──

/** El cuadrado redondeado de los iconos (superelipse). */
export function squircle(cx: number, cy: number, w: number, h: number, n = 4.6, points = 96) {
  let d = '';
  for (let i = 0; i <= points; i++) {
    const th = (i / points) * Math.PI * 2 - Math.PI * 0.75;
    const c = Math.cos(th),
      s = Math.sin(th);
    const x = cx + (w / 2) * Math.sign(c) * Math.abs(c) ** (2 / n);
    const y = cy + (h / 2) * Math.sign(s) * Math.abs(s) ** (2 / n);
    d += `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return d + 'Z';
}

export function roundRect(x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  return `M${x + r},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h - r}A${r},${r} 0 0 1 ${
    x + w - r
  },${y + h}H${x + r}A${r},${r} 0 0 1 ${x},${y + h - r}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}Z`;
}

export const ellipse = (cx: number, cy: number, rx: number, ry = rx) =>
  `M${cx - rx},${cy}A${rx},${ry} 0 1 1 ${cx + rx},${cy}A${rx},${ry} 0 1 1 ${cx - rx},${cy}Z`;

/** Nube de borde festoneado: base plana y bultos arriba. */
export function cloud(x: number, y: number, w: number) {
  const s = w / 110;
  const p = (dx: number, dy: number) => `${(x + dx * s).toFixed(1)},${(y + dy * s).toFixed(1)}`;
  return `M${p(0, 0)} L${p(110, 0)} A${14 * s},${14 * s} 0 0 0 ${p(90, -13)} A${19 * s},${19 * s} 0 0 0 ${p(
    56,
    -22,
  )} A${16 * s},${16 * s} 0 0 0 ${p(26, -12)} A${13 * s},${13 * s} 0 0 0 ${p(0, 0)} Z`;
}

/** Esqueletos de las cifras (caja 60 × 100), para trazarlas con rotulador grueso. */
export const DIGITS: Record<string, string> = {
  '0': 'M30,2 C46,2 58,22 58,50 C58,78 46,98 30,98 C14,98 2,78 2,50 C2,22 14,2 30,2 Z',
  '1': 'M12,22 L36,2 L36,98',
  '2': 'M5,26 C5,11 16,2 30,2 C45,2 55,12 55,26 C55,41 44,52 5,97 L57,97',
  '3': 'M6,14 C12,6 20,2 30,2 C44,2 53,11 53,24 C53,38 42,46 26,46 C44,46 56,56 56,71 C56,87 44,98 29,98 C17,98 8,93 3,84',
  '4': 'M42,98 L42,2 L3,68 L58,68',
  '5': 'M52,2 L13,2 L8,44 C15,39 22,37 30,37 C46,37 57,48 57,66 C57,84 45,98 29,98 C17,98 8,93 3,84',
  '6': 'M50,8 C44,3 38,2 32,2 C14,2 3,22 3,52 C3,80 14,98 31,98 C47,98 57,86 57,68 C57,50 46,39 31,39 C17,39 6,48 3,60',
  '7': 'M3,2 L57,2 L20,98',
  '8': 'M30,46 C17,46 8,37 8,24 C8,11 17,2 30,2 C43,2 52,11 52,24 C52,37 43,46 30,46 C14,46 4,57 4,72 C4,87 15,98 30,98 C45,98 56,87 56,72 C56,57 46,46 30,46 Z',
  '9': 'M10,92 C16,97 22,98 28,98 C46,98 57,78 57,48 C57,20 46,2 29,2 C13,2 3,14 3,31 C3,49 14,60 29,60 C43,60 54,51 57,40',
  ':': 'M30,30 L30.5,31 M30,72 L30.5,73',
  '+': 'M8,50 L52,50 M30,28 L30,72',
  '-': 'M10,50 L50,50',
  '°': 'M30,4 C38,4 44,10 44,18 C44,26 38,32 30,32 C22,32 16,26 16,18 C16,10 22,4 30,4 Z',
  '?': 'M10,26 C10,10 22,2 32,2 C46,2 54,12 54,24 C54,38 32,44 32,64 M32,90 L32.5,91',
};

/** Curvas y progreso. */
export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const ease = {
  out: (k: number) => 1 - (1 - k) ** 3,
  in: (k: number) => k ** 3,
  inOut: (k: number) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2),
  back: (k: number) => 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2,
  linear: (k: number) => k,
};
/** Progreso 0…1 de un tramo que empieza en «from» y dura «dur» segundos. */
export const span = (t: number, from: number, dur: number, curve = ease.out) =>
  curve(clamp((t - from) / dur));
/** Oscilación que se apaga (balanceos, rebotes). */
export const damped = (t: number, t0: number, freq = 2, brake = 4) =>
  t < t0 ? 0 : Math.exp(-brake * (t - t0)) * Math.sin(2 * Math.PI * freq * (t - t0));
