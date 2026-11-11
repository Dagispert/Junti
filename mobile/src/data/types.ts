// Tipos de la app. Reflejan (simplificado) el esquema de supabase/migrations.

export type User = {
  id: string;
  name: string;
  city: string;
  /** Zona horaria IANA, p. ej. "America/Mexico_City". */
  tz: string;
  color: string;
  /** País y coordenadas (a nivel de ciudad) de su residencia, si la ha elegido. */
  country?: string;
  lat?: number;
  lng?: number;
  /** Foto de perfil: dirección temporal firmada y su ruta en el almacén. */
  avatarUri?: string;
  avatarPath?: string;
};

export type Group = {
  id: string;
  name: string;
  description: string;
  color: string;
  memberIds: string[];
  /** Si soy administrador de este grupo. */
  isAdmin: boolean;
  adminIds: string[];
  /** Mi hora preferida (0–23, local) para recibir la propuesta de este grupo. */
  myHour: number;
  /** Si tengo silenciado este grupo, hasta cuándo. */
  mutedUntil?: number;
  /** Días de la semana con propuesta: 1 = lunes … 7 = domingo. */
  cadenceDays: number[];
  /** Preferencia de cada integrante: propuestas por semana. */
  votes: Record<string, number>;
  /** La narradora (IA) está activada en el grupo, y con qué estilo. */
  narrativeEnabled: boolean;
  narrativeStyle: string;
  /** Si he pedido que mis momentos no se usen en la narración. */
  myNarrativeOptOut: boolean;
};

/** Crónica de un periodo escrita por la narradora. */
export type Narration = {
  title: string;
  body: string;
  /** La crónica por escenas: cada una acompaña a un momento (o a ninguno). */
  scenes: { momentId: string | null; text: string }[];
  style: string;
  generations: number;
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
  /** Vídeo (entonces «imageUri» es su portada) y su duración en segundos. */
  videoUri?: string;
  videoDuration?: number;
  /** Nota de voz: audio, duración en segundos y forma de onda (0–100). */
  voice?: { uri: string; duration: number; waveform: number[] };
  createdAt: number;
  /** Zona horaria del autor cuando lo publicó. */
  authorTz: string;
  /** Si responde a una propuesta o reto. */
  proposalId?: string;
  /** Dónde se compartió, si se quiso decir (nombre «Ciudad, País» y coordenadas de ciudad). */
  place?: { name: string; lat: number; lng: number };
  reactions: Reaction[];
  comments: Comment[];
};

/** Una canción de la banda sonora del grupo (referencia al catálogo, no el archivo). */
export type Song = {
  id: string;
  groupId: string;
  addedBy: string;
  title: string;
  artist: string;
  artwork?: string;
  preview?: string;
  link?: string;
  note?: string;
  createdAt: number;
};

export type EventKind = 'birthday' | 'anniversary' | 'trip' | 'reunion' | 'celebration' | 'other';

/** Un evento del calendario del grupo. Las fechas van como «AAAA-MM-DD». */
export type GroupEvent = {
  id: string;
  groupId: string;
  createdBy?: string;
  kind: EventKind;
  title: string;
  description?: string;
  place?: string;
  startsOn: string;
  endsOn?: string;
  yearly: boolean;
  personId?: string;
};
