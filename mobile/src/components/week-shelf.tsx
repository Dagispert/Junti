import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Hand, useTheme } from '@/constants/theme';
import type { Moment } from '@/data/types';
import { primeNarrator } from '@/lib/narrator';
import { weekStart } from '@/lib/recap';

import { PressScale } from './motion';
import { Photo } from './ui';

const DAY = 86_400_000;

/** «9–15 de noviembre» (o «28 oct – 3 nov»). */
function rango(from: number) {
  const a = new Date(from);
  const b = new Date(from + 6 * DAY);
  const mes = (d: Date) => new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(d);
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${mes(b)}`
    : `${a.getDate()} ${mes(a)} – ${b.getDate()} ${mes(b)}`;
}

/**
 * Las semanas que ya terminaron, una al lado de otra (la más reciente
 * primero): cada una abre su resumen.
 */
export function WeekShelf({ groupId, moments }: { groupId: string; moments: Moment[] }) {
  const theme = useTheme();
  const thisWeek = weekStart(Date.now());
  const weeks = new Map<number, Moment[]>();
  for (const m of moments) {
    if (m.memory) continue;
    const w = weekStart(m.createdAt);
    if (w >= thisWeek) continue;
    weeks.set(w, [...(weeks.get(w) ?? []), m]);
  }
  const list = [...weeks.entries()].sort((a, b) => b[0] - a[0]).slice(0, 30);
  if (!list.length) return null;
  return (
    <View style={{ gap: 10 }}>
      <Text style={[styles.title, { color: theme.text }]}>Semanas anteriores</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 14, paddingVertical: 6, paddingHorizontal: 2 }}>
        {list.map(([from, items], i) => {
          const fotos = items.filter((m) => m.imageUri || m.videoUri).slice(0, 2);
          const pasada = i === 0 && from === thisWeek - 7 * DAY;
          return (
            <PressScale
              key={from}
              accessibilityRole="button"
              accessibilityLabel={`Resumen de la semana del ${rango(from)}`}
              onPress={() => {
                primeNarrator();
                router.push({
                  pathname: '/recap',
                  params: { groupId, kind: 'week', from: String(from) },
                });
              }}>
              <View style={[styles.card, { backgroundColor: theme.card, boxShadow: theme.shadow }]}>
                <View style={styles.pila}>
                  {fotos.length ? (
                    fotos
                      .slice()
                      .reverse()
                      .map((m, k) => (
                        <View
                          key={m.id}
                          style={[
                            styles.foto,
                            {
                              transform: [
                                { rotate: `${k ? 4 : -5}deg` },
                                { translateX: k ? 10 : -6 },
                              ],
                            },
                          ]}>
                          <Photo moment={m} style={StyleSheet.absoluteFill} />
                        </View>
                      ))
                  ) : (
                    <View style={[styles.foto, styles.papel]}>
                      <Text numberOfLines={4} style={styles.papelTxt}>
                        {items[0].text ?? '♪'}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.rango, { color: theme.text }]}>
                  {pasada ? 'La semana pasada' : rango(from)}
                </Text>
                <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                  {items.length} {items.length === 1 ? 'momento' : 'momentos'}
                </Text>
              </View>
            </PressScale>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '600', letterSpacing: -0.3 },
  card: { width: 150, borderRadius: 18, padding: 12, gap: 4, alignItems: 'center' },
  pila: { width: 120, height: 104, alignItems: 'center', justifyContent: 'center' },
  foto: {
    position: 'absolute',
    width: 84,
    height: 96,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    backgroundColor: '#E9E4DA',
  },
  papel: { padding: 6, justifyContent: 'center' },
  papelTxt: { fontFamily: Hand, fontSize: 15, color: '#3C3F44', textAlign: 'center' },
  rango: { fontFamily: Hand, fontSize: 21, marginTop: 4, textAlign: 'center' },
});
