// Tipos del prototipo. Reflejan (simplificado) el modelo de datos de
// docs/01-analisis-y-definicion-de-producto.md §9 y supabase/migrations.

export type User = {
  id: string;
  name: string;
  city: string;
  /** Zona horaria IANA, p. ej. "America/Mexico_City". */
  tz: string;
  color: string;
};

export type Group = {
  id: string;
  name: string;
  description: string;
  color: string;
  emoji: string;
  memberIds: string[];
};

/** Una propuesta del día ("prompt") o un reto ("challenge"): mismo objeto, distinta duración. */
export type Proposal = {
  id: string;
  groupId: string;
  kind: 'prompt' | 'challenge';
  title: string;
  body?: string;
  endsAt?: number;
};

export type Reaction = { emoji: string; userId: string };
export type Comment = {
  id: string;
  userId: string;
  text: string;
  createdAt: number;
};

export type Moment = {
  id: string;
  groupId: string;
  authorId: string;
  text?: string;
  imageUri?: string;
  /** Sustituto visual de la foto en los datos de ejemplo. */
  placeholder?: { emoji: string; color: string };
  createdAt: number;
  /** Si responde a una propuesta o reto. */
  proposalId?: string;
  reactions: Reaction[];
  comments: Comment[];
};
