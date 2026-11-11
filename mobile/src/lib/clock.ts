import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Milisegundos desde que se montó el componente, actualizados en cada fotograma
 * (limitado a ~30 por segundo para ahorrar batería). Con «reducir movimiento»
 * activado en el teléfono, devuelve un tiempo fijo muy alto: las animaciones
 * aparecen directamente en su estado final.
 */
export function useClock(active = true, stopAfter = Infinity): number {
  const [t, setT] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduced)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!active || reduced) return;
    let frame = 0;
    let last = 0;
    const start = Date.now();
    const tick = () => {
      const now = Date.now() - start;
      if (now - last >= 32) {
        last = now;
        setT(now);
      }
      if (now < stopAfter) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, reduced, stopAfter]);

  return reduced ? 1e9 : t;
}

/** 0 → 1 entre «from» y «from + duration» ms, con salida suave. */
export function progress(t: number, from: number, duration: number): number {
  const x = Math.min(1, Math.max(0, (t - from) / duration));
  return 1 - Math.pow(1 - x, 3);
}
