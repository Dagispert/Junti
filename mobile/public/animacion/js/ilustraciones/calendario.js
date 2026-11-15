// Ilustración: calendario de taco. Cabecera rosa con el mes, hojas negras con
// el día en cifras crema de rotulador, hilos rosas de la encuadernación y el
// montón de hojas ya pasadas por encima.

import { COLOR, MOSAICO } from '../config.js';
import { anchoNumero, numero, texto } from '../motor/letras.js';
import { el, formaMosaico, tinta, uid } from '../motor/trazo.js';

const Y0 = MOSAICO.cy - MOSAICO.lado / 2;
export const BISAGRA_HOJA = Y0 + 36; // las hojas giran bajo la cabecera

export function dibujarCalendario(padre, defs, dias = ['14', '15', '16']) {
  const g = el('g', {}, padre);
  // el montón de hojas pasadas (detrás, por encima de la cabecera)
  const monton = el('g', {}, g);
  tinta(monton, `M474,${Y0 + 4} C470,160 464,110 458,74 C540,62 730,58 794,50 C792,100 788,160 792,${Y0 + 4}`, {
    relleno: COLOR.negro,
    color: COLOR.crema,
    ancho: 1.8,
    amp: 1.6,
    cierre: false,
  });
  tinta(monton, 'M466,104 C560,92 700,88 790,80', { color: COLOR.crema, ancho: 1, amp: 1.2, opacidad: 0.6 });
  // hilos rosas de la encuadernación
  const hilos = tinta(g, 'M532,40 L534,226 M728,44 L726,226', { color: COLOR.rosa, ancho: 1.6, amp: 1.4 });

  const cuerpo = el('g', {}, g);
  // el grosor del taco
  tinta(cuerpo, formaMosaico(0, 0, 18), { relleno: COLOR.negro, color: COLOR.crema, ancho: 1.6, amp: 1.4 });
  tinta(cuerpo, formaMosaico(0, 0, 9), { relleno: COLOR.negro, color: COLOR.crema, ancho: 1.4, amp: 1.4 });

  // las hojas (la primera encima)
  const idForma = uid('cal');
  el('path', { d: formaMosaico(1) }, el('clipPath', { id: idForma }, defs));
  const hojasCapa = el('g', {}, cuerpo);
  const hojas = dias
    .slice()
    .reverse()
    .map((dia) => {
      const h = el('g', {}, hojasCapa);
      const delante = el('g', {}, h);
      tinta(delante, formaMosaico(), { relleno: COLOR.negro, color: COLOR.crema, ancho: 2, amp: 1.2 });
      const alto = 122;
      numero(delante, dia, { x: MOSAICO.cx - anchoNumero(dia, alto) / 2, y: 318, alto, color: COLOR.crema, veta: COLOR.negro, grosor: 16 });
      tinta(delante, 'M534,252 L534,500 M726,252 L726,500', { color: COLOR.rosa, ancho: 1.1, amp: 1.2, opacidad: 0.7 });
      const dorso = el('g', { style: 'display:none' }, h);
      tinta(dorso, formaMosaico(), { relleno: COLOR.negro, color: COLOR.crema, ancho: 1.8, amp: 1.4 });
      return { h, delante, dorso };
    })
    .reverse();

  // la cabecera rosa con el mes
  const cabecera = el('g', { 'clip-path': `url(#${idForma})` }, cuerpo);
  el('rect', { x: 480, y: Y0, width: 320, height: 36, fill: COLOR.rosa }, cabecera);
  tinta(cabecera, `M482,${BISAGRA_HOJA} L798,${BISAGRA_HOJA + 1}`, { color: COLOR.negro, ancho: 1.6, amp: 0.6 });
  texto(cuerpo, 'AGO', { x: 556, y: Y0 + 26, tam: 18, familia: 'geo', peso: 600, color: COLOR.negro, ancla: 'start', espaciado: 2 });
  tinta(cuerpo, formaMosaico(), { color: COLOR.crema, ancho: 2.2, amp: 1.2 });

  return { g, monton, hilos, cuerpo, hojas };
}
