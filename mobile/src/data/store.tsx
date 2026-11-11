import type { Session } from '@supabase/supabase-js';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import type { Place } from '@/lib/geo';
import { extensionFor } from '@/lib/media';
import { disablePush } from '@/lib/push';
import { AVATAR_BUCKET, MEDIA_BUCKET, supabase } from '@/lib/supabase';

import { dailyPrompts } from './library';
import type { Group, GroupEvent, Moment, Narration, Proposal, Song, User } from './types';

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
  signOut: () => Promise<void>;
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
    };
    /** Nota de voz grabada. */
    voice?: { uri: string; mime: string; duration: number; waveform: number[] };
    /** Lugar elegido voluntariamente (a nivel de ciudad). */
    place?: Place;
  }) => Promise<void>;
  deleteMoment: (momentId: string) => Promise<void>;
  toggleReaction: (momentId: string, emoji: string) => Promise<void>;
  addComment: (momentId: string, text: string) => Promise<void>;
  dismissProposal: (proposalId: string, state: 'snoozed' | 'skipped') => Promise<void>;
  addChallenge: (groupId: string, title: string, body: string) => Promise<void>;
  setAvatar: (imageUri: string) => Promise<void>;
  /** Borra mis archivos y mi cuenta. No se puede deshacer. */
  deleteAccount: () => Promise<void>;
  updateGroup: (groupId: string, name: string, description: string) => Promise<void>;
  /** Mi preferencia: cuántas propuestas por semana me gustaría recibir. */
  voteFrequency: (groupId: string, perWeek: number) => Promise<void>;
  /** Solo administradores: fija los días con propuesta (1 = lunes … 7 = domingo). */
  setCadence: (groupId: string, days: number[]) => Promise<void>;
  setMemberRole: (groupId: string, userId: string, role: 'admin' | 'member') => Promise<void>;
  removeMember: (groupId: string, userId: string) => Promise<void>;
  leaveGroup: (groupId: string, removeMoments: boolean) => Promise<void>;
  /** A partir de qué hora (0–23, en mi hora local) quiero recibir la propuesta de este grupo. */
  setPreferredHour: (groupId: string, hour: number) => Promise<void>;
  /** Silencia los avisos de un grupo hasta una fecha, o los reactiva con null. */
  setMuted: (groupId: string, until: number | null) => Promise<void>;
  /** Solo administradores: activa o apaga la narradora y elige su estilo. */
  setNarrative: (groupId: string, enabled: boolean, style: string) => Promise<void>;
  /** Que mis momentos no se usen (o sí) en la narración de este grupo. */
  setNarrativeOptOut: (groupId: string, optOut: boolean) => Promise<void>;
  /** Pide (o recupera) la crónica de un periodo. */
  narrate: (args: {
    groupId: string;
    kind: 'week' | 'month';
    from: number;
    to: number;
    label: string;
    force?: boolean;
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

const StoreContext = createContext<Store | null>(null);

const PALETTE = ['#D9663F', '#4E8D7C', '#5B7DB1', '#B8648F', '#C9A227', '#7A6FB0', '#3F8FA8'];
const colorFor = (id: string) =>
  PALETTE[[...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % PALETTE.length];

const deviceTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid';

/** Quien ya no comparte grupo conmigo: su perfil deja de ser visible, sus momentos no. */
const FORMER_MEMBER: Omit<User, 'id'> = {
  name: 'Antiguo integrante',
  city: '',
  tz: 'UTC',
  color: '#A89E93',
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
};
const EMPTY: Data = {
  users: {},
  groups: [],
  moments: [],
  proposals: [],
  dismissed: [],
  songs: [],
  events: [],
};

async function load(me: string): Promise<Data> {
  const [memberships, groupRows, profiles, momentRows, proposalRows, states, songRows, eventRows] =
    await Promise.all([
      supabase
        .from('memberships')
        .select(
          'group_id, user_id, role, frequency_vote, preferred_hour, muted_until, narrative_opt_out',
        )
        .eq('status', 'active')
        .then(check),
      supabase
        .from('groups')
        .select('id, name, description, color, cadence_days, narrative_enabled, narrative_style')
        .order('created_at')
        .then(check),
      supabase
        .from('profiles')
        .select(
          'id, name, home_city, home_country, home_lat, home_lng, home_visible, timezone, avatar_path',
        )
        .then(check),
      supabase
        .from('moments')
        .select(
          'id, group_id, author_id, text, created_at, author_tz, proposal_id, place_name, lat, lng, ' +
            'reactions(emoji, user_id), comments(id, user_id, text, created_at, deleted_at), ' +
            'moment_media(position, media_assets(storage_path, kind, thumb_path, duration_s, waveform))',
        )
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(300)
        .then(check) as PromiseLike<any[]>,
      supabase
        .from('proposals')
        .select('id, group_id, kind, title, body, starts_at, ends_at')
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
        memberIds: members.map((m) => m.user_id),
        isAdmin: members.some((m) => m.user_id === me && m.role === 'admin'),
        myHour: members.find((m) => m.user_id === me)?.preferred_hour ?? 19,
        mutedUntil:
          Date.parse(members.find((m) => m.user_id === me)?.muted_until ?? '') || undefined,
        adminIds: members.filter((m) => m.role === 'admin').map((m) => m.user_id),
        cadenceDays: g.cadence_days ?? [],
        narrativeEnabled: !!g.narrative_enabled,
        narrativeStyle: g.narrative_style ?? 'emotivo',
        myNarrativeOptOut: !!members.find((m) => m.user_id === me)?.narrative_opt_out,
        votes: Object.fromEntries(
          members.filter((m) => m.frequency_vote).map((m) => [m.user_id, m.frequency_vote]),
        ),
      };
    });

  // Las fotos están en un almacén privado: se piden direcciones temporales firmadas.
  // Archivos de cada momento: lo visual (foto o vídeo, con su portada) y la voz.
  type Asset = {
    storage_path: string;
    kind: 'photo' | 'video' | 'audio';
    thumb_path?: string;
    duration_s?: number;
    waveform?: number[];
  };
  const assetsOf = (row: any): Asset[] =>
    [...(row.moment_media ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((mm) => mm.media_assets)
      .filter(Boolean);
  const paths = [
    ...new Set(
      (momentRows ?? [])
        .flatMap((row) => assetsOf(row).flatMap((a) => [a.storage_path, a.thumb_path]))
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

  const moments: Moment[] = (momentRows ?? []).map((row) => {
    const assets = assetsOf(row);
    const photo = assets.find((a) => a.kind === 'photo');
    const video = assets.find((a) => a.kind === 'video');
    const voice = assets.find((a) => a.kind === 'audio');
    return {
      id: row.id,
      groupId: row.group_id,
      authorId: row.author_id,
      text: row.text ?? undefined,
      // En los vídeos, «imageUri» es su portada: así sirven igual en carretes, polaroids y mapa.
      imageUri: photo
        ? signed[photo.storage_path]
        : video?.thumb_path
          ? signed[video.thumb_path]
          : undefined,
      videoUri: video ? signed[video.storage_path] : undefined,
      videoDuration: video?.duration_s ?? undefined,
      voice: voice
        ? {
            uri: signed[voice.storage_path],
            duration: Number(voice.duration_s ?? 0),
            waveform: voice.waveform ?? [],
          }
        : undefined,
      createdAt: Date.parse(row.created_at),
      authorTz: row.author_tz,
      proposalId: row.proposal_id ?? undefined,
      place:
        row.lat != null && row.lng != null
          ? { name: row.place_name ?? '', lat: row.lat, lng: row.lng }
          : undefined,
      reactions: (row.reactions ?? []).map((r: any) => ({ emoji: r.emoji, userId: r.user_id })),
      comments: (row.comments ?? [])
        .filter((c: any) => !c.deleted_at)
        .map((c: any) => ({
          id: c.id,
          userId: c.user_id,
          text: c.text,
          createdAt: Date.parse(c.created_at),
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

  return {
    users,
    groups,
    moments,
    proposals,
    dismissed: (states ?? []).map((s) => s.proposal_id),
    songs,
    events,
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
  const day = Math.floor(Date.now() / 86_400_000);
  // Fecha local (AAAA-MM-DD): la base de datos admite una sola propuesta por grupo y día,
  // así que si el servidor u otra persona ya la creó, esta inserción se ignora.
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const { error } = await supabase.from('proposals').upsert(
    missing.map((g) => ({
      group_id: g.id,
      kind: 'prompt' as const,
      day: today,
      title: dailyPrompts[(day + g.id.charCodeAt(0)) % dailyPrompts.length],
    })),
    { onConflict: 'group_id,day', ignoreDuplicates: true },
  );
  return !error;
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

    addMoment: async ({ groupId, text, imageUri, media, voice, proposalId, place }) => {
      const visual = media ?? (imageUri ? { uri: imageUri, kind: 'photo' as const } : undefined);
      const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const put = async (uri: string, name: string, mime: string) => {
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
      };
      const assetIds: string[] = [];
      if (visual) {
        const mime = visual.mime ?? (visual.kind === 'video' ? 'video/mp4' : 'image/jpeg');
        const file = await put(
          visual.uri,
          `${stamp}.${extensionFor(mime, visual.kind === 'video' ? 'mp4' : 'jpg')}`,
          mime,
        );
        const thumb = visual.poster
          ? await put(visual.poster, `${stamp}-portada.jpg`, 'image/jpeg')
          : undefined;
        const asset = check(
          await supabase
            .from('media_assets')
            .insert({
              kind: visual.kind,
              storage_path: file.path,
              thumb_path: thumb?.path ?? null,
              bytes: file.bytes,
              mime,
              duration_s: visual.duration ?? null,
            })
            .select('id')
            .single(),
        );
        assetIds.push(asset!.id);
      }
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
    addComment: async (momentId, text) => {
      check(await supabase.from('comments').insert({ moment_id: momentId, text }));
      await refresh();
    },
    dismissProposal: async (proposalId, state) => {
      setData((d) => ({ ...d, dismissed: [...d.dismissed, proposalId] }));
      check(await supabase.from('proposal_states').upsert({ proposal_id: proposalId, state }));
    },
    addChallenge: async (groupId, title, body) => {
      check(
        await supabase.from('proposals').insert({
          group_id: groupId,
          kind: 'challenge',
          title,
          body,
          ends_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        }),
      );
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
    setNarrativeOptOut: async (groupId, optOut) => {
      check(
        await supabase
          .from('memberships')
          .update({ narrative_opt_out: optOut })
          .match({ group_id: groupId, user_id: me }),
      );
      await refresh();
    },
    narrate: async ({ groupId, kind, from, to, label, force }) => {
      const pad = (n: number) => String(n).padStart(2, '0');
      const d = new Date(from);
      const { data, error } = await supabase.functions.invoke('narrate', {
        body: {
          groupId,
          kind,
          from: new Date(from).toISOString(),
          to: new Date(to).toISOString(),
          periodStart: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
          label,
          force: !!force,
        },
      });
      if (error) {
        // El servidor explica el motivo en el cuerpo de la respuesta.
        const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
        throw new Error(detail?.error ?? error.message);
      }
      return data as { narration: Narration | null; reason?: string };
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
