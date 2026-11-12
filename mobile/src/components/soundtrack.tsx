import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
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

/** La banda sonora del grupo: portadas apiladas; al elegir una, sale el disco y suena. */
export function Soundtrack({ groupId }: { groupId: string }) {
  const theme = useTheme();
  const { songs } = useStore();
  const list = songs.filter((s) => s.groupId === groupId);
  const [open, setOpen] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
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
            <View style={[styles.stack, { width: COVER + (list.length - 1) * 38 }]}>
              {list.slice(0, 8).map((s, i) => {
                const lifted = hover === s.id;
                return (
                  <Pressable
                    key={s.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${s.title}, de ${s.artist}`}
                    onHoverIn={() => setHover(s.id)}
                    onHoverOut={() => setHover(null)}
                    onPress={() =>
                      hover === s.id || list.length === 1 ? setOpen(s.id) : setHover(s.id)
                    }
                    // La zona que se toca no se mueve; solo la portada de dentro se levanta.
                    style={[styles.cover, { left: i * 38, zIndex: lifted ? 50 : 20 - i }]}>
                    <View
                      style={{
                        borderRadius: 10,
                        boxShadow: '0 10px 18px rgba(20,22,26,0.28)',
                        transform: [
                          { translateY: lifted ? -14 : 0 },
                          { scale: 1 - Math.min(i, 4) * 0.035 },
                        ],
                      }}>
                      <Artwork song={s} size={COVER} />
                    </View>
                    {lifted && (
                      <View style={[styles.tooltip, { backgroundColor: theme.card }]}>
                        <Text
                          numberOfLines={1}
                          style={{ color: theme.textSecondary, fontSize: 13 }}>
                          {s.artist}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>
                          {s.title}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
          {list.length > 1 && (
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              Toca una portada para escucharla.
            </Text>
          )}
        </>
      )}
    </View>
  );
}

function Artwork({ song, size }: { song: Song; size: number }) {
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
  const slide = useSharedValue(0);
  const spin = useSharedValue(0);

  // El disco sale de la funda al abrir la canción y gira mientras suena.
  useEffect(() => {
    slide.value = 0;
    slide.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [song.id, slide]);
  useEffect(() => {
    if (audio.playing) {
      spin.value = withRepeat(
        withTiming(spin.value + 360, { duration: 2400, easing: Easing.linear }),
        -1,
        false,
      );
    } else cancelAnimation(spin);
  }, [audio.playing, spin]);

  const vinyl = useAnimatedStyle(() => ({
    transform: [{ translateX: slide.value * COVER * 0.42 }, { rotate: `${spin.value}deg` }],
  }));
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
        <View style={{ width: COVER * 1.45, height: COVER }}>
          <Animated.View style={[styles.vinyl, vinyl]}>
            {[0.92, 0.78, 0.64].map((k) => (
              <View
                key={k}
                style={[
                  styles.groove,
                  { width: COVER * k, height: COVER * k, borderRadius: COVER },
                ]}
              />
            ))}
            <View style={styles.labelDisc}>
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
            <Artwork song={song} size={COVER} />
          </View>
        </View>
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
  stack: { height: COVER + 10, alignSelf: 'center', marginTop: 12, maxWidth: '100%' },
  cover: { position: 'absolute', top: 0 },
  tooltip: {
    position: 'absolute',
    top: -44,
    left: 10,
    minWidth: 140,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    boxShadow: '0 8px 20px rgba(20,22,26,0.2)',
  },
  hint: { fontSize: 13, textAlign: 'center' },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vinyl: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: COVER,
    height: COVER,
    borderRadius: COVER / 2,
    backgroundColor: '#141518',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 18px rgba(0,0,0,0.3)',
  },
  groove: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  labelDisc: {
    width: COVER * 0.36,
    height: COVER * 0.36,
    borderRadius: COVER,
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
