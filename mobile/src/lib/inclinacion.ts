// La inclinación del móvil, para dar profundidad: lo que tiene «capas» se
// mueve un poco según cómo lo sostienes (como si fuera 3D). Una sola escucha
// para toda la app; cada elemento recibe las variables CSS --ix y --iy (de -1
// a 1) y sus capas se desplazan con calc(var(--ix) * N px).
// En el iPhone hay que pedir permiso: se pide con el primer toque en la app.

import { type RefObject, useEffect } from 'react';
import { Platform } from 'react-native';

const elementos = new Set<HTMLElement>();
let x = 0;
let y = 0;
let objetivoX = 0;
let objetivoY = 0;
let base: { beta: number; gamma: number } | null = null;
let arrancado = false;
let marco = 0;

function alGirar(e: DeviceOrientationEvent) {
  if (e.beta == null || e.gamma == null) return;
  // la postura con la que se coge el móvil cuenta como «recto»
  base ??= { beta: e.beta, gamma: e.gamma };
  // poco a poco, la nueva postura pasa a ser la «recta»
  base.beta += (e.beta - base.beta) * 0.002;
  base.gamma += (e.gamma - base.gamma) * 0.002;
  objetivoX = Math.max(-1, Math.min(1, (e.gamma - base.gamma) / 18));
  objetivoY = Math.max(-1, Math.min(1, (e.beta - base.beta) / 18));
}

// En el ordenador: con el ratón.
function alMover(e: PointerEvent) {
  if (e.pointerType !== 'mouse') return;
  objetivoX = (e.clientX / window.innerWidth) * 2 - 1;
  objetivoY = (e.clientY / window.innerHeight) * 2 - 1;
}

function paso() {
  marco = requestAnimationFrame(paso);
  x += (objetivoX - x) * 0.12;
  y += (objetivoY - y) * 0.12;
  for (const el of elementos) {
    el.style.setProperty('--ix', x.toFixed(3));
    el.style.setProperty('--iy', y.toFixed(3));
  }
}

function arrancar() {
  if (arrancado || Platform.OS !== 'web' || typeof window === 'undefined') return;
  arrancado = true;
  const D = window.DeviceOrientationEvent as unknown as
    | { requestPermission?: () => Promise<'granted' | 'denied'> }
    | undefined;
  if (D?.requestPermission) {
    // iPhone: el permiso solo se puede pedir tras un toque
    // Safari solo lo deja pedir dentro de un toque de verdad (no al deslizar);
    // se vuelve a intentar en cada toque hasta que se concede (y en cada
    // apertura de la app hay que pedirlo otra vez: si ya se dio, no pregunta).
    let pidiendo = false;
    const pedir = () => {
      if (pidiendo) return;
      pidiendo = true;
      D.requestPermission!()
        .then((r) => {
          if (r !== 'granted') return;
          window.addEventListener('deviceorientation', alGirar);
          window.removeEventListener('click', pedir);
          window.removeEventListener('touchend', pedir);
        })
        .catch(() => {})
        .finally(() => {
          pidiendo = false;
        });
    };
    window.addEventListener('click', pedir);
    window.addEventListener('touchend', pedir);
  } else {
    window.addEventListener('deviceorientation', alGirar);
  }
  window.addEventListener('pointermove', alMover);
}

/** Da a este elemento las variables --ix y --iy con la inclinación del móvil. */
export function useInclinacion(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
      return;
    arrancar();
    elementos.add(el);
    if (!marco) marco = requestAnimationFrame(paso);
    return () => {
      elementos.delete(el);
      if (!elementos.size && marco) {
        cancelAnimationFrame(marco);
        marco = 0;
      }
    };
  }, [ref]);
}

/** Un desplazamiento según la inclinación: cuanto más «cerca», más se mueve. */
export const capa = (px: number, rot = 0) =>
  `translate3d(calc(var(--ix, 0) * ${px}px), calc(var(--iy, 0) * ${px * 0.7}px), 0)${
    rot ? ` rotate(${rot}deg)` : ''
  }`;
