// Ideas pensadas para cada grupo (retos, karaokes, encuestas, quizzes,
// preguntas y recuerdos): la narradora (IA) las inventa a partir de lo
// que el grupo va compartiendo. Solo si el grupo tiene la narradora activada.

import { supabase } from './supabase';

export type TipoIdea =
  | 'reto'
  | 'karaoke'
  | 'encuesta'
  | 'quiz'
  | 'pregunta'
  | 'recuerdo'
  | 'cuento'
  | 'zoom'
  | 'dibujo';
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

/** La primera frase de un cuento a trozos, pensada por la narradora para el grupo. */
export async function pedirInicioCuento(
  groupId: string,
): Promise<{ inicio: string | null; reason?: 'off' | 'busy' | 'forbidden' | 'bad' }> {
  const { data, error } = await supabase.functions.invoke('narrate', {
    body: { action: 'cuento', groupId },
  });
  if (error) throw error;
  return data as { inicio: string | null; reason?: 'off' | 'busy' | 'forbidden' | 'bad' };
}

/** Comienzos de cuento por si la narradora no está (o para pedir otro). */
export const INICIOS_CUENTO = [
  'Aquella mañana, al abrir la nevera, había una nota escrita a mano que decía…',
  'Nadie en el grupo sabía que el gato de la vecina hablaba, hasta que un martes…',
  'El avión aterrizó en una ciudad que no salía en ningún mapa y, al bajar…',
  'Encontramos una caja con nuestros nombres enterrada en la playa y dentro había…',
  'Cada vez que alguien del grupo estornudaba, en algún lugar del mundo…',
  'El ascensor no paraba en el quinto, sino en un piso que no existía, y allí…',
  'La abuela nos dejó en herencia un mapa, una llave y una condición muy rara:',
  'Esa noche, por primera vez, la luna se veía igual desde todas nuestras ciudades y…',
];

/** La primera frase del cuento leída por la narradora (enlace al audio). */
export async function vozDelCuento(groupId: string, proposalId: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('narrate', {
    body: { action: 'cuento-voz', groupId, proposalId },
  });
  if (error) return null;
  return (data as { audio: string | null }).audio;
}

/** El cierre del cuento (texto y audio), escrito por la narradora al terminar. */
export async function cierreDelCuento(
  groupId: string,
  proposalId: string,
): Promise<{ cierre: string | null; audio?: string | null; reason?: string }> {
  const { data, error } = await supabase.functions.invoke('narrate', {
    body: { action: 'cuento-cierre', groupId, proposalId },
  });
  if (error) return { cierre: null, reason: 'busy' };
  return data as { cierre: string | null; audio?: string | null; reason?: string };
}
