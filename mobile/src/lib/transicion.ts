// Para las transiciones que crecen desde donde se tocó: la pantalla de origen
// guarda dónde estaba lo que se tocó (en pantalla) y la de destino lo recoge
// para crecer desde ahí, sin cortes.

/** Un círculo en pantalla: centro (x, y) y radio, en píxeles. */
export type Caja = { x: number; y: number; r: number };
let origen: { caja: Caja; at: number } | null = null;

export function guardarOrigen(caja: Caja) {
  origen = { caja, at: Date.now() };
}

/** El origen guardado, si es reciente (y solo una vez). */
export function tomarOrigen(maxMs = 2000): Caja | null {
  const o = origen;
  origen = null;
  return o && Date.now() - o.at < maxMs ? o.caja : null;
}

/** Dónde se ve el planeta dentro de `el` (lo publica el propio globo), en pantalla. */
export function planetaEn(el: HTMLElement | null): Caja | null {
  const g = el?.querySelector<HTMLElement>('[data-globo]');
  const d = g?.dataset.globo?.split(',').map(Number);
  if (!g || !d || d.length < 3 || !d[2]) return null;
  const b = g.getBoundingClientRect();
  return { x: b.left + d[0], y: b.top + d[1], r: d[2] };
}
