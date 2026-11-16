// Cambio suave entre el mapa y las demás pestañas: la que aparece entra con
// un fundido (y el mapa, además, con un leve acercamiento). Solo se anima la
// pantalla que entra; es una animación del navegador, sin coste al reposar.

import { useIsFocused } from 'expo-router';
import { useLayoutEffect, type RefObject } from 'react';

// Se apunta al entrar en el mapa; la siguiente pantalla que entre lo usa.
let veniaDelMapa = false;
const SUAVE = 'cubic-bezier(.2,.8,.2,1)';

export function useEntradaSuave(ref: RefObject<unknown>, esMapa = false) {
  const enFoco = useIsFocused();
  useLayoutEffect(() => {
    if (!enFoco) return;
    const el = ref.current as HTMLElement | null;
    if (!el || typeof el.animate !== 'function') return;
    if (esMapa) {
      veniaDelMapa = true;
      el.animate(
        [
          { opacity: 0, transform: 'scale(0.94)' },
          { opacity: 1, transform: 'scale(1)' },
        ],
        { duration: 420, easing: SUAVE },
      );
    } else if (veniaDelMapa) {
      veniaDelMapa = false;
      el.animate(
        [
          { opacity: 0, transform: 'scale(1.02)' },
          { opacity: 1, transform: 'scale(1)' },
        ],
        { duration: 360, easing: SUAVE },
      );
    }
  }, [enFoco, esMapa, ref]);
}
