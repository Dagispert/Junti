import { StyleSheet, Text, View } from 'react-native';

import { Hand, HandBold, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import { onThisDay } from '@/lib/recap';

import { Polaroid, Tape } from './scrapbook';

/** «Tal día como hoy»: lo que compartisteis este mismo día otro año (o hace un mes). */
export function OnThisDay({ groupId }: { groupId: string }) {
  const theme = useTheme();
  const { moments, user } = useStore();
  const found = onThisDay(moments.filter((m) => m.groupId === groupId));
  if (!found) return null;
  const shown = found.moments.slice(0, 3);
  const date = new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(shown[0].createdAt);
  const who = [...new Set(found.moments.map((m) => user(m.authorId).name.split(' ')[0]))];

  return (
    <View style={[styles.card, { backgroundColor: theme.card }]}>
      <Tape style={{ position: 'absolute', top: -8, left: '40%' }} />
      <Text style={styles.kicker}>{found.label}</Text>
      <Text style={{ color: theme.textSecondary, fontSize: 14, textAlign: 'center' }}>
        {date} · {who.join(', ')}
      </Text>
      <View style={styles.row}>
        {shown.map((m, i) =>
          m.imageUri ? (
            <Polaroid
              key={m.id}
              moment={m}
              width={shown.length === 1 ? 180 : 112}
              rotate={-5 + i * 5}
              caption={m.text}
            />
          ) : (
            <View key={m.id} style={[styles.paper, { transform: [{ rotate: `${3 - i * 4}deg` }] }]}>
              <Text numberOfLines={5} style={styles.paperText}>
                {m.text}
              </Text>
            </View>
          ),
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 32,
    padding: 20,
    paddingTop: 22,
    gap: 6,
    alignItems: 'center',
    boxShadow: '0 18px 40px rgba(20,22,26,0.10)',
  },
  kicker: { fontFamily: HandBold, fontSize: 30, color: '#C2477A', textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 14, marginBottom: 6 },
  paper: {
    width: 120,
    minHeight: 120,
    backgroundColor: '#FFFDF6',
    padding: 12,
    justifyContent: 'center',
    boxShadow: '0 10px 20px rgba(20,22,26,0.12)',
  },
  paperText: {
    fontFamily: Hand,
    fontSize: 20,
    lineHeight: 21,
    color: '#3C3F44',
    textAlign: 'center',
  },
});
