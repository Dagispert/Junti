// Dibujo a ciegas: los pasos que se pueden ver (lo tuyo, el último y, al
// terminar, todos), subir un dibujo y seguir la cadena.

import { useEffect, useState } from 'react';

import { MEDIA_BUCKET, supabase } from './supabase';

export type PasoDibujo = {
  orden: number;
  user_id: string;
  tipo: 'frase' | 'dibujo';
  texto: string | null;
  path: string | null;
  /** el dibujo, con enlace temporal */
  url?: string;
  created_at: string;
};

/** Frases que dan juego para dibujar. */
export const FRASES_DIBUJO = [
  'Un pulpo haciendo la compra',
  'Mi abuela surfeando una ola gigante',
  'Un perro conduciendo un autobús lleno de gatos',
  'Un dinosaurio en una boda',
  'La luna comiéndose una pizza',
  'Un astronauta perdido en el supermercado',
  'Una vaca tomando el sol en la playa',
  'Un fantasma con miedo a la oscuridad',
  'El día que llovieron churros',
  'Un pingüino de vacaciones en el desierto',
  'Una tortuga ganando una carrera de coches',
  'Un robot aprendiendo a bailar flamenco',
  'Un gato jefe de una oficina',
  'Una jirafa intentando entrar en un coche',
  'Un caracol con prisa',
  'Un oso panda haciendo yoga',
];

/** Los pasos que se pueden ver; se recargan cuando cambia la cadena. */
export function usePasosDibujo(proposalId: string, n: number) {
  const [pasos, setPasos] = useState<PasoDibujo[] | null>(null);
  useEffect(() => {
    let vivo = true;
    const cargar = async () => {
      const { data } = await supabase
        .from('dibujo_pasos')
        .select('orden, user_id, tipo, texto, path, created_at')
        .eq('proposal_id', proposalId)
        .order('orden');
      const lista = (data ?? []) as PasoDibujo[];
      const rutas = lista.filter((p) => p.path).map((p) => p.path!);
      if (rutas.length) {
        const { data: firmadas } = await supabase.storage
          .from(MEDIA_BUCKET)
          .createSignedUrls(rutas, 6 * 3600);
        const por = new Map((firmadas ?? []).map((f) => [f.path, f.signedUrl]));
        for (const p of lista) if (p.path) p.url = por.get(p.path) ?? undefined;
      }
      if (vivo) setPasos(lista);
    };
    cargar();
    const canal = supabase
      .channel(`dibujo-${proposalId}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'dibujo_pasos',
          filter: `proposal_id=eq.${proposalId}`,
        },
        () => cargar(),
      )
      .subscribe();
    return () => {
      vivo = false;
      supabase.removeChannel(canal);
    };
  }, [proposalId, n]);
  return pasos;
}

/** Sube el dibujo (PNG) al almacén del grupo. */
export async function subirDibujo(groupId: string, me: string, png: Blob) {
  const path = `${groupId}/${me}/dibujo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.png`;
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, png, { contentType: 'image/png' });
  if (error) throw new Error(error.message);
  return path;
}

/** Sigue la cadena tras el paso «tras» (el que se ha visto). */
export async function seguirDibujo(
  proposalId: string,
  tras: number,
  paso: { texto?: string; ruta?: string },
) {
  const { error } = await supabase.rpc('seguir_dibujo', {
    p: proposalId,
    tras,
    texto: paso.texto ?? null,
    ruta: paso.ruta ?? null,
  });
  if (error) throw new Error(error.message);
}
