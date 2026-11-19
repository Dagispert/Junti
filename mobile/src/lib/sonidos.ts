// Los sonidos de la app (hechos con ElevenLabs y guardados en public/sonidos):
// cortos y bajitos, para acompañar lo que pasa (una reacción, un acierto, la
// tele del karaoke…). Se pueden apagar en Ajustes. Solo web.
//
// Van por Web Audio (un único contexto, ya desbloqueado con el primer toque):
// así suenan al instante y en el iPhone no cortan la música que suene.

import { Platform } from 'react-native';
import { useSyncExternalStore } from 'react';

export type Sonido =
  | 'tele'
  | 'aplausos'
  | 'acierto'
  | 'fallo'
  | 'papel'
  | 'pagina'
  | 'obturador'
  | 'pop'
  | 'enviar'
  | 'reloj'
  | 'persiana'
  | 'destello'
  | 'lapiz'
  | 'sello';

/** Lo fuerte que suena cada uno (todos discretos). */
const VOLUMEN: Partial<Record<Sonido, number>> = {
  pop: 0.35,
  enviar: 0.35,
  aplausos: 0.4,
  tele: 0.4,
  persiana: 0.45,
  reloj: 0.4,
};

const web = Platform.OS === 'web' && typeof window !== 'undefined';
const BASE = (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');
const CLAVE = 'junti-sonidos';

/* ───── encendidos o apagados (Ajustes) ───── */

let encendidos = true;
try {
  if (web) encendidos = localStorage.getItem(CLAVE) !== 'no';
} catch {
  // sin almacenamiento: encendidos
}
const oyentes = new Set<() => void>();
export function setSonidos(on: boolean) {
  encendidos = on;
  try {
    localStorage.setItem(CLAVE, on ? 'si' : 'no');
  } catch {
    // no pasa nada
  }
  oyentes.forEach((f) => f());
  if (on) sonar('pop');
}
export function useSonidos() {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f);
      return () => oyentes.delete(f);
    },
    () => encendidos,
    () => encendidos,
  );
}

/* ───── el sonido ───── */

let ctx: AudioContext | null = null;
const buffers = new Map<Sonido, Promise<AudioBuffer | null>>();

function contexto() {
  if (ctx) return ctx;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  ctx = new Ctx();
  return ctx;
}

function cargar(n: Sonido) {
  let b = buffers.get(n);
  if (!b) {
    b = fetch(`${BASE}/sonidos/${n}.mp3`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((ab) => contexto()!.decodeAudioData(ab))
      .catch(() => null);
    buffers.set(n, b);
  }
  return b;
}

/** Que suene (si están encendidos). */
export function sonar(n: Sonido, volumen = VOLUMEN[n] ?? 0.5) {
  if (!web || !encendidos) return;
  try {
    const c = contexto();
    if (!c) return;
    c.resume().catch(() => {});
    cargar(n).then((buf) => {
      if (!buf || !encendidos) return;
      const src = c.createBufferSource();
      src.buffer = buf;
      const g = c.createGain();
      g.gain.value = volumen;
      src.connect(g).connect(c.destination);
      src.start();
    });
  } catch {
    // sin sonido: no pasa nada
  }
}

/** Se preparan con el primer toque (así suenan al momento, también en el iPhone). */
export function prepararSonidos() {
  if (!web) return;
  const primero = () => {
    window.removeEventListener('pointerdown', primero);
    const c = contexto();
    if (!c) return;
    // un sonido vacío dentro del toque: desbloquea el audio en el iPhone
    const b = c.createBuffer(1, 1, 22050);
    const s = c.createBufferSource();
    s.buffer = b;
    s.connect(c.destination);
    s.start();
    c.resume().catch(() => {});
    (['pop', 'enviar', 'acierto', 'fallo'] as Sonido[]).forEach(cargar);
  };
  window.addEventListener('pointerdown', primero);
}
