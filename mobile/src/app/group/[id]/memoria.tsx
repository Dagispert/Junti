import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { GroupHeader } from '@/components/group-header';
import { Photo, Screen } from '@/components/ui';
import { Fonts, Spacing, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import type { Moment } from '@/data/types';
import { monthOf } from '@/lib/time';

/** Memoria (versión mínima del MVP): todos los momentos del grupo, mes a mes. */
export default function Memory() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { group: groupById, moments } = useStore();
  const group = groupById(id);
  if (!group) return null;

  const months: { key: string; label: string; items: Moment[] }[] = [];
  for (const moment of moments.filter((m) => m.groupId === id)) {
    const { key, label } = monthOf(moment.createdAt);
    const last = months[months.length - 1];
    if (last?.key === key) last.items.push(moment);
    else months.push({ key, label, items: [moment] });
  }

  return (
    <Screen header={<GroupHeader group={group} />}>
      {months.length === 0 && (
        <Text style={{ color: theme.textSecondary, fontSize: 16, lineHeight: 23 }}>
          La memoria del grupo se irá llenando sola, mes a mes, con lo que compartáis.
        </Text>
      )}
      {months.map((month) => (
        <View key={month.key} style={{ gap: Spacing.two }}>
          <Text style={[styles.month, { color: theme.text, fontFamily: Fonts?.serif }]}>
            {month.label}
          </Text>
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
  month: { fontSize: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', margin: -2 },
  cell: { width: '33.333%', padding: 2 },
  photo: { width: '100%', aspectRatio: 1, borderRadius: 8 },
});
