// ─────────────────────────────────────────────────────────────────────────────
// LETRAS Y CIFRAS
// Las cifras grandes son trazados propios (esqueletos de rotulador grueso con
// vetas, como el «59» de la referencia). Los textos pequeños usan tipografía,
// pasada por un filtro áspero que hierve con el resto del dibujo.
// ─────────────────────────────────────────────────────────────────────────────

import { COLOR } from '../config.js';
import { el, tinta, uid } from './trazo.js';

/** Esqueletos de las cifras en una caja de 60 × 100. */
const CIFRAS = {
  0: 'M30,2 C46,2 58,22 58,50 C58,78 46,98 30,98 C14,98 2,78 2,50 C2,22 14,2 30,2 Z',
  1: 'M12,22 L36,2 L36,98',
  2: 'M5,26 C5,11 16,2 30,2 C45,2 55,12 55,26 C55,41 44,52 5,97 L57,97',
  3: 'M6,14 C12,6 20,2 30,2 C44,2 53,11 53,24 C53,38 42,46 26,46 C44,46 56,56 56,71 C56,87 44,98 29,98 C17,98 8,93 3,84',
  4: 'M42,98 L42,2 L3,68 L58,68',
  5: 'M52,2 L13,2 L8,44 C15,39 22,37 30,37 C46,37 57,48 57,66 C57,84 45,98 29,98 C17,98 8,93 3,84',
  6: 'M50,8 C44,3 38,2 32,2 C14,2 3,22 3,52 C3,80 14,98 31,98 C47,98 57,86 57,68 C57,50 46,39 31,39 C17,39 6,48 3,60',
  7: 'M3,2 L57,2 L20,98',
  8: 'M30,46 C17,46 8,37 8,24 C8,11 17,2 30,2 C43,2 52,11 52,24 C52,37 43,46 30,46 C14,46 4,57 4,72 C4,87 15,98 30,98 C45,98 56,87 56,72 C56,57 46,46 30,46 Z',
  9: 'M10,92 C16,97 22,98 28,98 C46,98 57,78 57,48 C57,20 46,2 29,2 C13,2 3,14 3,31 C3,49 14,60 29,60 C43,60 54,51 57,40',
};

/**
 * Una cifra de rotulador: trazo grueso + vetas oscuras dentro (la textura del
 * rotulador que no cubre del todo).
 */
export function cifra(padre, n, { x, y, alto, color = COLOR.crema, veta = COLOR.negro, grosor = 15 }) {
  const s = alto / 100;
  const g = el('g', { transform: `translate(${x},${y}) scale(${s})` }, padre);
  const d = CIFRAS[n];
  tinta(g, d, { color, ancho: grosor, amp: 0.7, hervor: 0.35, paso: 3, cierre: false });
  if (veta) {
    // dos vetas finas y discontinuas, desplazadas del eje del trazo
    tinta(g, d, { color: veta, ancho: 0.8, amp: 3, hervor: 0.6, paso: 3, cierre: false, opacidad: 0.22, discontinuo: '14 9 26 12' });
    tinta(g, d, { color: veta, ancho: 0.6, amp: 4.2, hervor: 0.6, paso: 3, cierre: false, opacidad: 0.14, discontinuo: '8 16 18 10' });
  }
  return g;
}

/** Un número de varias cifras (ancho de cada cifra = 0,62 del alto). */
export function numero(padre, texto, { x, y, alto, separacion = 0.16, ...o }) {
  const g = el('g', {}, padre);
  const paso = alto * (0.6 + separacion);
  [...String(texto)].forEach((c, i) => cifra(g, c, { x: x + i * paso, y, alto, ...o }));
  return g;
}
export const anchoNumero = (texto, alto, separacion = 0.16) =>
  String(texto).length * alto * (0.6 + separacion) - alto * separacion;

/**
 * Cifra de reloj de paletas: cada valor tiene su mitad de arriba y de abajo.
 * voltear(i, k) pasa del valor i al i+1 con la paleta cayendo sobre la bisagra.
 */
export function cifraVolteable(padre, defs, { x, y, alto, valores, ...o }) {
  const mitad = y + alto / 2;
  const idA = uid('arriba'), idB = uid('abajo');
  const ca = el('clipPath', { id: idA }, defs);
  el('rect', { x: x - 30, y: y - 40, width: alto + 60, height: alto / 2 + 40 }, ca);
  const cb = el('clipPath', { id: idB }, defs);
  el('rect', { x: x - 30, y: mitad, width: alto + 60, height: alto / 2 + 40 }, cb);
  const g = el('g', {}, padre);
  const capas = valores.map((v) => {
    const arriba = el('g', { 'clip-path': `url(#${idA})` }, g);
    const abajo = el('g', { 'clip-path': `url(#${idB})` }, g);
    // cada mitad lleva su copia, dentro de un grupo que se aplasta sobre la bisagra
    const ia = el('g', {}, arriba), ib = el('g', {}, abajo);
    cifra(ia, v, { x, y, alto, ...o });
    cifra(ib, v, { x, y, alto, ...o });
    return { arriba, abajo, ia, ib };
  });
  const escalaY = (nodo, s) =>
    nodo.setAttribute('transform', `translate(0,${mitad}) scale(1,${Math.max(0.001, s)}) translate(0,${-mitad})`);
  const ver = (nodo, v) => (nodo.style.display = v ? '' : 'none');
  return {
    g,
    voltear(i, k) {
      capas.forEach((c, j) => {
        ver(c.arriba, false);
        ver(c.abajo, false);
        escalaY(c.ia, 1);
        escalaY(c.ib, 1);
        c.ia.style.opacity = c.ib.style.opacity = 1;
      });
      const vieja = capas[i], nueva = capas[Math.min(i + 1, capas.length - 1)];
      if (k <= 0 || vieja === nueva) {
        ver(vieja.arriba, true);
        ver(vieja.abajo, true);
        return;
      }
      if (k >= 1) {
        ver(nueva.arriba, true);
        ver(nueva.abajo, true);
        return;
      }
      // detrás: la mitad de arriba nueva y la de abajo vieja
      ver(nueva.arriba, true);
      ver(vieja.abajo, true);
      g.appendChild(vieja.arriba);
      g.appendChild(nueva.abajo);
      if (k < 0.5) {
        ver(vieja.arriba, true);
        escalaY(vieja.ia, 1 - k * 2);
        vieja.ia.style.opacity = 1 - k; // se oscurece al caer
      } else {
        ver(nueva.abajo, true);
        escalaY(nueva.ib, k * 2 - 1);
        nueva.ib.style.opacity = 0.5 + k / 2;
      }
    },
  };
}

/** Texto con tipografía: «mano» (rótulos) o «geo» (fechas, cifras finas). */
export function texto(padre, cadena, { x, y, tam = 20, familia = 'mano', peso = 400, color = COLOR.crema, ancla = 'middle', espaciado = 0, aspero = true, estilo, clase } = {}) {
  const t = el(
    'text',
    {
      x,
      y,
      'font-size': tam,
      'font-family': familia === 'mano' ? "'Patrick Hand', cursive" : "'Jost', sans-serif",
      'font-weight': peso,
      'font-style': estilo,
      fill: color,
      'text-anchor': ancla,
      'letter-spacing': espaciado || null,
      class: [aspero && 'aspero', clase].filter(Boolean).join(' ') || null,
    },
    padre,
  );
  t.textContent = cadena;
  return t;
}
