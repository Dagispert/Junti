import { Link, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AvatarRow, Button, Card, Photo, Screen, Title } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import { relative } from '@/lib/time';

/** Nivel 0: los grupos a los que pertenezco. */
export default function MyGroups() {
  const theme = useTheme();
  const { me, user, groups, moments, proposals, dismissed, signOut } = useStore();

  return (
    <Screen
      header={
        <View style={styles.header}>
          <Title>Junti</Title>
          <Pressable accessibilityRole="button" onPress={signOut}>
            <Text style={{ color: theme.textSecondary }}>{user(me).name} · Salir</Text>
          </Pressable>
        </View>
      }>
      {groups.length === 0 && (
        <Text style={[styles.empty, { color: theme.textSecondary }]}>
          Todavía no estás en ningún grupo. Crea uno e invita a los tuyos, o únete con el código que
          te hayan pasado.
        </Text>
      )}
      {groups.map((group) => {
        const recent = moments.filter((m) => m.groupId === group.id);
        const last = recent[0];
        const pending = proposals
          .filter((p) => p.groupId === group.id && p.kind === 'prompt' && !dismissed.includes(p.id))
          .sort((a, b) => b.startsAt - a.startsAt)[0];
        const answered =
          pending && recent.some((m) => m.proposalId === pending.id && m.authorId === me);
        return (
          <Link key={group.id} href={{ pathname: '/group/[id]', params: { id: group.id } }} asChild>
            <Pressable>
              <Card>
                {recent.length > 0 && (
                  <View style={styles.mosaic}>
                    {recent.slice(0, 3).map((moment) => (
                      <Photo key={moment.id} moment={moment} style={styles.tile} />
                    ))}
                  </View>
                )}
                <View style={styles.info}>
                  <View style={styles.row}>
                    <Text style={[styles.name, { color: theme.text }]}>{group.name}</Text>
                    <AvatarRow userIds={group.memberIds} />
                  </View>
                  <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
                    {last
                      ? `${user(last.authorId).name} compartió un momento · ${relative(last.createdAt)}`
                      : 'Aún no hay momentos. Estrena el grupo.'}
                  </Text>
                  {pending && !answered && (
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
      <View style={styles.actions}>
        <Button label="Crear un grupo" onPress={() => router.push('/new-group')} />
        <Button label="Unirme con un código" variant="quiet" onPress={() => router.push('/join')} />
      </View>
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
  empty: { fontSize: 16, lineHeight: 23, paddingVertical: Spacing.four },
  mosaic: { flexDirection: 'row', height: 130, gap: 2 },
  tile: { flex: 1 },
  info: { padding: Spacing.three, gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  name: { fontSize: 19, fontWeight: '700', flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  actions: { gap: Spacing.one, marginTop: Spacing.two },
});
