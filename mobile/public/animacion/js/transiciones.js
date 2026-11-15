// ─────────────────────────────────────────────────────────────────────────────
// TRANSICIONES Y TRANSFORMACIONES COMPARTIDAS
// Las piezas de movimiento que usan varias escenas: mover/escalar/rotar,
// voltear con perspectiva (tapas, hojas, fotos), aparecer con rebote, abrir
// un iris de luz y revelar en cadena.
// ─────────────────────────────────────────────────────────────────────────────

import { CURVA, clamp, tramo } from './motor/tiempo.js';
import { revelar } from './motor/trazo.js';

/**
 * Transforma un nodo alrededor de su origen (ox, oy):
 * desplazar (x, y), girar (r, grados), sesgar (kx, ky) y escalar (sx, sy).
 */
export function mover(nodo, { x = 0, y = 0, s = 1, sx = s, sy = s, r = 0, ox = 0, oy = 0, kx = 0, ky = 0 } = {}) {
  nodo.setAttribute(
    'transform',
    `translate(${(x + ox).toFixed(2)},${(y + oy).toFixed(2)}) rotate(${r.toFixed(2)}) matrix(1,${ky.toFixed(4)},${kx.toFixed(
      4,
    )},1,0,0) scale(${sx.toFixed(4)},${sy.toFixed(4)}) translate(${-ox},${-oy})`,
  );
}

export const ver = (nodo, si) => {
  nodo.style.display = si ? '' : 'none';
};
export const opacidad = (nodo, v) => {
  nodo.style.opacity = String(clamp(v));
};

/**
 * Voltea alrededor de una bisagra vertical (tapa de libreta). ang en radianes:
 * 0 cerrada … π abierta del todo hacia la izquierda. La perspectiva se imita
 * con un sesgo: el borde que viene hacia nosotros sube y crece.
 * Devuelve true si se ve la cara de delante.
 */
export function voltearX(nodo, ang, bisagraX, cy, perspectiva = 0.16) {
  const c = Math.cos(ang), s = Math.sin(ang);
  mover(nodo, { ox: bisagraX, oy: cy, sx: Math.abs(c) < 0.02 ? 0.02 * Math.sign(c || 1) : c, sy: 1 + s * 0.1, ky: -s * perspectiva * Math.sign(c || 1) });
  return c >= 0;
}

/**
 * Voltea alrededor de una bisagra horizontal (hojas de calendario, foto).
 * 0 en su sitio … π dada la vuelta por encima de la bisagra.
 */
export function voltearY(nodo, ang, bisagraY, cx, perspectiva = 0.14) {
  const c = Math.cos(ang), s = Math.sin(ang);
  mover(nodo, { ox: cx, oy: bisagraY, sy: Math.abs(c) < 0.02 ? 0.02 * Math.sign(c || 1) : c, sx: 1 + s * perspectiva });
  return c >= 0;
}

/** Aparece creciendo con un pequeño rebote (escala 0 → 1). */
export function brotar(nodo, t, tr, ox, oy, desde = 0.4) {
  const k = tramo(t, tr, CURVA.lineal);
  const e = CURVA.rebote(k);
  ver(nodo, k > 0);
  mover(nodo, { ox, oy, s: desde + (1 - desde) * e });
  opacidad(nodo, k * 3);
  return k;
}

/** Revela varios trazos en cadena, cada uno con un pequeño retraso. */
export function revelarEnCadena(nodos, t, [desde, dur], retraso = 0.08) {
  nodos.forEach((n, i) => revelar(n, tramo(t, [desde + i * retraso, dur], CURVA.entraSale)));
}

/** Iris: un círculo de luz que se abre (k 0 → 1) o se cierra. */
export function iris(nodo, k, cx, cy) {
  mover(nodo, { ox: cx, oy: cy, s: Math.max(0.0001, k) });
  ver(nodo, k > 0.001);
}
