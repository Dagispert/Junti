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
  /** Más contexto (todo opcional): apodo, cómo hablar de ella/él, cumpleaños… */
  about: About;
};

export type About = {
  nickname?: string;
  /** f: femenino · m: masculino · n: neutro */
  voiceGender?: 'f' | 'm' | 'n';
  birthMonth?: number;
  birthDay?: number;
  /** Solo si quiere compartirlo. */
  birthYear?: number;
  hometown?: string;
  bio?: string;
  interests?: string[];
};

export type Group = {
  id: string;
  name: string;
  description: string;
  color: string;
  /** Foto de portada (dirección temporal firmada) y la pegatina del grupo. */
  coverUri?: string;
  coverPath?: string;
  sticker?: string;
  memberIds: string[];
  /** Apodos que cada uno usa en este grupo. */
  nicknames: Record<string, string>;
  /** Si soy administrador de este grupo. */
  isAdmin: boolean;
  adminIds: string[];
  /** Mi hora preferida (0–23, local) para recibir la propuesta de este grupo. */
  myHour: number;
  /** Si tengo silenciado este grupo, hasta cuándo. */
  mutedUntil?: number;
  /** Mis horas de descanso (0–23, locales): de «quietFrom» a «quietTo» no llegan avisos. */
  quietFrom: number;
  quietTo: number;
  /** Días de la semana con propuesta: 1 = lunes … 7 = domingo. */
  cadenceDays: number[];
  /** Preferencia de cada integrante: propuestas por semana. */
  votes: Record<string, number>;
  /** La narradora (IA) está activada en el grupo, y con qué estilo. */
  narrativeEnabled: boolean;
  narrativeStyle: string;
  /** La personalidad de la narradora (voz fija, acento, humor…), si el grupo la ha definido. */
  narrator?: NarratorPersona;
  /** Si he pedido que mis momentos no se usen en la narración. */
  myNarrativeOptOut: boolean;
  /** De dónde sois, si compartís origen («Todos somos de Valladolid»). */
  roots?: string;
  /** Dónde empezó todo: uno o varios comienzos (no todos se conocieron igual). */
  origins: GroupOrigin[];
};

/** Un comienzo del grupo: dónde y cuándo se conocieron (todos, o algunos). */
export type GroupOrigin = {
  id: string;
  createdBy?: string;
  place: string;
  lat?: number;
  lng?: number;
  year?: number;
  story?: string;
  /** Quiénes se conocieron así. Vacío = todo el grupo. */
  memberIds: string[];
};

/** Crónica de un periodo escrita por la narradora. */
export type Narration = {
  title: string;
  body: string;
  /** La crónica por escenas: cada una acompaña a un momento (o a ninguno). */
  /** momentId: un momento, o «stats» (las cifras), «end» (despedida) o null (general). */
  /** «chapter»: si con esta escena empieza un capítulo (en «Nuestra historia»). */
  scenes: { momentId: string | null; text: string; chapter?: string }[];
  style: string;
  id: string;
  /** La voz: dirección temporal del audio y segundo en que empieza cada escena. */
  audioUrl?: string | null;
  sceneTimes?: number[] | null;
  audioDuration?: number | null;
  generations: number;
};

/** Una propuesta del día ("prompt") o un reto ("challenge"): mismo objeto, distinta duración. */
export type Proposal = {
  id: string;
  groupId: string;
  /** «plan»: varias publicaciones juntas (importadas de WhatsApp), ya cerrado */
  kind: 'prompt' | 'challenge' | 'plan';
  title: string;
  body?: string;
  startsAt: number;
  endsAt?: number;
  /** Quién lo propuso (vacío: lo propuso Junti). */
  createdBy?: string;
  /** Un minijuego dentro del reto (por ahora, el karaoke). */
  game?: KaraokeGame;
  /** Los otros minijuegos (el cuento a trozos…). */
  juego?: CuentoGame;
};

/**
 * El cuento a trozos: empieza con una frase y cada uno graba, por turnos, cómo
 * sigue (solo oye el trozo anterior). Al terminar se escucha entero.
 */
export type CuentoGame = {
  type: 'cuento';
  /** la primera frase (de quien lo propone o de la narradora) */
  inicio: string;
};

/**
 * Karaoke: una canción (el fragmento gratuito de Apple o una pista subida) y el
 * tramo que canta cada uno entero; al verlo, la app va alternando las voces.
 */
export type KaraokeGame = {
  type: 'karaoke';
  song: string;
  artist?: string;
  artwork?: string;
  /** El fragmento de 30 s de Apple… */
  previewUrl?: string;
  /** …o la pista subida al almacén del grupo. */
  trackPath?: string;
  /** El tramo que se canta, en segundos dentro del audio. */
  start: number;
  end: number;
  lyrics?: string;
  /** la letra con su ritmo: cada línea y su segundo dentro del audio */
  lines?: { t: number; text: string }[];
  /** El vídeo con todas las voces juntas (se graba al verlo entero). */
  montaje?: {
    path: string;
    poster?: string | null;
    firma: string;
    duracion?: number;
    voces?: string[];
  };
  /** Se acabó el tiempo y ya se borraron las tomas sueltas: solo queda el montaje. */
  cerrado?: boolean;
};

export type Reaction = { emoji: string; userId: string; /** cuándo */ at?: number };
export type Comment = {
  id: string;
  userId: string;
  text: string;
  createdAt: number;
  /** Si su autor lo corrigió. */
  edited?: boolean;
  /** Si responde a otro comentario: el comentario al que contesta. */
  replyTo?: string;
};

/** Una foto o un vídeo dentro de un momento con varios. */
export type GalleryItem = {
  kind: 'photo' | 'video';
  uri: string;
  /** Portada (en los vídeos). */
  poster?: string;
  clip?: { start: number; end: number };
  duration?: number;
  /** Si la añadió otra persona en su versión del recuerdo. */
  by?: string;
};

/** La versión de un recuerdo de otra persona: cómo lo recuerda y sus fotos. */
export type MemoryAddition = {
  id: string;
  authorId: string;
  text?: string;
  createdAt: number;
  edited: boolean;
  items: GalleryItem[];
};

export type Moment = {
  id: string;
  groupId: string;
  /** a nombre de quién sale (en un recuerdo importado, quien lo mandó) */
  authorId: string;
  /** quién lo subió, si no es el autor (recuerdo importado de WhatsApp) */
  uploaderId?: string;
  text?: string;
  /** URL firmada y temporal de la foto, si la hay. */
  imageUri?: string;
  /** Todas las fotos del momento, en orden (la primera es «imageUri»). */
  photos?: string[];
  /** Varias fotos y vídeos mezclados, en orden (si hay más de uno). */
  gallery?: GalleryItem[];
  /** En un recuerdo: las versiones de los demás. */
  additions?: MemoryAddition[];
  /** Vídeo (entonces «imageUri» es su portada) y su duración en segundos. */
  videoUri?: string;
  videoDuration?: number;
  /** El tramo del vídeo que se enseña (si se recortó), su duración total y su archivo. */
  videoClip?: { start: number; end: number };
  videoFullDuration?: number;
  videoAssetId?: string;
  /** Nota de voz: audio, duración en segundos y forma de onda (0–100). */
  voice?: { uri: string; duration: number; waveform: number[]; assetId?: string };
  /** Cuándo pasó (en un recuerdo, su fecha real). */
  createdAt: number;
  /** Cuándo se compartió en el grupo. */
  sharedAt: number;
  /** Un recuerdo de antes, guardado en su fecha. */
  memory?: boolean;
  /** Si su autor cambió el texto después de publicarlo. */
  edited?: boolean;
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

/** Un álbum temático del grupo («Viaje a Roma»). */
export type Album = {
  id: string;
  groupId: string;
  createdBy?: string;
  title: string;
  description?: string;
  createdAt: number;
  /** Momentos del álbum, del más antiguo al más reciente según cuándo pasaron. */
  momentIds: string[];
};

export type QuestionKind = 'poll' | 'quiz' | 'open';

/** Una pregunta al grupo: encuesta, quiz o pregunta abierta. */
export type Question = {
  id: string;
  groupId: string;
  createdBy: string;
  kind: QuestionKind;
  title: string;
  options?: string[];
  closesAt?: number;
  createdAt: number;
  /** Solo llegan las de los demás después de haber respondido (o si la pregunta es mía). */
  answers: { userId: string; choice?: number; text?: string; createdAt: number }[];
  /** La respuesta correcta de un quiz, cuando ya se puede ver. */
  correct?: number;
};

/** Cómo es la narradora de un grupo: siempre la misma voz y forma de ser. */
export type NarratorPersona = {
  name?: string;
  /** voz de Gemini (p. ej. «Sulafat»); sin ella, la del tono elegido */
  voice?: string;
  /** acento de la lista («cubano», «mexicano»…) u «otro» */
  accent?: string;
  accentOther?: string;
  /** 0 seria · 1 con gracia · 2 pícara · 3 muy jodedora */
  humor?: number;
  sayings?: boolean;
  notes?: string;
};
