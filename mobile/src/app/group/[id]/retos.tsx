import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { GroupHeader } from '@/components/group-header';
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
  const { group: groupById, moments, proposals, addChallenge } = useStore();
  const group = groupById(id);
  if (!group) return <Missing />;

  const now = Date.now();
  const challenges = proposals.filter((p) => p.groupId === id && p.kind === 'challenge');
  const active = challenges.filter((p) => !p.endsAt || p.endsAt > now);
  const finished = challenges.filter((p) => p.endsAt && p.endsAt <= now);
  const ideas = challengeLibrary.filter((idea) => !challenges.some((p) => p.title === idea.title));

  const card = (challenge: (typeof challenges)[number], open: boolean) => {
    const answers = moments.filter((m) => m.proposalId === challenge.id);
    // Se muestra quién ha participado; nunca quién falta.
    const participants = [...new Set(answers.map((m) => m.authorId))];
    const left = challenge.endsAt ? daysLeft(challenge.endsAt) : undefined;
    return (
      <Card key={challenge.id} style={styles.card}>
        {answers.length > 0 && <PhotoFan moments={answers} size={120} />}
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Tag center>
            {!open
              ? 'Finalizado'
              : left
                ? left === 1
                  ? 'Queda 1 día'
                  : `Quedan ${left} días`
                : 'Reto'}
          </Tag>
          <Text style={[styles.title, { color: theme.text }]}>{challenge.title}</Text>
          {!!challenge.body && (
            <Text style={[styles.body, { color: theme.textSecondary }]}>{challenge.body}</Text>
          )}
        </View>
        <View style={styles.row}>
          <AvatarRow userIds={participants} size={32} />
          {open && (
            <Button
              label="Participar"
              onPress={() =>
                router.push({
                  pathname: '/publish',
                  params: { groupId: id, proposalId: challenge.id },
                })
              }
            />
          )}
        </View>
      </Card>
    );
  };

  return (
    <Screen header={<GroupHeader group={group} />}>
      {active.map((c) => card(c, true))}

      {ideas.length > 0 && (
        <View style={{ gap: Spacing.two }}>
          <Tag>Ideas para el grupo</Tag>
          <Card style={{ padding: 6 }}>
            {ideas.map((idea, i) => (
              <View
                key={idea.title}
                style={[styles.idea, i > 0 && { borderTopWidth: 1, borderTopColor: theme.soft }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: theme.text, fontSize: 16, fontWeight: '500' }}>
                    {idea.title}
                  </Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 14, lineHeight: 19 }}>
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

      {finished.map((c) => card(c, false))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 24, gap: 18 },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '500',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  body: { fontSize: 16, lineHeight: 22, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
  },
  idea: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: 14 },
});
