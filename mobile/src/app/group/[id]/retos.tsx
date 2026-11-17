import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { GroupHeader } from '@/components/group-header';
import { IdeasNarradora } from '@/components/ideas-retos';
import { MontajeEnBucle } from '@/components/montaje-bucle';
import { NudgeBell } from '@/components/nudge-bell';
import { OwnerActions } from '@/components/owner-actions';
import { QuestionCard } from '@/components/question-card';
import { AvatarRow, Button, Card, PhotoFan, Screen, Tag } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { challengeLibrary } from '@/data/library';
import { useStore } from '@/data/store';
import { daysLeft } from '@/lib/time';

import { Missing } from './index';

/** Retos: activos, ideas de la biblioteca y finalizados. */
export default function Challenges() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const {
    group: groupById,
    moments,
    proposals,
    questions,
    addChallenge,
    editChallenge,
    deleteChallenge,
    me,
  } = useStore();
  const group = groupById(id);
  if (!group) return <Missing />;

  const now = Date.now();
  const challenges = proposals.filter((p) => p.groupId === id && p.kind === 'challenge');
  const active = challenges.filter((p) => !p.endsAt || p.endsAt > now);
  const finished = challenges.filter((p) => p.endsAt && p.endsAt <= now);
  const ideas = challengeLibrary
    .filter((idea) => !challenges.some((p) => p.title === idea.title))
    .slice(0, 4);
  const asked = questions.filter((q) => q.groupId === id);
  const openQuestions = asked.filter((q) => !q.closesAt || q.closesAt > now);
  const closedQuestions = asked.filter((q) => q.closesAt && q.closesAt <= now);

  const card = (challenge: (typeof challenges)[number], open: boolean) => {
    const answers = moments.filter((m) => m.proposalId === challenge.id);
    // Se muestra quién ha participado; nunca quién falta.
    const participants = [
      ...new Set([...answers.map((m) => m.authorId), ...(challenge.game?.montaje?.voces ?? [])]),
    ];
    const left = challenge.endsAt ? daysLeft(challenge.endsAt) : undefined;
    const karaoke = challenge.game?.type === 'karaoke';
    return (
      <Card key={challenge.id} style={styles.card}>
        {open && (
          <View style={styles.bell}>
            <NudgeBell
              targetId={challenge.id}
              groupId={challenge.groupId}
              done={participants}
              owner={challenge.createdBy}
              label="el reto"
            />
          </View>
        )}
        {karaoke && !open && challenge.game?.montaje ? (
          <MontajeEnBucle game={challenge.game} />
        ) : (
          answers.length > 0 && <PhotoFan moments={answers} size={120} />
        )}
        <View style={{ alignItems: 'center', gap: 12 }}>
          <Tag center>
            {!open
              ? 'Finalizado'
              : left
                ? left === 1
                  ? 'Queda 1 día'
                  : `Quedan ${left} días`
                : karaoke
                  ? 'Karaoke'
                  : 'Reto'}
          </Tag>
          <Text style={[styles.title, { color: theme.text }]}>{challenge.title}</Text>
          {!!challenge.body && (
            <Text style={[styles.body, { color: theme.textSecondary }]}>{challenge.body}</Text>
          )}
        </View>
        <View style={styles.row}>
          <AvatarRow userIds={participants} size={32} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {karaoke && (answers.length > 0 || !!challenge.game?.montaje) && (
              <Button
                variant="light"
                label="Ver"
                onPress={() =>
                  router.push({
                    pathname: '/karaoke/[id]',
                    params: { id: challenge.id, watch: '1' },
                  })
                }
              />
            )}
            {open && !(karaoke && participants.includes(me)) && (
              <Button
                label={karaoke ? 'Cantar' : 'Participar'}
                onPress={() =>
                  karaoke
                    ? router.push({ pathname: '/karaoke/[id]', params: { id: challenge.id } })
                    : router.push({
                        pathname: '/publish',
                        params: { groupId: id, proposalId: challenge.id },
                      })
                }
              />
            )}
          </View>
        </View>
        {/* Quien lo propuso (o quien administra el grupo) puede corregirlo o quitarlo. */}
        {(challenge.createdBy === me || (group.isAdmin && !!challenge.createdBy)) && (
          <OwnerActions
            fields={[
              { label: 'El reto', value: challenge.title, max: 140, required: true },
              {
                label: 'Cómo se hace (opcional)',
                value: challenge.body ?? '',
                max: 600,
                multiline: true,
              },
            ]}
            onSave={([title, body]) => editChallenge(challenge.id, title, body)}
            onDelete={() => deleteChallenge(challenge.id)}
            deleteNote={
              answers.length
                ? 'Lo que ya se compartió para el reto se queda en el grupo.'
                : undefined
            }
          />
        )}
      </Card>
    );
  };

  return (
    <Screen header={<GroupHeader group={group} />}>
      <View style={styles.actions}>
        <Button
          compact
          label="Nuevo reto"
          onPress={() => router.push({ pathname: '/new-challenge', params: { groupId: id } })}
        />
        <Button
          compact
          variant="light"
          label="Karaoke"
          onPress={() => router.push({ pathname: '/new-karaoke', params: { groupId: id } })}
        />
        <Button
          compact
          variant="light"
          label="Preguntar algo"
          onPress={() => router.push({ pathname: '/add', params: { groupId: id } })}
        />
      </View>

      {active.map((c) => card(c, true))}

      {openQuestions.length > 0 && <Tag>Preguntas</Tag>}
      {openQuestions.map((q) => (
        <QuestionCard key={q.id} question={q} />
      ))}

      <IdeasNarradora group={group} />

      {ideas.length > 0 && (
        <View style={{ gap: Spacing.two }}>
          <Tag>Ideas para el grupo</Tag>
          <Card style={{ padding: 8 }}>
            {ideas.map((idea, i) => (
              <View
                key={idea.title}
                style={[styles.idea, i > 0 && { borderTopWidth: 1, borderTopColor: theme.soft }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: theme.text, fontSize: 17, fontWeight: '500' }}>
                    {idea.title}
                  </Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 15, lineHeight: 19 }}>
                    {idea.body}
                  </Text>
                </View>
                <Button
                  compact
                  variant="quiet"
                  label="Proponer"
                  onPress={() => addChallenge(id, idea.title, idea.body).catch(() => {})}
                />
              </View>
            ))}
          </Card>
        </View>
      )}

      {(finished.length > 0 || closedQuestions.length > 0) && <Tag>Terminados</Tag>}
      {finished.map((c) => card(c, false))}
      {closedQuestions.map((q) => (
        <QuestionCard key={q.id} question={q} />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 24, gap: 20 },
  bell: { position: 'absolute', top: 16, right: 16, zIndex: 2 },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '500',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  body: { fontSize: 17, lineHeight: 22, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
  },
  idea: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: 16 },
  actions: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
});
