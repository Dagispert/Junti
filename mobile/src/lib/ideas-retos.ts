// Retos pensados para cada grupo: la narradora (IA) los inventa a partir de lo
// que el grupo va compartiendo. Solo si el grupo tiene la narradora activada.

import { supabase } from './supabase';

export type IdeaReto = { title: string; body: string; days: number; porque: string };
export type RespuestaIdeas = {
  ideas: IdeaReto[];
  generatedAt?: string;
  /** cuántas veces más se pueden pedir otras hoy */
  left?: number;
  /** off: la narradora está desactivada · busy: la IA no ha respondido */
  reason?: 'off' | 'busy' | 'forbidden' | 'bad';
};

export async function pedirIdeasRetos(groupId: string, otras = false): Promise<RespuestaIdeas> {
  const { data, error } = await supabase.functions.invoke('narrate', {
    body: { action: 'retos', groupId, force: otras },
  });
  if (error) throw error;
  return data as RespuestaIdeas;
}
