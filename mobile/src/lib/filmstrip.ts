// La cinta de película dibujada como una tira de verdad: sigue un camino
// (recto para la lengüeta, en zigzag para la cinta abierta), tiene su punta
// recortada (la lengüeta de los carretes: media altura, con la curva del
// corte), el centro ámbar translúcido y las perforaciones cuadradas. Las
// perforaciones van siempre al mismo paso medido por su propio borde (en las
// vueltas también), contadas desde la punta: se mueven con la cinta.

export type TrackPt = { x: number; y: number; nx: number; ny: number };
export type Track = (q: number) => TrackPt;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const r = (v: number) => v.toFixed(1);

export const HOLE_STEP = 13;

/**
 * Los trazados de la cinta entre «from» y «to» (distancias por el camino; la
 * punta está en «to»). h: alto de la cinta. tab: largo de la lengüeta.
 */
export function filmPaths(track: Track, from: number, to: number, h: number, tab: number) {
  if (to - from < 1) return { body: '', amber: '', holes: '' };
  const half = h / 2;
  const curve = h * 0.55;
  // borde de arriba: en la lengüeta baja a media altura con una curva suave
  const topW = (q: number) => half - smooth(to - tab - curve, to - tab, q) * (half + h * 0.02);
  const step = 4;
  const qs: number[] = [];
  for (let q = from; q < to; q += step) qs.push(q);
  qs.push(to);
  const pts = qs.map(track);

  const up: string[] = [];
  const down: string[] = [];
  qs.forEach((q, i) => {
    const p = pts[i];
    const a = topW(q);
    up.push(`${r(p.x + p.nx * a)},${r(p.y + p.ny * a)}`);
    down.push(`${r(p.x - p.nx * half)},${r(p.y - p.ny * half)}`);
  });
  const body = `M${up.join('L')}L${down.reverse().join('L')}Z`;

  // el centro ámbar (no llega a la lengüeta)
  let amber = '';
  const amberEnd = to - tab - curve;
  if (amberEnd > from + 4) {
    const w = half - 15;
    const au: string[] = [];
    const ad: string[] = [];
    qs.forEach((q, i) => {
      if (q > amberEnd) return;
      const p = pts[i];
      au.push(`${r(p.x + p.nx * w)},${r(p.y + p.ny * w)}`);
      ad.push(`${r(p.x - p.nx * w)},${r(p.y - p.ny * w)}`);
    });
    if (au.length > 1) amber = `M${au.join('L')}L${ad.reverse().join('L')}Z`;
  }

  // perforaciones: por cada borde, cada HOLE_STEP px de su propio largo,
  // empezando desde la punta
  let holes = '';
  for (const side of [1, -1]) {
    const off = side * (half - 8);
    // la línea de perforaciones, desde la punta hacia atrás
    let acc = 0;
    let next = 10;
    for (let i = qs.length - 1; i > 0; i--) {
      const q0 = qs[i],
        q1 = qs[i - 1];
      const a = pts[i],
        b = pts[i - 1];
      const ax = a.x + a.nx * off,
        ay = a.y + a.ny * off;
      const bx = b.x + b.nx * off,
        by = b.y + b.ny * off;
      const seg = Math.hypot(bx - ax, by - ay);
      while (seg > 0 && acc + seg >= next) {
        const k = (next - acc) / seg;
        const q = q0 + (q1 - q0) * k;
        next += HOLE_STEP;
        if (q < from + 4) continue;
        if (side > 0 && topW(q) < half - 1) continue;
        const cx = ax + (bx - ax) * k,
          cy = ay + (by - ay) * k;
        // el cuadrito, alineado con su borde
        const tx = (bx - ax) / seg,
          ty = (by - ay) / seg;
        const nx = -ty,
          ny = tx;
        const s = 3.6,
          t = 3.1;
        holes +=
          `M${r(cx - tx * s - nx * t)},${r(cy - ty * s - ny * t)}` +
          `L${r(cx + tx * s - nx * t)},${r(cy + ty * s - ny * t)}` +
          `L${r(cx + tx * s + nx * t)},${r(cy + ty * s + ny * t)}` +
          `L${r(cx - tx * s + nx * t)},${r(cy - ty * s + ny * t)}Z`;
      }
      acc += seg;
    }
  }
  return { body, amber, holes };
}

/** Un fotograma que sigue la cinta (también en las vueltas): de qa a qb, con medio alto «w». */
export function windowPath(track: Track, qa: number, qb: number, w: number) {
  if (qb - qa < 2) return '';
  const up: string[] = [];
  const down: string[] = [];
  for (let q = qa; ; q = Math.min(qb, q + 4)) {
    const p = track(q);
    up.push(`${r(p.x + p.nx * w)},${r(p.y + p.ny * w)}`);
    down.push(`${r(p.x - p.nx * w)},${r(p.y - p.ny * w)}`);
    if (q >= qb) break;
  }
  return `M${up.join('L')}L${down.reverse().join('L')}Z`;
}

/** Un camino recto: de la boca del carrete hacia «d» (unitario), con la normal «n» hacia arriba. */
export function straightTrack(
  x: number,
  y: number,
  dx: number,
  dy: number,
  nx: number,
  ny: number,
): Track {
  return (q) => ({ x: x + dx * q, y: y + dy * q, nx, ny });
}

/**
 * La física de la cinta: una cuerda que vibra a lo largo (onda con
 * amortiguación y un muelle que la devuelve a su sitio). u es el
 * desplazamiento de cada punto por la normal de la cinta.
 */
export class FilmString {
  readonly dx = 8;
  u: Float32Array;
  v: Float32Array;
  constructor(length: number) {
    const n = Math.ceil(length / this.dx) + 3;
    this.u = new Float32Array(n);
    this.v = new Float32Array(n);
  }
  /** Avanza «dt» segundos; solo vibra la cinta que está fuera (hasta «out»). */
  step(dt: number, out: number) {
    const { u, v, dx } = this;
    const c2 = 540 * 540;
    const head = Math.min(u.length - 2, Math.floor(out / dx));
    const sub = Math.max(1, Math.ceil(dt * 200));
    const h = dt / sub;
    for (let s = 0; s < sub; s++) {
      u[0] = 0;
      v[0] = 0;
      for (let i = 1; i <= head; i++) {
        const right = i === head ? u[i - 1] : u[i + 1];
        const lap = (u[i - 1] - 2 * u[i] + right) / (dx * dx);
        // la rigidez de la película: amortigua los pliegues cortos (sin dientes de sierra)
        const vr = i === head ? v[i - 1] : v[i + 1];
        const lapV = (v[i - 1] - 2 * v[i] + vr) / (dx * dx);
        v[i] += (c2 * lap + 1400 * lapV - 46 * u[i] - 3.2 * v[i]) * h;
      }
      for (let i = 1; i <= head; i++) {
        u[i] += v[i] * h;
        // un tope: la cinta no se dobla sin fin
        if (u[i] > 26) u[i] = 26;
        else if (u[i] < -26) u[i] = -26;
      }
      for (let i = head + 1; i < u.length; i++) {
        u[i] = 0;
        v[i] = 0;
      }
    }
  }
  /** Un golpe: «amp» de velocidad repartido como una campana alrededor de q. */
  kick(q: number, amp: number, spread: number) {
    const { v, dx } = this;
    const a = Math.max(1, Math.floor((q - spread * 2.5) / dx));
    const b = Math.min(v.length - 1, Math.ceil((q + spread * 2.5) / dx));
    for (let i = a; i <= b; i++) {
      const d = (i * dx - q) / spread;
      v[i] += amp * Math.exp(-d * d);
    }
  }
  /** Fija el desplazamiento cerca de un punto (para sacudir la punta). */
  drive(q: number, value: number, k: number, spread = 22) {
    // se reparte como una campana: nunca se mueve un punto suelto
    const { u, v, dx } = this;
    const a = Math.max(1, Math.floor((q - spread * 2.5) / dx));
    const b = Math.min(u.length - 1, Math.ceil((q + spread * 2.5) / dx));
    for (let i = a; i <= b; i++) {
      const d = (i * dx - q) / spread;
      const w = k * Math.exp(-d * d);
      u[i] += (value - u[i]) * w;
      v[i] *= 1 - w;
    }
  }
  at(q: number) {
    const { u, dx } = this;
    const f = Math.max(0, q / dx);
    const i = Math.min(u.length - 2, Math.floor(f));
    const k = Math.min(1, f - i);
    return u[i] * (1 - k) + u[i + 1] * k;
  }
  /** ¿Se está moviendo todavía? */
  energy() {
    let e = 0;
    for (let i = 0; i < this.u.length; i++)
      e = Math.max(e, Math.abs(this.u[i]), Math.abs(this.v[i]) / 20);
    return e;
  }
  /** La cinta deformada: el camino de reposo + el desplazamiento por la normal. */
  bend(base: Track): Track {
    return (q) => {
      const p = base(q);
      const uq = this.at(q);
      const du = Math.max(-0.5, Math.min(0.5, (this.at(q + 6) - this.at(q - 6)) / 12));
      // la normal se inclina con la pendiente
      const tx = -p.ny,
        ty = p.nx;
      let nx = p.nx - tx * du,
        ny = p.ny - ty * du;
      const l = Math.hypot(nx, ny) || 1;
      nx /= l;
      ny /= l;
      return { x: p.x + p.nx * uq, y: p.y + p.ny * uq, nx, ny };
    };
  }
}
