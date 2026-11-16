// Registro de errores: cuando a alguien le falla algo, se apunta en la tabla
// app_errors de Supabase (qué pasó, en qué pantalla, móvil y versión) para
// verlo en Ajustes → Errores recientes. Sin datos personales: solo el id.

import { Platform } from 'react-native';

import { supabase } from './supabase';

const esWeb = Platform.OS === 'web' && typeof window !== 'undefined';
const vistos = new Map<string, number>();
let enviados = 0;

// Ruido del navegador que no es un fallo de la app.
const IGNORAR = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i,
  /AbortError|The operation was aborted|signal is aborted/i,
  /Failed to fetch|Network request failed|NetworkError|Load failed/i,
  /play\(\) request was interrupted|NotAllowedError/i,
  /No has dado permiso/i,
];

const corta = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Para agrupar el mismo fallo aunque cambien ids, números o rutas. */
function huella(kind: string, message: string, stack: string) {
  const base = message
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ':id')
    .replace(/\d+/g, '#')
    .slice(0, 200);
  const marco = (stack.split('\n').find((l) => /at |@/.test(l)) ?? '')
    .replace(/:\d+:\d+\)?$/, '')
    .replace(/https?:\/\/[^/]+/, '')
    .replace(/-[0-9a-f]{16,}\.js/, '.js')
    .trim();
  const txt = `${kind}|${base}|${marco}`;
  let h = 5381;
  for (let i = 0; i < txt.length; i++) h = ((h << 5) + h + txt.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

function version() {
  if (!esWeb) return Platform.OS;
  const m = document.documentElement.innerHTML.match(/\/entry-([0-9a-f]{8})/);
  return m ? m[1] : 'desarrollo';
}

function dispositivo() {
  if (!esWeb) return `${Platform.OS} ${String(Platform.Version)}`;
  const instalada =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true;
  return corta(`${navigator.userAgent}${instalada ? ' · instalada' : ''}`, 300);
}

function pantalla() {
  if (!esWeb) return '';
  return corta(
    location.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ':id').replace(/^\/Junti/, '') || '/',
    200,
  );
}

/** Apunta un error. Se puede llamar desde cualquier sitio; nunca lanza. */
export function apuntarError(error: unknown, kind = 'error') {
  try {
    const e = error instanceof Error ? error : null;
    const message = corta(
      (e ? `${e.name !== 'Error' ? `${e.name}: ` : ''}${e.message}` : String(error)) ||
        '(sin mensaje)',
      500,
    );
    if (IGNORAR.some((r) => r.test(message))) return;
    if (esWeb && navigator.onLine === false) return; // sin conexión: no es un fallo nuestro
    const stack = corta(e?.stack ?? '', 4000);
    const fingerprint = huella(kind, message, stack);
    // el mismo fallo, como mucho 3 veces por sesión; y no más de 30 en total
    const n = vistos.get(fingerprint) ?? 0;
    if (n >= 3 || enviados >= 30) return;
    vistos.set(fingerprint, n + 1);
    enviados++;
    supabase
      .from('app_errors')
      .insert({
        kind,
        message,
        stack,
        screen: pantalla(),
        version: version(),
        device: dispositivo(),
        fingerprint,
      })
      .then(
        () => {},
        () => {},
      );
  } catch {
    // apuntar un error nunca debe romper nada
  }
}

/** Escucha los errores que nadie atrapó (una vez, al arrancar la app). */
export function instalarErrores() {
  if (esWeb) {
    const alError = (ev: ErrorEvent) => apuntarError(ev.error ?? ev.message, 'error');
    const alRechazo = (ev: PromiseRejectionEvent) => apuntarError(ev.reason, 'promesa');
    window.addEventListener('error', alError);
    window.addEventListener('unhandledrejection', alRechazo);
    return () => {
      window.removeEventListener('error', alError);
      window.removeEventListener('unhandledrejection', alRechazo);
    };
  }
  const g = globalThis as {
    ErrorUtils?: {
      getGlobalHandler: () => (e: unknown, fatal?: boolean) => void;
      setGlobalHandler: (f: (e: unknown, fatal?: boolean) => void) => void;
    };
  };
  const antes = g.ErrorUtils?.getGlobalHandler();
  g.ErrorUtils?.setGlobalHandler((e, fatal) => {
    apuntarError(e, fatal ? 'cierre' : 'error');
    antes?.(e, fatal);
  });
}

export type ErrorAgrupado = {
  fingerprint: string;
  message: string;
  kind: string;
  veces: number;
  personas: number;
  primera: string;
  ultima: string;
  screen: string | null;
  version: string | null;
  device: string | null;
  stack: string | null;
};

export async function soyAdmin(): Promise<boolean> {
  const { data } = await supabase.rpc('soy_admin');
  return data === true;
}

export async function erroresRecientes(dias = 14): Promise<ErrorAgrupado[]> {
  const { data, error } = await supabase.rpc('errores_recientes', { dias });
  if (error) throw error;
  return (data ?? []) as ErrorAgrupado[];
}

export async function resolverError(fp: string) {
  const { error } = await supabase.rpc('resolver_error', { fp });
  if (error) throw error;
}
