import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useStore } from '@/data/store';
import { progress, useClock } from '@/lib/clock';

import { WorldMap, type MapPerson } from './world-map';

const NIGHT = ['#070A14', '#111830'] as const;

/** Todas las personas de mis grupos que tienen ciudad (sin repetir). */
export function useAllPeople(): MapPerson[] {
  const { me, user, groups } = useStore();
  const ids = [...new Set(groups.flatMap((g) => g.memberIds))];
  if (!ids.includes(me)) ids.push(me);
  return ids
    .map((id) => user(id))
    .filter((u) => u.lat != null && u.lng != null)
    .map((u) => ({
      id: u.id,
      name: u.name,
      lat: u.lat!,
      lng: u.lng!,
      tz: u.tz,
      isMe: u.id === me,
    }));
}

/**
 * Entrada de la app: la Tierra se enciende en puntos de luz, aparecen las
 * ciudades de los tuyos y se trazan los hilos entre ellas. Se salta con un toque.
 */
export function IntroCinematic({ onDone }: { onDone: () => void }) {
  const people = useAllPeople();
  const { height, width } = useWindowDimensions();
  const t = useClock(true, 3600);
  const END = 3300;

  useEffect(() => {
    const id = setTimeout(onDone, END);
    return () => clearTimeout(id);
  }, [onDone]);

  const title = progress(t, 1250, 800);
  const subtitle = progress(t, 1650, 800);
  const fadeOut = 1 - progress(t, END - 550, 550);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Saltar la entrada"
      onPress={onDone}
      style={[StyleSheet.absoluteFill, { opacity: fadeOut, zIndex: 100 }]}>
      <LinearGradient colors={NIGHT} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', top: height * 0.16, left: 0, right: 0 }}>
        <WorldMap
          people={people}
          height={Math.min(height * 0.48, width * 0.95)}
          mode="intro"
          framed={false}
        />
      </View>
      <View style={[styles.titles, { bottom: height * 0.14 }]}>
        <Text
          style={[
            styles.title,
            {
              opacity: title,
              letterSpacing: 2 + (1 - title) * 10,
              transform: [{ translateY: (1 - title) * 10 }],
            },
          ]}>
          Junti
        </Text>
        <Text style={[styles.subtitle, { opacity: subtitle }]}>Cerca, aunque estéis lejos.</Text>
      </View>
    </Pressable>
  );
}

/**
 * Al publicar: una luz sale de tu ciudad y llega a la de cada persona del grupo.
 * Si nadie tiene ciudad todavía, no se muestra y se continúa al momento.
 */
export function SendCinematic({
  people,
  groupName,
  onDone,
}: {
  people: MapPerson[];
  groupName: string;
  onDone: () => void;
}) {
  const { height, width } = useWindowDimensions();
  const t = useClock(true, 2600);
  const others = people.filter((p) => !p.isMe);
  const show = people.some((p) => p.isMe) && others.length > 0;
  const END = 2300;

  useEffect(() => {
    const id = setTimeout(onDone, show ? END : 0);
    return () => clearTimeout(id);
  }, [onDone, show]);

  if (!show) return null;
  const text = progress(t, 900, 600);
  const fadeIn = progress(t, 0, 250);
  const fadeOut = 1 - progress(t, END - 400, 400);
  const names = others.map((p) => p.name.split(' ')[0]);
  const list =
    names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : names[0];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onDone}
      style={[StyleSheet.absoluteFill, { opacity: fadeIn * fadeOut, zIndex: 100 }]}>
      <LinearGradient colors={NIGHT} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', top: height * 0.2, left: 0, right: 0 }}>
        <WorldMap
          people={people}
          height={Math.min(height * 0.45, width * 0.9)}
          mode="send"
          framed={false}
        />
      </View>
      <View style={[styles.titles, { bottom: height * 0.18, opacity: text }]}>
        <Text style={styles.sent}>Compartido en {groupName}</Text>
        <Text style={styles.subtitle}>Ya le llega a {list}.</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  titles: { position: 'absolute', left: 24, right: 24, alignItems: 'center', gap: 8 },
  title: { color: '#FBF4E8', fontSize: 54, fontWeight: '500' },
  subtitle: { color: '#E8C48F', fontSize: 17, textAlign: 'center' },
  sent: {
    color: '#FBF4E8',
    fontSize: 28,
    fontWeight: '500',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
});
