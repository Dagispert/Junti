// Escena 5 · El mapa: «la ruta hasta ti». La cinta cae, la tapa se abre y
// queda la hoja. Una pluma colgada de un hilo entra balanceándose, marca mi
// punto y dibuja la ruta discontinua (con su rodeo) hasta la X rosa. Se va
// balanceándose y la hoja se da la vuelta hacia arriba (calendario).

import { MOSAICO, T } from '../config.js';
import { RUTA, dibujarPagina, dibujarPluma } from '../ilustraciones/libreta.js';
import { CURVA, amortiguado, clamp, lerp, tramo } from '../motor/tiempo.js';
import { el, revelar } from '../motor/trazo.js';
import { mover, opacidad, ver, voltearY } from '../transiciones.js';

const Y0 = MOSAICO.cy - MOSAICO.lado / 2;
const ANCLA = [420, -90]; // de donde cuelga el hilo (fuera de cuadro)

export function crear({ capa, defs }) {
  const p = dibujarPagina(capa, defs);
  const pl = dibujarPluma(capa);
  const tl = T.libreta, tt = T.mapa;

  // para seguir la ruta con la punta
  const medidor = el('path', { d: RUTA }, defs);
  const L = medidor.getTotalLength();
  const enRuta = (k) => {
    const a = medidor.getPointAtLength(L * clamp(k));
    const b = medidor.getPointAtLength(L * clamp(k + 0.01));
    return { x: a.x, y: a.y, ang: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI };
  };

  return {
    pintar(t) {
      // la cinta rosa cae (y se mece un poco)
      const kc = tramo(t, tl.cinta, CURVA.sale);
      mover(p.cinta, { y: -90 * (1 - kc), ox: 506, oy: 470, r: amortiguado(t, tl.cinta[0] + tl.cinta[1], 1.6, 3) * 6 });
      opacidad(p.cinta, kc * 3);
      ver(p.hoja, t >= tl.abre[0]);

      // la ruta y sus marcas
      p.guia.style.strokeDasharray = '1 2';
      p.guia.style.strokeDashoffset = String(1 - tramo(t, tt.dibuja, CURVA.suave));
      const kp = tramo(t, tt.punto, CURVA.lineal);
      p.punto.setAttribute('r', (4.8 * CURVA.rebote(kp)).toFixed(2));
      opacidad(p.punto, kp * 4);
      revelar(p.equis[0], tramo(t, [tt.equis[0], tt.equis[1] / 2], CURVA.sale));
      revelar(p.equis[1], tramo(t, [tt.equis[0] + tt.equis[1] / 2, tt.equis[1] / 2], CURVA.sale));

      // ── la pluma ──
      // posición de la punta y giro del cuerpo (el cuerpo apunta abajo-izquierda)
      let x, y, giro, rapida = 0;
      const ke = tramo(t, tt.plumaEntra, CURVA.sale);
      const ks = tramo(t, tt.plumaSale, CURVA.entra);
      const kd = tramo(t, tt.dibuja, CURVA.suave);
      if (t < tt.dibuja[0]) {
        // entra en arco desde abajo a la izquierda, como un péndulo
        x = lerp(330, 542, ke) - Math.sin(Math.PI * ke) * 40;
        y = lerp(700, 325, ke);
        giro = 150 - 12 * (1 - ke) + amortiguado(t, tt.plumaEntra[0] + tt.plumaEntra[1], 2.2, 5) * 8;
        rapida = 1 - ke;
      } else if (t < tt.equis[0] + tt.equis[1]) {
        const q = enRuta(kd);
        x = q.x;
        y = q.y;
        giro = 140 + Math.sin(q.ang / 40) * 6; // la mano gira un poco con la curva
        // al final salta a la X
        const kx = tramo(t, tt.equis, CURVA.entraSale);
        x += 4 * kx;
        y += 2 * Math.sin(Math.PI * kx) * -8;
      } else {
        // sale columpiándose hacia abajo a la derecha
        x = lerp(728, 870, ks) + Math.sin(Math.PI * ks) * 30;
        y = lerp(407, 780, ks);
        giro = 140 - 70 * ks;
        rapida = ks;
      }
      const visible = ke > 0 && ks < 1;
      ver(pl.g, visible);
      ver(pl.hilo, visible);
      ver(pl.estela, visible && rapida > 0.05);
      if (visible) {
        mover(pl.g, { x, y, r: giro });
        // la cola de la pluma, donde se ata el hilo
        const a = (giro * Math.PI) / 180;
        const cx = x + Math.cos(a) * pl.cola[0], cy = y + Math.sin(a) * pl.cola[0];
        // el hilo cuelga con algo de comba
        const mx = (ANCLA[0] + cx) / 2 - 30, my = (ANCLA[1] + cy) / 2 + 40;
        pl.hilo.setAttribute('d', `M${ANCLA[0]},${ANCLA[1]} Q${mx.toFixed(1)},${my.toFixed(1)} ${cx.toFixed(1)},${cy.toFixed(1)}`);
        // estela rosa de movimiento detrás de la cola
        pl.estelas.forEach((e, i) => {
          const off = (i ? 9 : -9) + 0;
          const dx = Math.cos(a + Math.PI / 2) * off, dy = Math.sin(a + Math.PI / 2) * off;
          const lx = Math.cos(a) * 60, ly = Math.sin(a) * 60;
          e.setAttribute('d', `M${(cx + dx).toFixed(1)},${(cy + dy).toFixed(1)} l${lx.toFixed(1)},${ly.toFixed(1)}`);
        });
        opacidad(pl.estela, rapida * 1.5);
      }

      // ── la hoja se da la vuelta hacia arriba ──
      const kv = tramo(t, tt.volteo, CURVA.entraSale);
      const frente = voltearY(p.hoja, Math.PI * kv, Y0, MOSAICO.cx);
      ver(p.delante, frente);
      ver(p.dorso, !frente);
      opacidad(p.cinta, kc * 3 * (1 - kv * 2));
    },
  };
}
