// Ilustración: la cámara instantánea y la foto que revela (la ventana de una
// casa frente al mar, con el faro, y dos tazas de café: por fin juntos).

import { COLOR, MOSAICO } from '../config.js';
import { el, elipse, formaMosaico, rectRedondo, tinta, uid } from '../motor/trazo.js';

export function dibujarCamara(padre, defs) {
  const g = el('g', {}, padre);
  const idForma = uid('camara');
  el('path', { d: formaMosaico(1) }, el('clipPath', { id: idForma }, defs));
  tinta(g, formaMosaico(), { relleno: COLOR.crema, ancho: 0, amp: 1.1 });
  const dentro = el('g', { 'clip-path': `url(#${idForma})` }, g);
  // la banda negra
  tinta(dentro, 'M470,272 L810,273 L810,425 L470,424 Z', { relleno: COLOR.negro, color: COLOR.negro, ancho: 2, amp: 0.8 });
  // la ranura de la foto
  tinta(g, 'M518,455 L762,456', { color: COLOR.negro, ancho: 9, amp: 0.6 });
  tinta(g, 'M504,468 L776,469', { color: COLOR.negro, ancho: 1.6, amp: 0.8 });
  // visor (se enciende)
  const visorLuz = el('rect', { x: 554, y: 228, width: 56, height: 30, rx: 4, fill: '#FFFFFF', opacity: 0 }, g);
  tinta(g, rectRedondo(552, 226, 60, 34, 5), { color: COLOR.negro, ancho: 2, amp: 0.6 });
  // flash
  tinta(g, rectRedondo(702, 300, 50, 20, 3), { relleno: COLOR.crema, color: COLOR.crema, ancho: 1, amp: 0.4 });
  // objetivo: anillo, cristal y un brillo
  tinta(g, elipse(640, 355, 52), { relleno: COLOR.crema, color: COLOR.crema, ancho: 2, amp: 0.6 });
  tinta(g, elipse(640, 355, 43), { relleno: COLOR.negro, color: COLOR.negro, ancho: 2, amp: 0.6 });
  tinta(g, elipse(640, 355, 34), { relleno: COLOR.crema, color: COLOR.negro, ancho: 2.4, amp: 0.6 });
  tinta(g, 'M620,346 C623,336 631,329 641,327', { color: COLOR.negro, ancho: 1.6, amp: 0.3 });
  // el botón rosa
  el('circle', { cx: 727, cy: 393, r: 16, fill: COLOR.rosa }, g);
  // el contorno: crema de noche, negro de día (cambia con el flash)
  const bordeNoche = tinta(g, formaMosaico(), { color: COLOR.crema, ancho: 2, amp: 1.2 });
  const bordeDia = tinta(g, formaMosaico(), { color: COLOR.tinta, ancho: 2.2, amp: 1.2 });
  return { g, visorLuz, bordeNoche, bordeDia };
}

export function dibujarFoto(padre, defs) {
  const g = el('g', {}, padre);
  const o = { color: COLOR.tinta, ancho: 1.4, amp: 0.5 };
  tinta(g, formaMosaico(), { relleno: COLOR.crema, color: COLOR.tinta, ancho: 2.1, amp: 1.2 });
  const idForma = uid('foto');
  el('path', { d: formaMosaico(3) }, el('clipPath', { id: idForma }, defs));
  const dentro = el('g', { 'clip-path': `url(#${idForma})` }, g);

  // el mar y el faro
  tinta(dentro, 'M522,388 L712,389', o);
  tinta(dentro, 'M540,401 q6,-4 12,0 M592,405 q6,-4 12,0 M630,398 q5,-3 10,0 M684,403 q6,-4 12,0', { ...o, ancho: 1 });
  tinta(dentro, 'M600,388 L600,375 L611,375 L611,368 L621,368 L621,375 L700,375 L700,388', o);
  tinta(dentro, 'M596,388 C602,380 612,383 617,388 M688,388 C694,381 703,383 708,388', { ...o, ancho: 1.1 });
  tinta(dentro, 'M652,375 L656,282 L668,282 L672,375', o);
  tinta(dentro, 'M649,282 L675,282 M653,282 L655,267 L669,267 L671,282 M655,267 C656,256 668,256 669,267 M662,257 L662,247', o);
  // celosía del faro (el sombreado a rayas de la referencia)
  tinta(dentro, 'M656,298 L669,318 M668,298 L656,318 M655,323 L670,346 M669,323 L655,346 M654,350 L671,372 M670,350 L654,372', {
    ...o,
    ancho: 0.9,
  });
  tinta(dentro, 'M678,270 L702,263 M678,275 L704,282', { ...o, ancho: 0.9, discontinuo: '3 3' });
  tinta(dentro, 'M582,318 q5,-6 9,0 q4,-6 9,0', { ...o, ancho: 1.1 });

  // las cortinas
  tinta(dentro, 'M558,212 C532,236 523,262 521,302 L520,500 M541,226 C533,262 532,300 533,362', o);
  tinta(dentro, 'M706,212 C701,282 708,342 728,400 C742,440 758,470 774,498 M722,212 C722,292 738,350 768,402 M740,212 C748,262 764,302 792,332', o);

  // la mesa, las dos tazas y la servilleta rosa
  tinta(dentro, 'M488,432 L734,432 L734,446 L488,446', { ...o, relleno: COLOR.crema });
  tinta(dentro, 'M534,446 L538,490 M548,446 L540,470 M716,446 L722,490 M704,446 L716,470', o);
  const taza = (x) => {
    tinta(dentro, elipse(x, 428, 19, 3.6), { ...o, relleno: COLOR.crema });
    tinta(dentro, `M${x - 13},405 L${x + 13},405 L${x + 10},424 C${x + 9},428 ${x - 9},428 ${x - 10},424 Z`, { ...o, relleno: COLOR.crema });
    tinta(dentro, elipse(x, 406.5, 11, 2.2), { ...o, relleno: COLOR.tinta, ancho: 1 });
    tinta(dentro, `M${x + 13},409 C${x + 21},409 ${x + 21},419 ${x + 11},419`, o);
  };
  taza(566);
  taza(620);
  tinta(dentro, 'M512,431 L534,417 L541,432 Z', { relleno: COLOR.rosa, color: COLOR.rosa, ancho: 1, amp: 0.3 });
  // vapor (animación CSS independiente)
  const vapor = el('g', {}, dentro);
  ['M562,398 c-5,-6 5,-10 0,-16 c-5,-6 5,-10 0,-16', 'M572,396 c-5,-6 5,-10 0,-16', 'M616,398 c-5,-6 5,-10 0,-16 c-5,-6 5,-10 0,-16', 'M626,396 c-5,-6 5,-10 0,-16'].forEach(
    (d, i) => tinta(vapor, d, { ...o, ancho: 1, clase: `vapor vapor${i}` }),
  );
  return { g };
}
