// Ilustración: la rejilla de recuerdos que rodea a la foto (de día, tinta
// negra). Cada mosaico es un trocito de la vida a distancia: la nota, los
// mensajes, el tiempo que hace allí, la fecha, la alarma, el corazón, el
// mapa, el planeta, la nota de voz, el reproductor, el mensaje que llega.

import { COLOR } from '../config.js';
import { anchoNumero, cifraVolteable, texto } from '../motor/letras.js';
import { el, elipse, rectRedondo, tinta } from '../motor/trazo.js';

const N = { color: COLOR.tinta, ancho: 2.1, amp: 0.7 };
const relleno = { ...N, relleno: COLOR.tinta };

/** Posiciones (x, y, ancho, alto) alrededor del mosaico central (488…792, 210…514). */
export const MOSAICOS = [
  { id: 'nota', x: -170, y: -110, w: 340, h: 304 },
  { id: 'correo', x: 186, y: -110, w: 286, h: 304 },
  { id: 'tiempo', x: 488, y: -110, w: 616, h: 304 },
  { id: 'inicial', x: 1120, y: -110, w: 304, h: 304 },
  { id: 'fecha', x: -170, y: 210, w: 642, h: 304 },
  { id: 'alarma', x: 808, y: 210, w: 140, h: 140 },
  { id: 'corazon', x: 964, y: 210, w: 140, h: 140 },
  { id: 'pin', x: 808, y: 374, w: 140, h: 140 },
  { id: 'planeta', x: 964, y: 374, w: 140, h: 140 },
  { id: 'micro', x: 1120, y: 210, w: 304, h: 304 },
  { id: 'chat', x: -170, y: 530, w: 642, h: 304 },
  { id: 'voz', x: 488, y: 530, w: 304, h: 304 },
  { id: 'pausa', x: 808, y: 530, w: 296, h: 304 },
  { id: 'distancia', x: 1120, y: 530, w: 304, h: 304 },
];

const DIBUJO = {
  nota(g) {
    tinta(g, 'M10,40 L140,40 L140,150 L120,172 L10,172 Z', N);
    tinta(g, 'M120,172 L122,152 L140,150', N);
    let d = '';
    for (let y = 66; y < 160; y += 20) d += `M24,${y} L126,${y + 1} `;
    tinta(g, d, { ...N, ancho: 1.3 });
  },
  correo(g) {
    tinta(g, 'M256,32 L410,32 L410,140 L256,140 Z', relleno);
    tinta(g, 'M258,36 L333,96 L408,36', { ...N, color: COLOR.crema, ancho: 3 });
  },
  tiempo(g, partes, defs) {
    tinta(g, elipse(636, 52, 88), { ...N, ancho: 2.6 });
    let d = '';
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2, x = 636 + Math.cos(a) * 104, y = 52 + Math.sin(a) * 104;
      d += `M${x.toFixed(1)},${y.toFixed(1)} L${(x + 0.5).toFixed(1)},${(y + 0.5).toFixed(1)} `;
    }
    tinta(g, d, { ...N, ancho: 5.5, amp: 0.2 });
    tinta(g, 'M792,90 L842,90 M817,65 L817,115', { ...N, ancho: 12, amp: 0.4 });
    const o = { alto: 108, color: COLOR.tinta, veta: COLOR.crema, grosor: 15 };
    partes.decenas = cifraVolteable(g, defs, { x: 862, y: 38, valores: [3], ...o });
    partes.unidades = cifraVolteable(g, defs, { x: 944, y: 38, valores: [1, 2], ...o });
    tinta(g, elipse(1036, 30, 11), { ...N, ancho: 6 });
  },
  inicial(g) {
    // una J con remates y volumen (la inicial de Junti), como la «M» de la referencia
    const j = 'M1186,20 L1300,20 L1300,40 L1270,40 L1270,132 C1270,170 1244,186 1214,186 C1190,186 1170,174 1166,150 C1164,136 1174,126 1188,126 C1202,126 1210,136 1208,150 C1214,160 1230,160 1234,146 L1234,40 L1186,40 Z';
    tinta(g, j, { ...N, relleno: COLOR.cremaSombra, ancho: 2, amp: 0.5, semilla: 41 });
    g.lastChild.setAttribute('transform', 'translate(-10,10)');
    tinta(g, j, { ...relleno, ancho: 2, amp: 0.5, semilla: 41 });
    tinta(g, 'M1186,40 L1176,50 M1234,146 L1224,156 M1166,150 L1156,160', { ...N, ancho: 1.6 });
  },
  fecha(g, partes, defs) {
    const o = { alto: 168, color: COLOR.tinta, veta: COLOR.crema, grosor: 15 };
    const x = 36 - anchoNumero('16', 168) / 2 + 40;
    cifraVolteable(g, defs, { x, y: 278, valores: [1], ...o });
    partes.dia = cifraVolteable(g, defs, { x: x + 168 * 0.76, y: 278, valores: [6, 7], ...o });
    tinta(g, 'M210,236 L211,492', { ...N, ancho: 2.6 });
    texto(g, 'AGOSTO', { x: 340, y: 322, tam: 54, familia: 'geo', color: COLOR.tinta });
    tinta(g, 'M238,358 L444,357', { ...N, ancho: 2.6 });
    texto(g, '2026', { x: 340, y: 432, tam: 54, familia: 'geo', color: COLOR.tinta });
  },
  alarma(g, partes) {
    tinta(g, 'M845,254 C840,242 852,232 864,240 M911,254 C916,242 904,232 892,240', { ...N, ancho: 6 });
    tinta(g, 'M856,318 L848,328 M900,318 L908,328', { ...N, ancho: 3 });
    tinta(g, elipse(878, 286, 34), relleno);
    partes.agujas = el('g', {}, g);
    tinta(partes.agujas, 'M878,286 L878,262 M878,286 L894,292', { ...N, color: COLOR.crema, ancho: 3 });
  },
  corazon(g, partes) {
    const d = 'M1034,318 C1010,300 994,284 994,266 C994,252 1004,244 1015,244 C1024,244 1031,250 1034,258 C1037,250 1044,244 1053,244 C1064,244 1074,252 1074,266 C1074,284 1058,300 1034,318 Z';
    partes.corazonRelleno = tinta(g, d, { relleno: COLOR.rosa, ancho: 0, amp: 0.6 });
    tinta(g, d, { ...N, ancho: 3.2 });
    tinta(g, 'M1006,262 C1007,256 1011,253 1016,253', { ...N, ancho: 1.6 });
  },
  pin(g) {
    tinta(g, 'M878,494 C866,470 850,456 850,432 C850,414 862,402 878,402 C894,402 906,414 906,432 C906,456 890,470 878,494 Z', relleno);
    tinta(g, elipse(878, 431, 9), { ...N, relleno: COLOR.crema, color: COLOR.crema });
  },
  planeta(g, partes) {
    tinta(g, elipse(1034, 444, 38), { ...N, ancho: 2.6 });
    tinta(g, 'M996,444 L1072,444 M1000,426 L1068,426 M1000,462 L1068,462', { ...N, ancho: 1.4 });
    partes.meridianos = [0, 1].map(() => el('ellipse', { cx: 1034, cy: 444, rx: 18, ry: 38, fill: 'none', stroke: COLOR.tinta, 'stroke-width': 1.4 }, g));
  },
  micro(g) {
    tinta(g, rectRedondo(1236, 250, 64, 120, 32), relleno);
    tinta(g, 'M1244,286 L1292,286 M1242,306 L1294,306 M1242,326 L1294,326 M1244,346 L1292,346', { ...N, color: COLOR.crema, ancho: 2 });
    tinta(g, 'M1218,330 C1218,380 1240,396 1268,396 C1296,396 1318,380 1318,330 M1268,396 L1268,440 M1236,442 L1300,442', { ...N, ancho: 3 });
  },
  chat(g, partes) {
    tinta(g, 'M24,560 L58,560 C62,560 64,562 64,566 L64,584 C64,588 62,590 58,590 L40,590 L32,598 L32,590 L24,590 C20,590 18,588 18,584 L18,566 C18,562 20,560 24,560 Z', relleno);
    tinta(g, 'M28,572 L54,572 M28,580 L46,580', { ...N, color: COLOR.crema, ancho: 1.6 });
    texto(g, 'Lucía', { x: 80, y: 588, tam: 30, familia: 'geo', color: COLOR.tinta, ancla: 'start' });
    partes.mensaje = texto(g, '', { x: 22, y: 650, tam: 34, familia: 'geo', color: COLOR.tinta, ancla: 'start' });
    partes.caret = el('rect', { x: 22, y: 624, width: 2.5, height: 32, fill: COLOR.rosa }, g);
  },
  voz(g, partes) {
    partes.barras = [];
    for (let i = 0; i < 8; i++) {
      const x = 586 + i * 16;
      partes.barras.push(el('rect', { x, y: 640, width: 9, height: 60, rx: 2, fill: COLOR.tinta }, g));
    }
    tinta(g, 'M584,630 L700,580 M700,580 L684,578 M700,580 L694,594', { ...N, ancho: 2.6 });
  },
  pausa(g) {
    tinta(g, rectRedondo(884, 612, 164, 92, 16), { ...N, ancho: 3.4 });
    tinta(g, 'M952,640 L952,676 M980,640 L980,676', { ...N, ancho: 9 });
  },
  distancia(g) {
    texto(g, '7.412 km', { x: 1150, y: 620, tam: 46, familia: 'geo', peso: 500, color: COLOR.tinta, ancla: 'start' });
    tinta(g, 'M1152,652 L1340,652', { ...N, discontinuo: '8 7', ancho: 2.2 });
    el('circle', { cx: 1152, cy: 652, r: 5, fill: COLOR.rosa }, g);
  },
};

export function dibujarMosaicos(padre, defs) {
  const partes = {};
  const mosaicos = MOSAICOS.map((m) => {
    const g = el('g', {}, padre);
    const borde = tinta(g, rectRedondo(m.x, m.y, m.w, m.h, 40), { relleno: COLOR.crema, ...N, ancho: 2.2, amp: 1.1 });
    const dibujo = el('g', {}, g);
    DIBUJO[m.id](dibujo, partes, defs);
    return { ...m, g, borde, dibujo, cx: m.x + m.w / 2, cy: m.y + m.h / 2 };
  });
  // el cursor rosa (punta en 0,0)
  const cursor = el('g', {}, padre);
  const onda = el('circle', { r: 10, fill: 'none', stroke: COLOR.rosa, 'stroke-width': 2 }, cursor);
  tinta(cursor, 'M0,0 L0,30 L8,23 L14,36 L20,33 L14,21 L25,21 Z', { relleno: COLOR.rosa, color: COLOR.rosaOscuro, ancho: 1.2, amp: 0.3 });
  return { mosaicos, partes, cursor, onda };
}
