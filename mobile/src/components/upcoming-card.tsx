import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { HandBold, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import { upcoming } from '@/lib/calendar';

import { EventCard } from './event-card';
import { Avatar } from './ui';

/** Confeti que cae despacio. */
function Confetti({ index }: { index: number }) {
  const y = useSharedValue(-20);
  useEffect(() => {
    y.value = withDelay(
      index * 260,
      withRepeat(
        withTiming(240, { duration: 3200 + (index % 4) * 500, easing: Easing.linear }),
        -1,
        false,
      ),
    );
  }, [y, index]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { rotate: `${y.value * 2}deg` }],
  }));
  const colors = ['#F4B6C8', '#F6E19A', '#B9DDF2', '#CDE7B0', '#E2703A'];
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 0,
          left: `${(index * 37) % 96}%`,
          width: 8,
          height: 12,
          borderRadius: 2,
          backgroundColor: colors[index % colors.length],
        },
        style,
      ]}
    />
  );
}

/** En Hoy: el cumpleaños de hoy (con confeti) y el próximo evento, con su cuenta atrás. */
export function UpcomingCard({ groupId }: { groupId: string }) {
  const theme = useTheme();
  const { events, user, me } = useStore();
  const next = upcoming(
    events.filter((e) => e.groupId === groupId),
    3,
    45,
  );
  const birthdays = next.filter(
    (x) => x.days === 0 && x.event.kind === 'birthday' && x.event.personId,
  );
  const soon = next.find((x) => !birthdays.includes(x));

  return (
    <View style={{ gap: 12 }}>
      {birthdays.map(({ event }) => (
        <View key={event.id} style={[styles.party, { backgroundColor: '#FFF4F7' }]}>
          {Array.from({ length: 14 }, (_, i) => (
            <Confetti key={i} index={i} />
          ))}
          <Avatar userId={event.personId!} size={64} />
          <Text style={styles.partyTitle}>
            {event.personId === me
              ? 'Feliz cumpleaños'
              : `Hoy cumple ${user(event.personId!).name.split(' ')[0]}`}
          </Text>
          <Text style={{ color: theme.textSecondary, fontSize: 15, textAlign: 'center' }}>
            {event.personId === me
              ? 'Todo el grupo piensa hoy en ti'
              : 'Compártele algo: una foto, un recuerdo, una canción'}
          </Text>
        </View>
      ))}
      {soon && (
        <View style={{ gap: 8 }}>
          <View style={styles.row}>
            <Text style={styles.kicker}>Próximamente</Text>
            <Text
              accessibilityRole="link"
              onPress={() => router.push({ pathname: '/calendar', params: { groupId } })}
              style={{ color: theme.textSecondary, fontSize: 15 }}>
              Ver calendario
            </Text>
          </View>
          <EventCard event={soon.event} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  party: {
    borderRadius: 32,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
    boxShadow: '0 18px 40px rgba(20,22,26,0.10)',
  },
  partyTitle: { fontFamily: HandBold, fontSize: 34, color: '#C2477A', textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  kicker: { fontFamily: HandBold, fontSize: 28, color: '#C2477A' },
});
