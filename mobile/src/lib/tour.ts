import { Platform } from 'react-native';

// La guía de primer uso: se lanza sola la primera vez que se entra en un grupo
// (cuando ha terminado la animación de inicio) y se puede volver a ver desde
// «Ayuda».

const KEY = 'junti-guia-vista';
const web = Platform.OS === 'web' && typeof window !== 'undefined';

let introDone = false;
let requested = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function markIntroDone() {
  introDone = true;
  notify();
}

/** Pedir la guía (desde «Ayuda»). */
export function requestTour() {
  requested = true;
  notify();
}

export function tourSeen(): boolean {
  if (!web) return true; // de momento, solo en la web
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true;
  }
}

export function markTourSeen() {
  requested = false;
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    // sin almacenamiento: se verá otra vez, no pasa nada
  }
}

/** ¿Toca enseñar la guía ahora? */
export function shouldShowTour(): boolean {
  return web && introDone && (requested || !tourSeen());
}

export function subscribeTour(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
