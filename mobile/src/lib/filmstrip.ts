// La cinta de película dibujada como una tira de verdad: sigue un camino
// (recto para la lengüeta, en zigzag para la cinta abierta), tiene su punta
// recortada (la lengüeta de los carretes: media altura, con la curva del
// corte), el centro ámbar translúcido y las perforaciones cuadradas, que se
// mueven con la cinta cuando sale o entra.

export type TrackPt = { x: number; y: number; nx: number; ny: number };
export type Track = (q: number) => TrackPt;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Los trazados de la cinta entre «from» y «to» (distancias por el camino; la
 * punta está en «to»). h: alto de la cinta. tab: largo de la lengüeta.
 */
export function filmPaths(track: Track, from: number, to: number, h: number, tab: number) {
  if (to - from < 1) return { body: '', amber: '', holes: '' };
  const half = h / 2;
  const curve = h * 0.55;
  // borde de arriba: en la lengüeta baja a media altura con una curva suave
  const topW = (q: number) => {
    const k = smooth(to - tab - curve, to - tab, q);
    return half - k * (half + h * 0.02);
  };
  const step = 5;
  const qs: number[] = [];
  for (let q = from; q < to; q += step) qs.push(q);
  qs.push(to);
  const r = (v: number) => v.toFixed(1);
  const edge = (inset: number) => {
    const up: string[] = [];
    const down: string[] = [];
    for (const q of qs) {
      const p = track(q);
      const a = topW(q) - inset;
      const b = half - inset;
      up.push(`${r(p.x + p.nx * a)},${r(p.y + p.ny * a)}`);
      down.push(`${r(p.x - p.nx * b)},${r(p.y - p.ny * b)}`);
    }
    // la punta, con las esquinas apenas redondeadas
    return `M${up.join('L')}L${down.reverse().join('L')}Z`;
  };
  const body = edge(0);
  // el centro ámbar, donde van los fotogramas (no llega a la lengüeta)
  const amber = to - tab - curve > from + 4 ? amberBand(track, from, to - tab - curve, h) : '';
  // perforaciones: cada 13 px desde la punta (se mueven con la cinta)
  let holes = '';
  for (let u = 10; to - u > from + 4; u += 13) {
    const q = to - u;
    const p = track(q);
    const tx = -p.ny,
      ty = p.nx;
    for (const side of [1, -1]) {
      if (side > 0 && topW(q) < half - 1) continue;
      const off = side * (half - 8);
      const cx = p.x + p.nx * off,
        cy = p.y + p.ny * off;
      const a = 3.6,
        b = 3.1;
      holes +=
        `M${r(cx - tx * a - p.nx * b)},${r(cy - ty * a - p.ny * b)}` +
        `L${r(cx + tx * a - p.nx * b)},${r(cy + ty * a - p.ny * b)}` +
        `L${r(cx + tx * a + p.nx * b)},${r(cy + ty * a + p.ny * b)}` +
        `L${r(cx - tx * a + p.nx * b)},${r(cy - ty * a + p.ny * b)}Z`;
    }
  }
  return { body, amber, holes };
}

function amberBand(track: Track, from: number, to: number, h: number) {
  const w = h / 2 - 15;
  const up: string[] = [];
  const down: string[] = [];
  for (let q = from; ; q = Math.min(to, q + 5)) {
    const p = track(q);
    up.push(`${(p.x + p.nx * w).toFixed(1)},${(p.y + p.ny * w).toFixed(1)}`);
    down.push(`${(p.x - p.nx * w).toFixed(1)},${(p.y - p.ny * w).toFixed(1)}`);
    if (q >= to) break;
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
