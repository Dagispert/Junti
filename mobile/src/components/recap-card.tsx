import { Image } from 'expo-image';
import { useEffect } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Hand, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import type { Moment } from '@/data/types';
import { buildRecap } from '@/lib/recap';
import { primeNarrator } from '@/lib/narrator';

import { PressScale } from './motion';
import { Photo } from './ui';

/**
 * Tarjeta para abrir un resumen: fotos apiladas, la última desenfocada con
 * cuántas más hay, el título y el rango de fechas.
 */
export function RecapCard({
  groupId,
  kind,
  from,
  hint,
}: {
  groupId: string;
  kind: 'week' | 'month';
  from: number;
  hint?: string;
}) {
  const theme = useTheme();
  const { moments, user, proposals, songs, group, narrate } = useStore();
  const recap = buildRecap(
    kind,
    from,
    moments.filter((m) => m.groupId === groupId),
    user,
    proposals,
    songs,
  );
  // Con la narradora activada, la crónica se va escribiendo en cuanto se ve la
  // tarjeta: al abrir el resumen ya está lista.
  const narrating = !!group(groupId)?.narrativeEnabled && recap.moments.length > 0;
  const count = recap.moments.length;
  useEffect(() => {
    if (!narrating) return;
    const args = { groupId, kind, from, to: recap.to, label: recap.range };
    narrate(args)
      .then((r) => {
        if (r.narration && !r.narration.audioUrl) return narrate({ ...args, action: 'voice' });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrating, groupId, kind, from, count]);

  if (!recap.moments.length) return null;
  const photos = recap.picks.filter((m) => m.imageUri || m.videoUri);
  const shown: Moment[] = photos.slice(0, 3);
  const rest = recap.moments.length - shown.length;
  const blurred = photos[3] ?? photos[0];

  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={`Ver el resumen: ${recap.title}, ${recap.range}`}
      onPress={() => {
        primeNarrator();
        router.push({ pathname: '/recap', params: { groupId, kind, from: String(from) } });
      }}>
      <View style={styles.cards}>
        {shown.map((m, i) => (
          <View
            key={m.id}
            style={[
              styles.card,
              { left: 18 + i * 62, transform: [{ rotate: `${-6 + i * 5}deg` }], zIndex: i },
            ]}>
            <Photo moment={m} style={StyleSheet.absoluteFill} />
          </View>
        ))}
        {shown.length === 0 && (
          <View style={[styles.card, styles.paper, { left: 18 }]}>
            <Text numberOfLines={4} style={styles.paperText}>
              {recap.moments[0].text}
            </Text>
          </View>
        )}
        {rest > 0 && (
          <View
            style={[
              styles.card,
              {
                left: 18 + Math.max(1, shown.length) * 62,
                transform: [{ rotate: '7deg' }],
                zIndex: 9,
              },
            ]}>
            {blurred?.imageUri ? (
              <Image
                source={{ uri: blurred.imageUri }}
                blurRadius={18}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.soft }]} />
            )}
            <View style={[StyleSheet.absoluteFill, styles.more]}>
              <Text style={styles.moreText}>+{rest}</Text>
            </View>
          </View>
        )}
        <View style={[styles.play, { backgroundColor: theme.accent }]}>
          <Text style={{ color: theme.onAccent, fontSize: 16, marginLeft: 2 }}>▶</Text>
        </View>
      </View>
      <View style={{ alignItems: 'center', gap: 2, marginTop: 6 }}>
        <Text style={[styles.title, { color: theme.text }]}>{recap.title}</Text>
        <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
          {recap.range}
          {recap.ongoing ? ' · hasta hoy' : ''}
        </Text>
        {!!hint && <Text style={[styles.hint, { color: '#C2477A' }]}>{hint}</Text>}
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  cards: { height: 190, width: 300, alignSelf: 'center' },
  card: {
    position: 'absolute',
    top: 14,
    width: 112,
    height: 150,
    borderRadius: 18,
    borderWidth: 4,
    borderColor: '#fff',
    overflow: 'hidden',
    backgroundColor: '#fff',
    boxShadow: '0 12px 24px rgba(20,22,26,0.18)',
  },
  paper: { backgroundColor: '#FFFDF6', padding: 10, justifyContent: 'center' },
  paperText: {
    fontFamily: Hand,
    fontSize: 18,
    lineHeight: 19,
    color: '#3C3F44',
    textAlign: 'center',
  },
  more: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  moreText: { color: '#1D1F22', fontSize: 30, fontWeight: '500' },
  play: {
    position: 'absolute',
    right: 8,
    bottom: 6,
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    boxShadow: '0 8px 18px rgba(20,22,26,0.25)',
  },
  title: { fontSize: 22, fontWeight: '500', letterSpacing: -0.4 },
  hint: { fontFamily: Hand, fontSize: 20 },
});
