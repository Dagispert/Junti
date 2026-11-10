import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AvatarRow, Card, Photo, Screen, Title } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { allGroups, getUser, useStore } from '@/data/store';
import { relative } from '@/lib/time';

/** Nivel 0: los grupos a los que pertenezco. */
export default function MyGroups() {
  const theme = useTheme();
  const { me, moments, proposals, dismissed } = useStore();
  const groups = allGroups.filter((g) => g.memberIds.includes(me));

  return (
    <Screen
      header={
        <View style={styles.header}>
          <Title>Junti</Title>
          <Text style={{ color: theme.textSecondary }}>Hola, {getUser(me).name}</Text>
        </View>
      }>
      {groups.map((group) => {
        const recent = moments.filter((m) => m.groupId === group.id);
        const last = recent[0];
        const pending = proposals.find(
          (p) =>
            p.groupId === group.id &&
            p.kind === 'prompt' &&
            !dismissed.includes(p.id) &&
            !moments.some((m) => m.proposalId === p.id && m.authorId === me),
        );
        return (
          <Link key={group.id} href={{ pathname: '/group/[id]', params: { id: group.id } }} asChild>
            <Pressable style={({ pressed }) => pressed && { opacity: 0.8 }}>
              <Card>
                <View style={styles.mosaic}>
                  {recent.slice(0, 3).map((moment) => (
                    <Photo key={moment.id} moment={moment} style={styles.tile} />
                  ))}
                </View>
                <View style={styles.info}>
                  <View style={styles.row}>
                    <Text style={[styles.name, { color: theme.text }]}>
                      {group.emoji} {group.name}
                    </Text>
                    <AvatarRow userIds={group.memberIds} />
                  </View>
                  {last && (
                    <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
                      {getUser(last.authorId).name} compartió un momento ·{' '}
                      {relative(last.createdAt)}
                    </Text>
                  )}
                  {pending && (
                    <View style={styles.row}>
                      <View style={[styles.dot, { backgroundColor: group.color }]} />
                      <Text style={{ color: theme.text, fontSize: 14, flex: 1 }}>
                        {pending.title}
                      </Text>
                    </View>
                  )}
                </View>
              </Card>
            </Pressable>
          </Link>
        );
      })}
      <Text
        style={{
          color: theme.textSecondary,
          textAlign: 'center',
          fontSize: 13,
        }}>
        Prototipo con datos de ejemplo. Crear grupo y unirse con código llegarán con el backend.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
  },
  mosaic: { flexDirection: 'row', height: 130, gap: 2 },
  tile: { flex: 1 },
  info: { padding: Spacing.three, gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  name: { fontSize: 19, fontWeight: '700' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
