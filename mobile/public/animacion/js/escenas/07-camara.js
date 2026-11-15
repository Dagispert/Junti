// Escena 7 · La cámara: «por fin juntos». Al levantarse el calendario queda
// una cámara instantánea. El visor se enciende, salta el flash (el fondo pasa
// de noche a día, ver fondo.js) y la cámara escupe la foto por la ranura. La
// foto salta, se pliega arriba y se despliega encima: es el recuerdo.

import { CAMBIO_FONDO, MOSAICO, T } from '../config.js';
import { dibujarCamara, dibujarFoto } from '../ilustraciones/camara-instantanea.js';
import { CURVA, lerp, tramo } from '../motor/tiempo.js';
import { el, uid } from '../motor/trazo.js';
import { mover, opacidad, ver } from '../transiciones.js';

const Y0 = MOSAICO.cy - MOSAICO.lado / 2;
const RANURA = 460;

export function crear({ capa, defs }) {
  const c = dibujarCamara(capa, defs);
  // la foto va dentro de un recorte que solo deja ver lo que ya ha salido
  const id = uid('ranura');
  el('rect', { x: 0, y: RANURA, width: 1280, height: 400 }, el('clipPath', { id }, defs));
  const salida = el('g', {}, capa);
  const fotoMovil = el('g', {}, salida);
  dibujarFoto(fotoMovil, defs);
  const tensiones = el('path', { fill: 'none', stroke: '#E3065F', 'stroke-width': 1.4 }, capa);
  const tt = T.camara;

  return {
    pintar(t) {
      // flash del visor
      const kv = tramo(t, tt.visor, CURVA.lineal);
      c.visorLuz.setAttribute('opacity', (Math.sin(Math.PI * kv)).toFixed(3));
      const dia = t >= CAMBIO_FONDO.t + CAMBIO_FONDO.dur * 0.6;
      ver(c.bordeNoche, !dia);
      ver(c.bordeDia, dia);

      // 1. la foto asoma por la ranura
      const ke = tramo(t, tt.expulsa, CURVA.sale);
      const ksu = tramo(t, tt.sube, CURVA.entra);
      const kd = tramo(t, tt.despliega, CURVA.rebotin);
      const enRanura = t < tt.sube[0];
      salida.setAttribute('clip-path', enRanura ? `url(#${id})` : '');
      ver(salida, ke > 0);
      if (enRanura) {
        mover(fotoMovil, { y: lerp(-56, 92, ke) });
      } else if (t < tt.despliega[0]) {
        // 2. salta hacia arriba y se pliega contra el borde de arriba
        const y = lerp(92, 0, ksu);
        mover(fotoMovil, { y, ox: MOSAICO.cx, oy: Y0, sy: lerp(1, 0.1, ksu) });
      } else {
        // 3. se despliega hacia abajo, tapando la cámara
        mover(fotoMovil, { ox: MOSAICO.cx, oy: Y0, sy: lerp(0.1, 1, kd) });
      }
      // las líneas rosas de tensión a los lados mientras sale
      if (enRanura && ke > 0) {
        const fondoFoto = Y0 + MOSAICO.lado + lerp(-56, 92, ke);
        tensiones.setAttribute('d', `M500,${RANURA + 4} L500,${fondoFoto - 6} M780,${RANURA + 4} L780,${fondoFoto - 6}`);
        tensiones.style.display = '';
      } else tensiones.style.display = 'none';

      // la cámara cede su sitio
      const kc = tramo(t, [tt.despliega[0] + 0.05, tt.despliega[1]], CURVA.entra);
      mover(c.g, { ox: MOSAICO.cx, oy: MOSAICO.cy + 140, s: 1 - 0.08 * kc });
      opacidad(c.g, 1 - kc);
    },
  };
}
