import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Brand, TAGLINE } from '@/constants/brand';
import { useStore } from '@/data/store';
import { progress, useClock } from '@/lib/clock';

import { GlobeMap } from './globe-map';
import type { GlobePerson } from './globe-map.types';
import { LogoMark, Wordmark } from './logo';
import { WorldMap, type MapPerson } from './world-map';

const NIGHT = ['#070A14', '#111830'] as const;

/** Todas las personas de mis grupos con ciudad, con su foto, para el planeta. */
export function useAllGlobePeople(): GlobePerson[] {
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
      city: u.city,
      country: u.country,
      color: u.color,
      photo: u.avatarUri,
    }));
}

/** El cielo claro de la marca, detrás del planeta. */
export const SKY = ['#FFFFFF', '#EAF6F8', '#D8EEF2'] as const;

/**
 * Entrada de la app: nuestro planeta se acerca desde lejos, se trazan los
 * arcos entre las ciudades de los tuyos y la marca se dibuja sola. Se salta
 * con un toque.
 */
export function IntroCinematic({ onDone }: { onDone: () => void }) {
  const people = useAllGlobePeople();
  const { height, width } = useWindowDimensions();
  const t = useClock(true, 4600);
  const END = 4300;

  useEffect(() => {
    const id = setTimeout(onDone, END);
    return () => clearTimeout(id);
  }, [onDone]);

  const mark = progress(t, 400, 1900);
  const title = progress(t, 1700, 700);
  const subtitle = progress(t, 2200, 700);
  const fadeOut = 1 - progress(t, END - 500, 500);
  const globe = Math.min(height * 0.56, width * 1.05);

  return (
    <View style={[StyleSheet.absoluteFill, { opacity: fadeOut, zIndex: 100 }]}>
      <LinearGradient colors={SKY} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', top: height * 0.3, left: 0, right: 0, height: globe }}>
        <GlobeMap people={people} height={globe} interactive transparent />
      </View>
      <View style={[styles.brand, { top: height * 0.09 }]}>
        <View style={{ transform: [{ scale: 0.6 + mark * 0.4 }], opacity: Math.min(1, mark * 3) }}>
          <LogoMark size={84} drawn={mark} />
        </View>
        <View
          style={{ opacity: title, transform: [{ translateY: (1 - title) * 12 }], marginTop: 12 }}>
          <Wordmark height={52} />
        </View>
        <Text style={[styles.subtitle, { opacity: subtitle }]}>{TAGLINE}</Text>
      </View>
      {/* Un toque en cualquier sitio la salta. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Saltar la entrada"
        onPress={onDone}
        style={StyleSheet.absoluteFill}
      />
    </View>
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
  brand: { position: 'absolute', left: 24, right: 24, alignItems: 'center', gap: 4 },
  titles: { position: 'absolute', left: 24, right: 24, alignItems: 'center', gap: 8 },
  title: { color: Brand.ink, fontSize: 48, fontWeight: '600', letterSpacing: -1 },
  subtitle: { color: '#686C73', fontSize: 17, textAlign: 'center' },
  sent: {
    color: '#FBF4E8',
    fontSize: 28,
    fontWeight: '500',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
});
