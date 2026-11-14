import { router } from 'expo-router';
import { Heart, MessageCircle, Plus } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Hand, Radius, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import type { Moment, Proposal } from '@/data/types';
import { useFamily } from '@/lib/families';
import { daysLeft } from '@/lib/time';

import { FamilyCard, FamilyTag } from './family';
import { Icon } from './icon';
import { Avatar, AvatarRow, Photo } from './ui';

const TILE_W = 150;
const TILE_H = 196;

/**
 * Un reto en «Hoy»: todas sus respuestas juntas, en una tira que se desliza,
 * con el nombre del reto bien a la vista. Así, con varios retos a la vez, se
 * sabe a cuál pertenece cada foto y el «Hoy» no se convierte en un caos.
 */
export function ChallengeBlock({ challenge, answers }: { challenge: Proposal; answers: Moment[] }) {
  const theme = useTheme();
  const f = useFamily('challenge');
  const { me, user } = useStore();
  const open = !challenge.endsAt || challenge.endsAt > Date.now();
  const left = challenge.endsAt && open ? daysLeft(challenge.endsAt) : undefined;
  const ordered = [...answers].sort((a, b) => b.sharedAt - a.sharedAt);
  // Quién ha participado (nunca quién falta).
  const people = [...new Set(ordered.map((m) => m.authorId))];
  const names = people.map((id) => (id === me ? 'tú' : user(id).name.split(' ')[0]));
  const list =
    names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : names[0];
  const mine = people.includes(me);
  const participated = !list
    ? ''
    : people.length === 1 && mine
      ? 'Has participado'
      : `${list[0].toUpperCase()}${list.slice(1)} ${people.length === 1 ? 'ha' : 'han'} participado`;

  return (
    <FamilyCard family="challenge" style={{ padding: 16, gap: 12 }}>
      <View style={styles.head}>
        <FamilyTag
          family="challenge"
          detail={
            !open
              ? 'terminado'
              : left
                ? left === 1
                  ? 'queda 1 día'
                  : `quedan ${left} días`
                : 'sin fecha'
          }
        />
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
          {ordered.length} {ordered.length === 1 ? 'respuesta' : 'respuestas'}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          router.push({ pathname: '/group/[id]/retos', params: { id: challenge.groupId } })
        }>
        <Text style={[styles.title, { color: theme.text }]}>{challenge.title}</Text>
        {!!challenge.body && (
          <Text numberOfLines={2} style={{ color: theme.textSecondary, fontSize: 15 }}>
            {challenge.body}
          </Text>
        )}
      </Pressable>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingVertical: 4, paddingRight: 4 }}>
        {ordered.map((m) => (
          <Pressable
            key={m.id}
            accessibilityRole="button"
            accessibilityLabel={`Respuesta de ${user(m.authorId).name}`}
            onPress={() => router.push({ pathname: '/moment/[id]', params: { id: m.id } })}
            style={styles.tile}>
            {m.imageUri || m.videoUri ? (
              <Photo moment={m} style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.paper, { backgroundColor: f.tint }]}>
                <Text numberOfLines={6} style={[styles.paperText, { color: theme.text }]}>
                  {m.text ?? '🎙'}
                </Text>
              </View>
            )}
            <View style={styles.tileFoot}>
              <Avatar userId={m.authorId} size={22} />
              <Text numberOfLines={1} style={styles.tileName}>
                {m.authorId === me ? 'Tú' : user(m.authorId).name.split(' ')[0]}
              </Text>
              {m.reactions.length > 0 && (
                <View style={styles.count}>
                  <Icon icon={Heart} size={11} color="#FFFFFF" />
                  <Text style={styles.countText}>{m.reactions.length}</Text>
                </View>
              )}
              {m.comments.length > 0 && (
                <View style={styles.count}>
                  <Icon icon={MessageCircle} size={11} color="#FFFFFF" />
                  <Text style={styles.countText}>{m.comments.length}</Text>
                </View>
              )}
            </View>
          </Pressable>
        ))}
        {open && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={mine ? 'Añadir otra respuesta al reto' : 'Participar en el reto'}
            onPress={() =>
              router.push({
                pathname: '/publish',
                params: { groupId: challenge.groupId, proposalId: challenge.id },
              })
            }
            style={[styles.tile, styles.join, { borderColor: f.color }]}>
            <Icon icon={Plus} size={26} color={f.color} />
            <Text style={[styles.joinText, { color: f.color }]}>
              {mine ? 'Añadir otra' : 'Participar'}
            </Text>
          </Pressable>
        )}
      </ScrollView>

      <View style={styles.foot}>
        <AvatarRow userIds={people} size={24} />
        <Text style={{ color: theme.textSecondary, fontSize: 13, flexShrink: 1 }}>
          {participated}
        </Text>
      </View>
    </FamilyCard>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 24, lineHeight: 28, fontWeight: '600', letterSpacing: -0.4 },
  tile: {
    width: TILE_W,
    height: TILE_H,
    borderRadius: Radius.inner,
    overflow: 'hidden',
    backgroundColor: '#2B2E33',
  },
  paper: { padding: 14, justifyContent: 'center' },
  paperText: { fontFamily: Hand, fontSize: 22, lineHeight: 23, textAlign: 'center' },
  tileFoot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  tileName: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', flex: 1 },
  count: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  countText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  join: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  joinText: { fontSize: 15, fontWeight: '600' },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
