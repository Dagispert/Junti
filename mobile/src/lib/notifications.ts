// Centro de notificaciones: lo que han hecho los demás y te importa (nuevas
// publicaciones, comentarios, respuestas, reacciones a lo tuyo, retos,
// preguntas, canciones…), calculado con lo que la app ya tiene cargado.
//
// Qué está leído se guarda en el servidor (vale en todos tus dispositivos):
//   · al abrir algo (una publicación, un reto…) se apunta con su hora: lo que
//     pase después en eso mismo vuelve a contar como nuevo;
//   · si ya reaccionaste, comentaste o participaste después, también cuenta
//     como visto;
//   · «Marcar todo como leído» y el globo de nuevas (desde la última vez que
//     abriste el centro).

import { useEffect, useMemo, useSyncExternalStore } from 'react';

import { useStore } from '@/data/store';
import type { Moment } from '@/data/types';

import { supabase } from './supabase';

export type NotifKind =
  | 'moment'
  | 'memory'
  | 'answer'
  | 'karaoke'
  | 'credited'
  | 'comment'
  | 'reply'
  | 'thread'
  | 'reaction'
  | 'addition'
  | 'challenge'
  | 'question'
  | 'song';

export type Notif = {
  key: string;
  kind: NotifKind;
  groupId: string;
  at: number;
  /** quién (el primero es el principal) */
  actors: string[];
  /** lo que se dice, sin el nombre (que va delante, en negrita) */
  text: string;
  /** una frase de lo que escribieron, si la hay */
  quote?: string;
  emojis?: string[];
  /** en «también comentó en la publicación de…»: de quién es */
  ownerId?: string;
  thumb?: string;
  /** lo que hay que abrir para que cuente como visto */
  scope: string;
  /** a dónde lleva */
  to: { pathname: string; params: Record<string, string> };
  unread: boolean;
  /** nueva desde la última vez que se abrió el centro */
  fresh: boolean;
};

/* ───────────── Lo leído (compartido por toda la app) ───────────── */

type ReadState = {
  user: string | null;
  loaded: boolean;
  seenAt: number;
  readAllAt: number;
  reads: Record<string, number>;
};
let state: ReadState = { user: null, loaded: false, seenAt: 0, readAllAt: 0, reads: {} };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const set = (patch: Partial<ReadState>) => {
  state = { ...state, ...patch };
  emit();
};

async function loadReads(user: string, otraVez = false) {
  if (state.user === user && state.loaded && !otraVez) return;
  // al recargar se mantiene lo que ya había (sin parpadeos de «no leído»)
  if (!otraVez || state.user !== user)
    state = { user, loaded: false, seenAt: 0, readAllAt: 0, reads: {} };
  const [st, rd] = await Promise.all([
    supabase.from('notif_state').select('seen_at, read_all_at').maybeSingle(),
    supabase
      .from('notif_reads')
      .select('scope, read_at')
      .gte('read_at', new Date(Date.now() - WINDOW).toISOString()),
  ]);
  if (state.user !== user) return;
  const reads: Record<string, number> = {};
  for (const r of rd.data ?? []) reads[r.scope] = Date.parse(r.read_at);
  set({
    loaded: true,
    // la primera vez, lo de antes de hoy no cuenta como nuevo (no llega una avalancha)
    seenAt: st.data?.seen_at ? Date.parse(st.data.seen_at) : Date.now() - 86_400_000,
    readAllAt: st.data?.read_all_at ? Date.parse(st.data.read_all_at) : Date.now() - 3 * 86_400_000,
    reads: { ...reads, ...state.reads },
  });
}

/** Vuelve a leer lo visto en otros dispositivos (al volver a la app o si cambia). */
export function recargarLeidos() {
  if (state.user) loadReads(state.user, true).catch(() => {});
}

/** Apunta que se ha visto algo (una publicación, un reto…). */
export function markRead(scope: string) {
  if (!state.user) return;
  const now = Date.now();
  if ((state.reads[scope] ?? 0) > now - 2000) return;
  set({ reads: { ...state.reads, [scope]: now } });
  supabase
    .from('notif_reads')
    .upsert({ scope, read_at: new Date(now).toISOString() })
    .then(() => {});
}

/** Al abrir el centro: el globo de «nuevas» se vacía. */
export function markSeen() {
  if (!state.user) return;
  const now = Date.now();
  set({ seenAt: now });
  supabase
    .from('notif_state')
    .upsert({ seen_at: new Date(now).toISOString() })
    .then(() => {});
}

export function markAllRead() {
  if (!state.user) return;
  const now = Date.now();
  set({ readAllAt: now, seenAt: Math.max(state.seenAt, now) });
  supabase
    .from('notif_state')
    .upsert({ read_all_at: new Date(now).toISOString(), seen_at: new Date(now).toISOString() })
    .then(() => {});
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => state;

/* ───────────── Las notificaciones ───────────── */

/** Cuánto hacia atrás se mira. */
const WINDOW = 30 * 86_400_000;

const first = (s?: string, n = 90) => {
  if (!s) return undefined;
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

export function useNotifications() {
  const store = useStore();
  const { me, moments, proposals, questions, songs, groups } = store;
  const reads = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => {
    if (me) loadReads(me).catch(() => {});
  }, [me]);

  const items = useMemo(() => {
    if (!me) return [] as Notif[];
    const since = Date.now() - WINDOW;
    const out: Omit<Notif, 'unread' | 'fresh'>[] = [];
    const byId = new Map(moments.map((m) => [m.id, m]));
    const proposalById = new Map(proposals.map((p) => [p.id, p]));
    const momentTo = (m: Moment) => ({
      pathname: '/moment/[id]',
      params: { id: m.id },
    });
    const isMine = (m: Moment) => m.authorId === me || m.uploaderId === me;

    for (const m of moments) {
      const scope = `moment:${m.id}`;
      const posted = m.sharedAt;
      const by = m.uploaderId ?? m.authorId;
      // 1) publicaciones nuevas de los demás
      if (by !== me && posted >= since) {
        const p = m.proposalId ? proposalById.get(m.proposalId) : undefined;
        if (m.authorId === me && m.uploaderId) {
          out.push({
            key: `credit:${m.id}`,
            kind: 'credited',
            groupId: m.groupId,
            at: posted,
            actors: [m.uploaderId],
            text: m.memory ? 'guardó un recuerdo a tu nombre' : 'compartió algo tuyo',
            quote: first(m.text),
            thumb: m.imageUri,
            scope,
            to: momentTo(m),
          });
        } else {
          const karaoke = p?.game?.type === 'karaoke';
          const cuento = !!p?.juego;
          out.push({
            key: `moment:${m.id}`,
            kind: karaoke ? 'karaoke' : p ? 'answer' : m.memory ? 'memory' : 'moment',
            groupId: m.groupId,
            at: posted,
            actors: [m.authorId],
            text: karaoke
              ? `cantó en el karaoke «${p!.game!.song}»`
              : cuento
                ? 'siguió el cuento a trozos: ¿te toca?'
                : p?.kind === 'plan'
                  ? `añadió fotos a «${p.title}»`
                  : p
                    ? `respondió a «${p.title}»`
                    : m.memory
                      ? 'compartió un recuerdo'
                      : m.videoUri
                        ? 'publicó un vídeo'
                        : m.imageUri
                          ? 'publicó un momento'
                          : m.voice
                            ? 'mandó una nota de voz'
                            : 'escribió algo',
            quote: first(m.text),
            thumb: m.imageUri,
            scope: karaoke || cuento ? `proposal:${p!.id}` : scope,
            to: karaoke
              ? { pathname: '/karaoke/[id]', params: { id: p!.id, watch: '1' } }
              : cuento
                ? { pathname: '/cuento/[id]', params: { id: p!.id } }
                : momentTo(m),
          });
        }
      }

      // 2) comentarios: en lo mío, respuestas a mí y en conversaciones donde estoy
      const mine = isMine(m);
      const myComments = m.comments.filter((c) => c.userId === me);
      const myIds = new Set(myComments.map((c) => c.id));
      for (const c of m.comments) {
        if (c.userId === me || c.createdAt < since) continue;
        const toMe = !!c.replyTo && myIds.has(c.replyTo);
        const inThread = myComments.some((x) => x.createdAt < c.createdAt);
        if (!mine && !toMe && !inThread) continue;
        out.push({
          key: `comment:${c.id}`,
          kind: toMe ? 'reply' : mine ? 'comment' : 'thread',
          groupId: m.groupId,
          at: c.createdAt,
          actors: [c.userId],
          text: toMe
            ? 'respondió a tu comentario'
            : mine
              ? 'comentó tu publicación'
              : 'también comentó en la publicación de',
          ownerId: !mine && !toMe ? m.authorId : undefined,
          quote: first(c.text),
          thumb: m.imageUri,
          scope,
          to: momentTo(m),
        });
      }

      // 3) reacciones a lo mío (juntas por publicación)
      if (mine) {
        const theirs = m.reactions.filter((r) => r.userId !== me && (r.at ?? m.sharedAt) >= since);
        if (theirs.length) {
          const actors = [...new Set(theirs.map((r) => r.userId))];
          out.push({
            key: `reactions:${m.id}`,
            kind: 'reaction',
            groupId: m.groupId,
            at: Math.max(...theirs.map((r) => r.at ?? m.sharedAt)),
            actors,
            text: `${actors.length > 1 ? 'reaccionaron' : 'reaccionó'} a tu publicación`,
            emojis: [...new Set(theirs.map((r) => r.emoji))].slice(0, 4),
            thumb: m.imageUri,
            scope,
            to: momentTo(m),
          });
        }
        // 4) versiones de los demás en mi recuerdo
        for (const a of m.additions ?? []) {
          if (a.authorId === me || a.createdAt < since) continue;
          out.push({
            key: `addition:${a.id}`,
            kind: 'addition',
            groupId: m.groupId,
            at: a.createdAt,
            actors: [a.authorId],
            text: 'añadió su versión a tu recuerdo',
            quote: first(a.text),
            thumb: a.items[0]?.poster ?? a.items[0]?.uri ?? m.imageUri,
            scope,
            to: momentTo(m),
          });
        }
      }
    }

    // 5) retos y karaokes propuestos por los demás
    for (const p of proposals) {
      if (p.kind !== 'challenge' || !p.createdBy || p.createdBy === me || p.startsAt < since)
        continue;
      const karaoke = p.game?.type === 'karaoke';
      const cuento = !!p.juego;
      out.push({
        key: `proposal:${p.id}`,
        kind: karaoke ? 'karaoke' : 'challenge',
        groupId: p.groupId,
        at: p.startsAt,
        actors: [p.createdBy],
        text: karaoke
          ? `propuso un karaoke: «${p.game!.song}»`
          : cuento
            ? 'empezó un cuento a trozos'
            : `propuso un reto: «${p.title}»`,
        thumb: p.game?.artwork,
        scope: `proposal:${p.id}`,
        to: karaoke
          ? { pathname: '/karaoke/[id]', params: { id: p.id } }
          : cuento
            ? { pathname: '/cuento/[id]', params: { id: p.id } }
            : { pathname: '/group/[id]/retos', params: { id: p.groupId } },
      });
    }

    // 6) preguntas, encuestas y quizzes
    for (const q of questions) {
      if (q.createdBy === me || q.createdAt < since) continue;
      out.push({
        key: `question:${q.id}`,
        kind: 'question',
        groupId: q.groupId,
        at: q.createdAt,
        actors: [q.createdBy],
        text:
          q.kind === 'poll'
            ? `abrió una encuesta: «${first(q.title, 70)}»`
            : q.kind === 'quiz'
              ? `lanzó un quiz: «${first(q.title, 70)}»`
              : `preguntó: «${first(q.title, 70)}»`,
        scope: `question:${q.id}`,
        to: { pathname: '/group/[id]/retos', params: { id: q.groupId } },
      });
    }

    // 7) canciones de la banda sonora
    for (const s of songs) {
      if (s.addedBy === me || s.createdAt < since) continue;
      out.push({
        key: `song:${s.id}`,
        kind: 'song',
        groupId: s.groupId,
        at: s.createdAt,
        actors: [s.addedBy],
        text: `añadió «${s.title}» a la banda sonora`,
        quote: first(s.note),
        thumb: s.artwork,
        scope: `song:${s.id}`,
        to: { pathname: '/group/[id]/memoria', params: { id: s.groupId } },
      });
    }

    // Lo que ya has hecho tú después cuenta como visto.
    const acted = (n: (typeof out)[number]) => {
      if (n.scope.startsWith('moment:')) {
        const m = byId.get(n.scope.slice(7));
        if (!m) return false;
        if (m.comments.some((c) => c.userId === me && c.createdAt >= n.at)) return true;
        if (m.reactions.some((r) => r.userId === me && (r.at ?? 0) >= n.at)) return true;
      }
      if (n.scope.startsWith('proposal:')) {
        const id = n.scope.slice(9);
        if (moments.some((m) => m.proposalId === id && m.authorId === me && m.sharedAt >= n.at))
          return true;
      }
      if (n.scope.startsWith('question:')) {
        const q = questions.find((x) => x.id === n.scope.slice(9));
        if (q?.answers.some((a) => a.userId === me)) return true;
      }
      return false;
    };
    const groupIds = new Set(groups.map((g) => g.id));
    return out
      .filter((n) => groupIds.has(n.groupId))
      .map((n) => {
        const read = n.at <= reads.readAllAt || (reads.reads[n.scope] ?? 0) >= n.at || acted(n);
        return { ...n, unread: !read, fresh: !read && n.at > reads.seenAt };
      })
      .sort((a, b) => b.at - a.at)
      .slice(0, 200);
  }, [me, moments, proposals, questions, songs, groups, reads]);

  return {
    items,
    loaded: reads.loaded,
    unread: items.filter((n) => n.unread).length,
    fresh: items.filter((n) => n.fresh).length,
  };
}
