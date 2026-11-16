// Cola de envío: si no hay conexión al publicar (en el metro, en un avión…),
// lo publicado se guarda en el propio móvil —con sus fotos, vídeos y notas de
// voz— y se envía solo en cuanto vuelve la conexión, aunque se cierre la app.

import { Platform } from 'react-native';
import { useSyncExternalStore } from 'react';

export type Pendiente = {
  id: string;
  tipo: 'momento' | 'comentario';
  /** El grupo, para enseñar en él lo que falta por enviar. */
  grupo?: string;
  creado: number;
  intentos: number;
  /** Si falló por algo que no es la conexión: se enseña y se puede reintentar. */
  error?: string;
  datos: unknown;
  archivos: Record<string, Blob>;
};

const esWeb = Platform.OS === 'web' && typeof indexedDB !== 'undefined';
let lista: Pendiente[] = [];
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());

/** ¿Falló por la conexión (y merece la pena esperar y reintentar)? */
export function esErrorDeRed(e: unknown) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const m = e instanceof Error ? e.message : String(e);
  return /Failed to fetch|Network request failed|NetworkError|Load failed|network connection|timed? ?out|ERR_INTERNET|ERR_NETWORK/i.test(
    m,
  );
}

export const sinConexion = () => typeof navigator !== 'undefined' && navigator.onLine === false;

// ── Guardado en el móvil (IndexedDB: aguanta archivos grandes y cerrar la app) ──
function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, ko) => {
    const r = indexedDB.open('junti-cola', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('pendientes', { keyPath: 'id' });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}
async function tx<T>(modo: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>) {
  const db = await abrir();
  return new Promise<T>((ok, ko) => {
    const t = db.transaction('pendientes', modo);
    const r = f(t.objectStore('pendientes'));
    t.oncomplete = () => ok(r.result);
    t.onerror = () => ko(t.error);
  });
}

export async function cargarCola() {
  if (!esWeb) return;
  try {
    lista = ((await tx('readonly', (s) => s.getAll())) as Pendiente[]).sort(
      (a, b) => a.creado - b.creado,
    );
    avisar();
  } catch {
    // sin almacenamiento (modo privado): la cola vive solo en memoria
  }
}

async function guardar(p: Pendiente) {
  lista = [...lista.filter((x) => x.id !== p.id), p].sort((a, b) => a.creado - b.creado);
  avisar();
  if (esWeb) await tx('readwrite', (s) => s.put(p)).catch(() => {});
}

export async function quitar(id: string) {
  lista = lista.filter((x) => x.id !== id);
  avisar();
  if (esWeb) await tx('readwrite', (s) => s.delete(id)).catch(() => {});
}

const nuevoId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;

// Los archivos (blob:, data:) se copian dentro de la cola; en su lugar queda «cola:clave».
async function empaquetar(v: unknown, archivos: Record<string, Blob>): Promise<unknown> {
  if (typeof v === 'string' && /^(blob|data|file):/.test(v)) {
    const clave = `f${Object.keys(archivos).length}`;
    archivos[clave] = await (await fetch(v)).blob();
    return `cola:${clave}`;
  }
  if (Array.isArray(v)) return Promise.all(v.map((x) => empaquetar(x, archivos)));
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = await empaquetar(x, archivos);
    return out;
  }
  return v;
}
function desempaquetar(v: unknown, archivos: Record<string, Blob>, urls: string[]): unknown {
  if (typeof v === 'string' && v.startsWith('cola:')) {
    const b = archivos[v.slice(5)];
    if (!b) return undefined;
    const u = URL.createObjectURL(b);
    urls.push(u);
    return u;
  }
  if (Array.isArray(v)) return v.map((x) => desempaquetar(x, archivos, urls));
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = desempaquetar(x, archivos, urls);
    return out;
  }
  return v;
}

/** Deja algo en la cola para enviarlo cuando haya conexión. */
export async function encolar(
  tipo: Pendiente['tipo'],
  datos: Record<string, unknown>,
  grupo?: string,
) {
  const archivos: Record<string, Blob> = {};
  const id = (datos.id as string | undefined) ?? nuevoId();
  const paquete = await empaquetar({ ...datos, id }, archivos);
  await guardar({ id, tipo, grupo, creado: Date.now(), intentos: 0, datos: paquete, archivos });
}

/** Un id para publicar: si luego hay que reintentarlo, no se duplica. */
export const idParaPublicar = nuevoId;

type Enviar = {
  momento: (datos: never) => Promise<void>;
  comentario: (datos: never) => Promise<void>;
};

let enviando = false;
/** Intenta enviar todo lo pendiente (en orden). Devuelve cuántos se enviaron. */
export async function enviarCola(enviar: Enviar, tambienFallidos = false) {
  if (enviando || !lista.length || sinConexion()) return 0;
  enviando = true;
  let hechos = 0;
  try {
    for (const p of [...lista]) {
      if (p.error && !tambienFallidos) continue;
      const urls: string[] = [];
      try {
        const datos = desempaquetar(p.datos, p.archivos, urls) as never;
        await enviar[p.tipo](datos);
        await quitar(p.id);
        hechos++;
      } catch (e) {
        if (esErrorDeRed(e)) break; // sigue sin conexión: se probará más tarde
        const intentos = p.intentos + 1;
        // un fallo que no es de conexión: se reintenta un par de veces y luego se avisa
        await guardar({
          ...p,
          intentos,
          error: intentos >= 3 ? (e instanceof Error ? e.message : String(e)) : undefined,
        });
      } finally {
        urls.forEach((u) => URL.revokeObjectURL(u));
      }
    }
  } finally {
    enviando = false;
  }
  return hechos;
}

/** Reintentar uno que falló. */
export async function reintentar(id: string) {
  const p = lista.find((x) => x.id === id);
  if (p) await guardar({ ...p, error: undefined, intentos: 0 });
}

const suscribir = (f: () => void) => {
  oyentes.add(f);
  return () => oyentes.delete(f);
};
const foto = () => lista;
/** Lo que falta por enviar (para enseñarlo en pantalla). */
export function useCola(): Pendiente[] {
  return useSyncExternalStore(suscribir, foto, foto);
}
