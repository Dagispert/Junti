import type { Session } from '@supabase/supabase-js';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import type { Place } from '@/lib/geo';
import { extensionFor } from '@/lib/media';
import { disablePush } from '@/lib/push';
import { AVATAR_BUCKET, MEDIA_BUCKET, supabase } from '@/lib/supabase';

import type {
  About,
  Album,
  GroupOrigin,
  Group,
  GroupEvent,
  GalleryItem,
  Moment,
  Narration,
  NarratorPersona,
  Proposal,
  Question,
  QuestionKind,
  Song,
  User,
  KaraokeGame,
} from './types';

// Estado de la app, respaldado por Supabase. Todo lo que se lee aquí ya viene
// filtrado por las políticas de la base de datos: solo los grupos a los que pertenezco.

type Status = 'loading' | 'signedOut' | 'needsProfile' | 'ready';

type Store = {
  status: Status;
  me: string;
  groups: Group[];
  moments: Moment[];
  proposals: Proposal[];
  /** Propuestas que he omitido o pospuesto. Privado: nadie más lo ve. */
  dismissed: string[];
  songs: Song[];
  events: GroupEvent[];
  user: (id: string) => User;
  group: (id: string) => Group | undefined;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  /** Devuelve false si hay que confirmar el correo antes de poder entrar. */
  signUp: (email: string, password: string) => Promise<boolean>;
  /** Entrar sin contraseña: envía un enlace al correo (crea la cuenta si no existe). */
  sendLoginLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** El resto del perfil: apodo, cómo hablar de mí, cumpleaños, de dónde soy, frase y gustos. */
  saveAbout: (about: About) => Promise<void>;
  /** Mi apodo en un grupo concreto (null lo quita). */
  setGroupNickname: (groupId: string, nickname: string | null) => Promise<void>;
  /** place: la ciudad elegida en el buscador; null la quita; sin pasarla, no cambia. */
  saveProfile: (name: string, place?: Place | null) => Promise<void>;
  createGroup: (name: string, description: string) => Promise<string>;
  joinGroup: (code: string) => Promise<string>;
  createInvite: (groupId: string) => Promise<string>;
  addMoment: (input: {
    groupId: string;
    text?: string;
    imageUri?: string;
    proposalId?: string;
    /** Foto o vídeo, con su tipo, duración y portada (en los vídeos). */
    media?: {
      uri: string;
      kind: 'photo' | 'video';
      mime?: string;
      duration?: number;
      poster?: string;
      /** El tramo del vídeo que se enseña (en segundos). */
      clip?: { start: number; end: number };
    };
    /** Nota de voz grabada. */
    voice?: { uri: string; mime: string; duration: number; waveform: number[] };
    /** Lugar elegido voluntariamente (a nivel de ciudad). */
    place?: Place;
    /** Si es un recuerdo: cuándo pasó. */
    rememberedAt?: number;
    /** En un recuerdo importado: a nombre de quién va (alguien del grupo). */
    creditedTo?: string;
    /** Más fotos, además de la principal. */
    morePhotos?: string[];
    /** Más fotos o vídeos, además de la principal (en este orden). */
    more?: {
      uri: string;
      kind: 'photo' | 'video';
      mime?: string;
      duration?: number;
      poster?: string;
      clip?: { start: number; end: number };
    }[];
  }) => Promise<void>;
  deleteMoment: (momentId: string) => Promise<void>;
  /** Añadir mi versión a un recuerdo de otra persona: cómo lo recuerdo y mis fotos o vídeos. */
  addMemoryAddition: (
    momentId: string,
    input: { text?: string; items: VisualUpload[] },
  ) => Promise<void>;
  editMemoryAddition: (additionId: string, text: string) => Promise<void>;
  deleteMemoryAddition: (additionId: string) => Promise<void>;
  /** Quitar la nota de voz de un momento propio. */
  removeVoice: (momentId: string) => Promise<void>;
  /** Cambiar el tramo del vídeo que se enseña (o null para el vídeo entero). */
  setVideoClip: (assetId: string, clip: { start: number; end: number } | null) => Promise<void>;
  editChallenge: (proposalId: string, title: string, body: string) => Promise<void>;
  deleteChallenge: (proposalId: string) => Promise<void>;
  editQuestion: (questionId: string, title: string) => Promise<void>;
  /** Cambiar el texto de un momento propio. */
  editMoment: (momentId: string, text: string) => Promise<void>;
  toggleReaction: (momentId: string, emoji: string) => Promise<void>;
  addComment: (momentId: string, text: string, replyTo?: string) => Promise<void>;
  /** Solo quien lo escribió: corregir o retirar un comentario. */
  editComment: (commentId: string, text: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  dismissProposal: (proposalId: string, state: 'snoozed' | 'skipped') => Promise<void>;
  /** Un reto para el grupo; «days» = cuántos días dura (sin fecha si se omite). */
  addChallenge: (groupId: string, title: string, body: string, days?: number) => Promise<void>;
  /** Un plan (contenedor de varias publicaciones), en su fecha y ya cerrado. Devuelve su id. */
  addPlan: (groupId: string, title: string, at: number) => Promise<string>;
  /** Un reto de karaoke; con «track», la pista se sube antes al almacén del grupo. */
  addKaraoke: (
    groupId: string,
    game: Omit<KaraokeGame, 'type' | 'trackPath'>,
    days?: number,
    track?: { uri: string; mime: string; name: string },
  ) => Promise<string>;
  questions: Question[];
  albums: Album[];
  createAlbum: (groupId: string, title: string, description?: string) => Promise<string>;
  /** Pone o quita momentos de un álbum. */
  setAlbumMoments: (albumId: string, add: string[], remove: string[]) => Promise<void>;
  deleteAlbum: (albumId: string) => Promise<void>;
  askQuestion: (q: {
    groupId: string;
    kind: QuestionKind;
    title: string;
    options?: string[];
    correct?: number;
    days?: number;
  }) => Promise<void>;
  answerQuestion: (questionId: string, answer: { choice?: number; text?: string }) => Promise<void>;
  deleteQuestion: (questionId: string) => Promise<void>;
  setAvatar: (imageUri: string) => Promise<void>;
  /** Borra mis archivos y mi cuenta. No se puede deshacer. */
  deleteAccount: () => Promise<void>;
  updateGroup: (groupId: string, name: string, description: string) => Promise<void>;
  /** Solo administradores: color, pegatina y foto de portada (null la quita). */
  styleGroup: (
    groupId: string,
    look: { color?: string; sticker?: string | null; coverUri?: string | null },
  ) => Promise<void>;
  /** Dónde empezó todo: añade (sin id) o corrige un comienzo del grupo. */
  saveOrigin: (groupId: string, origin: Omit<GroupOrigin, 'id'> & { id?: string }) => Promise<void>;
  deleteOrigin: (originId: string) => Promise<void>;
  /** Solo administradores: de dónde sois («Todos somos de…»); vacío lo quita. */
  setRoots: (groupId: string, roots: string) => Promise<void>;
  /** Mi preferencia: cuántas propuestas por semana me gustaría recibir. */
  voteFrequency: (groupId: string, perWeek: number) => Promise<void>;
  /** Solo administradores: fija los días con propuesta (1 = lunes … 7 = domingo). */
  setCadence: (groupId: string, days: number[]) => Promise<void>;
  setMemberRole: (groupId: string, userId: string, role: 'admin' | 'member') => Promise<void>;
  removeMember: (groupId: string, userId: string) => Promise<void>;
  leaveGroup: (groupId: string, removeMoments: boolean) => Promise<void>;
  /** A partir de qué hora (0–23, en mi hora local) quiero recibir la propuesta de este grupo. */
  setPreferredHour: (groupId: string, hour: number) => Promise<void>;
  /** Mis horas de descanso en un grupo (0–23, en mi hora local). */
  setQuietHours: (groupId: string, from: number, to: number) => Promise<void>;
  /** Silencia los avisos de un grupo hasta una fecha, o los reactiva con null. */
  setMuted: (groupId: string, until: number | null) => Promise<void>;
  /** Solo administradores: activa o apaga la narradora y elige su estilo. */
  setNarrative: (groupId: string, enabled: boolean, style: string) => Promise<void>;
  /** Guarda cómo es la narradora (lo ya contado se vuelve a contar con ella). */
  setNarrator: (groupId: string, persona: NarratorPersona | null) => Promise<void>;
  /** La campanita: avisa a quien aún no ha participado; devuelve a cuántos. */
  nudge: (targetId: string) => Promise<number>;
  /** Que mis momentos no se usen (o sí) en la narración de este grupo. */
  setNarrativeOptOut: (groupId: string, optOut: boolean) => Promise<void>;
  /** Pide (o recupera) la crónica de un periodo. */
  narrate: (args: {
    groupId: string;
    kind: 'week' | 'month' | 'story';
    from: number;
    to: number;
    label: string;
    force?: boolean;
    /** «voice»: el audio de la crónica ya escrita. */
    action?: 'voice';
  }) => Promise<{ narration: Narration | null; reason?: string }>;
  reportMoment: (momentId: string) => Promise<void>;
  addSong: (
    groupId: string,
    song: Omit<Song, 'id' | 'groupId' | 'addedBy' | 'createdAt'>,
  ) => Promise<void>;
  removeSong: (songId: string) => Promise<void>;
  saveEvent: (event: Omit<GroupEvent, 'id' | 'createdBy'> & { id?: string }) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
};

/** Una foto o un vídeo para subir. */
type VisualUpload = {
  uri: string;
  kind: 'photo' | 'video';
  mime?: string;
  duration?: number;
  poster?: string;
  clip?: { start: number; end: number };
};

/** Sube un archivo al almacén privado del grupo. */
async function putFile(groupId: string, me: string, uri: string, name: string, mime: string) {
  const blob = await (await fetch(uri)).blob();
  const path = `${groupId}/${me}/${name}`;
  const upload = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, blob, { contentType: mime });
  if (upload.error) {
    throw new Error(
      /exceeded|too large|size/i.test(upload.error.message)
        ? 'El archivo es demasiado grande (máximo 50 MB). Prueba con un vídeo más corto.'
        : upload.error.message,
    );
  }
  return { path, bytes: blob.size };
}

/** Sube fotos y vídeos (con su portada y su tramo) y devuelve sus archivos, en orden. */
async function saveVisuals(
  groupId: string,
  me: string,
  items: VisualUpload[],
  stamp: string,
): Promise<string[]> {
  const ids: string[] = [];
  for (const [i, item] of items.entries()) {
    const mime = item.mime ?? (item.kind === 'video' ? 'video/mp4' : 'image/jpeg');
    const name = i === 0 ? stamp : `${stamp}-${i + 1}`;
    const file = await putFile(
      groupId,
      me,
      item.uri,
      `${name}.${extensionFor(mime, item.kind === 'video' ? 'mp4' : 'jpg')}`,
      mime,
    );
    const thumb = item.poster
      ? await putFile(groupId, me, item.poster, `${name}-portada.jpg`, 'image/jpeg')
      : undefined;
    const { data, error } = await supabase
      .from('media_assets')
      .insert({
        kind: item.kind,
        storage_path: file.path,
        thumb_path: thumb?.path ?? null,
        bytes: file.bytes,
        mime,
        duration_s: item.duration ?? null,
        clip_start: item.clip?.start ?? null,
        clip_end: item.clip?.end ?? null,
      })
      .select('id')
      .single();
    if (error) throw error;
    ids.push(data.id as string);
  }
  return ids;
}

/**
 * Una frase de muestra de la narradora con una personalidad (aunque no esté
 * guardada todavía): devuelve el texto y su audio, o el motivo si descansa.
 */
export async function sampleNarrator(
  groupId: string,
  persona: NarratorPersona,
): Promise<{ text?: string; audio?: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke('narrate', {
    body: { action: 'sample', groupId, persona },
  });
  if (error) {
    const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
    return { error: detail?.error ?? 'No se ha podido escuchar ahora. Prueba en un rato.' };
  }
  return data ?? {};
}

/** Pide la crónica de un periodo a la función «narrate» del servidor. */
async function requestNarration({
  groupId,
  kind,
  from,
  to,
  label,
  force,
  action,
}: {
  groupId: string;
  kind: 'week' | 'month' | 'story';
  from: number;
  to: number;
  label: string;
  force?: boolean;
  action?: 'voice';
}): Promise<{ narration: Narration | null; reason?: string }> {
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = new Date(from);
  const { data, error } = await supabase.functions.invoke('narrate', {
    body: {
      groupId,
      kind,
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
      // La historia del grupo no tiene periodo: el servidor usa el suyo.
      periodStart:
        kind === 'story'
          ? '2000-01-01'
          : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      label,
      force: !!force,
      action,
    },
  });
  if (error) {
    // El servidor explica el motivo en el cuerpo de la respuesta.
    const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(detail?.error ?? error.message);
  }
  const row = data?.narration as
    | (Omit<Narration, 'scenes' | 'audioUrl' | 'sceneTimes' | 'audioDuration'> & {
        scenes?: { moment_id: string | null; text: string; chapter?: string }[];
        audio_url?: string | null;
        scene_times?: number[] | null;
        audio_duration?: number | null;
      })
    | null;
  return {
    reason: data?.reason,
    narration: row && {
      id: row.id,
      title: row.title,
      body: row.body,
      style: row.style,
      generations: row.generations,
      scenes: (row.scenes ?? []).map((e) => ({
        momentId: e.moment_id,
        text: e.text,
        ...(e.chapter ? { chapter: e.chapter } : {}),
      })),
      audioUrl: row.audio_url,
      sceneTimes: row.scene_times,
      audioDuration: row.audio_duration,
    },
  };
}

const inFlight = new Map<string, Promise<{ narration: Narration | null; reason?: string }>>();

const StoreContext = createContext<Store | null>(null);

export const PALETTE = [
  '#D9663F',
  '#4E8D7C',
  '#5B7DB1',
  '#B8648F',
  '#C9A227',
  '#7A6FB0',
  '#3F8FA8',
];
const colorFor = (id: string) =>
  PALETTE[[...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % PALETTE.length];

const deviceTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid';

/** Quien ya no comparte grupo conmigo: su perfil deja de ser visible, sus momentos no. */
const FORMER_MEMBER: Omit<User, 'id'> = {
  name: 'Antiguo integrante',
  city: '',
  tz: 'UTC',
  color: '#A89E93',
  about: {},
};

function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

type Data = {
  users: Record<string, User>;
  groups: Group[];
  moments: Moment[];
  proposals: Proposal[];
  dismissed: string[];
  songs: Song[];
  events: GroupEvent[];
  questions: Question[];
  albums: Album[];
};
const EMPTY: Data = {
  users: {},
  groups: [],
  moments: [],
  proposals: [],
  dismissed: [],
  songs: [],
  events: [],
  questions: [],
  albums: [],
};

async function load(me: string): Promise<Data> {
  const [
    memberships,
    groupRows,
    profiles,
    momentRows,
    proposalRows,
    states,
    songRows,
    eventRows,
    questionRows,
    keyRows,
    albumRows,
    originRows,
  ] = await Promise.all([
    supabase
      .from('memberships')
      .select(
        'group_id, user_id, role, frequency_vote, preferred_hour, muted_until, narrative_opt_out, quiet_from, quiet_to, nickname',
      )
      .eq('status', 'active')
      .then(check),
    supabase
      .from('groups')
      .select(
        'id, name, description, color, cover_path, sticker, cadence_days, narrative_enabled, narrative_style, narrator, roots',
      )
      .order('created_at')
      .then(check),
    supabase
      .from('profiles')
      .select(
        'id, name, home_city, home_country, home_lat, home_lng, home_visible, timezone, avatar_path, nickname, voice_gender, birth_month, birth_day, birth_year, hometown, bio, interests',
      )
      .then(check),
    supabase
      .from('moments')
      .select(
        'id, group_id, author_id, credited_to, text, created_at, shared_at, memory, edited_at, author_tz, proposal_id, place_name, lat, lng, ' +
          'reactions(emoji, user_id, created_at), comments(id, user_id, text, created_at, deleted_at, edited_at, reply_to), ' +
          'memory_additions(id, author_id, text, created_at, edited_at), ' +
          'moment_media(position, addition_id, media_assets(id, storage_path, kind, thumb_path, duration_s, waveform, clip_start, clip_end))',
      )
      .is('deleted_at', null)
      .order('shared_at', { ascending: false })
      .limit(300)
      .then(check) as PromiseLike<any[]>,
    supabase
      .from('proposals')
      .select('id, group_id, kind, title, body, starts_at, ends_at, created_by, game')
      .then(check),
    supabase.from('proposal_states').select('proposal_id, state').eq('user_id', me).then(check),
    supabase
      .from('songs')
      .select(
        'id, group_id, added_by, title, artist, artwork_url, preview_url, external_url, note, created_at',
      )
      .order('created_at', { ascending: false })
      .then(check),
    supabase
      .from('events')
      .select(
        'id, group_id, created_by, kind, title, description, place, starts_on, ends_on, yearly, person_id',
      )
      .order('starts_on')
      .then(check),
    supabase
      .from('questions')
      .select(
        'id, group_id, created_by, kind, title, options, closes_at, created_at, ' +
          'question_answers(user_id, choice, text, created_at)',
      )
      .order('created_at', { ascending: false })
      .limit(100)
      .then(check) as PromiseLike<any[]>,
    supabase.from('question_keys').select('question_id, correct').then(check),
    supabase
      .from('albums')
      .select('id, group_id, created_by, title, description, created_at, album_moments(moment_id)')
      .order('created_at', { ascending: false })
      .then(check) as PromiseLike<any[]>,
    supabase
      .from('group_origins')
      .select('id, group_id, created_by, place_name, lat, lng, year, story, member_ids')
      .order('year', { ascending: true, nullsFirst: false })
      .order('created_at')
      .then(check),
  ]);

  // Fotos de perfil: también privadas, con dirección temporal firmada.
  const avatarPaths = (profiles ?? []).map((p) => p.avatar_path).filter(Boolean) as string[];
  const avatars: Record<string, string> = {};
  if (avatarPaths.length) {
    const { data } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrls(avatarPaths, 3600);
    for (const item of data ?? [])
      if (item.path && item.signedUrl) avatars[item.path] = item.signedUrl;
  }

  const users: Record<string, User> = {};
  for (const p of profiles ?? []) {
    users[p.id] = {
      avatarUri: p.avatar_path ? avatars[p.avatar_path] : undefined,
      avatarPath: p.avatar_path ?? undefined,
      id: p.id,
      name: p.name,
      // Quien decide no mostrar su ciudad no aparece en el mapa de los demás.
      ...(p.home_visible || p.id === me
        ? {
            city: p.home_city ?? '',
            country: p.home_country ?? undefined,
            lat: p.home_lat ?? undefined,
            lng: p.home_lng ?? undefined,
          }
        : { city: '' }),
      tz: p.timezone,
      color: colorFor(p.id),
      about: {
        nickname: p.nickname ?? undefined,
        voiceGender: p.voice_gender ?? undefined,
        birthMonth: p.birth_month ?? undefined,
        birthDay: p.birth_day ?? undefined,
        birthYear: p.birth_year ?? undefined,
        hometown: p.hometown ?? undefined,
        bio: p.bio ?? undefined,
        interests: p.interests ?? undefined,
      },
    };
  }

  const mine = new Set((memberships ?? []).filter((m) => m.user_id === me).map((m) => m.group_id));
  const groups: Group[] = (groupRows ?? [])
    .filter((g) => mine.has(g.id))
    .map((g) => {
      const members = (memberships ?? []).filter((m) => m.group_id === g.id);
      return {
        id: g.id,
        name: g.name,
        description: g.description ?? '',
        color: g.color,
        coverPath: g.cover_path ?? undefined,
        sticker: g.sticker ?? undefined,
        memberIds: members.map((m) => m.user_id),
        nicknames: Object.fromEntries(
          members.filter((m) => m.nickname).map((m) => [m.user_id, m.nickname]),
        ),
        isAdmin: members.some((m) => m.user_id === me && m.role === 'admin'),
        myHour: members.find((m) => m.user_id === me)?.preferred_hour ?? 19,
        quietFrom: members.find((m) => m.user_id === me)?.quiet_from ?? 22,
        quietTo: members.find((m) => m.user_id === me)?.quiet_to ?? 9,
        mutedUntil:
          Date.parse(members.find((m) => m.user_id === me)?.muted_until ?? '') || undefined,
        adminIds: members.filter((m) => m.role === 'admin').map((m) => m.user_id),
        cadenceDays: g.cadence_days ?? [],
        narrativeEnabled: !!g.narrative_enabled,
        narrativeStyle: g.narrative_style ?? 'emotivo',
        narrator: (g.narrator as NarratorPersona | null) ?? undefined,
        myNarrativeOptOut: !!members.find((m) => m.user_id === me)?.narrative_opt_out,
        votes: Object.fromEntries(
          members.filter((m) => m.frequency_vote).map((m) => [m.user_id, m.frequency_vote]),
        ),
        roots: g.roots ?? undefined,
        origins: (originRows ?? [])
          .filter((o) => o.group_id === g.id)
          .map((o) => ({
            id: o.id,
            createdBy: o.created_by ?? undefined,
            place: o.place_name,
            lat: o.lat ?? undefined,
            lng: o.lng ?? undefined,
            year: o.year ?? undefined,
            story: o.story ?? undefined,
            memberIds: o.member_ids ?? [],
          })),
      };
    });

  // Las fotos están en un almacén privado: se piden direcciones temporales firmadas.
  // Archivos de cada momento: lo visual (foto o vídeo, con su portada) y la voz.
  type Asset = {
    id: string;
    clip_start?: number | null;
    clip_end?: number | null;
    storage_path: string;
    kind: 'photo' | 'video' | 'audio';
    thumb_path?: string;
    duration_s?: number;
    waveform?: number[];
  };
  // Todos los archivos (los del autor y los de las versiones de los demás).
  const assetsOf = (row: any): (Asset & { addition?: string })[] =>
    [...(row.moment_media ?? [])]
      .sort((a, b) => a.position - b.position)
      .filter((mm) => mm.media_assets)
      .map((mm) => ({ ...mm.media_assets, addition: mm.addition_id ?? undefined }));
  const paths = [
    ...new Set(
      (momentRows ?? [])
        .flatMap((row) => assetsOf(row).flatMap((a) => [a.storage_path, a.thumb_path]))
        .concat(groups.map((g) => g.coverPath))
        .filter(Boolean),
    ),
  ] as string[];
  const signed: Record<string, string> = {};
  for (let k = 0; k < paths.length; k += 100) {
    const { data } = await supabase.storage
      .from(MEDIA_BUCKET)
      .createSignedUrls(paths.slice(k, k + 100), 3600);
    for (const item of data ?? [])
      if (item.path && item.signedUrl) signed[item.path] = item.signedUrl;
  }

  for (const g of groups) g.coverUri = g.coverPath ? signed[g.coverPath] : undefined;

  const moments: Moment[] = (momentRows ?? []).map((row) => {
    const everything = assetsOf(row);
    // Lo del autor; las versiones de los demás van aparte (y al final del carrusel).
    const assets = everything.filter((a) => !a.addition);
    const additionRows: any[] = [...(row.memory_additions ?? [])].sort(
      (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
    );
    const byAddition = new Map(additionRows.map((x) => [x.id, x.author_id as string]));
    const theirs = everything.filter((a) => a.addition && a.kind !== 'audio');
    const galleryItem = (a: Asset & { addition?: string }): GalleryItem => ({
      kind: a.kind as 'photo' | 'video',
      uri: signed[a.storage_path],
      poster: a.thumb_path ? signed[a.thumb_path] : undefined,
      clip: clipOf(a),
      duration: a.clip_end != null ? a.clip_end - (a.clip_start ?? 0) : (a.duration_s ?? undefined),
      by: a.addition ? byAddition.get(a.addition) : undefined,
    });
    const photo = assets.find((a) => a.kind === 'photo');
    const allPhotos = assets.filter((a) => a.kind === 'photo').map((a) => signed[a.storage_path]);
    const visuals = assets.filter((a) => a.kind !== 'audio');
    // Con varias cosas (fotos y vídeos mezclados), la primera hace de portada.
    const video =
      visuals.length > 1
        ? visuals[0].kind === 'video'
          ? visuals[0]
          : undefined
        : assets.find((a) => a.kind === 'video');
    const voice = assets.find((a) => a.kind === 'audio');
    const clipOf = (a: Asset) =>
      a.clip_end != null
        ? { start: Number(a.clip_start ?? 0), end: Number(a.clip_end) }
        : undefined;
    return {
      id: row.id,
      groupId: row.group_id,
      // un recuerdo importado sale a nombre de quien lo mandó; quien lo subió sigue siendo el dueño
      authorId: row.credited_to ?? row.author_id,
      uploaderId: row.credited_to ? row.author_id : undefined,
      text: row.text ?? undefined,
      // En los vídeos, «imageUri» es su portada: así sirven igual en carretes, polaroids y mapa.
      imageUri:
        visuals.length > 1 && visuals[0].kind === 'photo'
          ? signed[visuals[0].storage_path]
          : visuals.length > 1 && video?.thumb_path
            ? signed[video.thumb_path]
            : photo && !video
              ? signed[photo.storage_path]
              : video?.thumb_path
                ? signed[video.thumb_path]
                : undefined,
      photos: allPhotos.length > 1 ? allPhotos : undefined,
      gallery:
        visuals.length + theirs.length > 1 ? [...visuals, ...theirs].map(galleryItem) : undefined,
      additions: additionRows.length
        ? additionRows.map((x) => ({
            id: x.id,
            authorId: x.author_id,
            text: x.text ?? undefined,
            createdAt: Date.parse(x.created_at),
            edited: !!x.edited_at,
            items: theirs.filter((a) => a.addition === x.id).map(galleryItem),
          }))
        : undefined,
      videoUri: video ? signed[video.storage_path] : undefined,
      videoDuration:
        video?.clip_end != null
          ? video.clip_end - (video.clip_start ?? 0)
          : (video?.duration_s ?? undefined),
      videoAssetId: video?.id,
      videoClip: video ? clipOf(video) : undefined,
      videoFullDuration: video?.duration_s ?? undefined,
      voice: voice
        ? {
            assetId: voice.id,
            uri: signed[voice.storage_path],
            duration: Number(voice.duration_s ?? 0),
            waveform: voice.waveform ?? [],
          }
        : undefined,
      createdAt: Date.parse(row.created_at),
      sharedAt: Date.parse(row.shared_at ?? row.created_at),
      memory: !!row.memory,
      edited: !!row.edited_at,
      authorTz: row.author_tz,
      proposalId: row.proposal_id ?? undefined,
      place:
        row.lat != null && row.lng != null
          ? { name: row.place_name ?? '', lat: row.lat, lng: row.lng }
          : undefined,
      reactions: (row.reactions ?? []).map((r: any) => ({
        emoji: r.emoji,
        userId: r.user_id,
        at: r.created_at ? Date.parse(r.created_at) : undefined,
      })),
      comments: (row.comments ?? [])
        .filter((c: any) => !c.deleted_at)
        .map((c: any) => ({
          id: c.id,
          userId: c.user_id,
          text: c.text,
          createdAt: Date.parse(c.created_at),
          edited: !!c.edited_at,
          replyTo: c.reply_to ?? undefined,
        }))
        .sort((a: any, b: any) => a.createdAt - b.createdAt),
    };
  });

  const proposals: Proposal[] = (proposalRows ?? []).map((p) => ({
    id: p.id,
    groupId: p.group_id,
    kind: p.kind,
    title: p.title,
    body: p.body ?? undefined,
    startsAt: Date.parse(p.starts_at),
    endsAt: p.ends_at ? Date.parse(p.ends_at) : undefined,
    createdBy: p.created_by ?? undefined,
    game: p.game?.type === 'karaoke' ? p.game : undefined,
  }));

  const songs: Song[] = (songRows ?? []).map((s) => ({
    id: s.id,
    groupId: s.group_id,
    addedBy: s.added_by,
    title: s.title,
    artist: s.artist,
    artwork: s.artwork_url ?? undefined,
    preview: s.preview_url ?? undefined,
    link: s.external_url ?? undefined,
    note: s.note ?? undefined,
    createdAt: Date.parse(s.created_at),
  }));

  const events: GroupEvent[] = (eventRows ?? []).map((e) => ({
    id: e.id,
    groupId: e.group_id,
    createdBy: e.created_by ?? undefined,
    kind: e.kind,
    title: e.title,
    description: e.description ?? undefined,
    place: e.place ?? undefined,
    startsOn: e.starts_on,
    endsOn: e.ends_on ?? undefined,
    yearly: e.yearly,
    personId: e.person_id ?? undefined,
  }));

  // Los cumpleaños apuntados en los perfiles salen solos en el calendario de cada
  // grupo (salvo que alguien ya lo haya apuntado a mano).
  for (const g of groups) {
    for (const uid of g.memberIds) {
      const a = users[uid]?.about;
      if (!a?.birthMonth || !a.birthDay) continue;
      if (events.some((e) => e.groupId === g.id && e.kind === 'birthday' && e.personId === uid))
        continue;
      const mm = String(a.birthMonth).padStart(2, '0');
      const dd = String(a.birthDay).padStart(2, '0');
      events.push({
        id: `perfil-${g.id}-${uid}`,
        groupId: g.id,
        kind: 'birthday',
        title: `Cumpleaños de ${users[uid].name.split(' ')[0]}`,
        startsOn: `${a.birthYear ?? 2000}-${mm}-${dd}`,
        yearly: true,
        personId: uid,
      });
    }
  }

  const keys = new Map((keyRows ?? []).map((k) => [k.question_id, k.correct as number]));
  const questions: Question[] = (questionRows ?? []).map((q) => ({
    id: q.id,
    groupId: q.group_id,
    createdBy: q.created_by,
    kind: q.kind,
    title: q.title,
    options: q.options ?? undefined,
    closesAt: q.closes_at ? Date.parse(q.closes_at) : undefined,
    createdAt: Date.parse(q.created_at),
    answers: (q.question_answers ?? []).map((a: any) => ({
      userId: a.user_id,
      choice: a.choice ?? undefined,
      text: a.text ?? undefined,
      createdAt: Date.parse(a.created_at),
    })),
    correct: keys.get(q.id),
  }));

  const when = new Map(moments.map((m) => [m.id, m.createdAt]));
  const albums: Album[] = (albumRows ?? []).map((a) => ({
    id: a.id,
    groupId: a.group_id,
    createdBy: a.created_by ?? undefined,
    title: a.title,
    description: a.description ?? undefined,
    createdAt: Date.parse(a.created_at),
    momentIds: (a.album_moments ?? [])
      .map((x: any) => x.moment_id as string)
      .filter((id: string) => when.has(id))
      .sort((x: string, y: string) => when.get(x)! - when.get(y)!),
  }));

  return {
    users,
    groups,
    moments,
    proposals,
    dismissed: (states ?? []).map((s) => s.proposal_id),
    songs,
    events,
    questions,
    albums,
  };
}

/**
 * Provisional: hasta que exista el planificador del servidor (que respetará la
 * frecuencia del grupo y la hora de cada persona), la propuesta del día se crea
 * cuando alguien abre el grupo y todavía no hay ninguna de hoy.
 */
async function ensureTodayPrompts(data: Data): Promise<boolean> {
  const midnight = new Date().setHours(0, 0, 0, 0);
  // Día de la semana, de 1 (lunes) a 7 (domingo): solo hay propuesta los días que toca.
  const weekday = new Date().getDay() || 7;
  const missing = data.groups.filter(
    (g) =>
      g.cadenceDays.includes(weekday) &&
      !data.proposals.some(
        (p) => p.groupId === g.id && p.kind === 'prompt' && p.startsAt >= midnight,
      ),
  );
  if (!missing.length) return false;
  // Fecha local (AAAA-MM-DD). El servidor elige de la biblioteca una propuesta que el
  // grupo aún no haya tenido; si ya existe la de hoy, la deja como está.
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const results = await Promise.all(
    missing.map((g) => supabase.rpc('daily_prompt', { g: g.id, d: today })),
  );
  return results.some((r) => !r.error && r.data);
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>();
  const [hasProfile, setHasProfile] = useState<boolean>();
  const [data, setData] = useState<Data>(EMPTY);

  const me = session?.user.id ?? '';

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  const refreshFor = async (userId: string) => {
    let next = await load(userId);
    if (await ensureTodayPrompts(next)) next = await load(userId);
    setData(next);
    setHasProfile(userId in next.users);
    // Si viajo o me mudo, mi hora local cambia: las propuestas deben seguirme.
    const mine = next.users[userId];
    if (mine && mine.tz !== deviceTz()) {
      await supabase.from('profiles').update({ timezone: deviceTz() }).eq('id', userId);
    }
  };

  useEffect(() => {
    if (!me) {
      setData(EMPTY);
      setHasProfile(undefined);
      return;
    }
    refreshFor(me).catch(() => setHasProfile((known) => known ?? false));
  }, [me]);

  const refresh = () => (me ? refreshFor(me) : Promise.resolve());

  const status: Status =
    session === undefined
      ? 'loading'
      : !session
        ? 'signedOut'
        : hasProfile === undefined
          ? 'loading'
          : hasProfile
            ? 'ready'
            : 'needsProfile';

  const store: Store = {
    status,
    me,
    groups: data.groups,
    moments: data.moments,
    proposals: data.proposals,
    dismissed: data.dismissed,
    songs: data.songs,
    events: data.events,
    questions: data.questions,
    albums: data.albums,
    user: (id) => data.users[id] ?? { id, ...FORMER_MEMBER },
    group: (id) => data.groups.find((g) => g.id === id),
    refresh,

    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
    },
    signUp: async (email, password) => {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw new Error(error.message);
      return !!data.session;
    },
    saveAbout: async (a) => {
      check(
        await supabase
          .from('profiles')
          .update({
            nickname: a.nickname || null,
            voice_gender: a.voiceGender ?? null,
            birth_month: a.birthMonth ?? null,
            birth_day: a.birthDay ?? null,
            birth_year: a.birthMonth ? (a.birthYear ?? null) : null,
            hometown: a.hometown || null,
            bio: a.bio || null,
            interests: a.interests?.length ? a.interests : null,
          })
          .eq('id', me),
      );
      await refresh();
    },
    setGroupNickname: async (groupId, nickname) => {
      check(
        await supabase
          .from('memberships')
          .update({ nickname: nickname || null })
          .match({ group_id: groupId, user_id: me }),
      );
      await refresh();
    },
    sendLoginLink: async (email) => {
      const back =
        typeof window !== 'undefined' && window.location
          ? `${window.location.origin}${window.location.pathname.startsWith('/Junti') ? '/Junti/' : '/'}`
          : 'https://dagispert.github.io/Junti/';
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: back, shouldCreateUser: true },
      });
      if (error) throw new Error(error.message);
    },
    signOut: async () => {
      // Este dispositivo deja de recibir avisos de esta cuenta.
      await disablePush().catch(() => {});
      await supabase.auth.signOut();
    },
    saveProfile: async (name, place) => {
      const where =
        place === undefined
          ? {}
          : {
              home_city: place?.name ?? null,
              home_country: place?.country ?? null,
              home_lat: place?.lat ?? null,
              home_lng: place?.lng ?? null,
            };
      check(
        await supabase.from('profiles').upsert({ id: me, name, timezone: deviceTz(), ...where }),
      );
      await refresh();
    },

    createGroup: async (name, description) => {
      const row = check(
        await supabase
          .from('groups')
          .insert({ name, description: description || null })
          .select('id')
          .single(),
      );
      await refresh();
      return row!.id;
    },
    joinGroup: async (code) => {
      const groupId = check(
        await supabase.rpc('join_group', { invite_code: code.trim().toLowerCase() }),
      );
      await refresh();
      return groupId as string;
    },
    createInvite: async (groupId) => {
      const row = check(
        await supabase.from('invitations').insert({ group_id: groupId }).select('code').single(),
      );
      return row!.code;
    },

    addMoment: async ({
      groupId,
      text,
      imageUri,
      media,
      voice,
      proposalId,
      place,
      rememberedAt,
      morePhotos,
      more,
      creditedTo,
    }) => {
      const visual = media ?? (imageUri ? { uri: imageUri, kind: 'photo' as const } : undefined);
      const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const put = (uri: string, name: string, mime: string) =>
        putFile(groupId, me, uri, name, mime);
      // Lo visual, en orden: la principal y las demás (fotos y vídeos mezclados).
      const assetIds = await saveVisuals(
        groupId,
        me,
        [
          ...(visual ? [visual as VisualUpload] : []),
          ...(more ?? []),
          ...(morePhotos ?? []).map((uri) => ({ uri, kind: 'photo' as const })),
        ],
        stamp,
      );
      if (voice) {
        const file = await put(
          voice.uri,
          `${stamp}-voz.${extensionFor(voice.mime, 'webm')}`,
          voice.mime,
        );
        const asset = check(
          await supabase
            .from('media_assets')
            .insert({
              kind: 'audio',
              storage_path: file.path,
              bytes: file.bytes,
              mime: voice.mime,
              duration_s: Math.round(voice.duration * 10) / 10,
              waveform: voice.waveform,
            })
            .select('id')
            .single(),
        );
        assetIds.push(asset!.id);
      }
      const moment = check(
        await supabase
          .from('moments')
          .insert({
            group_id: groupId,
            text: text || null,
            proposal_id: proposalId ?? null,
            author_tz: deviceTz(),
            // Un recuerdo se guarda en su fecha real.
            ...(rememberedAt && {
              memory: true,
              created_at: new Date(rememberedAt).toISOString(),
            }),
            // a nombre de quien lo mandó (alguien del grupo), si no es quien lo sube
            ...(creditedTo && { credited_to: creditedTo }),
            place_name: place ? [place.name, place.country].filter(Boolean).join(', ') : null,
            lat: place?.lat ?? null,
            lng: place?.lng ?? null,
          })
          .select('id')
          .single(),
      );
      if (assetIds.length) {
        check(
          await supabase.from('moment_media').insert(
            assetIds.map((id, position) => ({
              moment_id: moment!.id,
              media_asset_id: id,
              position,
            })),
          ),
        );
      }
      if (proposalId) {
        await supabase
          .from('proposal_states')
          .upsert({ proposal_id: proposalId, state: 'answered' });
      }
      await refresh();
    },
    editMoment: async (momentId, text) => {
      check(
        await supabase
          .from('moments')
          .update({ text: text || null, edited_at: new Date().toISOString() })
          .eq('id', momentId),
      );
      await refresh();
    },
    addMemoryAddition: async (momentId, { text, items }) => {
      const moment = data.moments.find((m) => m.id === momentId);
      if (!moment) throw new Error('Ese recuerdo ya no está.');
      const addition = check(
        await supabase
          .from('memory_additions')
          .insert({ moment_id: momentId, text: text || null })
          .select('id')
          .single(),
      );
      try {
        const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const ids = await saveVisuals(moment.groupId, me, items, stamp);
        if (ids.length) {
          check(
            await supabase.from('moment_media').insert(
              ids.map((id, i) => ({
                moment_id: momentId,
                media_asset_id: id,
                addition_id: addition!.id,
                // Después de lo del autor, en el orden en que se añadieron.
                position: Math.min(32000, 100 + (moment.additions?.length ?? 0) * 12 + i),
              })),
            ),
          );
        }
      } catch (error) {
        // Sin archivos a medias: se deshace la versión.
        await supabase.from('memory_additions').delete().eq('id', addition!.id);
        throw error;
      }
      await refresh();
    },
    editMemoryAddition: async (additionId, text) => {
      check(
        await supabase
          .from('memory_additions')
          .update({ text: text || null, edited_at: new Date().toISOString() })
          .eq('id', additionId),
      );
      await refresh();
    },
    deleteMemoryAddition: async (additionId) => {
      // Primero sus archivos (fotos, vídeos y portadas), luego la versión.
      const { data: rows } = await supabase
        .from('moment_media')
        .select('media_asset_id, media_assets(storage_path, thumb_path)')
        .eq('addition_id', additionId);
      const assets = (rows ?? []) as any[];
      check(await supabase.from('memory_additions').delete().eq('id', additionId));
      if (assets.length) {
        await supabase
          .from('media_assets')
          .delete()
          .in(
            'id',
            assets.map((a) => a.media_asset_id),
          );
        const paths = assets
          .flatMap((a) => [a.media_assets?.storage_path, a.media_assets?.thumb_path])
          .filter(Boolean);
        if (paths.length) await supabase.storage.from(MEDIA_BUCKET).remove(paths);
      }
      await refresh();
    },
    removeVoice: async (momentId) => {
      const moment = data.moments.find((m) => m.id === momentId);
      const assetId = moment?.voice?.assetId;
      if (!assetId) return;
      const { data: asset } = await supabase
        .from('media_assets')
        .select('storage_path')
        .eq('id', assetId)
        .maybeSingle();
      check(
        await supabase
          .from('moment_media')
          .delete()
          .match({ moment_id: momentId, media_asset_id: assetId }),
      );
      check(await supabase.from('media_assets').delete().eq('id', assetId));
      if (asset?.storage_path)
        await supabase.storage.from(MEDIA_BUCKET).remove([asset.storage_path]);
      check(
        await supabase
          .from('moments')
          .update({ edited_at: new Date().toISOString() })
          .eq('id', momentId),
      );
      await refresh();
    },
    setVideoClip: async (assetId, clip) => {
      check(
        await supabase
          .from('media_assets')
          .update({ clip_start: clip?.start ?? null, clip_end: clip?.end ?? null })
          .eq('id', assetId),
      );
      await refresh();
    },
    editChallenge: async (proposalId, title, body) => {
      check(
        await supabase
          .from('proposals')
          .update({ title, body: body || null })
          .eq('id', proposalId),
      );
      await refresh();
    },
    deleteChallenge: async (proposalId) => {
      check(await supabase.from('proposals').delete().eq('id', proposalId));
      await refresh();
    },
    editQuestion: async (questionId, title) => {
      check(await supabase.from('questions').update({ title }).eq('id', questionId));
      await refresh();
    },
    deleteMoment: async (momentId) => {
      check(
        await supabase
          .from('moments')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', momentId),
      );
      await refresh();
    },
    toggleReaction: async (momentId, emoji) => {
      const moment = data.moments.find((m) => m.id === momentId);
      const mine = moment?.reactions.some((r) => r.userId === me && r.emoji === emoji);
      check(
        mine
          ? await supabase
              .from('reactions')
              .delete()
              .match({ moment_id: momentId, user_id: me, emoji })
          : await supabase.from('reactions').insert({ moment_id: momentId, emoji }),
      );
      await refresh();
    },
    addComment: async (momentId, text, replyTo) => {
      check(
        await supabase
          .from('comments')
          .insert({ moment_id: momentId, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
      );
      await refresh();
    },
    editComment: async (commentId, text) => {
      check(
        await supabase
          .from('comments')
          .update({ text, edited_at: new Date().toISOString() })
          .eq('id', commentId)
          .eq('user_id', me),
      );
      await refresh();
    },
    deleteComment: async (commentId) => {
      check(
        await supabase
          .from('comments')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', commentId)
          .eq('user_id', me),
      );
      await refresh();
    },
    dismissProposal: async (proposalId, state) => {
      setData((d) => ({ ...d, dismissed: [...d.dismissed, proposalId] }));
      check(await supabase.from('proposal_states').upsert({ proposal_id: proposalId, state }));
    },
    addPlan: async (groupId, title, at) => {
      const row = check(
        await supabase
          .from('proposals')
          .insert({
            group_id: groupId,
            kind: 'plan',
            title: title.slice(0, 140),
            starts_at: new Date(at).toISOString(),
            ends_at: new Date(at + 60_000).toISOString(),
          })
          .select('id')
          .single(),
      );
      return row!.id as string;
    },
    addKaraoke: async (groupId, game, days, track) => {
      let trackPath: string | undefined;
      if (track) {
        const ext = /\.(\w{2,4})$/.exec(track.name)?.[1] ?? 'mp3';
        trackPath = (
          await putFile(
            groupId,
            me,
            track.uri,
            `karaoke-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`,
            track.mime || 'audio/mpeg',
          )
        ).path;
      }
      const row = check(
        await supabase
          .from('proposals')
          .insert({
            group_id: groupId,
            kind: 'challenge',
            title: `Karaoke: ${game.song}`.slice(0, 140),
            body: 'Cada uno canta el tramo entero; Junti junta las voces en un solo vídeo.',
            ends_at: days ? new Date(Date.now() + days * 86_400_000).toISOString() : null,
            game: {
              type: 'karaoke',
              ...game,
              ...(trackPath ? { trackPath, previewUrl: undefined } : {}),
            },
          })
          .select('id')
          .single(),
      );
      await refresh();
      return row!.id as string;
    },
    addChallenge: async (groupId, title, body, days) => {
      check(
        await supabase.from('proposals').insert({
          group_id: groupId,
          kind: 'challenge',
          title,
          body: body || null,
          ends_at: days ? new Date(Date.now() + days * 86_400_000).toISOString() : null,
        }),
      );
      await refresh();
    },
    createAlbum: async (groupId, title, description) => {
      const row = check(
        await supabase
          .from('albums')
          .insert({ group_id: groupId, title, description: description || null })
          .select('id')
          .single(),
      );
      await refresh();
      return row!.id as string;
    },
    setAlbumMoments: async (albumId, add, remove) => {
      if (add.length) {
        check(
          await supabase.from('album_moments').upsert(
            add.map((moment_id) => ({ album_id: albumId, moment_id })),
            { onConflict: 'album_id,moment_id', ignoreDuplicates: true },
          ),
        );
      }
      if (remove.length) {
        check(
          await supabase
            .from('album_moments')
            .delete()
            .eq('album_id', albumId)
            .in('moment_id', remove),
        );
      }
      await refresh();
    },
    deleteAlbum: async (albumId) => {
      check(await supabase.from('albums').delete().eq('id', albumId));
      await refresh();
    },
    askQuestion: async ({ groupId, kind, title, options, correct, days }) => {
      const q = check(
        await supabase
          .from('questions')
          .insert({
            group_id: groupId,
            kind,
            title,
            options: kind === 'open' ? null : options,
            closes_at: days ? new Date(Date.now() + days * 86_400_000).toISOString() : null,
          })
          .select('id')
          .single(),
      );
      if (kind === 'quiz' && correct !== undefined) {
        check(await supabase.from('question_keys').insert({ question_id: q!.id, correct }));
      }
      await refresh();
    },
    answerQuestion: async (questionId, { choice, text }) => {
      check(
        await supabase
          .from('question_answers')
          .upsert(
            { question_id: questionId, user_id: me, choice: choice ?? null, text: text ?? null },
            { onConflict: 'question_id,user_id' },
          ),
      );
      await refresh();
    },
    deleteQuestion: async (questionId) => {
      check(await supabase.from('questions').delete().eq('id', questionId));
      await refresh();
    },

    setAvatar: async (imageUri) => {
      const bytes = await (await fetch(imageUri)).arrayBuffer();
      const path = `${me}/${Date.now()}.jpg`;
      const upload = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, bytes, { contentType: 'image/jpeg' });
      if (upload.error) throw new Error(upload.error.message);
      const previous = data.users[me]?.avatarPath;
      check(await supabase.from('profiles').update({ avatar_path: path }).eq('id', me));
      if (previous) await supabase.storage.from(AVATAR_BUCKET).remove([previous]);
      await refresh();
    },
    deleteAccount: async () => {
      // Primero mis archivos (la base de datos no puede borrarlos), luego la cuenta.
      for (const g of data.groups) {
        const folder = `${g.id}/${me}`;
        const { data: files } = await supabase.storage
          .from(MEDIA_BUCKET)
          .list(folder, { limit: 1000 });
        if (files?.length) {
          await supabase.storage.from(MEDIA_BUCKET).remove(files.map((f) => `${folder}/${f.name}`));
        }
      }
      const { data: mine } = await supabase.storage.from(AVATAR_BUCKET).list(me);
      if (mine?.length) {
        await supabase.storage.from(AVATAR_BUCKET).remove(mine.map((f) => `${me}/${f.name}`));
      }
      check(await supabase.rpc('delete_my_account'));
      await supabase.auth.signOut();
    },

    updateGroup: async (groupId, name, description) => {
      check(
        await supabase
          .from('groups')
          .update({ name, description: description || null })
          .eq('id', groupId),
      );
      await refresh();
    },
    styleGroup: async (groupId, { color, sticker, coverUri }) => {
      const change: Record<string, string | null> = {};
      if (color !== undefined) change.color = color;
      if (sticker !== undefined) change.sticker = sticker;
      if (coverUri === null) change.cover_path = null;
      if (coverUri) {
        const blob = await (await fetch(coverUri)).blob();
        const path = `${groupId}/${me}/portada-${Date.now()}.jpg`;
        const upload = await supabase.storage
          .from(MEDIA_BUCKET)
          .upload(path, blob, { contentType: 'image/jpeg' });
        if (upload.error) throw new Error(upload.error.message);
        change.cover_path = path;
      }
      check(await supabase.from('groups').update(change).eq('id', groupId));
      await refresh();
    },
    saveOrigin: async (groupId, o) => {
      const row = {
        place_name: o.place,
        lat: o.lat ?? null,
        lng: o.lng ?? null,
        year: o.year ?? null,
        story: o.story || null,
        member_ids: o.memberIds,
      };
      check(
        o.id
          ? await supabase.from('group_origins').update(row).eq('id', o.id)
          : await supabase.from('group_origins').insert({ ...row, group_id: groupId }),
      );
      await refresh();
    },
    deleteOrigin: async (originId) => {
      check(await supabase.from('group_origins').delete().eq('id', originId));
      await refresh();
    },
    setRoots: async (groupId, roots) => {
      check(
        await supabase
          .from('groups')
          .update({ roots: roots.trim() || null })
          .eq('id', groupId),
      );
      await refresh();
    },
    voteFrequency: async (groupId, perWeek) => {
      check(
        await supabase
          .from('memberships')
          .update({ frequency_vote: perWeek })
          .match({ group_id: groupId, user_id: me }),
      );
      await refresh();
    },
    setCadence: async (groupId, days) => {
      check(await supabase.from('groups').update({ cadence_days: days }).eq('id', groupId));
      await refresh();
    },
    setMemberRole: async (groupId, userId, role) => {
      check(
        await supabase
          .from('memberships')
          .update({ role })
          .match({ group_id: groupId, user_id: userId }),
      );
      await refresh();
    },
    removeMember: async (groupId, userId) => {
      check(
        await supabase
          .from('memberships')
          .update({ status: 'removed', left_at: new Date().toISOString() })
          .match({ group_id: groupId, user_id: userId }),
      );
      await refresh();
    },
    leaveGroup: async (groupId, removeMoments) => {
      check(await supabase.rpc('leave_group', { g: groupId, remove_moments: removeMoments }));
      await refresh();
    },
    setPreferredHour: async (groupId, hour) => {
      check(
        await supabase
          .from('memberships')
          .update({ preferred_hour: hour })
          .match({ group_id: groupId, user_id: me }),
      );
      await refresh();
    },
    setQuietHours: async (groupId, from, to) => {
      check(
        await supabase
          .from('memberships')
          .update({ quiet_from: from, quiet_to: to })
          .match({ group_id: groupId, user_id: me }),
      );
      await refresh();
    },
    setMuted: async (groupId, until) => {
      check(
        await supabase
          .from('memberships')
          .update({ muted_until: until ? new Date(until).toISOString() : null })
          .match({ group_id: groupId, user_id: me }),
      );
      await refresh();
    },
    setNarrative: async (groupId, enabled, style) => {
      check(
        await supabase
          .from('groups')
          .update({ narrative_enabled: enabled, narrative_style: style })
          .eq('id', groupId),
      );
      await refresh();
    },
    nudge: async (targetId) => {
      const { data, error } = await supabase.rpc('nudge', { target: targetId });
      if (error) throw new Error(error.message);
      return Number(data ?? 0);
    },
    setNarrator: async (groupId, persona) => {
      check(await supabase.from('groups').update({ narrator: persona }).eq('id', groupId));
      await refresh();
    },
    setNarrativeOptOut: async (groupId, optOut) => {
      check(
        await supabase
          .from('memberships')
          .update({ narrative_opt_out: optOut })
          .match({ group_id: groupId, user_id: me }),
      );
      await refresh();
    },
    narrate: ({ groupId, kind, from, to, label, force, action }) => {
      // Si ya se está pidiendo lo mismo (p. ej. preparándolo de antemano), se espera a eso.
      const key = `${groupId}:${kind}:${from}:${action ?? 'text'}`;
      const running = force ? undefined : inFlight.get(key);
      if (running) return running;
      // Si se corta la conexión mientras escribe (tarda), el servidor termina y lo
      // guarda igual: se vuelve a pedir y llega lo ya hecho.
      const attempt = async (
        left: number,
      ): Promise<{ narration: Narration | null; reason?: string }> => {
        try {
          return await requestNarration({
            groupId,
            kind,
            from,
            to,
            label,
            force: force && left === 3,
            action,
          });
        } catch (error) {
          const network = /failed to (send|fetch)|network|load failed/i.test(
            String((error as Error)?.message),
          );
          if (!network || left <= 1) throw error;
          if (action === 'voice') {
            // La voz se sigue haciendo en el servidor: se espera a que esté guardada
            // (sin pedir otra) y entonces se recoge.
            const d = new Date(from);
            const pad = (n: number) => String(n).padStart(2, '0');
            const period =
              kind === 'story'
                ? '2000-01-01'
                : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
            for (let k = 0; k < 24; k++) {
              await new Promise((r) => setTimeout(r, 5000));
              const { data: row } = await supabase
                .from('narrations')
                .select('audio_path')
                .match({ group_id: groupId, kind, period_start: period })
                .maybeSingle();
              if (row?.audio_path) break;
            }
          } else {
            await new Promise((r) => setTimeout(r, 8000));
          }
          return attempt(left - 1);
        }
      };
      const job = attempt(3).finally(() => inFlight.delete(key));
      if (!force) inFlight.set(key, job);
      return job;
    },
    addSong: async (groupId, song) => {
      check(
        await supabase.from('songs').insert({
          group_id: groupId,
          title: song.title,
          artist: song.artist,
          artwork_url: song.artwork ?? null,
          preview_url: song.preview ?? null,
          external_url: song.link ?? null,
          note: song.note || null,
        }),
      );
      await refresh();
    },
    removeSong: async (songId) => {
      check(await supabase.from('songs').delete().eq('id', songId));
      await refresh();
    },
    saveEvent: async ({ id, ...e }) => {
      const row = {
        group_id: e.groupId,
        kind: e.kind,
        title: e.title,
        description: e.description || null,
        place: e.place || null,
        starts_on: e.startsOn,
        ends_on: e.endsOn || null,
        yearly: e.yearly,
        person_id: e.personId || null,
      };
      check(
        id
          ? await supabase.from('events').update(row).eq('id', id)
          : await supabase.from('events').insert(row),
      );
      await refresh();
    },
    deleteEvent: async (eventId) => {
      check(await supabase.from('events').delete().eq('id', eventId));
      await refresh();
    },
    reportMoment: async (momentId) => {
      check(await supabase.from('reports').insert({ moment_id: momentId, reason: 'inapropiado' }));
    },
  };

  return <StoreContext value={store}>{children}</StoreContext>;
}

export function useStore(): Store {
  const store = use(StoreContext);
  if (!store) throw new Error('useStore debe usarse dentro de StoreProvider');
  return store;
}

/** Traduce los errores más habituales a algo que se pueda leer. */
export function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/Invalid login credentials/i.test(message))
    return 'El correo o la contraseña no son correctos.';
  if (/already registered/i.test(message))
    return 'Ya existe una cuenta con ese correo. Prueba a entrar.';
  if (/Email not confirmed/i.test(message))
    return 'Confirma tu correo con el enlace que te enviamos y vuelve a entrar.';
  if (/at least 6 characters|weak/i.test(message))
    return 'La contraseña debe tener al menos 6 caracteres.';
  if (/rate limit/i.test(message))
    return 'Demasiados intentos seguidos. Espera un poco y prueba otra vez.';
  if (/Failed to fetch|Network request failed/i.test(message))
    return 'No hay conexión. Revisa tu internet y prueba otra vez.';
  return message;
}
