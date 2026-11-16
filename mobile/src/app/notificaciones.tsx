import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import {
  BellOff,
  ChartColumn,
  CheckCheck,
  Flag,
  Heart,
  History,
  MessageCircle,
  Mic,
  Music,
  Camera,
  Reply,
  UserCheck,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Avatar, Button, Screen, Title } from '@/components/ui';
import { useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import {
  markAllRead,
  markRead,
  markSeen,
  useNotifications,
  type Notif,
  type NotifKind,
} from '@/lib/notifications';
import { relative } from '@/lib/time';

const KIND: Record<NotifKind, { icon: LucideIcon; color: string }> = {
  moment: { icon: Camera, color: '#3E7BFA' },
  memory: { icon: History, color: '#B07A3A' },
  credited: { icon: UserCheck, color: '#B07A3A' },
  answer: { icon: Flag, color: '#E2603F' },
  karaoke: { icon: Mic, color: '#E2603F' },
  challenge: { icon: Flag, color: '#E2603F' },
  comment: { icon: MessageCircle, color: '#2FA36B' },
  thread: { icon: MessageCircle, color: '#2FA36B' },
  reply: { icon: Reply, color: '#2FA36B' },
  reaction: { icon: Heart, color: '#E0457B' },
  addition: { icon: History, color: '#B07A3A' },
  question: { icon: ChartColumn, color: '#8A5CF6' },
  song: { icon: Music, color: '#D8A21E' },
};

/** «Hoy», «Ayer», «Esta semana», «Antes». */
function section(at: number) {
  const day = (t: number) => new Date(t).setHours(0, 0, 0, 0);
  const diff = Math.round((day(Date.now()) - day(at)) / 86_400_000);
  if (diff <= 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  if (diff < 7) return 'Esta semana';
  return 'Antes';
}

/**
 * Centro de notificaciones: lo que han hecho los demás (publicaciones,
 * comentarios, respuestas, reacciones, retos…). Al tocar una, lleva a lo que
 * es y queda como vista; también lo que ya viste, comentaste o reaccionaste.
 */
export default function Notificaciones() {
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const { groups, user, group } = useStore();
  const { items, unread } = useNotifications();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [only, setOnly] = useState<string | null>(groupId ?? null);

  // Al abrir el centro, el globo de «nuevas» se vacía (las no leídas siguen marcadas).
  useEffect(() => {
    markSeen();
    return () => markSeen();
  }, []);

  const shown = useMemo(
    () => items.filter((n) => (filter === 'all' || n.unread) && (!only || n.groupId === only)),
    [items, filter, only],
  );
  const sections = useMemo(() => {
    const out: { title: string; items: Notif[] }[] = [];
    for (const n of shown) {
      const t = section(n.at);
      if (out[out.length - 1]?.title !== t) out.push({ title: t, items: [] });
      out[out.length - 1].items.push(n);
    }
    return out;
  }, [shown]);

  const open = (n: Notif) => {
    markRead(n.scope);
    router.push(n.to as never);
  };
  const name = (id: string) => user(id).name.split(' ')[0];
  const many = groups.length > 1;

  return (
    <Screen
      header={
        <View style={styles.header}>
          <Button
            compact
            variant="quiet"
            label="Volver"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
          {unread > 0 && (
            <Pressable
              accessibilityRole="button"
              onPress={markAllRead}
              style={[styles.allRead, { backgroundColor: theme.soft }]}>
              <Icon icon={CheckCheck} size={16} color={theme.text} />
              <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>
                Marcar todo como leído
              </Text>
            </Pressable>
          )}
        </View>
      }>
      <View style={{ gap: 6 }}>
        <Title>Notificaciones</Title>
        <Text style={{ color: theme.textSecondary, fontSize: 15 }}>
          {unread === 0
            ? 'Estás al día.'
            : unread === 1
              ? 'Tienes 1 sin ver.'
              : `Tienes ${unread} sin ver.`}
        </Text>
      </View>

      {/* filtros: todas / sin leer, y el grupo si hay varios */}
      <View style={styles.chips}>
        {(
          [
            ['all', 'Todas'],
            ['unread', `Sin leer${unread ? ` · ${unread}` : ''}`],
          ] as const
        ).map(([k, label]) => (
          <Chip key={k} on={filter === k} label={label} onPress={() => setFilter(k)} />
        ))}
        {many && <View style={[styles.sep, { backgroundColor: theme.soft }]} />}
        {many &&
          groups.map((g) => (
            <Chip
              key={g.id}
              on={only === g.id}
              label={g.name}
              onPress={() => setOnly(only === g.id ? null : g.id)}
            />
          ))}
      </View>

      {sections.length === 0 ? (
        <View style={styles.empty}>
          <Icon icon={BellOff} size={34} color={theme.textSecondary} />
          <Text style={{ color: theme.textSecondary, fontSize: 16, textAlign: 'center' }}>
            {filter === 'unread'
              ? 'No tienes nada sin leer.'
              : 'Aquí verás lo que hagan los demás: publicaciones, comentarios, reacciones a lo tuyo, retos…'}
          </Text>
        </View>
      ) : (
        sections.map((s) => (
          <View key={s.title} style={{ gap: 6 }}>
            <Text style={[styles.section, { color: theme.textSecondary }]}>{s.title}</Text>
            <View
              style={[
                styles.list,
                { backgroundColor: theme.card, boxShadow: theme.shadow },
                wide && styles.listWide,
              ]}>
              {s.items.map((n, i) => {
                const k = KIND[n.kind];
                const others = n.actors.length - 1;
                return (
                  <Pressable
                    key={n.key}
                    accessibilityRole="button"
                    accessibilityLabel={`${name(n.actors[0])} ${n.text}`}
                    onPress={() => open(n)}
                    style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
                      styles.row,
                      wide && styles.rowWide,
                      i > 0 && { borderTopWidth: 1, borderTopColor: theme.soft },
                      n.unread && { backgroundColor: `${k.color}12` },
                      (hovered || pressed) && { backgroundColor: theme.soft },
                    ]}>
                    <View>
                      <Avatar userId={n.actors[0]} size={wide ? 46 : 42} />
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: k.color, borderColor: theme.card },
                        ]}>
                        <Icon icon={k.icon} size={11} color="#FFFFFF" />
                      </View>
                    </View>
                    <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
                      <Text
                        numberOfLines={3}
                        style={{ color: theme.text, fontSize: 15, lineHeight: 20 }}>
                        <Text style={{ fontWeight: '700' }}>{name(n.actors[0])}</Text>
                        {others > 0 && (
                          <Text>
                            {others === 1 ? ' y ' : ', '}
                            <Text style={{ fontWeight: '700' }}>
                              {others === 1 ? name(n.actors[1]) : `${others} más`}
                            </Text>
                          </Text>
                        )}{' '}
                        {n.text}
                        {n.ownerId && <Text style={{ fontWeight: '600' }}> {name(n.ownerId)}</Text>}
                        {n.emojis?.length ? ` ${n.emojis.join(' ')}` : ''}
                      </Text>
                      {!!n.quote && (
                        <Text
                          numberOfLines={2}
                          style={{ color: theme.textSecondary, fontSize: 14, lineHeight: 19 }}>
                          «{n.quote}»
                        </Text>
                      )}
                      <Text
                        style={{
                          color: n.unread ? k.color : theme.textSecondary,
                          fontSize: 12.5,
                          fontWeight: n.unread ? '600' : '400',
                        }}>
                        {relative(n.at)}
                        {many ? ` · ${group(n.groupId)?.name ?? ''}` : ''}
                      </Text>
                    </View>
                    {!!n.thumb && (
                      <Image
                        source={{ uri: n.thumb }}
                        style={[styles.thumb, wide && styles.thumbWide]}
                        contentFit="cover"
                      />
                    )}
                    {n.unread && <View style={[styles.dot, { backgroundColor: k.color }]} />}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))
      )}
    </Screen>
  );
}

function Chip({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      aria-checked={on}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: on ? theme.accent : theme.card }]}>
      <Text style={{ color: on ? theme.onAccent : theme.text, fontSize: 14, fontWeight: '500' }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  allRead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  sep: { width: 1, height: 22, marginHorizontal: 2 },
  section: { fontSize: 13, fontWeight: '600', marginTop: 6, marginLeft: 4 },
  list: { borderRadius: 20, overflow: 'hidden' },
  listWide: { borderRadius: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 22,
    cursor: 'pointer',
  } as never,
  rowWide: { paddingVertical: 14, paddingLeft: 18, gap: 16 },
  badge: {
    position: 'absolute',
    right: -4,
    bottom: -3,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: { width: 48, height: 48, borderRadius: 10 },
  thumbWide: { width: 58, height: 58, borderRadius: 12 },
  dot: {
    position: 'absolute',
    right: 8,
    top: '50%',
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: -4,
  },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 60, paddingHorizontal: 20 },
});
