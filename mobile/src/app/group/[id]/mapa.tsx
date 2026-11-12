import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGlobePeople } from '@/components/connection-card';
import { GlobeMap, type GlobeMemory } from '@/components/globe-map';
import { Icon } from '@/components/icon';
import { Polaroid } from '@/components/scrapbook';
import { SkyBadge } from '@/components/sky-badge';
import { Avatar } from '@/components/ui';
import { Hand, Radius, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import { distanceKm, formatKm } from '@/lib/geo';
import { clockIn } from '@/lib/time';

import { Missing } from './index';
import { ChevronLeft, MapPin, Users, type LucideIcon } from 'lucide-react-native';

type Period = 'all' | 'year' | 'month';
const PERIODS: { key: Period; label: string }[] = [
  { key: 'all', label: 'Siempre' },
  { key: 'year', label: 'Este año' },
  { key: 'month', label: 'Este mes' },
];

/**
 * El planeta del grupo a pantalla completa: dónde vive cada uno y, con el
 * tiempo, el mapa de recuerdos (los momentos que se compartieron con lugar).
 */
export default function MapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { group: groupById, me, moments, user } = useStore();
  const group = groupById(id);
  const people = useGlobePeople(group);
  const [focus, setFocus] = useState<string | null>(null);
  // Personas o recuerdos, nunca a la vez: así el planeta no se llena de cosas.
  const [layer, setLayer] = useState<'people' | 'memories'>('people');
  const showPeople = layer === 'people';
  const showMemories = layer === 'memories';
  const [period, setPeriod] = useState<Period>('all');
  const [picked, setPicked] = useState<string[]>([]);
  if (!group) return <Missing />;

  const since =
    period === 'year'
      ? new Date(new Date().getFullYear(), 0, 1).getTime()
      : period === 'month'
        ? new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
        : 0;
  const placed = moments.filter((m) => m.groupId === id && m.place && m.createdAt >= since);
  const memories: GlobeMemory[] = showMemories
    ? placed.map((m) => ({
        id: m.id,
        lat: m.place!.lat,
        lng: m.place!.lng,
        photo: m.imageUri,
        title: m.place!.name,
      }))
    : [];
  const pickedMoments = moments.filter((m) => picked.includes(m.id));
  const pickedPlace = pickedMoments[0]?.place;
  const places = [...new Set(placed.map((m) => m.place!.name.split(',')[0]))];

  const mine = people.find((p) => p.isMe);
  const focused = people.find((p) => p.id === focus);
  const missing = group.memberIds.length - people.length;

  const chip = (on: boolean, label: string, onPress: () => void, icon?: LucideIcon) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[styles.filter, { backgroundColor: on ? theme.accent : theme.card }]}>
      {icon && <Icon icon={icon} size={16} color={on ? theme.onAccent : theme.textSecondary} />}
      <Text style={{ color: on ? theme.onAccent : theme.text, fontSize: 13, fontWeight: '500' }}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Sin fondo propio: el del planeta se cortaba al llegar a la barra de abajo. */}
      <GlobeMap
        transparent
        people={people}
        focusId={focus}
        onSelect={(pid) => {
          setPicked([]);
          setFocus(pid);
        }}
        memories={memories}
        onMemories={(ids) => {
          setFocus(null);
          setPicked(ids);
        }}
        focusPoint={pickedPlace ? { lat: pickedPlace.lat, lng: pickedPlace.lng } : null}
        hidePeople={!showPeople}
      />

      <View pointerEvents="box-none" style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.dismissTo('/')}
            style={[styles.chip, { backgroundColor: theme.card }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon icon={ChevronLeft} size={16} color={theme.text} />
              <Text style={{ color: theme.text, fontSize: 15, fontWeight: '500' }}>
                {group.name}
              </Text>
            </View>
          </Pressable>
          {(focus || picked.length > 0) && (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setFocus(null);
                setPicked([]);
              }}
              style={[styles.chip, { backgroundColor: theme.accent }]}>
              <Text style={{ color: theme.onAccent, fontSize: 15, fontWeight: '500' }}>
                Ver el mundo
              </Text>
            </Pressable>
          )}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersRow}
          contentContainerStyle={styles.filters}>
          {chip(showPeople, 'Personas', () => setLayer('people'), Users)}
          {chip(
            showMemories,
            `Recuerdos${placed.length ? ` · ${placed.length}` : ''}`,
            () => {
              setLayer('memories');
              setFocus(null);
            },
            MapPin,
          )}
          {showMemories &&
            PERIODS.map((p) => chip(period === p.key, p.label, () => setPeriod(p.key)))}
        </ScrollView>
        {showMemories && placed.length === 0 && (
          <View style={[styles.tip, { backgroundColor: theme.card }]}>
            <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 18 }}>
              Al compartir un momento, toca «Añadir lugar» y aparecerá aquí. Con el tiempo, este
              planeta será el mapa de vuestros recuerdos.
            </Text>
          </View>
        )}
      </View>

      <View pointerEvents="box-none" style={styles.bottom}>
        {pickedMoments.length > 0 && (
          <Animated.View
            entering={FadeInDown.duration(360)}
            style={[styles.sheet, { backgroundColor: theme.card }]}>
            <Text style={styles.sheetTitle}>{pickedPlace?.name}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 16, paddingVertical: 12, paddingHorizontal: 8 }}>
              {pickedMoments.map((m) => (
                <View key={m.id} style={{ alignItems: 'center', gap: 4 }}>
                  <Polaroid moment={m} width={108} caption={user(m.authorId).name.split(' ')[0]} />
                  <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
                    {new Intl.DateTimeFormat('es-ES', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    }).format(m.createdAt)}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </Animated.View>
        )}
        {focused && !pickedMoments.length && (
          <View style={[styles.detail, { backgroundColor: theme.card }]}>
            <SkyBadge tz={focused.tz} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: 17, fontWeight: '600' }}>
                {focused.isMe ? 'Tú' : focused.name}
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 15 }}>
                {clockIn(focused.tz)} en {focused.city || 'su ciudad'}
                {mine && !focused.isMe ? ` · a ${formatKm(distanceKm(mine, focused))} de ti` : ''}
              </Text>
            </View>
          </View>
        )}
        {!pickedMoments.length && places.length > 0 && !focused && (
          <Text style={styles.places}>
            Habéis compartido desde {places.slice(0, 6).join(' · ')}
          </Text>
        )}
        {showPeople && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.peopleRow}
            contentContainerStyle={styles.people}>
            {people.map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityLabel={`Ir a ${p.isMe ? 'tu ciudad' : p.name}`}
                onPress={() => {
                  setPicked([]);
                  setFocus(p.id === focus ? null : p.id);
                }}
                style={[
                  styles.person,
                  { backgroundColor: theme.card },
                  p.id === focus && { borderColor: theme.accent },
                ]}>
                <Avatar userId={p.id} size={34} />
                <View>
                  <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>
                    {p.id === me ? 'Tú' : p.name.split(' ')[0]}
                  </Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{p.city}</Text>
                </View>
              </Pressable>
            ))}
            {missing > 0 && (
              <View style={[styles.person, { backgroundColor: theme.card }]}>
                <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                  {missing === 1 ? '1 persona' : `${missing} personas`} sin ciudad
                </Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', top: 0, left: 0, right: 0, gap: 12 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16 },
  chip: {
    paddingHorizontal: 16,
    height: 40,
    borderRadius: Radius.pill,
    justifyContent: 'center',
    boxShadow: '0 8px 20px rgba(20,22,26,0.15)',
  },
  filters: { paddingHorizontal: 16, paddingVertical: 16, gap: 8 },
  filtersRow: { marginVertical: -16 },
  filter: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    boxShadow: '0 6px 14px rgba(20,22,26,0.12)',
  },
  tip: {
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 16,
    boxShadow: '0 8px 20px rgba(20,22,26,0.12)',
  },
  // Pegado abajo (la barra de pestañas va debajo, fuera de esta pantalla): más sitio para el planeta.
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 10, gap: 10 },
  sheet: {
    marginHorizontal: 12,
    borderRadius: 26,
    paddingTop: 16,
    paddingHorizontal: 12,
    boxShadow: '0 16px 36px rgba(20,22,26,0.2)',
  },
  sheetTitle: { fontFamily: Hand, fontSize: 24, color: '#C2477A', paddingHorizontal: 8 },
  detail: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    boxShadow: '0 12px 30px rgba(20,22,26,0.18)',
  },
  places: {
    fontFamily: Hand,
    fontSize: 20,
    color: '#3C3F44',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  // Con aire arriba y abajo: si no, la fila recorta la sombra de las tarjetas.
  people: { paddingHorizontal: 16, paddingVertical: 18, gap: 8 },
  peopleRow: { marginVertical: -18 },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    paddingRight: 16,
    borderRadius: Radius.pill,
    borderWidth: 2,
    borderColor: 'transparent',
    boxShadow: '0 8px 20px rgba(20,22,26,0.14)',
  },
});
