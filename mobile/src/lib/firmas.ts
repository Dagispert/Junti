// Los enlaces temporales a los archivos (fotos, vídeos, audios), guardados y
// reutilizados durante días. Antes se pedía uno nuevo en cada carga: como la
// dirección cambiaba, el móvil no podía aprovechar lo que ya había descargado
// y todo se volvía a bajar (y se agotaba el cupo gratis de descargas de
// Supabase). Con la misma dirección, el navegador lo guarda y no lo repite.

import { Platform } from 'react-native';

import { supabase } from './supabase';

/** Lo que dura cada enlace (7 días) y cuándo se renueva (si le queda menos de 1). */
const DURA = 7 * 86_400;
const MARGEN = 86_400_000;
const CLAVE = 'junti-firmas';
const web = Platform.OS === 'web' && typeof window !== 'undefined';

type Firma = { u: string; e: number };
let guardadas: Record<string, Firma> | null = null;

function todas(): Record<string, Firma> {
  if (guardadas) return guardadas;
  guardadas = {};
  if (web) {
    try {
      const raw = JSON.parse(localStorage.getItem(CLAVE) ?? '{}') as Record<string, Firma>;
      const ahora = Date.now();
      for (const [k, v] of Object.entries(raw)) if (v.e - ahora > MARGEN) guardadas[k] = v;
    } catch {
      // sin almacenamiento: se piden de nuevo
    }
  }
  return guardadas;
}

let pendiente: ReturnType<typeof setTimeout> | undefined;
function guardar() {
  if (!web) return;
  clearTimeout(pendiente);
  pendiente = setTimeout(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(todas()));
    } catch {
      // lleno o bloqueado: se vivirá sin guardarlas
    }
  }, 500);
}

/** Enlaces para estos archivos (los que ya había y siguen valiendo, sin pedirlos). */
export async function firmar(bucket: string, paths: string[]): Promise<Record<string, string>> {
  const g = todas();
  const ahora = Date.now();
  const out: Record<string, string> = {};
  const faltan: string[] = [];
  for (const p of new Set(paths.filter(Boolean))) {
    const f = g[`${bucket}:${p}`];
    if (f && f.e - ahora > MARGEN) out[p] = f.u;
    else faltan.push(p);
  }
  for (let k = 0; k < faltan.length; k += 100) {
    const { data } = await supabase.storage
      .from(bucket)
      .createSignedUrls(faltan.slice(k, k + 100), DURA);
    for (const item of data ?? [])
      if (item.path && item.signedUrl) {
        out[item.path] = item.signedUrl;
        g[`${bucket}:${item.path}`] = { u: item.signedUrl, e: ahora + DURA * 1000 };
      }
  }
  if (faltan.length) guardar();
  return out;
}

/** Un solo enlace. */
export async function firmarUno(bucket: string, path: string): Promise<string | undefined> {
  return (await firmar(bucket, [path]))[path];
}

/** Al cerrar sesión: que no queden enlaces de la cuenta en este dispositivo. */
export function olvidarFirmas() {
  guardadas = {};
  if (web)
    try {
      localStorage.removeItem(CLAVE);
    } catch {
      // nada
    }
}

/** Para subir: que el navegador lo guarde mucho tiempo (el archivo no cambia nunca). */
export const CACHE_LARGA = '31536000';
