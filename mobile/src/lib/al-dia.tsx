// Mantener la app al día sin cerrarla: en un iPhone la app instalada se queda
// «dormida» en segundo plano y antes solo cargaba los datos al abrirse.
// Ahora se actualiza:
//  · al momento, cuando alguien publica, comenta, reacciona… (tiempo real);
//  · al volver a la app (y si se recupera la conexión);
//  · cada minuto mientras está a la vista, por si se perdió algún aviso.
// Y si hay una versión nueva de la app, al volver a ella se carga sola.

import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { useStore } from '@/data/store';
import { recargarLeidos } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';

const TABLAS = [
  'moments',
  'moment_media',
  'comments',
  'reactions',
  'questions',
  'question_answers',
  'events',
  'songs',
  'memberships',
  'memory_additions',
  'albums',
  'album_moments',
  'proposals',
  'proposal_states',
  'groups',
  'group_origins',
  'profiles',
];

const BASE = (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');
const esWeb = Platform.OS === 'web' && typeof document !== 'undefined';

/** El nombre del código de la app que se está usando (cambia con cada versión). */
const entrada = (html: string) => html.match(/\/entry-([0-9a-f]+)\.js/)?.[1] ?? null;

/** Si se publicó una versión nueva, se recarga (salvo si se está escribiendo algo). */
async function versionNueva() {
  const actual = entrada(document.documentElement.innerHTML);
  if (!actual) return; // en desarrollo no hay versiones
  const r = await fetch(`${BASE}/?v=${Date.now()}`, { cache: 'no-store' });
  const nueva = entrada(await r.text());
  if (!nueva || nueva === actual) return;
  const a = document.activeElement as HTMLElement | null;
  const escribiendo = a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable);
  if (escribiendo || /\/(add|editar|edit)/.test(location.pathname)) return;
  location.reload();
}

export function AlDia() {
  const { me, refresh } = useStore();
  const recargar = useRef(refresh);
  recargar.current = refresh;

  useEffect(() => {
    if (!me) return;
    let ultima = Date.now();
    let pendiente: ReturnType<typeof setTimeout> | undefined;
    let oculta = 0;
    const ahora = (margen: number) => {
      if (Date.now() - ultima < margen) return;
      ultima = Date.now();
      recargar.current().catch(() => {});
      recargarLeidos();
    };
    // varios cambios seguidos (una foto con varias imágenes…) = una sola recarga
    const pronto = () => {
      clearTimeout(pendiente);
      pendiente = setTimeout(() => ahora(0), 1200);
    };

    const canal = supabase.channel(`al-dia-${me}`);
    for (const table of TABLAS)
      canal.on('postgres_changes', { event: '*', schema: 'public', table }, pronto);
    canal.on('postgres_changes', { event: '*', schema: 'public', table: 'notif_reads' }, () =>
      recargarLeidos(),
    );
    canal.subscribe();

    const visible = () => !esWeb || document.visibilityState === 'visible';
    const alVolver = () => {
      if (!visible()) {
        oculta = Date.now();
        return;
      }
      ahora(3000);
      if (esWeb && oculta && Date.now() - oculta > 60_000) versionNueva().catch(() => {});
      oculta = 0;
    };
    const cadaMinuto = setInterval(() => {
      if (visible()) ahora(50_000);
    }, 60_000);

    const quitar: (() => void)[] = [];
    if (esWeb) {
      document.addEventListener('visibilitychange', alVolver);
      window.addEventListener('pageshow', alVolver);
      window.addEventListener('focus', alVolver);
      window.addEventListener('online', alVolver);
      quitar.push(() => {
        document.removeEventListener('visibilitychange', alVolver);
        window.removeEventListener('pageshow', alVolver);
        window.removeEventListener('focus', alVolver);
        window.removeEventListener('online', alVolver);
      });
    } else {
      const sub = AppState.addEventListener('change', (s) => s === 'active' && ahora(3000));
      quitar.push(() => sub.remove());
    }

    return () => {
      clearTimeout(pendiente);
      clearInterval(cadaMinuto);
      quitar.forEach((f) => f());
      supabase.removeChannel(canal);
    };
  }, [me]);

  return null;
}
