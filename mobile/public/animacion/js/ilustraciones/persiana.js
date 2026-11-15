// Ilustración: persiana de lamas con su cordón (noche, tinta crema y negra).

import { COLOR, MOSAICO } from '../config.js';
import { el, formaMosaico, tinta, uid } from '../motor/trazo.js';

const X0 = MOSAICO.cx - MOSAICO.lado / 2, Y0 = MOSAICO.cy - MOSAICO.lado / 2, L = MOSAICO.lado;

export function dibujarPersiana(padre, defs) {
  const g = el('g', {}, padre);

  // recorte 1: la forma del mosaico; recorte 2: lo desenrollado (rect animado)
  const idForma = uid('forma'), idRollo = uid('rollo');
  el('path', { d: formaMosaico(3) }, el('clipPath', { id: idForma }, defs));
  const rollo = el('rect', { x: X0 - 10, y: Y0, width: L + 20, height: 0 }, el('clipPath', { id: idRollo }, defs));

  const dentro = el('g', { 'clip-path': `url(#${idForma})` }, g);
  const lamas = el('g', { 'clip-path': `url(#${idRollo})` }, dentro);
  el('rect', { x: X0, y: Y0, width: L, height: L, fill: COLOR.crema }, lamas);
  // las lamas: rayas negras irregulares, una cada 12 px
  let d = '';
  for (let y = Y0 + 8; y < Y0 + L; y += 11.2) d += `M${X0 - 4},${y.toFixed(1)} L${X0 + L + 4},${(y + 0.8).toFixed(1)} `;
  tinta(lamas, d, { color: COLOR.negro, ancho: 4.2, amp: 0.45, paso: 10 });
  // los cordones que atraviesan las lamas
  tinta(lamas, `M${MOSAICO.cx},${Y0} L${MOSAICO.cx + 1},${Y0 + L}`, { color: COLOR.negro, ancho: 6, amp: 0.6 });
  tinta(lamas, `M${MOSAICO.cx - 32},${Y0} L${MOSAICO.cx - 31},${Y0 + L}`, { color: COLOR.negro, ancho: 3.2, amp: 0.5 });

  // la barra de abajo, que va con el borde de la persiana
  const barra = el('g', {}, dentro);
  el('rect', { x: X0, y: -8, width: L, height: 9, fill: COLOR.crema }, barra);
  tinta(barra, `M${X0},${-8} L${X0 + L},${-7} M${X0},1 L${X0 + L},1.5`, { color: COLOR.negro, ancho: 3, amp: 0.6 });

  // el marco grueso de la persiana
  const marco = tinta(g, formaMosaico(), { color: COLOR.crema, ancho: 5.5, amp: 1.2, doble: true });

  // el cordón con su bola rosa, colgado de arriba a la izquierda
  const cordon = el('g', {}, g);
  const hilo = tinta(cordon, `M456,${Y0 - 12} L455,${Y0 + 160} L456,${Y0 + 292}`, { ancho: 1.6, amp: 0.8 });
  const bola = el('circle', { cx: 456, cy: Y0 + 294, r: 4.6, fill: COLOR.rosa }, cordon);

  return { g, rollo, barra, marco, cordon, hilo, bola, X0, Y0, L };
}
