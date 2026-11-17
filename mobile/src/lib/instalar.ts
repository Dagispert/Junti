// La guía para instalar Junti en el móvil (mientras sea una web instalable).
//
// ⚠️ PROVISIONAL: cuando salga la app de verdad (App Store / Google Play), se
// quita poniendo GUIA_INSTALACION a false (y se pueden borrar este archivo y
// components/guia-instalar.tsx).
import { Platform } from 'react-native';

export const GUIA_INSTALACION = true;

const web = Platform.OS === 'web' && typeof window !== 'undefined';
const ua = web ? navigator.userAgent : '';

export type Sistema = 'ios' | 'android' | 'otro';

export const sistema: Sistema = !web
  ? 'otro'
  : /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1)
    ? 'ios'
    : /Android/i.test(ua)
      ? 'android'
      : 'otro';

/** El navegador de dentro de otra app (Instagram, Facebook, TikTok…): ahí no se puede instalar. */
export const dentroDeOtraApp =
  web && /FBAN|FBAV|FB_IAB|Instagram|Line\/|TikTok|musical_ly|Snapchat|; wv\)|GSA\//i.test(ua);

/** Chrome en iPhone (el botón Compartir está arriba, junto a la dirección). */
export const chromeIos = web && /CriOS|FxiOS|EdgiOS/.test(ua);
export const samsung = web && /SamsungBrowser/.test(ua);

export function instalada(): boolean {
  if (!web) return true;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

const SALTADA = 'junti-guia-instalar-saltada';

/** ¿Hay que enseñar la guía? En el móvil, en el navegador y sin haberla saltado. */
export function mostrarGuia(): boolean {
  if (!GUIA_INSTALACION || !web || sistema === 'otro' || instalada()) return false;
  try {
    return !sessionStorage.getItem(SALTADA);
  } catch {
    return true;
  }
}

/** «Seguir en el navegador»: no se vuelve a enseñar hasta que se cierre la pestaña. */
export function saltarGuia() {
  try {
    sessionStorage.setItem(SALTADA, '1');
  } catch {
    // sin almacenamiento: se enseñará otra vez
  }
}

/* ───── Android/Chrome: el aviso de instalar de verdad (un botón y listo) ───── */

type AvisoInstalar = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};
let aviso: AvisoInstalar | null = null;
const oyentes = new Set<() => void>();
if (web) {
  // llega muy pronto, antes de que se pinte la guía: se guarda aquí
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    aviso = e as AvisoInstalar;
    oyentes.forEach((f) => f());
  });
  window.addEventListener('appinstalled', () => {
    aviso = null;
    oyentes.forEach((f) => f());
  });
}

export const puedeInstalarDirecto = () => !!aviso;
export function alCambiarInstalable(f: () => void) {
  oyentes.add(f);
  return () => {
    oyentes.delete(f);
  };
}

/** Abre el aviso de instalar del navegador. true si la persona aceptó. */
export async function instalarDirecto(): Promise<boolean> {
  if (!aviso) return false;
  const a = aviso;
  aviso = null;
  await a.prompt();
  const { outcome } = await a.userChoice;
  oyentes.forEach((f) => f());
  return outcome === 'accepted';
}
