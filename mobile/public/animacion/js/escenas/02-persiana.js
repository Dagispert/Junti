// Escena 2 · La persiana: «cinco minutos más». Se desenrolla sobre el reloj,
// el cordón cae y se balancea; luego alguien tira y la persiana sube,
// descubriendo la ventanilla del avión (escena 3, debajo).

import { T } from '../config.js';
import { dibujarPersiana } from '../ilustraciones/persiana.js';
import { CURVA, amortiguado, clamp, tramo } from '../motor/tiempo.js';
import { revelar } from '../motor/trazo.js';
import { mover, opacidad, ver } from '../transiciones.js';

export function crear({ capa, defs }) {
  const p = dibujarPersiana(capa, defs);
  const tt = T.persiana;
  return {
    pintar(t) {
      // cuánto está desenrollada: baja, espera, sube
      const baja = tramo(t, tt.baja, CURVA.entraSale);
      const sube = tramo(t, tt.sube, CURVA.entraSale);
      // al bajar se pasa un poquito y rebota (el peso de la barra)
      const rebote = t > tt.baja[0] + tt.baja[1] ? amortiguado(t, tt.baja[0] + tt.baja[1], 3, 7) * 0.025 : 0;
      const k = clamp(baja * (1 + rebote) * (1 - sube), 0, 1.03);
      const h = p.L * k;
      p.rollo.setAttribute('height', h.toFixed(1));
      p.barra.setAttribute('transform', `translate(0,${(p.Y0 + h).toFixed(1)})`);
      ver(p.barra, k > 0.01 && k < 1.0);

      // el marco engorda mientras baja y adelgaza mientras sube
      const km = tramo(t, tt.marco) * (1 - tramo(t, [tt.sube[0] + 0.2, 0.3]));
      opacidad(p.marco, km);

      // el cordón: cae, se balancea y, al tirar, baja y suelta
      const kc = tramo(t, tt.cordon, CURVA.sale);
      revelar(p.hilo, kc);
      opacidad(p.bola, kc > 0.95 ? 1 : 0);
      const tiron = Math.sin(Math.PI * tramo(t, tt.tiron, CURVA.lineal)) * 20;
      const giro =
        amortiguado(t, tt.cordon[0] + tt.cordon[1] * 0.6, 1.2, 1.6) * 7 + amortiguado(t, tt.tiron[0] + tt.tiron[1], 1.4, 2.5) * 5;
      mover(p.cordon, { ox: 456, oy: p.Y0 - 12, r: giro, sy: 1 + tiron / 300 });
      // el cordón se va cuando la persiana termina de subir
      opacidad(p.cordon, 1 - tramo(t, [tt.sube[0] + 0.3, 0.3]));
    },
  };
}
