// Escena 4 · La libreta: «nuestro diario». El contorno de la ventanilla se
// redibuja como la tapa de una libreta; se escribe su nombre; una goma
// elástica entra desde la derecha, vibra y se suelta; la tapa se abre girando
// sobre su lado izquierdo y sale del plano.

import { MOSAICO, T } from '../config.js';
import { dibujarTapa } from '../ilustraciones/libreta.js';
import { CURVA, amortiguado, tramo } from '../motor/tiempo.js';
import { el, revelar, uid } from '../motor/trazo.js';
import { mover, opacidad, ver, voltearX } from '../transiciones.js';

const X0 = MOSAICO.cx - MOSAICO.lado / 2, X1 = MOSAICO.cx + MOSAICO.lado / 2;

export function crear({ capa, defs }) {
  const tapa = dibujarTapa(capa);
  const tt = T.libreta;
  // el nombre se escribe de izquierda a derecha
  const id = uid('nombre');
  const clip = el('rect', { x: 590, y: 470, width: 0, height: 24 }, el('clipPath', { id }, defs));
  tapa.nombre.setAttribute('clip-path', `url(#${id})`);

  return {
    pintar(t) {
      // 1. el contorno se dibuja mientras la cabina se apaga; el relleno negro tapa lo de debajo
      revelar(tapa.borde, tramo(t, tt.contorno, CURVA.entraSale));
      opacidad(tapa.relleno, tramo(t, [tt.contorno[0] + 0.25, 0.25]));
      clip.setAttribute('width', (100 * tramo(t, tt.letras, CURVA.entraSale)).toFixed(1));

      // 2. la goma: entra curvada, se endereza al agarrar el borde, vibra y se va
      const ke = tramo(t, tt.gomaEntra, CURVA.sale);
      const ks = tramo(t, tt.gomaSale, CURVA.entra);
      const vibra = amortiguado(t, tt.gomaEntra[0] + tt.gomaEntra[1], 5, 6);
      const x = 980 - (980 - (X1 - 4)) * ke + 220 * ks;
      const comba = 46 * (1 - ke) + 30 * vibra + 34 * ks;
      const visible = ke > 0 && ks < 1;
      ver(tapa.goma, visible);
      ver(tapa.tension, visible);
      if (visible) {
        tapa.goma.setAttribute('d', `M${x.toFixed(1)},${206} Q${(x + comba).toFixed(1)},362 ${x.toFixed(1)},${520}`);
        // la tensión: líneas rosas que tiran hacia atrás desde los extremos
        const largo = 34 * (1 - ke * 0.6) + 20 * ks + 10 * Math.abs(vibra);
        tapa.lineasTension[0].setAttribute('d', `M${x + 4},206 L${x + 4 + largo},206`);
        tapa.lineasTension[1].setAttribute('d', `M${x + 4},520 L${x + 4 + largo},520`);
      }

      // 3. la tapa se abre (0 → π) sobre el lomo y luego sale por la izquierda
      const ka = tramo(t, tt.abre, CURVA.entraSale);
      const kt = tramo(t, tt.tapaSale, CURVA.entra);
      voltearX(tapa.g, Math.PI * ka * 0.97, X0, MOSAICO.cy);
      if (kt > 0) {
        const base = tapa.g.getAttribute('transform');
        tapa.g.setAttribute('transform', `translate(${(-260 * kt).toFixed(1)},0) ${base}`);
      }
      opacidad(tapa.g, 1 - kt);
    },
  };
}
