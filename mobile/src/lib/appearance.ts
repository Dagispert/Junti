// La apariencia de la app: clara, oscura o como el móvil («automático»).
// Se guarda en este dispositivo y se aplica al momento en toda la app.

import { useSyncExternalStore } from 'react';
import { Platform, useColorScheme } from 'react-native';

export type Modo = 'sistema' | 'claro' | 'oscuro';
const CLAVE = 'junti-apariencia';

let modo: Modo = leer();
const oyentes = new Set<() => void>();

function leer(): Modo {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(CLAVE) : null;
    return v === 'claro' || v === 'oscuro' ? v : 'sistema';
  } catch {
    return 'sistema';
  }
}

export function setModo(m: Modo) {
  modo = m;
  try {
    localStorage.setItem(CLAVE, m);
  } catch {
    // sin almacenamiento: vale para esta sesión
  }
  oyentes.forEach((f) => f());
}

const suscribir = (f: () => void) => {
  oyentes.add(f);
  return () => oyentes.delete(f);
};

/** El modo elegido (automático, claro u oscuro). */
export function useModo(): Modo {
  return useSyncExternalStore(
    suscribir,
    () => modo,
    () => modo,
  );
}

/** El esquema que toca ahora: el elegido o, en automático, el del móvil. */
export function useEsquema(): 'light' | 'dark' {
  const sistema = useColorScheme();
  const m = useModo();
  if (m === 'claro') return 'light';
  if (m === 'oscuro') return 'dark';
  return sistema === 'dark' ? 'dark' : 'light';
}

/**
 * En la web: se le dice al navegador qué esquema usamos (para que no
 * «oscurezca» la página por su cuenta ni cambie los colores de los campos) y
 * se pinta el fondo de la página, que se ve al estirar la pantalla.
 */
export function aplicarEnLaWeb(esquema: 'light' | 'dark', fondo: string) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'color-scheme';
    document.head.appendChild(meta);
  }
  meta.content = esquema;
  document.documentElement.style.colorScheme = esquema;
  document.documentElement.style.backgroundColor = fondo;
  document.body.style.backgroundColor = fondo;
  let tema = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!tema) {
    tema = document.createElement('meta');
    tema.name = 'theme-color';
    document.head.appendChild(tema);
  }
  tema.content = fondo;
}
