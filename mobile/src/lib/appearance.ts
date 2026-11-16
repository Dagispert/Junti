// La apariencia de la app: clara, oscura o como el móvil («automático»).
// Se guarda en este dispositivo y se aplica al momento en toda la app.

import { useSyncExternalStore } from 'react';
import { Platform, useColorScheme } from 'react-native';

export type Modo = 'sistema' | 'claro' | 'oscuro';
/** El tema de colores de cada persona (ver TEMAS en constants/theme). */
export type TemaId = 'junti' | 'peonia' | 'tinta' | 'salvia' | 'atardecer' | 'noche';
/** Un fondo suave detrás de las pantallas. */
export type Fondo = 'liso' | 'papel' | 'puntos' | 'lineas';
const CLAVE = 'junti-apariencia';
const CLAVE_TEMA = 'junti-tema';
const CLAVE_FONDO = 'junti-fondo';
const TEMAS_IDS: TemaId[] = ['junti', 'peonia', 'tinta', 'salvia', 'atardecer', 'noche'];
const FONDOS: Fondo[] = ['liso', 'papel', 'puntos', 'lineas'];

function guardado<T extends string>(clave: string, validos: T[], porDefecto: T): T {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(clave) : null;
    return v && (validos as string[]).includes(v) ? (v as T) : porDefecto;
  } catch {
    return porDefecto;
  }
}

let modo: Modo = leer();
let tema: TemaId = guardado(CLAVE_TEMA, TEMAS_IDS, 'junti');
let fondo: Fondo = guardado(CLAVE_FONDO, FONDOS, 'liso');
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

function apuntar(clave: string, v: string) {
  try {
    localStorage.setItem(clave, v);
  } catch {
    // sin almacenamiento: vale para esta sesión
  }
  oyentes.forEach((f) => f());
}

export function setTema(t: TemaId) {
  tema = t;
  apuntar(CLAVE_TEMA, t);
}

export function setFondo(f: Fondo) {
  fondo = f;
  apuntar(CLAVE_FONDO, f);
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

export function useTema(): TemaId {
  return useSyncExternalStore(
    suscribir,
    () => tema,
    () => tema,
  );
}

export function useFondo(): Fondo {
  return useSyncExternalStore(
    suscribir,
    () => fondo,
    () => fondo,
  );
}

/** El esquema que toca ahora: el elegido o, en automático, el del móvil. */
export function useEsquema(): 'light' | 'dark' {
  const sistema = useColorScheme();
  const m = useModo();
  // «Noche» es siempre oscuro
  if (useTema() === 'noche') return 'dark';
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
