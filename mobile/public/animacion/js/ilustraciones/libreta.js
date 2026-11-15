// Ilustración: la libreta. Tapa negra con su nombre, cinta rosa, goma
// elástica, y la hoja de dentro (renglones, motas, fecha) con la ruta y la
// pluma colgada de su hilo.

import { COLOR, MOSAICO } from '../config.js';
import { texto } from '../motor/letras.js';
import { el, formaMosaico, motas, tinta } from '../motor/trazo.js';

const X0 = MOSAICO.cx - MOSAICO.lado / 2, Y0 = MOSAICO.cy - MOSAICO.lado / 2;

/** La tapa (gira sobre su lado izquierdo). */
export function dibujarTapa(padre) {
  const g = el('g', {}, padre);
  const relleno = tinta(g, formaMosaico(), { relleno: COLOR.negro, ancho: 0, amp: 1.1 });
  const borde = tinta(g, formaMosaico(), { color: COLOR.crema, ancho: 1.9, amp: 1.3 });
  const nombre = texto(g, 'DIARIO', { x: MOSAICO.cx, y: 486, tam: 11, familia: 'geo', peso: 500, espaciado: 3.2 });
  // la goma elástica: un trazado que se recalcula en cada fotograma
  const goma = el('path', { fill: 'none', stroke: COLOR.crema, 'stroke-width': 7, 'stroke-linecap': 'round' }, padre);
  const tension = el('g', {}, padre);
  const lineasTension = [0, 1].map(() =>
    el('path', { fill: 'none', stroke: COLOR.rosa, 'stroke-width': 1.5, 'stroke-linecap': 'round' }, tension),
  );
  return { g, relleno, borde, nombre, goma, tension, lineasTension };
}

/** La ruta: de mi casa (punto rosa) a la tuya (la X), con un rodeo. */
export const RUTA =
  'M542,325 C560,346 575,360 600,368 C640,380 700,378 714,342 C727,304 692,280 655,281 C615,283 590,309 592,340 C594,375 622,394 660,400 C688,404 704,405 724,405';

export function dibujarPagina(padre, defs) {
  const g = el('g', {}, padre);
  // la cinta rosa (asoma por abajo)
  const cinta = el('g', {}, g);
  el('path', { d: `M${X0 + 12},470 L${X0 + 25},470 L${X0 + 25},567 L${X0 + 18.5},559 L${X0 + 12},567 Z`, fill: COLOR.rosa }, cinta);

  const hoja = el('g', {}, g);
  const delante = el('g', {}, hoja);
  // el canto de las hojas (dos contornos desplazados)
  tinta(delante, formaMosaico(0, 7, 5), { relleno: COLOR.cremaSombra, color: COLOR.crema, ancho: 1.4, amp: 1.2 });
  tinta(delante, formaMosaico(0, 3.5, 2.5), { relleno: COLOR.crema, color: COLOR.rayas, ancho: 1.2, amp: 1.2 });
  tinta(delante, formaMosaico(), { relleno: COLOR.crema, color: COLOR.crema, ancho: 1.6, amp: 1.2, doble: true });
  // renglones, motas, fecha
  let r = '';
  for (let y = Y0 + 48; y < Y0 + 290; y += 31.5) r += `M${X0 + (y < Y0 + 90 ? 82 : 26)},${y} L${X0 + 268},${y + 0.5} `;
  tinta(delante, r, { color: COLOR.rayas, ancho: 1.8, amp: 0.7, paso: 9 });
  tinta(delante, motas(X0 + 20, Y0 + 20, 260, 260, 40, 9), { color: COLOR.tinta, ancho: 1, amp: 0.2, opacidad: 0.55 });
  texto(delante, '14', { x: X0 + 26, y: Y0 + 66, tam: 40, familia: 'geo', color: COLOR.tinta, ancla: 'start' });
  texto(delante, 'VIERNES', { x: X0 + 27, y: Y0 + 80, tam: 9.5, familia: 'geo', peso: 600, color: COLOR.tinta, ancla: 'start', espaciado: 0.6 });

  // la ruta discontinua, revelada con una máscara que avanza
  const mascara = el('mask', { id: 'mascaraRuta', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 1280, height: 720 }, defs);
  const guia = el('path', { d: RUTA, fill: 'none', stroke: '#fff', 'stroke-width': 10, 'stroke-linecap': 'round', pathLength: 1 }, mascara);
  const ruta = el('g', { mask: 'url(#mascaraRuta)' }, delante);
  tinta(ruta, RUTA, { color: COLOR.gris, ancho: 2.2, amp: 0.7, discontinuo: '7 6', extremo: 'butt' });
  const punto = el('circle', { cx: 542, cy: 325, r: 4.8, fill: COLOR.rosa }, delante);
  const equis = [
    tinta(delante, 'M717,398 L733,412', { color: COLOR.rosa, ancho: 2.8, amp: 0.4 }),
    tinta(delante, 'M733,398 L717,413', { color: COLOR.rosa, ancho: 2.8, amp: 0.4 }),
  ];

  // el dorso de la hoja (se ve al dar la vuelta)
  const dorso = el('g', { style: 'display:none' }, hoja);
  tinta(dorso, formaMosaico(), { relleno: COLOR.negro, color: COLOR.crema, ancho: 1.8, amp: 1.2 });

  return { g, cinta, hoja, delante, dorso, guia, punto, equis };
}

/** La pluma: punta en (0,0), el cuerpo hacia +x. Negra con borde crema. */
export function dibujarPluma(padre) {
  const hilo = el('path', { fill: 'none', stroke: COLOR.crema, 'stroke-width': 1.5 }, padre);
  const estela = el('g', {}, padre);
  const estelas = [0, 1].map(() =>
    el('path', { fill: 'none', stroke: COLOR.rosa, 'stroke-width': 1.5, 'stroke-dasharray': '6 5', 'stroke-linecap': 'round' }, estela),
  );
  const g = el('g', {}, padre);
  const o = { relleno: COLOR.negro, color: COLOR.crema, ancho: 1.6, amp: 0.4, paso: 4 };
  tinta(g, 'M0,0 L18,-6 L18,6 Z', { ...o, relleno: COLOR.crema });
  tinta(g, 'M18,-9 L132,-10 L132,10 L18,9 Z', o);
  tinta(g, 'M132,-10 L140,-10 L140,10 L132,10 Z', { ...o, relleno: COLOR.crema });
  tinta(g, 'M140,-9 L156,-8 C160,-8 162,-4 162,0 C162,4 160,8 156,8 L140,9 Z', o);
  tinta(g, 'M30,-4 L118,-5', { color: COLOR.crema, ancho: 1, amp: 0.3, opacidad: 0.6 });
  return { g, hilo, estela, estelas, cola: [162, 0] };
}
