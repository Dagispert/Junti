import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { GroupHeader } from '@/components/group-header';
import { MomentCard } from '@/components/moment-card';
import { Button, Card, Screen } from '@/components/ui';
import { Fonts, Spacing, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';

/** Hoy: la propuesta vigente y los momentos recientes del grupo. */
export default function Today() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { me, group: groupById, moments, proposals, dismissed, dismissProposal } = useStore();
  const group = groupById(id);
  if (!group) return <Missing />;

  const feed = moments.filter((m) => m.groupId === id);
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
                onPress={() => dismissProposal(proposal.id, 'snoozed').catch(() => {})}
              />
              <Button
                label="Omitir"
                variant="quiet"
                onPress={() => dismissProposal(proposal.id, 'skipped').catch(() => {})}
              />
            </View>
          </View>
        </Card>
      )}
      {feed.length === 0 && (
        <Text style={{ color: theme.textSecondary, fontSize: 16, lineHeight: 23 }}>
          Aquí aparecerán los momentos del grupo. Comparte el primero con el botón «+» e invita a
          los demás con «Invitar».
        </Text>
      )}
      {feed.map((moment) => (
        <MomentCard key={moment.id} moment={moment} />
      ))}
    </Screen>
  );
}

/** El grupo no existe o ya no pertenezco a él. */
export function Missing() {
  const theme = useTheme();
  return (
    <Screen>
      <Text style={{ color: theme.textSecondary, paddingTop: Spacing.five }}>
        No se encuentra este grupo. Tira hacia abajo para recargar.
      </Text>
      <Button label="Volver a mis grupos" variant="quiet" onPress={() => router.replace('/')} />
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
