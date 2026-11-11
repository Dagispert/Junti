import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInLeft, ZoomIn } from 'react-native-reanimated';

import { Hand, HandBold } from '@/constants/theme';
import { useStore } from '@/data/store';
import type { Moment } from '@/data/types';

import { Sticker, StickyNote } from './scrapbook';
import { Photo } from './ui';

const FRAME_W = 132;
const FRAME_H = 118;
const STRIP_H = FRAME_H + 44;
const FILM = '#3E2C22';

/** El carrete: un cartucho del que sale una tira de película con las fotos del mes. */
export function FilmRoll({
  moments,
  label,
  index = 0,
}: {
  moments: Moment[];
  label: string;
  index?: number;
}) {
  const { user } = useStore();
  const ordered = [...moments].sort((a, b) => a.createdAt - b.createdAt);
  // Las reacciones más usadas del mes se convierten en pegatinas.
  const counts = new Map<string, number>();
  for (const m of moments)
    for (const r of m.reactions) counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
  const stickers = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([e]) => e);
  // Ancho de la tira: margen + fotogramas + el trozo final sin revelar.
  const stripW = 96 + 18 + ordered.length * (FRAME_W + 10) + 70 + 24;
  const holes = Math.ceil(stripW / 18);

  return (
    <View style={{ gap: 4 }}>
      <View style={styles.titleRow}>
        <Text style={styles.month}>{label}</Text>
        <Text style={styles.count}>
          {moments.length} {moments.length === 1 ? 'foto' : 'fotos'}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 46, paddingRight: 30 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Canister label={label} />
          <Animated.View entering={FadeInLeft.delay(200 + index * 120).duration(900)}>
            <View style={[styles.strip, { width: stripW - 96 }]}>
              <View style={[styles.holes, { top: 6 }]}>
                {Array.from({ length: holes }, (_, i) => (
                  <View key={i} style={styles.hole} />
                ))}
              </View>
              <View style={[styles.holes, { bottom: 6 }]}>
                {Array.from({ length: holes }, (_, i) => (
                  <View key={i} style={styles.hole} />
                ))}
              </View>
              <View style={styles.frames}>
                {ordered.map((m, i) => (
                  <Pressable
                    key={m.id}
                    accessibilityRole="button"
                    accessibilityLabel={m.text ?? 'Ver el momento'}
                    onPress={() => router.push({ pathname: '/moment/[id]', params: { id: m.id } })}>
                    {m.imageUri ? (
                      <Photo moment={m} style={styles.frame} />
                    ) : (
                      <View style={[styles.frame, styles.paper]}>
                        <Text numberOfLines={5} style={styles.paperText}>
                          {m.text}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.frameNo}>{i + 1}</Text>
                    {/* Anotaciones a mano, alternando arriba y abajo de la tira. */}
                    <View
                      style={[
                        styles.note,
                        i % 2 ? { top: FRAME_H + 30 } : { bottom: FRAME_H + 30 },
                      ]}>
                      <Text numberOfLines={2} style={styles.noteText}>
                        {i % 2 ? '↖ ' : ''}
                        {m.imageUri && m.text ? m.text : user(m.authorId).name.split(' ')[0]}
                        {i % 2 ? '' : ' ↘'}
                      </Text>
                      <Text style={styles.noteSmall}>
                        {user(m.authorId).name.split(' ')[0]} ·{' '}
                        {new Intl.DateTimeFormat('es-ES', {
                          day: 'numeric',
                          month: 'short',
                        }).format(m.createdAt)}
                      </Text>
                    </View>
                  </Pressable>
                ))}
                {/* Final de la tira, sin revelar: como en la referencia, garabateado. */}
                <View style={[styles.frame, styles.unexposed]} />
              </View>
            </View>
          </Animated.View>
        </View>
        {stickers.map((e, i) => (
          <Sticker
            key={e}
            emoji={e}
            size={40}
            rotate={(i % 2 ? 1 : -1) * (8 + i * 5)}
            delay={900 + i * 180}
            // Pegadas en la esquina inferior de las fotos, donde no tapan las notas.
            style={{
              position: 'absolute',
              top: 46 + (STRIP_H - FRAME_H) / 2 + FRAME_H - 30,
              left: 96 + 10 + Math.min(i, ordered.length - 1) * (FRAME_W + 10) + FRAME_W - 22,
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
}

/** Cartucho de película, dibujado con piezas. */
function Canister({ label }: { label: string }) {
  return (
    <Animated.View entering={ZoomIn.springify().damping(13)} style={styles.canister}>
      <View style={styles.knob} />
      <View style={styles.cap} />
      <View style={styles.body}>
        <View style={styles.band}>
          <Text style={styles.iso}>200</Text>
        </View>
        <Text style={styles.brand} numberOfLines={1}>
          JUNTI
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {label.split(' ')[0]}
        </Text>
      </View>
      <View style={styles.cap} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  month: { fontFamily: HandBold, fontSize: 30, color: '#C2477A' },
  count: { fontFamily: Hand, fontSize: 20, color: '#8B9096' },
  strip: {
    height: STRIP_H,
    backgroundColor: FILM,
    marginLeft: -8,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    justifyContent: 'center',
  },
  holes: {
    position: 'absolute',
    left: 6,
    right: 6,
    flexDirection: 'row',
    gap: 8,
    overflow: 'hidden',
  },
  hole: { width: 10, height: 12, borderRadius: 2.5, backgroundColor: '#F6F1EA' },
  frames: { flexDirection: 'row', gap: 10, paddingLeft: 18 },
  frame: { width: FRAME_W, height: FRAME_H, borderRadius: 3, overflow: 'hidden' },
  paper: { backgroundColor: '#F7F0E2', padding: 10, justifyContent: 'center' },
  paperText: {
    fontFamily: Hand,
    fontSize: 20,
    lineHeight: 21,
    color: '#3C3F44',
    textAlign: 'center',
  },
  unexposed: { width: 70, backgroundColor: '#2A1D16', opacity: 0.8 },
  frameNo: {
    position: 'absolute',
    bottom: -20,
    right: 4,
    color: '#E8B26A',
    fontSize: 10,
    fontWeight: '700',
  },
  note: { position: 'absolute', left: -6, width: FRAME_W + 16 },
  noteText: { fontFamily: Hand, fontSize: 19, lineHeight: 19, color: '#4A4E55' },
  noteSmall: { fontFamily: Hand, fontSize: 15, color: '#9AA0A6' },
  canister: { width: 80, alignItems: 'center', zIndex: 2 },
  knob: {
    width: 22,
    height: 10,
    backgroundColor: '#55585C',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  cap: { width: 74, height: 12, backgroundColor: '#3A3D41', borderRadius: 3 },
  body: {
    width: 70,
    height: 132,
    backgroundColor: '#5E8C3A',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    boxShadow: 'inset -10px 0 14px rgba(0,0,0,0.25), inset 8px 0 10px rgba(255,255,255,0.15)',
  },
  band: { backgroundColor: '#F4E9C8', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  iso: { color: '#2F5A20', fontWeight: '800', fontSize: 16 },
  brand: { color: '#F4E9C8', fontWeight: '800', fontSize: 15, letterSpacing: 2 },
  sub: { fontFamily: Hand, color: '#F4E9C8', fontSize: 16 },
});

export { StickyNote };
