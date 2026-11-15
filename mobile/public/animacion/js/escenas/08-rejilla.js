// Escena 8 · La rejilla: la cámara se aleja y la foto resulta ser un mosaico
// más entre todos los trocitos de vuestra vida a distancia. Los mosaicos
// brotan desde el centro hacia fuera; un cursor rosa toca el mapa, da un
// corazón y pasa el día en la fecha. Mientras, llega un mensaje, sube un
// grado allí y la nota de voz suena. Corte a negro.

import { MOSAICO, T } from '../config.js';
import { dibujarMosaicos } from '../ilustraciones/mosaicos.js';
import { CURVA, amortiguado, clamp, pista, tramo } from '../motor/tiempo.js';
import { revelar } from '../motor/trazo.js';
import { brotar, mover, opacidad, ver } from '../transiciones.js';

const MENSAJE = '¡Por fin! Te espero en la salida 3';

export function crear({ capa, defs }) {
  const r = dibujarMosaicos(capa, defs);
  const tt = T.rejilla;
  const [t0, dur] = tt.mosaicos;
  // cada mosaico brota según su distancia al centro
  r.mosaicos.forEach((m) => {
    const d = Math.hypot(m.cx - MOSAICO.cx, m.cy - MOSAICO.cy);
    m.inicio = t0 + (d / 900) * (dur - 0.45);
  });
  const [toquePin, toqueCorazon, toqueFecha] = tt.toques;
  const objetivo = (id) => r.mosaicos.find((m) => m.id === id);
  const CURSOR = [
    [tt.cursor[0], { x: 1320, y: 820 }],
    [toquePin - 0.05, { x: 880, y: 440 }, 'entraSale'],
    [toqueCorazon - 0.05, { x: 1036, y: 280 }, 'entraSale'],
    [toqueFecha - 0.05, { x: 150, y: 360 }, 'entraSale'],
    [toqueFecha + 0.6, { x: 170, y: 380 }, 'sale'],
  ];
  let largoMensaje = 0;

  return {
    pintar(t) {
      // ── los mosaicos brotan ──
      r.mosaicos.forEach((m) => {
        const k = brotar(m.g, t, [m.inicio, 0.45], m.cx, m.cy, 0.55);
        revelar(m.borde, clamp(k * 1.6));
        opacidad(m.dibujo, (k - 0.25) * 2);
      });

      // ── el cursor ──
      const p = pista(t, CURSOR);
      const visibleCursor = t >= tt.cursor[0];
      ver(r.cursor, visibleCursor);
      let pulsa = 0, onda = 1;
      for (const tq of tt.toques) {
        pulsa += Math.max(0, Math.sin(Math.PI * clamp((t - tq) / 0.18)));
        if (t >= tq && t < tq + 0.45) onda = (t - tq) / 0.45;
      }
      mover(r.cursor, { x: p.x, y: p.y, s: 1 - 0.18 * pulsa });
      r.onda.setAttribute('r', (6 + 34 * CURVA.sale(onda)).toFixed(1));
      r.onda.style.opacity = String(onda < 1 ? 1 - onda : 0);

      // el mosaico tocado se hunde un poco y rebota
      [['pin', toquePin], ['corazon', toqueCorazon], ['fecha', toqueFecha]].forEach(([id, tq]) => {
        const m = objetivo(id);
        const hunde = Math.sin(Math.PI * clamp((t - tq) / 0.16)) * 0.05 + amortiguado(t, tq + 0.16, 3, 8) * 0.03;
        if (t >= m.inicio + 0.45) mover(m.g, { ox: m.cx, oy: m.cy, s: 1 - hunde });
      });

      // ── detalles vivos ──
      const { partes } = r;
      // el corazón se llena de rosa al tocarlo
      const kc = tramo(t, [toqueCorazon + 0.05, 0.3], CURVA.rebote);
      opacidad(partes.corazonRelleno, kc);
      // la fecha pasa al día siguiente; allí sube un grado
      partes.dia.voltear(0, tramo(t, [toqueFecha + 0.06, 0.34], CURVA.entra));
      partes.unidades.voltear(0, tramo(t, tt.temperatura, CURVA.entra));
      // la alarma: el minutero corre
      mover(partes.agujas, { ox: 878, oy: 286, r: (t - t0) * 90 });
      // el planeta gira (los meridianos se abren y cierran)
      partes.meridianos.forEach((e, i) => e.setAttribute('rx', Math.abs(38 * Math.cos(t * 1.6 + i * 1.3)).toFixed(1)));
      // la nota de voz suena
      const suena = tramo(t, [t0 + 0.6, 0.4]);
      partes.barras.forEach((b, i) => {
        const h = 10 + (14 + i * 6) * (0.45 + 0.55 * Math.abs(Math.sin(t * 7 + i * 0.9))) * suena;
        b.setAttribute('y', (700 - h).toFixed(1));
        b.setAttribute('height', h.toFixed(1));
      });
      // el mensaje se escribe solo
      const ke = tramo(t, tt.escribe, CURVA.lineal);
      const n = Math.round(MENSAJE.length * ke);
      if (partes.mensaje.textContent !== MENSAJE.slice(0, n)) {
        partes.mensaje.textContent = MENSAJE.slice(0, n);
        largoMensaje = n ? partes.mensaje.getComputedTextLength() : 0;
      }
      partes.caret.setAttribute('x', (24 + largoMensaje).toFixed(1));
      ver(partes.caret, t > tt.escribe[0] - 0.4 && (ke < 1 || Math.floor(t * 3) % 2 === 0));
    },
  };
}
