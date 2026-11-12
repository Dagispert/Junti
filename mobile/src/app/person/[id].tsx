import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Cake, MapPin, House } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { SkyBadge } from '@/components/sky-badge';
import { Avatar, Photo, Screen, Tag, Title } from '@/components/ui';
import { Hand, Radius, Spacing, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import { clockIn } from '@/lib/time';

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** La ficha de una persona: quién es, dónde está ahora y lo último que ha compartido. */
export default function PersonScreen() {
  const { id, groupId } = useLocalSearchParams<{ id: string; groupId?: string }>();
  const theme = useTheme();
  const { user, me, moments, group: groupById } = useStore();
  const person = user(id);
  const group = groupId ? groupById(groupId) : undefined;
  const a = person.about;
  const nickname = (group && group.nicknames[id]) || a.nickname;
  const theirs = moments
    .filter((m) => m.authorId === id && (!groupId || m.groupId === groupId))
    .sort((x, y) => y.sharedAt - x.sharedAt)
    .slice(0, 9);

  // ¿Cuántos días faltan para su cumpleaños?
  let birthday = '';
  if (a.birthMonth && a.birthDay) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    let next = new Date(now.getFullYear(), a.birthMonth - 1, a.birthDay);
    if (next < now) next = new Date(now.getFullYear() + 1, a.birthMonth - 1, a.birthDay);
    const days = Math.round((next.getTime() - now.getTime()) / 86_400_000);
    const when = `${a.birthDay} de ${MONTHS[a.birthMonth - 1]}`;
    const age = a.birthYear ? ` · cumple ${next.getFullYear() - a.birthYear}` : '';
    birthday =
      days === 0
        ? `Hoy es su cumpleaños${age}`
        : `${when}${age} · ${days === 1 ? 'mañana' : `en ${days} días`}`;
  }

  return (
    <Screen
      header={
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            style={[styles.round, { backgroundColor: theme.card }]}>
            <Icon icon={ArrowLeft} color={theme.text} />
          </Pressable>
          {id === me && (
            <Pressable accessibilityRole="button" onPress={() => router.push('/settings')}>
              <Text style={{ color: theme.textSecondary, fontSize: 15 }}>Editar mi perfil</Text>
            </Pressable>
          )}
        </View>
      }>
      <View style={styles.top}>
        <Avatar userId={id} size={96} />
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Title style={{ textAlign: 'center' }}>{person.name}</Title>
          {!!nickname && <Text style={styles.nick}>«{nickname}»</Text>}
        </View>
        {!!a.bio && <Text style={[styles.bio, { color: theme.text }]}>{a.bio}</Text>}
      </View>

      <View style={[styles.facts, { backgroundColor: theme.card }]}>
        {!!person.city && (
          <View style={styles.fact}>
            <Icon icon={MapPin} />
            <Text style={[styles.factText, { color: theme.text }]}>
              Vive en {person.city}
              {person.country ? `, ${person.country}` : ''}
            </Text>
          </View>
        )}
        <View style={styles.fact}>
          <SkyBadge tz={person.tz} size={18} />
          <Text style={[styles.factText, { color: theme.text }]}>
            Allí son las {clockIn(person.tz)}
          </Text>
        </View>
        {!!a.hometown && (
          <View style={styles.fact}>
            <Icon icon={House} />
            <Text style={[styles.factText, { color: theme.text }]}>Es de {a.hometown}</Text>
          </View>
        )}
        {!!birthday && (
          <View style={styles.fact}>
            <Icon icon={Cake} />
            <Text style={[styles.factText, { color: theme.text }]}>{birthday}</Text>
          </View>
        )}
      </View>

      {!!a.interests?.length && (
        <View style={{ gap: Spacing.two }}>
          <Tag>Le gusta</Tag>
          <View style={styles.chips}>
            {a.interests.map((i) => (
              <View key={i} style={[styles.chip, { backgroundColor: theme.card }]}>
                <Text style={{ color: theme.text, fontSize: 15 }}>{i}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {theirs.length > 0 && (
        <View style={{ gap: Spacing.two }}>
          <Tag>{group ? `Lo último en ${group.name}` : 'Lo último que ha compartido'}</Tag>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}>
            {theirs.map((m) => (
              <Pressable
                key={m.id}
                accessibilityRole="button"
                accessibilityLabel={m.text ?? 'Momento'}
                onPress={() => router.push({ pathname: '/moment/[id]', params: { id: m.id } })}
                style={styles.tile}>
                <Photo moment={m} style={StyleSheet.absoluteFill} animate={false} />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  top: { alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.two },
  nick: { fontFamily: Hand, fontSize: 28, color: '#C2477A' },
  bio: { fontSize: 17, lineHeight: 24, textAlign: 'center', paddingHorizontal: Spacing.three },
  facts: { borderRadius: Radius.inner, padding: Spacing.three, gap: 12 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  factText: { fontSize: 15, flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 36, paddingHorizontal: 16, borderRadius: 999, justifyContent: 'center' },
  tile: { width: 112, height: 140, borderRadius: Radius.small, overflow: 'hidden' },
});
