import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EventCard } from '@/components/event-card';
import { Icon } from '@/components/icon';
import { Appear } from '@/components/motion';
import { Scribble } from '@/components/scrapbook';
import { Button, Lead, Screen, Title } from '@/components/ui';
import { HandBold, Radius, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import { happensOn, KINDS, longDate, toISO, today, upcoming } from '@/lib/calendar';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/** El calendario del grupo: el mes en cuadrícula, lo del día elegido y lo que viene. */
export default function CalendarScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const theme = useTheme();
  const { events, group } = useStore();
  const mine = events.filter((e) => e.groupId === groupId);
  const [month, setMonth] = useState(() => {
    const d = today();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState(today());

  const cells = useMemo(() => {
    const first = (month.getDay() + 6) % 7;
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [
      ...Array.from({ length: first }, () => null),
      ...Array.from(
        { length: days },
        (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1),
      ),
    ];
  }, [month]);

  const onDay = mine.filter((e) => happensOn(e, selected));
  const next = upcoming(mine, 8);
  const title = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(month);
  const isToday = (d: Date) => d.getTime() === today().getTime();
  const add = (d: Date) => router.push({ pathname: '/event', params: { groupId, date: toISO(d) } });

  return (
    <Screen
      header={
        <View style={styles.header}>
          <Button compact label="Volver" variant="quiet" onPress={() => router.back()} />
          <Button compact label="Añadir" onPress={() => add(selected)} />
        </View>
      }>
      <View style={{ gap: 4 }}>
        <Text style={{ color: theme.textSecondary, fontSize: 15 }}>{group(groupId)?.name}</Text>
        <Title>Calendario</Title>
      </View>

      <View style={[styles.month, { backgroundColor: theme.card }]}>
        <View style={styles.monthHead}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mes anterior"
            onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            style={styles.arrow}>
            <Icon icon={ChevronLeft} color={theme.text} />
          </Pressable>
          <Text style={styles.monthTitle}>{title[0].toUpperCase() + title.slice(1)}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mes siguiente"
            onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            style={styles.arrow}>
            <Icon icon={ChevronRight} color={theme.text} />
          </Pressable>
        </View>
        <View style={styles.grid}>
          {WEEKDAYS.map((w) => (
            <Text key={w} style={[styles.weekday, { color: theme.textSecondary }]}>
              {w}
            </Text>
          ))}
          {cells.map((d, i) => {
            if (!d) return <View key={`e${i}`} style={styles.cell} />;
            const dayEvents = mine.filter((e) => happensOn(e, d));
            const sel = d.getTime() === selected.getTime();
            return (
              <Pressable
                key={d.toISOString()}
                accessibilityRole="button"
                accessibilityLabel={`${longDate(d)}${dayEvents.length ? `, ${dayEvents.map((e) => e.title).join(', ')}` : ''}`}
                onPress={() => setSelected(d)}
                style={styles.cell}>
                <View
                  style={[
                    styles.dayCircle,
                    dayEvents[0] && { backgroundColor: KINDS[dayEvents[0].kind].color },
                    isToday(d) && { borderColor: theme.accent, borderWidth: 2 },
                    sel && { backgroundColor: theme.accent },
                  ]}>
                  <Text style={[styles.dayNum, { color: sel ? theme.onAccent : theme.text }]}>
                    {d.getDate()}
                  </Text>
                </View>
                {dayEvents[0] && (
                  <View
                    style={[styles.dayDot, { backgroundColor: KINDS[dayEvents[0].kind].color }]}
                  />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <View style={styles.rowBetween}>
          <Text style={[styles.section, { color: theme.text }]}>{longDate(selected)}</Text>
          <Pressable accessibilityRole="button" onPress={() => add(selected)}>
            <Text style={{ color: theme.textSecondary, fontSize: 15 }}>＋ Añadir este día</Text>
          </Pressable>
        </View>
        {onDay.length ? (
          onDay.map((e) => <EventCard key={e.id} event={e} compact />)
        ) : (
          <Text style={{ color: theme.textSecondary, fontSize: 15 }}>Nada apuntado.</Text>
        )}
      </View>

      <View style={{ gap: 12 }}>
        <Text style={styles.kicker}>Próximamente</Text>
        {next.length === 0 ? (
          <Lead strong="Apuntad lo que no queréis olvidar:">
            cumpleaños, aniversarios, el próximo viaje o cuándo os volvéis a ver.
          </Lead>
        ) : (
          next.map(({ event }, i) => (
            <Appear key={event.id} index={i}>
              <EventCard event={event} />
            </Appear>
          ))
        )}
        <Scribble size={20}>
          Os avisaremos el mismo día y una semana antes de lo que esperáis con ganas
        </Scribble>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  month: { borderRadius: 30, padding: 16, boxShadow: '0 18px 40px rgba(20,22,26,0.10)' },
  monthHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  monthTitle: { fontFamily: HandBold, fontSize: 28, color: '#C2477A' },
  arrow: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  arrowText: { fontSize: 28 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    paddingBottom: 8,
  },
  cell: { width: `${100 / 7}%`, height: 52, alignItems: 'center', justifyContent: 'flex-start' },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNum: { fontSize: 15, fontWeight: '500' },
  dayDot: { position: 'absolute', bottom: 4, width: 6, height: 6, borderRadius: 3 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  section: { fontSize: 17, fontWeight: '600' },
  kicker: { fontFamily: HandBold, fontSize: 28, color: '#C2477A' },
});
