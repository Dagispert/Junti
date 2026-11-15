import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';

import { Hand, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import type { Song } from '@/data/types';
import { mmss, spotifyLink, usePreview } from '@/lib/music';
import { ArrowUpRight, Music } from 'lucide-react-native';
import { Icon } from './icon';

const COVER = 128;
/** El carrusel: tamaño de las portadas y distancia entre una y otra. */
const FLOW = 150;
const FLOW_STEP = 112;

/** La banda sonora del grupo: portadas apiladas; al elegir una, sale el disco y suena. */
export function Soundtrack({ groupId }: { groupId: string }) {
  const theme = useTheme();
  const { songs } = useStore();
  const list = songs.filter((s) => s.groupId === groupId);
  const [open, setOpen] = useState<string | null>(null);
  const song = list.find((s) => s.id === open);

  return (
    <View style={[styles.card, { backgroundColor: theme.card }]}>
      {song ? (
        <Player song={song} list={list} onBack={() => setOpen(null)} onSwitch={setOpen} />
      ) : (
        <>
          <View style={styles.head}>
            <Text style={[styles.title, { color: theme.text }]}>Nuestra banda sonora</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/add-song', params: { groupId } })}
              style={[styles.pill, { backgroundColor: theme.soft }]}>
              <Text style={[styles.pillText, { color: theme.textSecondary }]}>＋ Añadir</Text>
            </Pressable>
          </View>
          {list.length === 0 ? (
            <Text style={[styles.empty, { color: theme.textSecondary }]}>
              Las canciones que os recuerdan a algo: la del viaje, la de aquel verano, la que
              siempre cantáis. Añade la primera.
            </Text>
          ) : (
            <CoverFlow list={list} onOpen={setOpen} />
          )}
          {list.length > 1 && (
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              Desliza para ver todas; toca la del centro para escucharla.
            </Text>
          )}
        </>
      )}
    </View>
  );
}

/**
 * Las portadas en un carrusel 3D: se deslizan en horizontal y la del centro
 * queda de frente; las de los lados giran hacia ella. Tocar la del centro la
 * abre; tocar otra la trae al centro.
 */
function CoverFlow({ list, onOpen }: { list: Song[]; onOpen: (id: string) => void }) {
  const theme = useTheme();
  const scroller = useRef<{ scrollTo: (o: { x: number; animated?: boolean }) => void } | null>(
    null,
  );
  const [width, setWidth] = useState(0);
  const [x, setX] = useState(0);
  const step = FLOW_STEP;
  const pad = Math.max(0, (width - step) / 2);
  const current = Math.max(0, Math.min(list.length - 1, Math.round(x / step)));
  const song = list[current];
  return (
    <View style={{ gap: 10 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <ScrollView
        ref={scroller as never}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={(e) => setX(e.nativeEvent.contentOffset.x)}
        style={{ marginHorizontal: -20 }}
        contentContainerStyle={{
          paddingHorizontal: pad + 20,
          height: FLOW + 24,
          alignItems: 'center',
        }}>
        {list.map((s, i) => {
          const d = Math.max(-3, Math.min(3, (x - i * step) / step));
          const a = Math.min(1, Math.abs(d));
          return (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityLabel={`${s.title}, de ${s.artist}`}
              onPress={() =>
                i === current
                  ? onOpen(s.id)
                  : scroller.current?.scrollTo({ x: i * step, animated: true })
              }
              style={{
                width: step,
                height: FLOW,
                alignItems: 'center',
                zIndex: 100 - Math.round(Math.abs(d) * 10),
              }}>
              <View
                style={{
                  width: FLOW,
                  height: FLOW,
                  borderRadius: 12,
                  boxShadow: `0 ${14 - a * 6}px ${26 - a * 8}px rgba(20,22,26,${0.32 - a * 0.1})`,
                  opacity: 1 - Math.max(0, Math.abs(d) - 1.6) * 0.5,
                  transform: [
                    { perspective: 700 },
                    { translateX: -Math.sign(d) * a * 0 + d * 18 },
                    { rotateY: `${Math.sign(d) * a * 52}deg` },
                    { scale: 1 - a * 0.16 },
                  ],
                }}>
                <Artwork song={s} size={FLOW} />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      {song && (
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Text numberOfLines={1} style={{ color: theme.text, fontSize: 17, fontWeight: '600' }}>
            {song.title}
          </Text>
          <Text numberOfLines={1} style={{ color: theme.textSecondary, fontSize: 14 }}>
            {song.artist}
          </Text>
        </View>
      )}
      {list.length > 1 && (
        <View style={styles.dots}>
          {list.map((s, i) => (
            <View
              key={s.id}
              style={[styles.dot, { backgroundColor: i === current ? theme.text : theme.soft }]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

export function Artwork({ song, size }: { song: Song; size: number }) {
  return song.artwork ? (
    <Image
      source={{ uri: song.artwork }}
      style={{ width: size, height: size, borderRadius: 10 }}
      contentFit="cover"
    />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        backgroundColor: '#2B2E33',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Icon icon={Music} size={Math.round(size * 0.3)} color="#8B9096" />
    </View>
  );
}

/**
 * La funda con su disco: al aparecer, el disco sale de la carátula hacia la
 * derecha; mientras suena, gira. Se usa en el reproductor y en «Hoy».
 */
export function RecordSleeve({
  song,
  size,
  playing,
}: {
  song: Song;
  size: number;
  playing: boolean;
}) {
  const slide = useSharedValue(0);
  const spin = useSharedValue(0);
  useEffect(() => {
    slide.value = 0;
    slide.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [song.id, slide]);
  useEffect(() => {
    if (playing) {
      spin.value = withRepeat(
        withTiming(spin.value + 360, { duration: 2400, easing: Easing.linear }),
        -1,
        false,
      );
    } else cancelAnimation(spin);
  }, [playing, spin]);
  const vinyl = useAnimatedStyle(() => ({
    transform: [{ translateX: slide.value * size * 0.42 }, { rotate: `${spin.value}deg` }],
  }));
  return (
    <View style={{ width: size * 1.45, height: size }}>
      <Animated.View
        style={[styles.vinyl, { width: size, height: size, borderRadius: size / 2 }, vinyl]}>
        {[0.92, 0.78, 0.64].map((k) => (
          <View
            key={k}
            style={[styles.groove, { width: size * k, height: size * k, borderRadius: size }]}
          />
        ))}
        <View
          style={[
            styles.labelDisc,
            { width: size * 0.36, height: size * 0.36, borderRadius: size },
          ]}>
          {song.artwork ? (
            <Image
              source={{ uri: song.artwork }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          ) : null}
          <View style={styles.spindle} />
        </View>
      </Animated.View>
      <View style={styles.sleeve}>
        <Artwork song={song} size={size} />
      </View>
    </View>
  );
}

function Player({
  song,
  list,
  onBack,
  onSwitch,
}: {
  song: Song;
  list: Song[];
  onBack: () => void;
  onSwitch: (id: string) => void;
}) {
  const theme = useTheme();
  const { user, me, removeSong } = useStore();
  const audio = usePreview(song.preview);
  const i = list.findIndex((s) => s.id === song.id);
  const go = (d: number) => onSwitch(list[(i + d + list.length) % list.length].id);

  return (
    <View style={{ gap: 20 }}>
      <View style={styles.head}>
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={[styles.pill, { backgroundColor: theme.soft }]}>
          <Text style={[styles.pillText, { color: theme.textSecondary }]}>Volver</Text>
        </Pressable>
        <Pressable
          accessibilityRole="link"
          onPress={() => Linking.openURL(spotifyLink(song.title, song.artist))}
          style={[styles.pill, { backgroundColor: theme.soft }]}>
          <Text style={[styles.pillText, { color: theme.textSecondary }]}>Ver en Spotify</Text>
          <Icon icon={ArrowUpRight} size={16} />
        </Pressable>
      </View>
      <View style={styles.playerRow}>
        <RecordSleeve song={song} size={COVER} playing={audio.playing} />
        <View style={{ flex: 1, alignItems: 'center', gap: 8 }}>
          <Text numberOfLines={1} style={{ color: theme.textSecondary, fontSize: 13 }}>
            {song.artist}
          </Text>
          <Text
            numberOfLines={2}
            style={{ color: theme.text, fontSize: 17, fontWeight: '600', textAlign: 'center' }}>
            {song.title}
          </Text>
          <View style={[styles.time, { backgroundColor: theme.soft }]}>
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
              {mmss(audio.position)} / {mmss(audio.duration)}
            </Text>
          </View>
          <View style={[styles.controls, { backgroundColor: theme.soft }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Anterior"
              onPress={() => go(-1)}
              style={styles.ctrl}>
              <Text style={[styles.ctrlText, { color: theme.textSecondary }]}>⏮</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={audio.playing ? 'Pausa' : 'Reproducir'}
              onPress={() =>
                audio.available ? audio.toggle() : song.link && Linking.openURL(song.link)
              }
              style={styles.ctrl}>
              <Text style={[styles.ctrlText, { color: theme.text, fontSize: 20 }]}>
                {audio.playing ? '⏸' : '▶'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Siguiente"
              onPress={() => go(1)}
              style={styles.ctrl}>
              <Text style={[styles.ctrlText, { color: theme.textSecondary }]}>⏭</Text>
            </Pressable>
          </View>
        </View>
      </View>
      {!!song.note && (
        <Text style={[styles.note, { color: theme.text }]}>
          «{song.note}»{' '}
          <Text style={{ color: theme.textSecondary }}>
            — {user(song.addedBy).name.split(' ')[0]}
          </Text>
        </Text>
      )}
      {song.addedBy === me && (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            removeSong(song.id)
              .then(onBack)
              .catch(() => {})
          }>
          <Text style={{ color: theme.textSecondary, fontSize: 13, textAlign: 'center' }}>
            Quitar de la banda sonora
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 32,
    padding: 20,
    gap: 16,
    boxShadow: '0 18px 40px rgba(20,22,26,0.10)',
    overflow: 'visible',
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 24, fontWeight: '500', letterSpacing: -0.4 },
  pill: { height: 36, paddingHorizontal: 16, borderRadius: 999, justifyContent: 'center' },
  pillText: { fontSize: 15, fontWeight: '500' },
  empty: { fontSize: 15, lineHeight: 21 },
  hint: { fontSize: 13, textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vinyl: {
    position: 'absolute',
    left: 0,
    top: 0,
    backgroundColor: '#141518',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 18px rgba(0,0,0,0.3)',
  },
  groove: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  labelDisc: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2703A',
  },
  spindle: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F6F1EA' },
  sleeve: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: 10,
    boxShadow: '0 12px 22px rgba(20,22,26,0.3)',
  },
  time: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  controls: { flexDirection: 'row', borderRadius: 999, paddingHorizontal: 8, marginTop: 4 },
  ctrl: { width: 44, height: 40, alignItems: 'center', justifyContent: 'center' },
  ctrlText: { fontSize: 17 },
  note: { fontFamily: Hand, fontSize: 24, lineHeight: 24, textAlign: 'center' },
});
