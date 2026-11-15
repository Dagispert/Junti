// Ilustración: reloj de paletas en el mosaico (noche, tinta crema).

import { COLOR } from '../config.js';
import { cifraVolteable } from '../motor/letras.js';
import { el, elipse, formaMosaico, tinta } from '../motor/trazo.js';

export function dibujarReloj(padre, defs) {
  const g = el('g', {}, padre);
  // el mosaico: relleno negro, contorno fino crema
  const caja = tinta(g, formaMosaico(), { relleno: COLOR.negro, color: COLOR.crema, ancho: 2.1, amp: 1.1 });
  const cifras = el('g', {}, g);
  const op = { alto: 172, color: COLOR.crema, veta: COLOR.negro, grosor: 13 };
  const izq = cifraVolteable(cifras, defs, { x: 512, y: 276, valores: [5], ...op });
  const der = cifraVolteable(cifras, defs, { x: 664, y: 276, valores: [8, 9], ...op });
  // la bisagra de las paletas: una raya negra que corta las cifras
  const bisagra = tinta(cifras, 'M502,362 L628,361 M654,362 L784,361', { color: COLOR.negro, ancho: 3.2, amp: 0.6 });
  // la separación entre paletas
  const division = tinta(g, 'M640,213 L641,512', { color: COLOR.crema, ancho: 2.4, amp: 0.9, doble: true });
  // la alarma: un piloto rosa y su anillo
  const piloto = el('circle', { cx: 815, cy: 487, r: 6, fill: COLOR.rosa, class: 'piloto' }, g);
  const anillo = tinta(g, elipse(814, 508, 4.2), { ancho: 1.3, amp: 0.3 });
  return { g, caja, cifras, izq, der, bisagra, division, piloto, anillo };
}
