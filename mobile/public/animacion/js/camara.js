// ─────────────────────────────────────────────────────────────────────────────
// CÁMARA
// Un solo grupo que contiene todas las escenas. Se acerca, se aleja y se
// desplaza según la pista CAMARA de config.js. Además lleva una respiración
// mínima (como una cámara en mano muy quieta) para que nunca esté muerta.
// ─────────────────────────────────────────────────────────────────────────────

import { CAMARA, ESCENARIO } from './config.js';
import { pista } from './motor/tiempo.js';

export function crearCamara(grupo) {
  const { ancho: W, alto: H } = ESCENARIO;
  return {
    pintar(t) {
      const c = pista(t, CAMARA);
      // respiración: 0,3 % de zoom y medio píxel de deriva
      const s = c.s * (1 + 0.003 * Math.sin(t * 1.3));
      const x = c.x + Math.sin(t * 0.7) * 0.6;
      const y = c.y + Math.cos(t * 0.9) * 0.5;
      grupo.setAttribute(
        'transform',
        `translate(${W / 2},${H / 2}) scale(${s.toFixed(4)}) translate(${(-W / 2 - x).toFixed(2)},${(-H / 2 - y).toFixed(2)})`,
      );
      return { x, y, s };
    },
  };
}
