// Escena 1 · El reloj: «es la hora». El contorno se dibuja, aparecen las
// cifras y la última paleta cae: 58 → 59. La alarma parpadea (CSS).

import { MOSAICO, T } from '../config.js';
import { dibujarReloj } from '../ilustraciones/reloj.js';
import { CURVA, tramo } from '../motor/tiempo.js';
import { revelar } from '../motor/trazo.js';
import { mover, opacidad } from '../transiciones.js';

export function crear({ capa, defs }) {
  const r = dibujarReloj(capa, defs);
  const tt = T.reloj;
  return {
    pintar(t) {
      revelar(r.caja, tramo(t, tt.trazo, CURVA.entraSale));
      revelar(r.division, tramo(t, [tt.trazo[0] + 0.12, 0.3], CURVA.sale));
      const kc = tramo(t, tt.cifras, CURVA.lineal);
      opacidad(r.cifras, kc * 2);
      mover(r.cifras, { ox: MOSAICO.cx, oy: MOSAICO.cy, s: 0.9 + 0.1 * CURVA.rebote(kc) });
      r.izq.voltear(0, 0);
      r.der.voltear(0, tramo(t, tt.voltea, CURVA.entra));
      opacidad(r.piloto, tramo(t, [0.3, 0.1]));
      opacidad(r.anillo, tramo(t, [0.35, 0.1]));
    },
  };
}
