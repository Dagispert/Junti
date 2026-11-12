import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Hand, HandBold, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import type { GroupEvent } from '@/data/types';
import { countdown, daysUntil, fromISO, KINDS, occurrence } from '@/lib/calendar';

import { Avatar } from './ui';

const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('es-ES', opts).format(d);

/**
 * Un evento como objeto de recuerdo: los viajes y reencuentros como billete de
 * avión, el resto como tarjeta con su emoji grande.
 */
export function EventCard({ event, compact }: { event: GroupEvent; compact?: boolean }) {
  const theme = useTheme();
  const { user } = useStore();
  const kind = KINDS[event.kind];
  const days = daysUntil(event);
  const when = occurrence(event);
  // Los cumpleaños que vienen del perfil se ven en la ficha de la persona.
  const open = () =>
    event.id.startsWith('perfil-') && event.personId
      ? router.push({
          pathname: '/person/[id]',
          params: { id: event.personId, groupId: event.groupId },
        })
      : router.push({ pathname: '/event', params: { groupId: event.groupId, id: event.id } });

  if (event.kind === 'trip' || event.kind === 'reunion') {
    const end = event.endsOn ? fromISO(event.endsOn) : undefined;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={event.title}
        onPress={open}
        style={[styles.ticket, { backgroundColor: theme.card }]}>
        <View style={[styles.stub, { backgroundColor: kind.color }]}>
          <Icon icon={kind.icon} size={20} color="#1D1F22" />
          <Text style={styles.stubDay}>{fmt(when, { day: 'numeric' })}</Text>
          <Text style={styles.stubMonth}>{fmt(when, { month: 'short' }).replace('.', '')}</Text>
        </View>
        <View style={styles.perforation}>
          {Array.from({ length: 7 }, (_, i) => (
            <View key={i} style={[styles.hole, { backgroundColor: theme.background }]} />
          ))}
        </View>
        <View style={styles.ticketBody}>
          <Text style={[styles.ticketKind, { color: theme.textSecondary }]}>
            {kind.label.toUpperCase()}
            {event.place ? ` · ${event.place.toUpperCase()}` : ''}
          </Text>
          <Text numberOfLines={2} style={[styles.title, { color: theme.text }]}>
            {event.title}
          </Text>
          {end && (
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
              Hasta el {fmt(end, { day: 'numeric', month: 'long' })}
            </Text>
          )}
          <Text style={styles.count}>{countdown(days)}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={event.title}
      onPress={open}
      style={[styles.card, { backgroundColor: theme.card }, compact && { padding: 12 }]}>
      <View style={[styles.badge, { backgroundColor: kind.color }]}>
        {event.kind === 'birthday' && event.personId ? (
          <View>
            <Avatar userId={event.personId} size={44} />
            <View style={styles.badgeOver}>
              <Icon icon={kind.icon} size={14} color="#1D1F22" />
            </View>
          </View>
        ) : (
          <Icon icon={kind.icon} size={24} color="#1D1F22" />
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>
          {event.title}
        </Text>
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
          {fmt(when, { weekday: 'long', day: 'numeric', month: 'long' })}
          {event.kind === 'birthday' && event.personId
            ? ` · ${user(event.personId).city || ''}`
            : ''}
        </Text>
      </View>
      <Text style={styles.count}>{countdown(days)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ticket: {
    flexDirection: 'row',
    borderRadius: 22,
    overflow: 'hidden',
    boxShadow: '0 14px 30px rgba(20,22,26,0.12)',
    minHeight: 120,
  },
  stub: { width: 92, alignItems: 'center', justifyContent: 'center', gap: 2 },
  stubDay: { fontSize: 34, fontWeight: '600', color: '#1D1F22', letterSpacing: -1 },
  stubMonth: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1D1F22',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  perforation: { width: 10, justifyContent: 'space-evenly', alignItems: 'center', marginLeft: -4 },
  hole: { width: 10, height: 10, borderRadius: 5 },
  ticketBody: { flex: 1, padding: 16, gap: 4, justifyContent: 'center' },
  ticketKind: { fontSize: 11, letterSpacing: 1.4, fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '600' },
  count: { fontFamily: HandBold, fontSize: 24, color: '#C2477A' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 22,
    boxShadow: '0 12px 26px rgba(20,22,26,0.10)',
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeOver: {
    position: 'absolute',
    right: -8,
    bottom: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hand: { fontFamily: Hand },
});
