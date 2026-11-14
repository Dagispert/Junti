import { router, useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ConnectionCard } from '@/components/connection-card';
import { GroupHeader } from '@/components/group-header';
import type { Moment, Proposal } from '@/data/types';
import { ChallengeBlock } from '@/components/challenge-block';
import { FamilyCard, FamilyTag } from '@/components/family';
import { MomentCard } from '@/components/moment-card';
import { QuestionCard } from '@/components/question-card';
import { OnThisDay } from '@/components/on-this-day';
import { UpcomingCard } from '@/components/upcoming-card';
import { RecapCard } from '@/components/recap-card';
import { Appear } from '@/components/motion';
import { Button, Lead, Screen } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import { featuredWeek, weekStart } from '@/lib/recap';

/** Hoy: la propuesta vigente y los momentos recientes del grupo. */
export default function Today() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const {
    me,
    group: groupById,
    moments,
    proposals,
    questions,
    dismissed,
    dismissProposal,
  } = useStore();
  const group = groupById(id);
  // Lo que respondo aquí se queda a la vista (para ver el resultado) hasta salir.
  const shown = useRef(new Set<string>());
  if (!group) return <Missing />;

  const feed = moments.filter((m) => m.groupId === id);
  // Lunes y martes: el resumen de la semana que acaba de terminar, si tuvo vida.
  const lastWeek = weekStart(Date.now()) - 7 * 86_400_000;
  const lastWeekReady =
    new Date().getDay() >= 1 && new Date().getDay() <= 2 && featuredWeek(feed) === lastWeek
      ? lastWeek
      : null;
  // La propuesta más reciente, si no la he respondido ni apartado.
  const latest = proposals
    .filter((p) => p.groupId === id && p.kind === 'prompt')
    .sort((a, b) => b.startsAt - a.startsAt)[0];
  const proposal =
    latest &&
    !dismissed.includes(latest.id) &&
    !feed.some((m) => m.proposalId === latest.id && m.authorId === me)
      ? latest
      : undefined;

  // Las respuestas a un mismo reto van juntas, en un solo bloque (donde está la más nueva).
  type Entry =
    | { kind: 'moment'; moment: Moment }
    | { kind: 'challenge'; challenge: Proposal; answers: Moment[] };
  const entries: Entry[] = [];
  const blocks = new Map<string, Entry & { kind: 'challenge' }>();
  for (const moment of feed) {
    const challenge = proposals.find((p) => p.id === moment.proposalId && p.kind === 'challenge');
    if (!challenge) {
      entries.push({ kind: 'moment', moment });
      continue;
    }
    const block = blocks.get(challenge.id);
    if (block) block.answers.push(moment);
    else {
      const entry = { kind: 'challenge' as const, challenge, answers: [moment] };
      blocks.set(challenge.id, entry);
      entries.push(entry);
    }
  }

  return (
    <Screen header={<GroupHeader group={group} />}>
      <ConnectionCard group={group} />
      {proposal && (
        <FamilyCard family="prompt" style={styles.proposal}>
          <FamilyTag
            family="prompt"
            detail={
              proposal.startsAt >= new Date().setHours(0, 0, 0, 0) ? 'la de hoy' : 'la última'
            }
          />
          <Text style={[styles.question, { color: theme.text }]}>{proposal.title}</Text>
          <View style={styles.actions}>
            <Button
              label="Responder"
              onPress={() =>
                router.push({
                  pathname: '/publish',
                  params: { groupId: id, proposalId: proposal.id },
                })
              }
            />
            {/* Posponer u omitir no deja rastro visible para los demás. */}
            <Button
              label="Más tarde"
              variant="quiet"
              onPress={() => dismissProposal(proposal.id, 'snoozed').catch(() => {})}
            />
            <Button
              label="Omitir"
              variant="quiet"
              onPress={() => dismissProposal(proposal.id, 'skipped').catch(() => {})}
            />
          </View>
        </FamilyCard>
      )}
      {/* Preguntas del grupo que aún no he respondido (las tres más recientes). */}
      {questions
        .filter(
          (q) =>
            q.groupId === id &&
            q.createdBy !== me &&
            (shown.current.has(q.id) || !q.answers.some((a) => a.userId === me)) &&
            (!q.closesAt || q.closesAt > Date.now()),
        )
        .slice(0, 3)
        .map((q) => {
          shown.current.add(q.id);
          return <QuestionCard key={q.id} question={q} />;
        })}
      <UpcomingCard groupId={group.id} />
      <OnThisDay groupId={group.id} />
      {lastWeekReady != null && (
        <RecapCard
          groupId={group.id}
          kind="week"
          from={lastWeekReady}
          hint="Ya está vuestro resumen"
        />
      )}
      {feed.length === 0 && (
        <Lead strong="Aquí aparecerán los momentos del grupo.">
          Comparte el primero con el botón «+» e invita a los demás con «Invitar».
        </Lead>
      )}
      {entries.map((entry, i) =>
        entry.kind === 'challenge' ? (
          <Appear key={`reto-${entry.challenge.id}`} index={i + 1}>
            <ChallengeBlock challenge={entry.challenge} answers={entry.answers} />
          </Appear>
        ) : (
          <Appear key={entry.moment.id} index={i + 1}>
            <MomentCard moment={entry.moment} />
          </Appear>
        ),
      )}
    </Screen>
  );
}

/** El grupo no existe o ya no pertenezco a él. */
export function Missing() {
  return (
    <Screen>
      <View style={{ paddingTop: Spacing.five, gap: Spacing.three }}>
        <Lead strong="No se encuentra este grupo.">Tira hacia abajo para recargar.</Lead>
        <Button label="Volver a mis grupos" variant="quiet" onPress={() => router.replace('/')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  proposal: { padding: 24, gap: 16 },
  question: { fontSize: 28, lineHeight: 32, fontWeight: '500', letterSpacing: -0.6 },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginLeft: -2 },
});
