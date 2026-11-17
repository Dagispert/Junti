// El zoom misterioso: la foto (enlace temporal), los intentos y los resultados.
// La solución nunca llega a la app hasta que se termina: la comprueba el servidor.

import { useEffect, useState } from 'react';

import { MEDIA_BUCKET, supabase } from './supabase';

/** Lo ampliada que se ve la foto en cada nivel (cada fallo, un nivel más lejos). */
export const NIVELES = [9, 5.5, 3.2, 1.9, 1];

export type EstadoZoom = {
  acierto: boolean;
  nivel: number;
  terminado: boolean;
  puntos: number;
  respuesta?: string | null;
};

export type ResultadoZoom = {
  user_id: string;
  nivel: number;
  terminado: boolean;
  acierto: boolean;
  puntos: number;
};

/** El enlace temporal de la foto del zoom. */
export function useFotoZoom(path?: string) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!path) return;
    let vivo = true;
    supabase.storage
      .from(MEDIA_BUCKET)
      .createSignedUrl(path, 6 * 3600)
      .then(({ data }) => vivo && setUrl(data?.signedUrl ?? undefined));
    return () => {
      vivo = false;
    };
  }, [path]);
  return url;
}

export async function adivinar(proposalId: string, intento: string, rendirse = false) {
  const { data, error } = await supabase.rpc('adivinar_zoom', {
    p: proposalId,
    intento,
    rendirse,
  });
  if (error) throw new Error(error.message);
  return data as EstadoZoom;
}

export async function solucion(proposalId: string): Promise<string | null> {
  const { data } = await supabase.rpc('solucion_zoom', { p: proposalId });
  return (data as string | null) ?? null;
}

/** Cómo le va a cada uno (en tiempo real): quién acertó y en qué nivel. */
export function useResultadosZoom(proposalId: string) {
  const [lista, setLista] = useState<ResultadoZoom[]>([]);
  useEffect(() => {
    let vivo = true;
    const cargar = () =>
      supabase
        .from('juego_respuestas')
        .select('user_id, nivel, terminado, acierto, puntos')
        .eq('proposal_id', proposalId)
        .then(({ data }) => vivo && setLista((data ?? []) as ResultadoZoom[]));
    cargar();
    const canal = supabase
      .channel(`zoom-${proposalId}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'juego_respuestas',
          filter: `proposal_id=eq.${proposalId}`,
        },
        () => cargar(),
      )
      .subscribe();
    return () => {
      vivo = false;
      supabase.removeChannel(canal);
    };
  }, [proposalId]);
  return lista;
}
