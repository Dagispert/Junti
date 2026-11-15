// La cinta que rebota de pared a pared: sale de la boca del carrete hacia la
// derecha, choca con la pared, da la vuelta (media curva) y vuelve hacia la
// izquierda una fila más abajo, y así hasta que caben todas las fotos sin
// montarse. Aquí solo hay geometría: el camino, sus vueltas y dónde va cada
// fotograma (siempre en los tramos rectos, derechos).

export type Pt = { x: number; y: number; nx: number; ny: number };

type Seg =
  | { kind: 'line'; from: [number, number]; to: [number, number]; s0: number; len: number }
  | {
      kind: 'arc';
      c: [number, number];
      r: number;
      side: 1 | -1;
      y0: number;
      s0: number;
      len: number;
    };

export type Frame = {
  i: number;
  x: number;
  y: number;
  /** distancia por la cinta donde termina */ end: number;
};

export type Serpentine = {
  segs: Seg[];
  length: number;
  frames: Frame[];
  /** Momentos en que la punta choca con una pared (distancia por la cinta). */
  walls: number[];
  height: number;
  rows: number;
  at: (s: number) => Pt;
};

export function serpentine(o: {
  x0: number;
  y0: number;
  left: number;
  right: number;
  rowH: number;
  frameW: number;
  frameH: number;
  gap: number;
  n: number;
  /** Lo que se deja libre al principio de cada fila. */
  pad?: number;
  tail?: number;
}): Serpentine {
  const r = o.rowH / 2;
  const pad = o.pad ?? 10;
  const segs: Seg[] = [];
  const frames: Frame[] = [];
  const walls: number[] = [];
  let s = 0;
  let row = 0;
  let placed = 0;
  let x = o.x0;
  let guard = 0;
  while (placed < o.n && guard++ < 200) {
    const y = o.y0 + row * o.rowH;
    const dir = row % 2 === 0 ? 1 : -1;
    const endX = dir > 0 ? o.right - r : o.left + r;
    const len = Math.max(0, (endX - x) * dir);
    // fotogramas que caben en esta fila
    let off = pad;
    while (placed < o.n && off + o.frameW <= len - pad / 2) {
      const fx = dir > 0 ? x + off : x - off - o.frameW;
      frames.push({ i: placed, x: fx, y: y - o.frameH / 2, end: s + off + o.frameW });
      placed += 1;
      off += o.frameW + o.gap;
    }
    segs.push({ kind: 'line', from: [x, y], to: [endX, y], s0: s, len });
    s += len;
    if (placed >= o.n) break;
    // la vuelta, contra la pared
    walls.push(s);
    const arcLen = Math.PI * r;
    segs.push({
      kind: 'arc',
      c: [endX, y + r],
      r,
      side: dir > 0 ? 1 : -1,
      y0: y,
      s0: s,
      len: arcLen,
    });
    s += arcLen;
    x = endX;
    row += 1;
  }
  // un poco de cola sin revelar al final
  const last = segs[segs.length - 1];
  if (last.kind === 'line') {
    const tail = Math.min(
      o.tail ?? 40,
      Math.abs(last.to[0] - (frames[frames.length - 1]?.x ?? last.to[0])),
    );
    last.len = Math.min(last.len, (frames[frames.length - 1]?.end ?? last.s0) - last.s0 + tail);
    const dir = last.to[0] >= last.from[0] ? 1 : -1;
    last.to = [last.from[0] + dir * last.len, last.to[1]];
    s = last.s0 + last.len;
  }
  const at = (d: number): Pt => {
    const q = Math.max(0, Math.min(s, d));
    const g = segs.find((x) => q >= x.s0 && q <= x.s0 + x.len) ?? segs[segs.length - 1];
    const k = g.len ? (q - g.s0) / g.len : 0;
    if (g.kind === 'line') {
      const dir = g.to[0] >= g.from[0] ? 1 : -1;
      // la normal apunta «arriba» de la cinta en su sentido de marcha
      return { x: g.from[0] + (g.to[0] - g.from[0]) * k, y: g.from[1], nx: 0, ny: -dir };
    }
    // media vuelta: de arriba a abajo por el lado de la pared
    const ang = -Math.PI / 2 + Math.PI * k; // -90° (arriba) … 90° (abajo)
    const px = g.c[0] + g.side * g.r * Math.cos(ang);
    const py = g.c[1] + g.r * Math.sin(ang);
    // la normal sigue siendo el mismo borde de la cinta (sin saltar de lado):
    // en las vueltas de la derecha es la de fuera; en las de la izquierda, la de dentro
    return g.side > 0
      ? { x: px, y: py, nx: Math.cos(ang), ny: Math.sin(ang) }
      : { x: px, y: py, nx: Math.cos(ang), ny: -Math.sin(ang) };
  };
  return {
    segs,
    length: s,
    frames,
    walls,
    height: o.y0 + row * o.rowH + r,
    rows: row + 1,
    at,
  };
}

/** Un trazado SVG que sigue la cinta desplazado «off» px por su normal (para las perforaciones). */
export function offsetPath(sp: Serpentine, off: number, step = 4) {
  let d = '';
  for (let q = 0; q <= sp.length; q += step) {
    const p = sp.at(q);
    d += `${q ? 'L' : 'M'}${(p.x + p.nx * off).toFixed(1)},${(p.y + p.ny * off).toFixed(1)}`;
  }
  const p = sp.at(sp.length);
  d += `L${(p.x + p.nx * off).toFixed(1)},${(p.y + p.ny * off).toFixed(1)}`;
  return d;
}

/**
 * Cómo avanza la punta al soltar la cinta con fuerza: rápida en la primera
 * fila, frenando un poco en cada pared (rebota y sigue). Devuelve, para cada
 * instante (s), la distancia desplegada y el último choque con la pared.
 */
export function unrollSchedule(sp: Serpentine, speed: number) {
  const parts: { s0: number; s1: number; t0: number; t1: number; arc: boolean }[] = [];
  let t = 0;
  let v = Math.max(900, speed);
  for (const g of sp.segs) {
    const dur = g.kind === 'arc' ? 0.22 : g.len / v;
    parts.push({ s0: g.s0, s1: g.s0 + g.len, t0: t, t1: t + dur, arc: g.kind === 'arc' });
    t += dur;
    if (g.kind === 'arc') v = Math.max(620, v * 0.86);
  }
  const total = t;
  return {
    total,
    /** Distancia desplegada en el instante t (segundos). */
    at(time: number) {
      if (time >= total) return sp.length;
      const p = parts.find((x) => time >= x.t0 && time <= x.t1) ?? parts[parts.length - 1];
      const k = (time - p.t0) / Math.max(1e-6, p.t1 - p.t0);
      // en las vueltas, entra frenando y sale acelerando (el rebote)
      const e = p.arc ? (k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k)) : k;
      return p.s0 + (p.s1 - p.s0) * e;
    },
    /** Momentos (s) en que la punta toca pared. */
    hits: parts.filter((p) => p.arc).map((p) => p.t0),
  };
}
