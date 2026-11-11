import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Avatar,
  AvatarRow,
  Button,
  Card,
  Lead,
  Photo,
  Scrim,
  Screen,
  Title,
} from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import { relative } from '@/lib/time';

/** Nivel 0: los grupos a los que pertenezco. */
export default function MyGroups() {
  const theme = useTheme();
  const { me, user, groups, moments, proposals, dismissed } = useStore();

  return (
    <Screen
      header={
        <View style={styles.header}>
          <Title>Junti</Title>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tu perfil"
            onPress={() => router.push('/settings')}
            style={styles.me}>
            <Text style={{ color: theme.textSecondary, fontSize: 14 }}>{user(me).name}</Text>
            <Avatar userId={me} size={34} />
          </Pressable>
        </View>
      }>
      {groups.length === 0 && (
        <View style={{ paddingVertical: Spacing.five }}>
          <Lead strong="Todavía no estás en ningún grupo.">
            Crea uno e invita a los tuyos, o únete con el código que te hayan pasado.
          </Lead>
        </View>
      )}

      {groups.map((group) => {
        // (el margen inferior deja sitio a las tarjetas que asoman por debajo)
        const recent = moments.filter((m) => m.groupId === group.id);
        const last = recent[0];
        const cover = recent.find((m) => m.imageUri);
        const pending = proposals
          .filter((p) => p.groupId === group.id && p.kind === 'prompt' && !dismissed.includes(p.id))
          .sort((a, b) => b.startsAt - a.startsAt)[0];
        const answered =
          pending && recent.some((m) => m.proposalId === pending.id && m.authorId === me);
        const open = () => router.push({ pathname: '/group/[id]', params: { id: group.id } });
        const people = `${group.memberIds.length} ${group.memberIds.length === 1 ? 'persona' : 'personas'}`;

        return (
          <Pressable
            key={group.id}
            accessibilityRole="button"
            onPress={open}
            style={{ marginBottom: 20 }}>
            {/* Dos tarjetas asomando por debajo: el grupo como una baraja de momentos. */}
            <View
              style={[
                styles.deck,
                styles.deckFar,
                { backgroundColor: theme.card, boxShadow: theme.shadow },
              ]}
            />
            <View
              style={[
                styles.deck,
                styles.deckNear,
                { backgroundColor: theme.card, boxShadow: theme.shadow },
              ]}
            />
            <Card>
              {cover ? (
                <View style={styles.cover}>
                  <Photo moment={cover} style={StyleSheet.absoluteFill} />
                  <Scrim edge="top" height="40%" />
                  <Text style={[styles.groupName, { color: '#fff' }]}>{group.name}</Text>
                  <Text style={[styles.groupMeta, { color: 'rgba(255,255,255,0.85)' }]}>
                    {people}
                  </Text>
                </View>
              ) : (
                <View style={[styles.cover, styles.coverEmpty, { backgroundColor: theme.soft }]}>
                  <Text style={[styles.groupName, { color: theme.text }]}>{group.name}</Text>
                  <Text style={[styles.groupMeta, { color: theme.textSecondary }]}>{people}</Text>
                </View>
              )}
              <View style={styles.footer}>
                <AvatarRow userIds={group.memberIds} size={34} />
                <View style={{ flex: 1 }}>
                  <Text
                    numberOfLines={1}
                    style={{ color: theme.text, fontSize: 15, fontWeight: '500' }}>
                    {last ? user(last.authorId).name : 'Sin momentos aún'}
                  </Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                    {last ? relative(last.createdAt) : 'Estrena el grupo'}
                  </Text>
                </View>
                <Button compact label="Entrar" onPress={open} />
              </View>
              {pending && !answered && (
                <View style={styles.pending}>
                  <View style={[styles.dot, { backgroundColor: theme.text }]} />
                  <Text
                    numberOfLines={1}
                    style={{ color: theme.textSecondary, fontSize: 14, flex: 1 }}>
                    {pending.title}
                  </Text>
                </View>
              )}
            </Card>
          </Pressable>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  me: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deck: { position: 'absolute', height: 60, borderRadius: Radius.frame },
  deckNear: { left: 16, right: 16, bottom: -12, opacity: 0.9 },
  deckFar: { left: 34, right: 34, bottom: -24, opacity: 0.7 },
  cover: { aspectRatio: 1, borderRadius: Radius.inner, overflow: 'hidden' },
  coverEmpty: { aspectRatio: 1.9, justifyContent: 'center' },
  groupName: {
    marginTop: 26,
    paddingHorizontal: 16,
    textAlign: 'center',
    fontSize: 30,
    fontWeight: '500',
    letterSpacing: -0.7,
  },
  groupMeta: { textAlign: 'center', fontSize: 14, marginTop: 4 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingTop: 14,
    paddingBottom: 6,
  },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 8,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  actions: { gap: Spacing.one, marginTop: Spacing.three },
});
