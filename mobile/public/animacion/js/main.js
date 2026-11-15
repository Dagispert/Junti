// ─────────────────────────────────────────────────────────────────────────────
// MONTAJE
// Construye el escenario (fondo, cámara, escenas, rótulos, viñeteado, grano),
// y en cada fotograma pinta todo para el instante t. También monta los
// controles: reproducir/pausar, barra de tiempo y saltos entre escenas.
//
// Para editar una escena: js/escenas/0X-*.js (movimiento) y
// js/ilustraciones/*.js (dibujo). Para el ritmo: js/config.js.
// ─────────────────────────────────────────────────────────────────────────────

import { DURACION, ESCENAS, ESCENARIO, FIN, ORDEN } from './config.js';
import { crearCamara } from './camara.js';
import { crearFondo, crearGrano } from './fondo.js';
import { Reproductor } from './motor/tiempo.js';
import { el, enEscena, hervir } from './motor/trazo.js';
import { crearRotulos } from './rotulos.js';
import * as reloj from './escenas/01-reloj.js';
import * as persiana from './escenas/02-persiana.js';
import * as ventanilla from './escenas/03-ventanilla.js';
import * as libreta from './escenas/04-libreta.js';
import * as mapa from './escenas/05-mapa.js';
import * as calendario from './escenas/06-calendario.js';
import * as camaraInstantanea from './escenas/07-camara.js';
import * as rejilla from './escenas/08-rejilla.js';

const MODULOS = { reloj, persiana, ventanilla, libreta, mapa, calendario, camara: camaraInstantanea, rejilla };
const NOMBRES = {
  reloj: 'Reloj',
  persiana: 'Persiana',
  ventanilla: 'Ventanilla',
  libreta: 'Libreta',
  mapa: 'Ruta',
  calendario: 'Calendario',
  camara: 'Cámara',
  rejilla: 'Recuerdos',
};

const raiz = document.documentElement;
const svg = document.getElementById('escenario');
const defs = svg.querySelector('defs');

// Filtros ásperos para el texto (tres semillas: el texto también hierve).
[0, 1, 2].forEach((i) => {
  const f = el('filter', { id: `aspero${i}`, x: '-5%', y: '-20%', width: '110%', height: '140%' }, defs);
  el('feTurbulence', { type: 'fractalNoise', baseFrequency: 0.8, numOctaves: 1, seed: i * 7 + 2, result: 'ruido' }, f);
  el('feDisplacementMap', { in: 'SourceGraphic', in2: 'ruido', scale: 1.8, xChannelSelector: 'R', yChannelSelector: 'G' }, f);
});

// ── Escenario ──
const capaCamara = el('g', { id: 'camara' });
const fondo = crearFondo({ svg, defs, capaCamara, raiz });
svg.appendChild(capaCamara);
const camara = crearCamara(capaCamara);
const escenas = ORDEN.map((id) => {
  const capa = el('g', { 'data-escena': id }, capaCamara);
  const escena = enEscena(id, () => MODULOS[id].crear({ capa, defs }));
  return { id, capa, ...ESCENAS[id], escena };
});
const rotulos = crearRotulos(capaCamara, defs);
fondo.cubrir();
crearGrano(document.getElementById('marco'));

// ── Pintar un instante ──
const visibles = new Set();
function pintar(t) {
  const cam = camara.pintar(t);
  fondo.pintar(t, cam);
  visibles.clear();
  for (const e of escenas) {
    const si = t >= e.desde && t <= e.hasta && t < FIN;
    e.capa.style.display = si ? '' : 'none';
    if (si) {
      visibles.add(e.id);
      e.escena.pintar(t);
    }
  }
  capaCamara.lastChild.style.display = t < FIN ? '' : 'none'; // rótulos
  rotulos.pintar(t);
  const cuadro = Math.floor(t * ESCENARIO.hervorFps);
  raiz.dataset.hervor = String(cuadro % 3);
  hervir(cuadro, (id) => visibles.has(id));
}

// ── Controles ──
const boton = document.getElementById('play');
const barra = document.getElementById('barra');
const reloj_ = document.getElementById('tiempo');
const capitulos = document.getElementById('capitulos');
barra.max = String(DURACION);

const reproductor = new Reproductor({
  duracion: DURACION,
  pintar,
  raiz,
  alCambiar(r) {
    boton.setAttribute('aria-label', r.enMarcha ? 'Pausar' : 'Reproducir');
    boton.dataset.estado = r.enMarcha ? 'marcha' : 'pausa';
    barra.value = String(r.t);
    reloj_.textContent = `${r.t.toFixed(1).padStart(4, '0')} s`;
    capitulos.querySelectorAll('button').forEach((b) => {
      const e = ESCENAS[b.dataset.id];
      b.setAttribute('aria-current', r.t >= e.desde && r.t < e.hasta ? 'true' : 'false');
    });
  },
});

// Un salto de capítulo por escena, en orden de aparición.
Object.entries(ESCENAS)
  .sort((a, b) => a[1].desde - b[1].desde)
  .forEach(([id, e]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.id = id;
    b.textContent = NOMBRES[id];
    b.addEventListener('click', () => reproductor.ir(e.desde + (id === 'reloj' ? 0 : 0.35)));
    capitulos.appendChild(b);
  });

boton.addEventListener('click', () => reproductor.alternar());
barra.addEventListener('input', () => {
  reproductor.pausa();
  reproductor.ir(Number(barra.value));
});
svg.addEventListener('click', () => reproductor.alternar());
window.addEventListener('keydown', (ev) => {
  if (ev.code === 'Space') {
    ev.preventDefault();
    reproductor.alternar();
  } else if (ev.code === 'ArrowRight') reproductor.ir(reproductor.t + (ev.shiftKey ? 0.04 : 1));
  else if (ev.code === 'ArrowLeft') reproductor.ir(reproductor.t - (ev.shiftKey ? 0.04 : 1));
});

// Los controles se esconden mientras se mira.
let quieto;
const despertar = () => {
  raiz.classList.remove('quieto');
  clearTimeout(quieto);
  quieto = setTimeout(() => reproductor.enMarcha && raiz.classList.add('quieto'), 2200);
};
window.addEventListener('pointermove', despertar);
window.addEventListener('pointerdown', despertar);

// En vertical (móvil) el encuadre se ciñe al mosaico central.
const encuadre = () => {
  const vertical = innerHeight > innerWidth * 1.1;
  svg.setAttribute('viewBox', vertical ? '360 -60 560 840' : `0 0 ${ESCENARIO.ancho} ${ESCENARIO.alto}`);
};
addEventListener('resize', encuadre);
encuadre();

// ?t=12.5 empieza en ese instante; ?pausa=1 no reproduce (útil para revisar).
const q = new URLSearchParams(location.search);
reproductor.ir(Number(q.get('t')) || 0);
document.fonts.ready.then(() => {
  rotulos.medir();
  pintar(reproductor.t);
  raiz.classList.add('listo');
  if (q.get('pausa') !== '1') reproductor.play();
  else reproductor.pausa();
  despertar();
});

window.__animacion = { reproductor, pintar };
