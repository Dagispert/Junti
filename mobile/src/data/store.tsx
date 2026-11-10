import type { Session } from '@supabase/supabase-js';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { MEDIA_BUCKET, supabase } from '@/lib/supabase';

import { dailyPrompts } from './library';
import type { Group, Moment, Proposal, User } from './types';

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
  user: (id: string) => User;
  group: (id: string) => Group | undefined;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  /** Devuelve false si hay que confirmar el correo antes de poder entrar. */
  signUp: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  saveProfile: (name: string, city: string) => Promise<void>;
  createGroup: (name: string, description: string) => Promise<string>;
  joinGroup: (code: string) => Promise<string>;
  createInvite: (groupId: string) => Promise<string>;
  addMoment: (input: {
    groupId: string;
    text?: string;
    imageUri?: string;
    proposalId?: string;
  }) => Promise<void>;
  deleteMoment: (momentId: string) => Promise<void>;
  toggleReaction: (momentId: string, emoji: string) => Promise<void>;
  addComment: (momentId: string, text: string) => Promise<void>;
  dismissProposal: (proposalId: string, state: 'snoozed' | 'skipped') => Promise<void>;
  addChallenge: (groupId: string, title: string, body: string) => Promise<void>;
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
};
const EMPTY: Data = { users: {}, groups: [], moments: [], proposals: [], dismissed: [] };

async function load(me: string): Promise<Data> {
  const [memberships, groupRows, profiles, momentRows, proposalRows, states] = await Promise.all([
    supabase
      .from('memberships')
      .select('group_id, user_id, role')
      .eq('status', 'active')
      .then(check),
    supabase.from('groups').select('id, name, description, color').order('created_at').then(check),
    supabase.from('profiles').select('id, name, home_city, timezone').then(check),
    supabase
      .from('moments')
      .select(
        'id, group_id, author_id, text, created_at, author_tz, proposal_id, ' +
          'reactions(emoji, user_id), comments(id, user_id, text, created_at, deleted_at), ' +
          'moment_media(position, media_assets(storage_path))',
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
  ]);

  const users: Record<string, User> = {};
  for (const p of profiles ?? []) {
    users[p.id] = {
      id: p.id,
      name: p.name,
      city: p.home_city ?? '',
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
      };
    });

  // Las fotos están en un almacén privado: se piden direcciones temporales firmadas.
  const pathOf = (row: any): string | undefined =>
    [...(row.moment_media ?? [])].sort((a, b) => a.position - b.position)[0]?.media_assets
      ?.storage_path;
  const paths = [...new Set((momentRows ?? []).map(pathOf).filter(Boolean))] as string[];
  const signed: Record<string, string> = {};
  if (paths.length) {
    const { data } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(paths, 3600);
    for (const item of data ?? [])
      if (item.path && item.signedUrl) signed[item.path] = item.signedUrl;
  }

  const moments: Moment[] = (momentRows ?? []).map((row) => {
    const path = pathOf(row);
    return {
      id: row.id,
      groupId: row.group_id,
      authorId: row.author_id,
      text: row.text ?? undefined,
      imageUri: path ? signed[path] : undefined,
      createdAt: Date.parse(row.created_at),
      authorTz: row.author_tz,
      proposalId: row.proposal_id ?? undefined,
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

  return { users, groups, moments, proposals, dismissed: (states ?? []).map((s) => s.proposal_id) };
}

/**
 * Provisional: hasta que exista el planificador del servidor (que respetará la
 * frecuencia del grupo y la hora de cada persona), la propuesta del día se crea
 * cuando alguien abre el grupo y todavía no hay ninguna de hoy.
 */
async function ensureTodayPrompts(data: Data): Promise<boolean> {
  const midnight = new Date().setHours(0, 0, 0, 0);
  const missing = data.groups.filter(
    (g) =>
      !data.proposals.some(
        (p) => p.groupId === g.id && p.kind === 'prompt' && p.startsAt >= midnight,
      ),
  );
  if (!missing.length) return false;
  const day = Math.floor(Date.now() / 86_400_000);
  const { error } = await supabase.from('proposals').insert(
    missing.map((g) => ({
      group_id: g.id,
      kind: 'prompt' as const,
      title: dailyPrompts[(day + g.id.charCodeAt(0)) % dailyPrompts.length],
    })),
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
      await supabase.auth.signOut();
    },
    saveProfile: async (name, city) => {
      check(
        await supabase
          .from('profiles')
          .upsert({ id: me, name, home_city: city || null, timezone: deviceTz() }),
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

    addMoment: async ({ groupId, text, imageUri, proposalId }) => {
      let assetId: string | undefined;
      if (imageUri) {
        const bytes = await (await fetch(imageUri)).arrayBuffer();
        const path = `${groupId}/${me}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        const upload = await supabase.storage
          .from(MEDIA_BUCKET)
          .upload(path, bytes, { contentType: 'image/jpeg' });
        if (upload.error) throw new Error(upload.error.message);
        const asset = check(
          await supabase
            .from('media_assets')
            .insert({ kind: 'photo', storage_path: path, bytes: bytes.byteLength })
            .select('id')
            .single(),
        );
        assetId = asset!.id;
      }
      const moment = check(
        await supabase
          .from('moments')
          .insert({
            group_id: groupId,
            text: text || null,
            proposal_id: proposalId ?? null,
            author_tz: deviceTz(),
          })
          .select('id')
          .single(),
      );
      if (assetId) {
        check(
          await supabase
            .from('moment_media')
            .insert({ moment_id: moment!.id, media_asset_id: assetId }),
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
