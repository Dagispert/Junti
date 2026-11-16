// Ideas pensadas para cada grupo (retos, karaokes, encuestas, quizzes,
// preguntas y recuerdos): la narradora (IA) las inventa a partir de lo
// que el grupo va compartiendo. Solo si el grupo tiene la narradora activada.

import { supabase } from './supabase';

export type TipoIdea = 'reto' | 'karaoke' | 'encuesta' | 'quiz' | 'pregunta' | 'recuerdo';
export type IdeaReto = {
  /** qué es (lo mismo que se puede crear con el «+»); sin él, un reto */
  tipo?: TipoIdea;
  title: string;
  body: string;
  days: number;
  porque: string;
  /** encuesta y quiz */
  opciones?: string[];
  /** karaoke */
  cancion?: { titulo: string; artista: string };
};
export type RespuestaIdeas = {
  ideas: IdeaReto[];
  generatedAt?: string;
  /** cuántas veces más se pueden pedir otras hoy */
  left?: number;
  /** off: la narradora está desactivada · busy: la IA no ha respondido */
  reason?: 'off' | 'busy' | 'forbidden' | 'bad';
  /** por qué no hubo ideas (para el registro de errores) */
  detalle?: string;
};

export async function pedirIdeasRetos(groupId: string, otras = false): Promise<RespuestaIdeas> {
  const { data, error } = await supabase.functions.invoke('narrate', {
    body: { action: 'retos', groupId, force: otras },
  });
  if (error) throw error;
  return data as RespuestaIdeas;
}
