// ─────────────────────────────────────────────────────────────────────────────
// TRAZO A MANO
// Convierte cualquier trazado SVG «limpio» (escrito a mano en las
// ilustraciones) en una línea de rotulador: con temblor de pulso, extremos
// que no cierran del todo y tres variantes para el «hervor» (line boil) que
// hace que el dibujo respire, como en la referencia.
// ─────────────────────────────────────────────────────────────────────────────

import { COLOR, MOSAICO } from '../config.js';

const NS = 'http://www.w3.org/2000/svg';

/** Crea un elemento SVG con sus atributos (los null se ignoran). */
export function el(tag, attrs = {}, padre) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, String(v));
  if (padre) padre.appendChild(n);
  return n;
}

let contadorId = 0;
export const uid = (p = 'u') => `${p}${++contadorId}`;

/** Azar con semilla (mulberry32): el mismo dibujo en cada carga. */
export function azar(semilla) {
  let a = semilla >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let semillaGlobal = 7;
export const nuevaSemilla = () => (semillaGlobal = (semillaGlobal * 9301 + 49297) % 233280) + 1;

// Un <path> oculto para medir trazados (getPointAtLength).
let medidor;
function medir() {
  if (!medidor) {
    const s = el('svg', { width: 0, height: 0, style: 'position:absolute;visibility:hidden' }, document.body);
    medidor = el('path', {}, s);
  }
  return medidor;
}

/** Puntos repartidos a lo largo de cada subtrazado (cada «M»). */
export function muestrear(d, paso = 6) {
  const subs = d.match(/M[^M]*/g) || [];
  const m = medir();
  return subs.map((sub) => {
    m.setAttribute('d', sub);
    const L = m.getTotalLength();
    const n = Math.max(2, Math.ceil(L / paso));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const p = m.getPointAtLength((L * i) / n);
      pts.push([p.x, p.y]);
    }
    return { pts, cerrado: /Z\s*$/i.test(sub.trim()), L };
  });
}

/**
 * El temblor del pulso: un desvío suave (dos ondas lentas, la forma de la
 * mano) más un temblor fino que cambia en cada variante (el hervor).
 */
function temblar({ pts }, { amp, semilla, variante, hervor }) {
  const r = azar(semilla);
  const fa = 1 / (30 + r() * 40), fb = 1 / (9 + r() * 8), pa = r() * 6.28, pb = r() * 6.28;
  const rv = azar(semilla * 7 + variante * 131 + 3);
  const fv = 1 / (7 + rv() * 6), pv = rv() * 6.28;
  let s = 0;
  return pts.map(([x, y], i) => {
    if (i) s += Math.hypot(x - pts[i - 1][0], y - pts[i - 1][1]);
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl;
    ny /= nl;
    const o =
      amp * (0.65 * Math.sin(s * fa * 6.283 + pa) + 0.35 * Math.sin(s * fb * 6.283 + pb)) +
      (variante ? hervor * Math.sin(s * fv * 6.283 + pv) : 0);
    return [x + nx * o, y + ny * o];
  });
}

/** Un trazo cerrado a mano nunca cierra exacto: se pasa un poco. */
function solapar(p, cuanto = 14) {
  const out = p.slice();
  let s = 0;
  for (let i = 1; i < p.length && s < cuanto; i++) {
    s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    const k = s / cuanto;
    // se separa hacia fuera, cada vez más
    const cx = p.reduce((a, q) => a + q[0], 0) / p.length;
    const cy = p.reduce((a, q) => a + q[1], 0) / p.length;
    const dx = p[i][0] - cx, dy = p[i][1] - cy, dl = Math.hypot(dx, dy) || 1;
    out.push([p[i][0] + (dx / dl) * 1.8 * k, p[i][1] + (dy / dl) * 1.8 * k]);
  }
  return out;
}

const f = ([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`;

/** Curva suave por los puntos (Catmull-Rom → Bézier). */
export function suave(p, cerrar = false) {
  if (p.length < 3) return `M${f(p[0])}L${f(p[1] || p[0])}`;
  let d = `M${f(p[0])}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1)} ${f(c2)} ${f(p2)}`;
  }
  return cerrar ? d + 'Z' : d;
}

/** Las tres variantes a mano de un trazado. */
export function mano(forma, { amp = 1.2, paso = 6, semilla = nuevaSemilla(), hervor = 0.5, cierre = true } = {}) {
  const trazos = muestrear(forma, paso);
  return [0, 1, 2].map((v) =>
    trazos
      .map((tz, j) => {
        let p = temblar(tz, { amp, semilla: semilla + j * 17, variante: v, hervor });
        if (tz.cerrado && cierre) p = solapar(p);
        return suave(p, tz.cerrado && !cierre);
      })
      .join(''),
  );
}

// ── Hervor (line boil) ──────────────────────────────────────────────────────
// Cada trazo registrado cambia de variante unas 8 veces por segundo. Solo se
// tocan los de las escenas visibles.
const HERVOR = [];
let escenaActual = null;
export function enEscena(id, fn) {
  const previa = escenaActual;
  escenaActual = id;
  try {
    return fn();
  } finally {
    escenaActual = previa;
  }
}
export function registrar(nodo, variantes) {
  HERVOR.push({ nodo, variantes, escena: escenaActual, ultimo: null });
  nodo.setAttribute('d', variantes[0]);
}
export function hervir(cuadro, esVisible) {
  for (const h of HERVOR) {
    if (h.escena && !esVisible(h.escena)) continue;
    const d = h.variantes[cuadro % 3];
    if (h.ultimo !== d) {
      h.nodo.setAttribute('d', d);
      h.ultimo = d;
    }
  }
}

/**
 * Dibuja un trazado con tinta.
 * - doble: segunda pasada más fina y desplazada (el boceto de la referencia)
 * - relleno: color de relleno (el trazado se cierra solo)
 */
export function tinta(padre, forma, o = {}) {
  const {
    color = COLOR.crema,
    ancho = 2.2,
    relleno = 'none',
    doble = false,
    opacidad,
    clase,
    extremo = 'round',
    discontinuo,
    ...m
  } = o;
  const semilla = m.semilla ?? nuevaSemilla();
  const g = doble ? el('g', { class: clase, opacity: opacidad }, padre) : null;
  const base = el(
    'path',
    {
      fill: relleno,
      stroke: ancho ? color : 'none',
      'stroke-width': ancho || null,
      'stroke-linecap': extremo,
      'stroke-linejoin': 'round',
      'stroke-dasharray': discontinuo,
      class: doble ? null : clase,
      opacity: doble ? null : opacidad,
    },
    g || padre,
  );
  registrar(base, mano(forma, { ...m, semilla }));
  if (doble) {
    const otra = el(
      'path',
      { fill: 'none', stroke: color, 'stroke-width': ancho * 0.55, 'stroke-linecap': 'round', opacity: 0.85 },
      g,
    );
    registrar(otra, mano(forma, { ...m, semilla: semilla + 999, amp: (m.amp ?? 1.2) * 1.5 + 0.6 }));
  }
  return g || base;
}

// ── Formas base (trazados limpios que luego se pasan a mano) ─────────────────

/** Superelipse: el cuadrado redondeado de los iconos. */
export function superelipse(cx, cy, w, h, n = MOSAICO.n, puntos = 120) {
  const a = w / 2, b = h / 2;
  let d = '';
  for (let i = 0; i <= puntos; i++) {
    const th = (i / puntos) * Math.PI * 2 - Math.PI * 0.75; // empieza arriba a la izquierda
    const c = Math.cos(th), s = Math.sin(th);
    const x = cx + a * Math.sign(c) * Math.abs(c) ** (2 / n);
    const y = cy + b * Math.sign(s) * Math.abs(s) ** (2 / n);
    d += `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return d + 'Z';
}

/** El mosaico central (con margen hacia dentro). */
export const formaMosaico = (dentro = 0, dx = 0, dy = 0) =>
  superelipse(MOSAICO.cx + dx, MOSAICO.cy + dy, MOSAICO.lado - 2 * dentro, MOSAICO.lado - 2 * dentro);

/** Rectángulo de esquinas redondas. */
export function rectRedondo(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  return `M${x + r},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h - r}A${r},${r} 0 0 1 ${
    x + w - r
  },${y + h}H${x + r}A${r},${r} 0 0 1 ${x},${y + h - r}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}Z`;
}

/** Círculo / elipse como trazado. */
export const elipse = (cx, cy, rx, ry = rx) =>
  `M${cx - rx},${cy}A${rx},${ry} 0 1 1 ${cx + rx},${cy}A${rx},${ry} 0 1 1 ${cx - rx},${cy}Z`;

/** Motas y rasguños del papel (la textura de la libreta). */
export function motas(x, y, w, h, n, semilla = 3) {
  const r = azar(semilla);
  let d = '';
  for (let i = 0; i < n; i++) {
    const px = x + r() * w, py = y + r() * h, l = 1.5 + r() * 5, a = r() * Math.PI;
    d += `M${px.toFixed(1)},${py.toFixed(1)}l${(Math.cos(a) * l).toFixed(1)},${(Math.sin(a) * l).toFixed(1)}`;
  }
  return d;
}

// ── Revelado por trazo (stroke-dasharray / dashoffset) ──────────────────────

/** Muestra la parte k (0…1) de los trazos de un nodo, como si se dibujaran. */
export function revelar(nodo, k) {
  const paths = nodo.tagName === 'path' ? [nodo] : nodo.querySelectorAll('path');
  for (const p of paths) {
    if (!p.hasAttribute('pathLength')) p.setAttribute('pathLength', '1');
    if (k >= 0.999) {
      p.style.strokeDasharray = p.getAttribute('stroke-dasharray') ? '' : 'none';
      p.style.strokeDashoffset = '';
      p.style.visibility = '';
    } else {
      p.style.strokeDasharray = '1 2';
      p.style.strokeDashoffset = String(1 - k);
      p.style.visibility = k <= 0.001 ? 'hidden' : '';
    }
  }
}
