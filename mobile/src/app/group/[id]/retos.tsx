import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { GroupHeader } from '@/components/group-header';
import { AvatarRow, Button, Card, Photo, Screen } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { challengeLibrary } from '@/data/library';
import { useStore } from '@/data/store';
import { daysLeft } from '@/lib/time';

/** Retos: activos, ideas de la biblioteca y finalizados. */
export default function Challenges() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { group: groupById, moments, proposals, addChallenge } = useStore();
  const group = groupById(id);
  if (!group) return null;

  const now = Date.now();
  const challenges = proposals.filter((p) => p.groupId === id && p.kind === 'challenge');
  const active = challenges.filter((p) => !p.endsAt || p.endsAt > now);
  const finished = challenges.filter((p) => p.endsAt && p.endsAt <= now);
  const ideas = challengeLibrary.filter((idea) => !challenges.some((p) => p.title === idea.title));

  const section = (label: string) => (
    <Text style={[styles.section, { color: theme.textSecondary }]}>{label}</Text>
  );

  const card = (challenge: (typeof challenges)[number], open: boolean) => {
    const answers = moments.filter((m) => m.proposalId === challenge.id);
    // Se muestra quién ha participado; nunca quién falta.
    const participants = [...new Set(answers.map((m) => m.authorId))];
    return (
      <Card key={challenge.id}>
        <View style={styles.body}>
          <Text style={[styles.title, { color: theme.text }]}>{challenge.title}</Text>
          {!!challenge.body && <Text style={{ color: theme.textSecondary }}>{challenge.body}</Text>}
          {answers.length > 0 && (
            <View style={styles.grid}>
              {answers.map((m) => (
                <Photo key={m.id} moment={m} style={styles.thumb} />
              ))}
            </View>
          )}
          <View style={styles.row}>
            <AvatarRow userIds={participants} />
            {open && challenge.endsAt && (
              <Text style={{ color: theme.textSecondary, fontSize: 13, flex: 1 }}>
                {daysLeft(challenge.endsAt) === 1
                  ? 'Queda 1 día'
                  : `Quedan ${daysLeft(challenge.endsAt)} días`}
              </Text>
            )}
            {open && (
              <Button
                label="Participar"
                color={group.color}
                onPress={() =>
                  router.push({
                    pathname: '/publish',
                    params: { groupId: id, proposalId: challenge.id },
                  })
                }
              />
            )}
          </View>
        </View>
      </Card>
    );
  };

  return (
    <Screen header={<GroupHeader group={group} />}>
      {active.length > 0 && section('En marcha')}
      {active.map((c) => card(c, true))}

      {ideas.length > 0 && section('Ideas para el grupo')}
      {ideas.map((idea) => (
        <Card key={idea.title}>
          <View style={[styles.body, styles.row]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.text }]}>{idea.title}</Text>
              <Text style={{ color: theme.textSecondary }}>{idea.body}</Text>
            </View>
            <Button
              label="Proponer"
              variant="quiet"
              onPress={() => addChallenge(id, idea.title, idea.body).catch(() => {})}
            />
          </View>
        </Card>
      ))}

      {finished.length > 0 && section('Finalizados')}
      {finished.map((c) => card(c, false))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: Spacing.two,
  },
  body: { padding: Spacing.three, gap: Spacing.two },
  title: { fontSize: 17, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    justifyContent: 'space-between',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  thumb: { width: 84, height: 84, borderRadius: 10 },
});
