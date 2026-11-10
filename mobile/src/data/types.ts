// Tipos de la app. Reflejan (simplificado) el esquema de supabase/migrations.

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
  memberIds: string[];
  /** Si soy administrador de este grupo. */
  isAdmin: boolean;
};

/** Una propuesta del día ("prompt") o un reto ("challenge"): mismo objeto, distinta duración. */
export type Proposal = {
  id: string;
  groupId: string;
  kind: 'prompt' | 'challenge';
  title: string;
  body?: string;
  startsAt: number;
  endsAt?: number;
};

export type Reaction = { emoji: string; userId: string };
export type Comment = { id: string; userId: string; text: string; createdAt: number };

export type Moment = {
  id: string;
  groupId: string;
  authorId: string;
  text?: string;
  /** URL firmada y temporal de la foto, si la hay. */
  imageUri?: string;
  createdAt: number;
  /** Zona horaria del autor cuando lo publicó. */
  authorTz: string;
  /** Si responde a una propuesta o reto. */
  proposalId?: string;
  reactions: Reaction[];
  comments: Comment[];
};
