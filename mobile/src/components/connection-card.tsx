import { StyleSheet, Text, View } from 'react-native';

import { Spacing, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import type { Group } from '@/data/types';
import { distanceKm, formatKm, utcOffsetMinutes } from '@/lib/geo';

import { WorldMap, type MapPerson } from './world-map';

/** Las personas del grupo con ciudad en el mapa. */
export function useGroupPeople(group: Group | undefined): MapPerson[] {
  const { me, user } = useStore();
  return (group?.memberIds ?? [])
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
 * El mapa del grupo, con la distancia y la diferencia horaria que hay entre
 * quienes viven más lejos. Es la seña de identidad de cada grupo.
 */
export function ConnectionCard({ group }: { group: Group }) {
  const theme = useTheme();
  const { me, user } = useStore();
  const people = useGroupPeople(group);

  let far: { a: MapPerson; b: MapPerson; km: number } | undefined;
  for (let i = 0; i < people.length; i++)
    for (let j = i + 1; j < people.length; j++) {
      const km = distanceKm(people[i], people[j]);
      if (!far || km > far.km) far = { a: people[i], b: people[j], km };
    }
  const hours = far ? Math.abs(utcOffsetMinutes(far.a.tz) - utcOffsetMinutes(far.b.tz)) / 60 : 0;
  const missing = group.memberIds.filter((id) => !people.some((p) => p.id === id));
  const iMiss = missing.includes(me);

  return (
    <View style={{ gap: Spacing.two }}>
      <WorldMap people={people} height={230} />
      <Text style={[styles.line, { color: theme.textSecondary }]}>
        {far && far.km >= 30 ? (
          <>
            <Text style={{ color: theme.text }}>
              {formatKm(far.km)}
              {hours >= 1
                ? ` y ${hours % 1 ? hours.toFixed(1) : hours} ${hours === 1 ? 'hora' : 'horas'}`
                : ''}
            </Text>{' '}
            entre {city(far.a, user)} y {city(far.b, user)}, y aquí seguís.
          </>
        ) : people.length > 1 ? (
          <Text style={{ color: theme.text }}>Estáis cerca. Aprovechad para veros.</Text>
        ) : (
          <Text style={{ color: theme.text }}>Aquí aparecerán vuestras ciudades.</Text>
        )}
        {iMiss
          ? ' Elige tu ciudad en tu perfil para aparecer en el mapa.'
          : missing.length > 0
            ? ` ${missing.length === 1 ? 'Falta' : 'Faltan'} ${missing
                .map((id) => user(id).name.split(' ')[0])
                .join(', ')} por elegir ciudad.`
            : ''}
      </Text>
    </View>
  );
}

function city(p: MapPerson, user: (id: string) => { city: string }) {
  return user(p.id).city || p.name;
}

const styles = StyleSheet.create({
  line: { fontSize: 15, lineHeight: 21, paddingHorizontal: 4 },
});
