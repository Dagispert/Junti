import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { GroupHeader } from '@/components/group-header';
import { Lead, Photo, PhotoFan, Screen, Tag } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import type { Moment } from '@/data/types';
import { monthOf } from '@/lib/time';

import { Missing } from './index';

/** Memoria (versión mínima del MVP): todos los momentos del grupo, mes a mes. */
export default function Memory() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { group: groupById, moments } = useStore();
  const group = groupById(id);
  if (!group) return <Missing />;

  const all = moments.filter((m) => m.groupId === id);
  const months: { key: string; label: string; items: Moment[] }[] = [];
  for (const moment of all) {
    const { key, label } = monthOf(moment.createdAt);
    const last = months[months.length - 1];
    if (last?.key === key) last.items.push(moment);
    else months.push({ key, label, items: [moment] });
  }
  const photos = all.filter((m) => m.imageUri);
  const count = `${all.length} ${all.length === 1 ? 'momento compartido' : 'momentos compartidos'}`;

  return (
    <Screen header={<GroupHeader group={group} />}>
      {months.length === 0 ? (
        <Lead strong="La memoria del grupo se irá llenando sola,">
          mes a mes, con lo que compartáis.
        </Lead>
      ) : (
        <View style={styles.hero}>
          <PhotoFan moments={photos} size={150} />
          <Tag center>{count}</Tag>
          <View style={{ maxWidth: 320 }}>
            <Text style={[styles.heroText, { color: theme.textSecondary }]}>
              <Text style={{ color: theme.text }}>Vuestra historia, </Text>
              desde {months[months.length - 1].label.toLowerCase()}.
            </Text>
          </View>
        </View>
      )}

      {months.map((month) => (
        <View key={month.key} style={{ gap: Spacing.two }}>
          <Text style={[styles.month, { color: theme.text }]}>{month.label}</Text>
          <View style={styles.grid}>
            {month.items.map((moment) => (
              <View key={moment.id} style={styles.cell}>
                <Photo moment={moment} style={styles.photo} />
              </View>
            ))}
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 14, paddingBottom: Spacing.two },
  heroText: { fontSize: 19, lineHeight: 26, textAlign: 'center', letterSpacing: -0.2 },
  month: { fontSize: 22, fontWeight: '500', letterSpacing: -0.4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', margin: -3 },
  cell: { width: '33.333%', padding: 3 },
  photo: { width: '100%', aspectRatio: 1, borderRadius: 18 },
});
