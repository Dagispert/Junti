// ─────────────────────────────────────────────────────────────────────────────
// FONDO
// Negro con esquirlas desenfocadas flotando (la profundidad de la referencia),
// el flash que inunda la pantalla de crema (de la noche al día), el
// viñeteado y el grano de película.
// ─────────────────────────────────────────────────────────────────────────────

import { CAMBIO_FONDO, COLOR, ESCENARIO, FIN } from './config.js';
import { CURVA, tramo } from './motor/tiempo.js';
import { azar, el } from './motor/trazo.js';

export function crearFondo({ svg, defs, capaCamara, raiz }) {
  const { ancho: W, alto: H } = ESCENARIO;

  // Base: el color del cielo de la película.
  const base = el('rect', { x: -400, y: -400, width: W + 800, height: H + 800, fill: COLOR.negro }, svg);

  // Esquirlas: polígonos irregulares, desenfocados según su profundidad. Las
  // mueve una animación CSS independiente (deriva lenta) y la cámara las
  // desplaza menos que el primer plano (paralaje).
  [1.5, 3, 5.5].forEach((sd, i) => {
    const fl = el('filter', { id: `desenfoque${i}`, x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
    el('feGaussianBlur', { stdDeviation: sd }, fl);
  });
  const esquirlas = el('g', { class: 'esquirlas' }, svg);
  const r = azar(11);
  const capasParalaje = [0.15, 0.35, 0.6].map(() => el('g', {}, esquirlas));
  for (let i = 0; i < 22; i++) {
    const prof = i % 3;
    const cx = r() * W, cy = r() * H;
    // nunca justo detrás del mosaico central
    if (Math.abs(cx - 640) < 190 && Math.abs(cy - 360) < 190 && prof < 2) continue;
    const tam = 40 + r() * (prof === 2 ? 220 : 110);
    const lados = r() < 0.6 ? 3 : 4;
    let pts = '';
    for (let k = 0; k < lados; k++) {
      const a = (k / lados) * Math.PI * 2 + r() * 1.2;
      const rr = tam * (0.35 + r() * 0.65);
      pts += `${(cx + Math.cos(a) * rr * 0.5).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)} `;
    }
    const g = el('g', { filter: `url(#desenfoque${prof})` }, capasParalaje[prof]);
    el(
      'polygon',
      {
        points: pts,
        class: 'esquirla',
        style: `--dx:${(r() * 60 - 30).toFixed(0)}px;--dy:${(r() * 40 - 20).toFixed(0)}px;--giro:${(r() * 50 - 25).toFixed(
          0,
        )}deg;animation-duration:${(9 + r() * 12).toFixed(1)}s;animation-delay:${(-r() * 10).toFixed(1)}s;opacity:${(
          0.5 +
          prof * 0.2
        ).toFixed(2)}`,
      },
      g,
    );
  }

  // El flash: un círculo crema que crece desde el flash de la cámara. Vive en
  // la capa de la cámara (sale de un objeto de la escena) pero debajo de todo.
  const destello = el('circle', { r: 1, fill: COLOR.crema, style: 'display:none' }, capaCamara);

  // Viñeteado (dos versiones, se funden en el cambio de fondo).
  const grad = (id, borde, alfa) => {
    const g = el('radialGradient', { id, cx: '50%', cy: '48%', r: '75%' }, defs);
    el('stop', { offset: '45%', 'stop-color': borde, 'stop-opacity': 0 }, g);
    el('stop', { offset: '100%', 'stop-color': borde, 'stop-opacity': alfa }, g);
  };
  grad('vinetaNoche', '#000', 0.75);
  grad('vinetaDia', COLOR.cremaVineta, 0.9);
  const vinetaNoche = el('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#vinetaNoche)', 'pointer-events': 'none' });
  const vinetaDia = el('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#vinetaDia)', 'pointer-events': 'none' });

  return {
    /** Se llama al final del montaje para que el viñeteado quede encima. */
    cubrir() {
      svg.appendChild(vinetaNoche);
      svg.appendChild(vinetaDia);
    },
    pintar(t, cam) {
      const { t: tc, dur, origen } = CAMBIO_FONDO;
      const k = tramo(t, [tc, dur], CURVA.entra);
      const dia = t >= tc + dur && t < FIN;
      base.setAttribute('fill', dia ? COLOR.crema : COLOR.negro);
      raiz.classList.toggle('dia', dia);
      // el flash crece hasta tapar la pantalla, luego el fondo ya es crema
      const flash = k > 0 && k < 1 && t < FIN;
      destello.style.display = flash ? '' : 'none';
      if (flash) {
        destello.setAttribute('cx', origen[0]);
        destello.setAttribute('cy', origen[1]);
        destello.setAttribute('r', (8 + k * 1500).toFixed(1));
      }
      vinetaNoche.style.opacity = dia ? 0 : 1;
      vinetaDia.style.opacity = dia ? 1 : 0;
      esquirlas.style.display = t >= FIN ? 'none' : '';
      // paralaje: cada capa sigue a la cámara en distinta medida
      capasParalaje.forEach((g, i) => {
        const f = [0.15, 0.35, 0.6][i];
        const s = 1 + (cam.s - 1) * f;
        g.setAttribute(
          'transform',
          `translate(${W / 2 - cam.x * f},${H / 2 - cam.y * f}) scale(${s.toFixed(4)}) translate(${-W / 2},${-H / 2})`,
        );
      });
    },
  };
}

/** Grano de película: ruido pintado una vez en un lienzo, que salta 12 veces por segundo (CSS). */
export function crearGrano(contenedor) {
  const c = document.createElement('canvas');
  c.width = c.height = 220;
  const x = c.getContext('2d');
  const img = x.createImageData(220, 220);
  const r = azar(5);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = r() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const d = document.createElement('div');
  d.className = 'grano';
  d.style.backgroundImage = `url(${c.toDataURL()})`;
  contenedor.appendChild(d);
  return d;
}

