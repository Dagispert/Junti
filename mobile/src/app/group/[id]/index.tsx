import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { GroupHeader } from '@/components/group-header';
import { MomentCard } from '@/components/moment-card';
import { Button, Card, Screen } from '@/components/ui';
import { Fonts, Spacing, useTheme } from '@/constants/theme';
import { getGroup, useStore } from '@/data/store';

/** Hoy: la propuesta vigente y los momentos recientes del grupo. */
export default function Today() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { me, moments, proposals, dismissed, dismissProposal } = useStore();
  const group = getGroup(id);
  if (!group) return null;

  const feed = moments.filter((m) => m.groupId === id);
  const proposal = proposals.find(
    (p) =>
      p.groupId === id &&
      p.kind === 'prompt' &&
      !dismissed.includes(p.id) &&
      !feed.some((m) => m.proposalId === p.id && m.authorId === me),
  );

  return (
    <Screen header={<GroupHeader group={group} />}>
      {proposal && (
        <Card style={{ borderColor: group.color, borderWidth: 1.5 }}>
          <View style={styles.proposal}>
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Propuesta de hoy</Text>
            <Text style={[styles.question, { color: theme.text, fontFamily: Fonts?.serif }]}>
              {proposal.title}
            </Text>
            <View style={styles.actions}>
              <Button
                label="Responder"
                color={group.color}
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
                onPress={() => dismissProposal(proposal.id)}
              />
              <Button label="Omitir" variant="quiet" onPress={() => dismissProposal(proposal.id)} />
            </View>
          </View>
        </Card>
      )}
      {feed.map((moment) => (
        <MomentCard key={moment.id} moment={moment} />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  proposal: { padding: Spacing.three, gap: Spacing.two },
  question: { fontSize: 22, lineHeight: 29 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
});
