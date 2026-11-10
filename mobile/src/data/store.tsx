import { createContext, use, useState, type ReactNode } from 'react';

import * as sample from './sample';
import type { Moment, Proposal } from './types';

// Estado en memoria del prototipo. Se sustituirá por Supabase (ver supabase/).

type Store = {
  me: string;
  moments: Moment[];
  proposals: Proposal[];
  /** Propuestas que he omitido o pospuesto. Privado: nadie más lo ve. */
  dismissed: string[];
  addMoment: (input: {
    groupId: string;
    text?: string;
    imageUri?: string;
    proposalId?: string;
  }) => void;
  toggleReaction: (momentId: string, emoji: string) => void;
  addComment: (momentId: string, text: string) => void;
  dismissProposal: (proposalId: string) => void;
  addChallenge: (groupId: string, title: string, body: string) => void;
};

const StoreContext = createContext<Store | null>(null);

const newId = () => Math.random().toString(36).slice(2);

export function StoreProvider({ children }: { children: ReactNode }) {
  const me = sample.ME;
  const [moments, setMoments] = useState(sample.moments);
  const [proposals, setProposals] = useState(sample.proposals);
  const [dismissed, setDismissed] = useState<string[]>([]);

  const update = (id: string, change: (moment: Moment) => Moment) =>
    setMoments((list) => list.map((moment) => (moment.id === id ? change(moment) : moment)));

  const store: Store = {
    me,
    moments,
    proposals,
    dismissed,
    addMoment: (input) =>
      setMoments((list) => [
        {
          id: newId(),
          authorId: me,
          createdAt: Date.now(),
          reactions: [],
          comments: [],
          ...input,
        },
        ...list,
      ]),
    toggleReaction: (momentId, emoji) =>
      update(momentId, (moment) => {
        const mine = moment.reactions.some((r) => r.userId === me && r.emoji === emoji);
        return {
          ...moment,
          reactions: mine
            ? moment.reactions.filter((r) => !(r.userId === me && r.emoji === emoji))
            : [...moment.reactions, { emoji, userId: me }],
        };
      }),
    addComment: (momentId, text) =>
      update(momentId, (moment) => ({
        ...moment,
        comments: [...moment.comments, { id: newId(), userId: me, text, createdAt: Date.now() }],
      })),
    dismissProposal: (proposalId) => setDismissed((list) => [...list, proposalId]),
    addChallenge: (groupId, title, body) =>
      setProposals((list) => [
        ...list,
        {
          id: newId(),
          groupId,
          kind: 'challenge',
          title,
          body,
          endsAt: Date.now() + 7 * 24 * 3600_000,
        },
      ]),
  };

  return <StoreContext value={store}>{children}</StoreContext>;
}

export function useStore(): Store {
  const store = use(StoreContext);
  if (!store) throw new Error('useStore debe usarse dentro de StoreProvider');
  return store;
}

export const getUser = (id: string) => sample.users.find((u) => u.id === id)!;
export const getGroup = (id: string) => sample.groups.find((g) => g.id === id);
export const allGroups = sample.groups;
export const challengeLibrary = sample.challengeLibrary;
