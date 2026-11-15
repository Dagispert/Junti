// Escena 6 · El calendario: «cuenta atrás». Debajo de la hoja de la libreta
// aparece un taco de calendario; las hojas se arrancan hacia arriba (14 → 15
// → 16) y se amontonan detrás. Al final todo el taco se levanta y descubre la
// cámara instantánea.

import { MOSAICO, T } from '../config.js';
import { BISAGRA_HOJA, dibujarCalendario } from '../ilustraciones/calendario.js';
import { CURVA, amortiguado, tramo } from '../motor/tiempo.js';
import { mover, opacidad, ver, voltearY } from '../transiciones.js';

const Y0 = MOSAICO.cy - MOSAICO.lado / 2;

export function crear({ capa, defs }) {
  const c = dibujarCalendario(capa, defs);
  const tt = T.calendario;
  const volteos = [tt.volteo1, tt.volteo2];
  return {
    pintar(t) {
      // cada hoja: gira sobre la bisagra; al pasar de 90° se ve su dorso;
      // al terminar desaparece (ya es parte del montón)
      let pasadas = 0;
      c.hojas.forEach((h, i) => {
        const tr = volteos[i];
        if (!tr) return ver(h.h, true);
        const k = tramo(t, tr, CURVA.entraSale);
        pasadas += k;
        ver(h.h, k < 1);
        const frente = voltearY(h.h, Math.PI * k, BISAGRA_HOJA, MOSAICO.cx);
        ver(h.delante, frente);
        ver(h.dorso, !frente);
      });

      // el montón crece con cada hoja y tiembla al recibirla
      const km = tramo(t, tt.monton, CURVA.rebote);
      const golpe = volteos.reduce((a, tr) => a + amortiguado(t, tr[0] + tr[1], 4, 8), 0);
      mover(c.monton, { ox: MOSAICO.cx, oy: Y0 + 4, sy: Math.max(0.001, km * (0.62 + 0.19 * pasadas) + golpe * 0.04) });
      opacidad(c.monton, km * 3);
      opacidad(c.hilos, km * 3);

      // salida: todo el taco se levanta sobre su borde de arriba
      const ks = tramo(t, tt.salida, CURVA.entra);
      voltearY(c.g, Math.PI * 0.92 * ks, Y0, MOSAICO.cx);
      opacidad(c.g, 1 - tramo(t, [tt.salida[0] + tt.salida[1] * 0.55, tt.salida[1] * 0.45]));
    },
  };
}
