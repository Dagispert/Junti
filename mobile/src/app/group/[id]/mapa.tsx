import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGlobePeople } from '@/components/connection-card';
import { GlobeMap } from '@/components/globe-map';
import { SkyBadge } from '@/components/sky-badge';
import { Avatar } from '@/components/ui';
import { Radius, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import { distanceKm, formatKm } from '@/lib/geo';
import { clockIn } from '@/lib/time';

import { Missing } from './index';

/** El globo del grupo a pantalla completa: girar, acercarse y viajar a la ciudad de cada uno. */
export default function MapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { group: groupById, me } = useStore();
  const group = groupById(id);
  const people = useGlobePeople(group);
  const [focus, setFocus] = useState<string | null>(null);
  if (!group) return <Missing />;

  const mine = people.find((p) => p.isMe);
  const focused = people.find((p) => p.id === focus);
  const missing = group.memberIds.length - people.length;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <GlobeMap people={people} focusId={focus} onSelect={setFocus} />

      <View pointerEvents="box-none" style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.dismissTo('/')}
          style={[styles.chip, { backgroundColor: theme.card }]}>
          <Text style={{ color: theme.text, fontSize: 14, fontWeight: '500' }}>‹ {group.name}</Text>
        </Pressable>
        {focus && (
          <Pressable
            accessibilityRole="button"
            onPress={() => setFocus(null)}
            style={[styles.chip, { backgroundColor: theme.accent }]}>
            <Text style={{ color: theme.onAccent, fontSize: 14, fontWeight: '500' }}>
              Ver el mundo
            </Text>
          </Pressable>
        )}
      </View>

      <View pointerEvents="box-none" style={styles.bottom}>
        {focused && (
          <View style={[styles.detail, { backgroundColor: theme.card }]}>
            <SkyBadge tz={focused.tz} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: 18, fontWeight: '600' }}>
                {focused.isMe ? 'Tú' : focused.name}
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
                {clockIn(focused.tz)} en {focused.city || 'su ciudad'}
                {mine && !focused.isMe ? ` · a ${formatKm(distanceKm(mine, focused))} de ti` : ''}
              </Text>
            </View>
          </View>
        )}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.people}>
          {people.map((p) => (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityLabel={`Ir a ${p.isMe ? 'tu ciudad' : p.name}`}
              onPress={() => setFocus(p.id === focus ? null : p.id)}
              style={[
                styles.person,
                { backgroundColor: theme.card },
                p.id === focus && { borderColor: theme.accent },
              ]}>
              <Avatar userId={p.id} size={34} />
              <View>
                <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>
                  {p.id === me ? 'Tú' : p.name.split(' ')[0]}
                </Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{p.city}</Text>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chip: {
    paddingHorizontal: 16,
    height: 40,
    borderRadius: Radius.pill,
    justifyContent: 'center',
    boxShadow: '0 8px 20px rgba(20,22,26,0.15)',
  },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 104, gap: 10 },
  detail: {
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    boxShadow: '0 12px 30px rgba(20,22,26,0.18)',
  },
  people: { paddingHorizontal: 16, gap: 8 },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 6,
    paddingRight: 14,
    borderRadius: Radius.pill,
    borderWidth: 2,
    borderColor: 'transparent',
    boxShadow: '0 8px 20px rgba(20,22,26,0.14)',
  },
});
