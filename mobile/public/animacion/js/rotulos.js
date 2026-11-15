// ─────────────────────────────────────────────────────────────────────────────
// RÓTULOS
// El hashtag bajo el mosaico. El viejo se apaga hacia arriba en un instante y
// el nuevo se escribe de izquierda a derecha (una máscara que avanza como la
// punta de un bolígrafo). Crema de noche, tinta negra de día.
// ─────────────────────────────────────────────────────────────────────────────

import { CAMBIO_FONDO, COLOR, MOSAICO, ROTULOS } from './config.js';
import { CURVA, clamp } from './motor/tiempo.js';
import { el, uid } from './motor/trazo.js';
import { texto } from './motor/letras.js';

const Y = MOSAICO.cy + MOSAICO.lado / 2 + 72;

export function crearRotulos(capa, defs) {
  const g = el('g', {}, capa);
  const nodos = ROTULOS.map((r) => {
    const id = uid('rotulo');
    const clip = el('clipPath', { id }, defs);
    const rect = el('rect', { x: 0, y: Y - 30, width: 0, height: 44 }, clip);
    const n = texto(g, r.texto, { x: MOSAICO.cx, y: Y, tam: 21, espaciado: 0.4 });
    n.setAttribute('clip-path', `url(#${id})`);
    n.style.display = 'none';
    return { n, rect, largo: null };
  });
  const largo = (i) => (nodos[i].largo ??= nodos[i].n.getComputedTextLength() || 160);

  return {
    /** Tras cargar las fuentes, los anchos cambian: se vuelven a medir. */
    medir() {
      nodos.forEach((x) => (x.largo = null));
    },
    pintar(t) {
      let i = -1;
      ROTULOS.forEach((r, j) => {
        if (t >= r.t) i = j;
      });
      const dia = t >= CAMBIO_FONDO.t + CAMBIO_FONDO.dur * 0.8;
      nodos.forEach((x, j) => {
        x.n.style.display = 'none';
        x.n.setAttribute('fill', dia ? COLOR.tinta : COLOR.crema);
      });
      if (i < 0) return;
      const k = clamp((t - ROTULOS[i].t) / 0.42);
      const actual = nodos[i];
      if (ROTULOS[i].texto) {
        actual.n.style.display = '';
        actual.n.style.opacity = 1;
        actual.n.removeAttribute('transform');
        const L = largo(i);
        actual.rect.setAttribute('x', MOSAICO.cx - L / 2 - 6);
        actual.rect.setAttribute('width', ((L + 12) * CURVA.entraSale(k)).toFixed(1));
      }
      // el anterior se apaga subiendo
      if (i > 0 && k < 1 && ROTULOS[i - 1].texto) {
        const prev = nodos[i - 1];
        const kp = clamp(k * 2.5);
        prev.n.style.display = kp < 1 ? '' : 'none';
        prev.n.style.opacity = 1 - kp;
        prev.n.setAttribute('transform', `translate(0,${(-8 * kp).toFixed(1)})`);
        const L = largo(i - 1);
        prev.rect.setAttribute('x', MOSAICO.cx - L / 2 - 6);
        prev.rect.setAttribute('width', L + 12);
      }
    },
  };
}
