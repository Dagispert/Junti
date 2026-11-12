import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { FilmRoll } from '@/components/film-roll';
import { RecapCard } from '@/components/recap-card';
import { GroupHeader } from '@/components/group-header';
import { PolaroidPile, Scribble } from '@/components/scrapbook';
import { Soundtrack } from '@/components/soundtrack';
import { Lead, Screen } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import type { Moment } from '@/data/types';
import { featuredWeek } from '@/lib/recap';
import { monthOf } from '@/lib/time';

import { Missing } from './index';

/** La memoria del grupo: lo de esta semana en un montón de polaroids, la banda sonora y un carrete por mes. */
export default function Memory() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { group: groupById, moments, user } = useStore();
  const group = groupById(id);
  if (!group) return <Missing />;

  // Por fecha de lo que pasó (los recuerdos, en la suya).
  const all = moments.filter((m) => m.groupId === id).sort((a, b) => b.createdAt - a.createdAt);
  const months: { key: string; label: string; items: Moment[] }[] = [];
  for (const moment of all) {
    const { key, label } = monthOf(moment.createdAt);
    const last = months[months.length - 1];
    if (last?.key === key) last.items.push(moment);
    else months.push({ key, label, items: [moment] });
  }

  const week = all.filter((m) => m.sharedAt > Date.now() - 7 * 86_400_000);
  const who = [...new Set(week.map((m) => user(m.authorId).name.split(' ')[0]))];
  const whoText =
    who.length > 1 ? `${who.slice(0, -1).join(', ')} y ${who[who.length - 1]}` : who[0];
  const featured = featuredWeek(all);
  const pile = (week.length >= 3 ? week : all).filter((m) => m.imageUri || m.videoUri).slice(0, 7);

  return (
    <Screen header={<GroupHeader group={group} />}>
      {all.length === 0 ? (
        <Lead strong="La memoria del grupo se irá llenando sola,">
          mes a mes, con lo que compartáis.
        </Lead>
      ) : (
        <View style={styles.hero}>
          {pile.length > 0 && <PolaroidPile moments={pile} size={320} />}
          <Text style={[styles.heroText, { color: theme.text }]}>
            {week.length >= 5
              ? 'Ha pasado mucho esta semana.'
              : week.length > 0
                ? `Esta semana, ${week.length} ${week.length === 1 ? 'momento' : 'momentos'}.`
                : 'Una semana tranquila.'}
          </Text>
          {week.length > 0 && (
            <Scribble size={22} rotate={-2}>
              Gracias a {whoText} ♡
            </Scribble>
          )}
        </View>
      )}

      {featured != null && <RecapCard groupId={group.id} kind="week" from={featured} />}

      <Soundtrack groupId={group.id} />

      {months.map((m, i) => (
        <FilmRoll key={m.key} moments={m.items} label={m.label} index={i} groupId={group.id} />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three },
  heroText: { fontSize: 22, letterSpacing: -0.4, textAlign: 'center' },
});
