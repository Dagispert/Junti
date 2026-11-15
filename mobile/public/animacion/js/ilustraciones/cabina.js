// Ilustración: la cabina del avión. Ventanilla (el mosaico), cielo con mar de
// nubes, asientos dibujados en línea crema, bandeja y vaso rosa, y el foco de
// luz oliva que los recorta de la noche.

import { COLOR, MOSAICO } from '../config.js';
import { el, elipse, formaMosaico, rectRedondo, tinta, uid } from '../motor/trazo.js';

/** Nube de borde festoneado (base plana, bultos arriba). */
export function nube(x, y, ancho) {
  const s = ancho / 110;
  const p = (dx, dy) => `${(x + dx * s).toFixed(1)},${(y + dy * s).toFixed(1)}`;
  return `M${p(0, 0)} L${p(110, 0)} A${14 * s},${14 * s} 0 0 0 ${p(90, -13)} A${19 * s},${19 * s} 0 0 0 ${p(56, -22)} A${
    16 * s
  },${16 * s} 0 0 0 ${p(26, -12)} A${13 * s},${13 * s} 0 0 0 ${p(0, 0)} Z`;
}

/** Mar de nubes: una línea larga de festones (se repite cada «periodo»). */
function marDeNubes(x0, x1, y, periodo = 46) {
  let d = `M${x0},${y}`;
  for (let x = x0; x < x1; x += periodo / 2) {
    const r = periodo / 4 + ((x * 7) % 5);
    d += ` A${r},${r} 0 0 1 ${x + periodo / 2},${y}`;
  }
  return d;
}

const ASIENTO = [
  // reposacabezas
  'M372,300 C380,290 392,286 402,290 L458,348 C464,356 463,388 456,392 L384,390 C372,389 366,380 366,370 Z',
  'M382,308 C388,301 396,299 402,303 L448,352 C452,358 452,376 448,380 L390,379 C382,378 378,373 378,366 Z',
  // respaldo
  'M314,724 L314,404 C314,392 322,386 334,386 L448,386 C462,386 472,394 472,408 L472,724',
  'M328,724 L328,412 C328,404 334,400 342,400 L452,400 C458,400 460,404 460,410 L460,724',
  // asiento de delante
  'M474,724 L477,636 C478,622 488,614 500,614 L572,614 C584,614 590,622 586,634 L562,724',
  'M490,724 L491,646 C491,635 498,628 508,628 L566,628',
];

export function dibujarCabina(padre, defs) {
  const g = el('g', {}, padre);
  const { cx } = MOSAICO;

  // ── el foco de luz ──
  const gr = el('radialGradient', { id: 'focoCabina' }, defs);
  el('stop', { offset: '0%', 'stop-color': COLOR.oliva }, gr);
  el('stop', { offset: '78%', 'stop-color': COLOR.oliva }, gr);
  el('stop', { offset: '100%', 'stop-color': COLOR.oliva, 'stop-opacity': 0 }, gr);
  const foco = el('circle', { cx, cy: 450, r: 350, fill: 'url(#focoCabina)' }, g);

  // ── el haz de sol (recortado al foco) ──
  const idFoco = uid('foco');
  el('circle', { cx, cy: 450, r: 330 }, el('clipPath', { id: idFoco }, defs));
  const luzCapa = el('g', { 'clip-path': `url(#${idFoco})` }, g);
  const luz = el('polygon', { points: '250,400 420,330 520,720 300,720', fill: COLOR.crema, opacity: 0 }, luzCapa);

  // ── asientos (izquierda y su espejo) ──
  const asientos = el('g', {}, g);
  const lados = [el('g', {}, asientos), el('g', { transform: 'translate(1280,0) scale(-1,1)' }, asientos)];
  const trazosAsiento = [];
  lados.forEach((lado) =>
    ASIENTO.forEach((d) => trazosAsiento.push(tinta(lado, d, { color: COLOR.crema, ancho: 1.4, amp: 1.1, opacidad: 0.82 }))),
  );

  // ── la ventanilla ──
  const ventana = el('g', {}, g);
  const marco = tinta(ventana, formaMosaico(), { relleno: COLOR.crema, color: COLOR.crema, ancho: 2, amp: 1.2 });
  tinta(ventana, formaMosaico(9), { relleno: COLOR.crema, color: COLOR.negro, ancho: 1.9, amp: 0.9 });
  const idCristal = uid('cristal');
  el('path', { d: formaMosaico(11) }, el('clipPath', { id: idCristal }, defs));
  const cristal = el('g', { 'clip-path': `url(#${idCristal})` }, ventana);
  // fuera: mar de nubes lejano y nubes que pasan
  const lejos = el('g', {}, cristal);
  tinta(lejos, marDeNubes(300, 1300, 448, 44), { color: COLOR.negro, ancho: 1.6, amp: 0.6 });
  tinta(lejos, marDeNubes(300, 1300, 468, 60), { color: COLOR.negro, ancho: 1.1, amp: 0.6, opacidad: 0.6 });
  const pasan = el('g', {}, cristal);
  const nubes = [
    [520, 395, 90],
    [700, 372, 120],
    [880, 410, 70],
    [1020, 385, 105],
  ].map(([x, y, w]) => tinta(pasan, nube(x, y, w), { relleno: COLOR.crema, color: COLOR.negro, ancho: 1.5, amp: 0.7 }));
  // la cortinilla enrollada arriba, con sus dos tornillos
  el('rect', { x: 480, y: 200, width: 320, height: 100, fill: COLOR.cremaSombra }, cristal);
  tinta(cristal, 'M490,262 L790,263 M490,282 L790,281', { color: COLOR.negro, ancho: 0.8, amp: 0.5, opacidad: 0.25 });
  tinta(cristal, 'M488,300 L792,301 M488,307 L792,306', { color: COLOR.negro, ancho: 1.8, amp: 0.6 });
  tinta(cristal, 'M500,348 L780,347', { color: COLOR.negro, ancho: 3.6, amp: 0.6 }); // el asa
  tinta(cristal, elipse(517, 297, 3.6) + elipse(762, 297, 3.6), { color: COLOR.negro, ancho: 1.4, amp: 0.3 });
  // rayas rosas de velocidad (cuando las nubes pasan deprisa)
  const prisa = el('g', { opacity: 0 }, ventana);
  tinta(prisa, 'M770,330 L800,330 M778,392 L812,392 M772,455 L798,455 M760,420 L790,420', {
    color: COLOR.rosa,
    ancho: 1.6,
    amp: 0.4,
  });
  // doble contorno del cristal
  tinta(ventana, formaMosaico(12), { color: COLOR.negro, ancho: 1, amp: 1.2 });

  // ── bandeja y vaso ──
  const bandeja = tinta(g, rectRedondo(546, 527, 188, 15, 6), { color: COLOR.crema, ancho: 1.7, amp: 0.6 });
  const vaso = el('g', {}, g);
  tinta(vaso, 'M574,489 L598,489 L595,524 L577,524 Z', { relleno: COLOR.rosa, color: COLOR.rosa, ancho: 1.2, amp: 0.5 });
  tinta(vaso, 'M576,497 L597,497 M577,505 L596,505 M577,513 L596,513', { color: COLOR.rosaOscuro, ancho: 1.2, amp: 0.3 });
  tinta(vaso, 'M576,489 L597,489', { color: COLOR.crema, ancho: 1, amp: 0.2, opacidad: 0.7 });

  // tapa negra para el final (la ventanilla se apaga)
  const apagado = tinta(g, formaMosaico(), { relleno: COLOR.negro, ancho: 0, amp: 1.1 });

  return { g, foco, luz, asientos, trazosAsiento, ventana, marco, lejos, pasan, nubes, prisa, bandeja, vaso, apagado };
}
