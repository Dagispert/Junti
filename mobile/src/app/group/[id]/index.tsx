import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ConnectionCard } from '@/components/connection-card';
import { GroupHeader } from '@/components/group-header';
import { MomentCard } from '@/components/moment-card';
import { OnThisDay } from '@/components/on-this-day';
import { RecapCard } from '@/components/recap-card';
import { Appear } from '@/components/motion';
import { Button, Card, Lead, Screen, Tag } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import { featuredWeek, weekStart } from '@/lib/recap';

/** Hoy: la propuesta vigente y los momentos recientes del grupo. */
export default function Today() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { me, group: groupById, moments, proposals, dismissed, dismissProposal } = useStore();
  const group = groupById(id);
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

  return (
    <Screen header={<GroupHeader group={group} />}>
      <ConnectionCard group={group} />
      {proposal && (
        <Card style={styles.proposal}>
          <Tag>
            {proposal.startsAt >= new Date().setHours(0, 0, 0, 0)
              ? 'Propuesta de hoy'
              : 'Última propuesta'}
          </Tag>
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
        </Card>
      )}
      <OnThisDay groupId={group.id} />
      {lastWeekReady != null && (
        <RecapCard
          groupId={group.id}
          kind="week"
          from={lastWeekReady}
          hint="¡Ya está vuestro resumen!"
        />
      )}
      {feed.length === 0 && (
        <Lead strong="Aquí aparecerán los momentos del grupo.">
          Comparte el primero con el botón «+» e invita a los demás con «Invitar».
        </Lead>
      )}
      {feed.map((moment, i) => (
        <Appear key={moment.id} index={i + 1}>
          <MomentCard moment={moment} />
        </Appear>
      ))}
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
  proposal: { padding: 24, gap: 14 },
  question: { fontSize: 26, lineHeight: 32, fontWeight: '500', letterSpacing: -0.6 },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginLeft: -2 },
});
