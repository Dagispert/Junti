// Escena 3 · La ventanilla: «rumbo a ti». Al subir la persiana la cámara se
// aleja y descubre que estamos en un avión: el foco se abre como un iris, los
// asientos se dibujan, el vaso cae en la bandeja. Las nubes pasan; un haz de
// sol barre el asiento y las nubes corren (rayas rosas). Luego todo se apaga.

import { MOSAICO, T } from '../config.js';
import { dibujarCabina } from '../ilustraciones/cabina.js';
import { CURVA, amortiguado, tramo } from '../motor/tiempo.js';
import { revelar } from '../motor/trazo.js';
import { iris, mover, opacidad, revelarEnCadena } from '../transiciones.js';

export function crear({ capa, defs }) {
  const c = dibujarCabina(capa, defs);
  const tt = T.ventanilla;
  return {
    pintar(t) {
      const sale = tramo(t, tt.salida, CURVA.entraSale);
      // iris de luz: se abre al empezar, se cierra al salir
      iris(c.foco, tramo(t, tt.iris) * (1 - sale), MOSAICO.cx, 450);

      // asientos: se dibujan en cadena y al salir se van a la izquierda
      revelarEnCadena(c.trazosAsiento, t, tt.asientos, 0.05);
      mover(c.asientos, { x: -140 * sale });
      opacidad(c.asientos, 1 - sale * 1.4);

      // las nubes: deriva constante + una racha rápida (la integral de la prisa)
      const recorrido = 26 * (t - 2.5) + 520 * tramo(t, tt.prisa, CURVA.entraSale);
      c.nubes.forEach((n, i) => {
        // vuelve a entrar por la derecha cuando ya ha salido por la izquierda
        const x = 300 - ((recorrido * (1 + i * 0.15) + i * 170) % 1000);
        n.setAttribute('transform', `translate(${x.toFixed(1)},0)`);
      });
      c.lejos.setAttribute('transform', `translate(${(-recorrido * 0.35).toFixed(1)},0)`);
      const kp = tramo(t, tt.prisa, CURVA.lineal);
      opacidad(c.prisa, Math.sin(Math.PI * kp) * 1.3);
      mover(c.prisa, { x: -30 * kp });

      // el haz de sol que barre el asiento izquierdo
      const kl = tramo(t, tt.luz, CURVA.entraSale);
      c.luz.setAttribute('opacity', (Math.sin(Math.PI * kl) * 0.85).toFixed(3));
      c.luz.setAttribute('transform', `translate(${(-160 + 260 * kl).toFixed(1)},0)`);

      // bandeja y vaso (cae y se aplasta un poco al tocar)
      revelar(c.bandeja, tramo(t, tt.bandeja, CURVA.entraSale));
      const kv = tramo(t, tt.vaso, CURVA.entra);
      const golpe = amortiguado(t, tt.vaso[0] + tt.vaso[1], 4, 9);
      mover(c.vaso, { y: -40 * (1 - kv), ox: 586, oy: 524, sy: 1 - golpe * 0.18, sx: 1 + golpe * 0.12 });
      opacidad(c.vaso, kv * 4);

      // la ventanilla se apaga: queda solo el contorno (lo dibuja la libreta)
      opacidad(c.apagado, sale);
      opacidad(c.ventana, 1 - tramo(t, [tt.salida[0] + 0.2, 0.3]));
      opacidad(c.bandeja, 1 - sale);
      opacidad(c.vaso, kv * 4 * (1 - sale));
    },
  };
}
