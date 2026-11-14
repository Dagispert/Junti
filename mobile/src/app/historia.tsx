import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { MapPin, Plus, Volume2, VolumeX, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGlobePeople } from '@/components/connection-card';
import { GlobeMap } from '@/components/globe-map';
import type { GlobeMemory } from '@/components/globe-map.types';
import { Icon } from '@/components/icon';
import { LogoMark } from '@/components/logo';
import { Hand, HandBold } from '@/constants/theme';
import { useStore } from '@/data/store';
import type { GroupOrigin, Moment, Narration } from '@/data/types';
import { useClock } from '@/lib/clock';
import { narratorAudio, stopNarrator } from '@/lib/narrator';
import { buildStory, type Gap, gapLabel, parseGap, templateScenes } from '@/lib/story';

type Scene = (
  | { type: 'origin'; text: string; origin?: GroupOrigin }
  | { type: 'memory'; text: string; moment: Moment }
  | { type: 'gap'; text: string; gap: Gap }
  | { type: 'end'; text: string }
  | { type: 'line'; text: string }
) & { chapter?: string };

const INK = '#1F2124';

/**
 * «Nuestra historia» contada por la narradora: el planeta viaja de un recuerdo
 * a otro, en orden, desde donde empezó todo. Cuando hay años sin nada, lo
 * dice y pregunta qué pasó (con un botón para contarlo). Se toca a la derecha
 * para seguir y a la izquierda para volver.
 */
export default function StoryScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { group: groupById, moments, narrate } = useStore();
  const group = groupById(groupId);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const people = useGlobePeople(group);

  // Lo que hay al abrir (no cambia mientras se cuenta).
  const story = useMemo(
    () =>
      buildStory(
        group?.origins ?? [],
        moments.filter((m) => m.groupId === groupId),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groupId],
  );

  // La crónica de la narradora (si está activada); si no, frases sencillas.
  const narrating = !!group?.narrativeEnabled;
  const [narration, setNarration] = useState<Narration | null>(null);
  const [state, setState] = useState<'writing' | 'voicing' | 'ready'>(
    narrating ? 'writing' : 'ready',
  );
  const [note, setNote] = useState('');
  useEffect(() => {
    if (!narrating) return;
    let alive = true;
    const args = { groupId, kind: 'story' as const, from: 0, to: 0, label: 'Nuestra historia' };
    (async () => {
      try {
        const result = await narrate(args);
        if (!alive) return;
        let text = result.narration;
        if (result.reason === 'resting')
          setNote('Versión corta: la narradora está descansando y vuelve en un rato.');
        if (text) setNarration(text);
        if (text && !text.audioUrl) {
          setState('voicing');
          const voiced = await narrate({ ...args, action: 'voice' });
          if (voiced.narration?.id === text.id) text = voiced.narration;
          if (alive) setNarration(text);
        }
      } catch (error) {
        if (alive) setNote(error instanceof Error ? error.message : String(error));
      }
      if (alive) setState('ready');
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, narrating]);

  const scenes: Scene[] = useMemo(() => {
    const raw = narration?.scenes?.length ? narration.scenes : templateScenes(story.items);
    const base = raw.map((e): Scene => {
      const memory = story.memories.find((m) => m.id === e.momentId);
      if (memory) return { type: 'memory', text: e.text, moment: memory };
      if (e.momentId === 'origin') {
        const first = story.items.find((i) => i.type === 'origin');
        return {
          type: 'origin',
          text: e.text,
          origin: first?.type === 'origin' ? first.origin : undefined,
        };
      }
      const gap = parseGap(e.momentId);
      if (gap) return { type: 'gap', text: e.text, gap };
      if (e.momentId === 'end') return { type: 'end', text: e.text };
      return { type: 'line', text: e.text };
    });
    return base.map((x, i) => (raw[i].chapter ? { ...x, chapter: raw[i].chapter } : x));
  }, [narration, story]);
  // Los capítulos: en qué capítulo está cada escena (número y nombre).
  const chapterAt = useMemo(() => {
    let n = 0;
    let name = '';
    return scenes.map((x) => {
      if (x.chapter) {
        n += 1;
        name = x.chapter;
      }
      return n ? { n, name } : null;
    });
  }, [scenes]);

  // -1: la portada, mientras la narradora escribe y pone voz (como mucho 40 s).
  const [index, setIndex] = useState(-1);
  const [paused, setPaused] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const scene = index >= 0 ? scenes[index] : undefined;

  const elapsed = useRef(0);
  const tick = useClock(!paused);
  const lastTick = useRef(tick);
  if (tick !== lastTick.current) {
    if (!paused) elapsed.current += Math.max(0, Math.min(100, tick - lastTick.current));
    lastTick.current = tick;
  }
  useEffect(() => {
    elapsed.current = 0;
  }, [index]);

  // La voz: un solo audio, cada escena es un tramo.
  const voice = narration?.audioUrl && narration.sceneTimes?.length ? narration : null;
  const player = narratorAudio();
  useEffect(() => {
    if (!player || !voice?.audioUrl) return;
    player.src = voice.audioUrl;
    player.load();
  }, [player, voice?.audioUrl]);
  useEffect(() => () => stopNarrator(), []);
  const times = voice?.sceneTimes ?? [];
  const start = index >= 0 ? (times[index] ?? 0) : 0;
  const end =
    index >= 0 ? (times[index + 1] ?? voice?.audioDuration ?? player?.duration ?? start + 8) : 0;
  const voiced = !!(voice && player && index >= 0);
  useEffect(() => {
    if (!player) return;
    if (!voiced) {
      player.pause();
      return;
    }
    if (player.currentTime < start - 0.4 || player.currentTime > end - 0.1) {
      player.currentTime = start;
    }
    if (paused) player.pause();
    else player.play().catch(() => {});
  }, [player, voiced, index, paused, start, end]);
  useEffect(() => {
    if (player) player.muted = !voiceOn;
  }, [player, voiceOn]);

  const text = scene?.text ?? '';
  const duration = (text.length / 14) * 1000 + 2000;
  const now = voiced ? player!.currentTime : 0;
  const said = voiced
    ? Math.max(0, Math.min(1, (now - start) / Math.max(0.5, end - start)))
    : Math.min(1, elapsed.current / (duration - 1200));

  // Avanzar: con la voz, al terminar su tramo; sin ella, por tiempo.
  const last = index === scenes.length - 1;
  useEffect(() => {
    if (paused) return;
    if (index === -1) {
      const waiting = state !== 'ready' && elapsed.current < 40_000;
      if (!waiting && elapsed.current > 2600) setIndex(0);
      return;
    }
    if (last) return; // la última se queda, con sus botones
    if (voiced ? now >= end - 0.05 || player!.ended : elapsed.current >= duration)
      setIndex((i) => i + 1);
  });

  const close = () => {
    stopNarrator();
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/group/[id]/memoria', params: { id: groupId } });
  };
  const go = (d: number) => setIndex((i) => Math.max(0, Math.min(scenes.length - 1, i + d)));
  const addMemory = (year?: number) => {
    stopNarrator();
    router.push({
      pathname: '/publish',
      params: { groupId, memory: '1', ...(year ? { year: String(year) } : {}) },
    });
  };

  // Dónde mira el planeta: el sitio del recuerdo o del origen; si no, el mundo.
  const point =
    scene?.type === 'memory' && scene.moment.place
      ? { lat: scene.moment.place.lat, lng: scene.moment.place.lng }
      : scene?.type === 'origin' && scene.origin?.lat != null && scene.origin.lng != null
        ? { lat: scene.origin.lat, lng: scene.origin.lng! }
        : null;
  const pins: GlobeMemory[] = useMemo(
    () =>
      story.memories
        .filter((m) => m.place)
        .map((m) => ({ id: m.id, lat: m.place!.lat, lng: m.place!.lng, photo: m.imageUri })),
    [story],
  );
  const year =
    scene?.type === 'memory'
      ? new Date(scene.moment.createdAt).getFullYear()
      : scene?.type === 'origin'
        ? scene.origin?.year
        : scene?.type === 'gap'
          ? gapLabel(scene.gap)
          : undefined;

  // El subtítulo: la parte ya dicha, y el resto reservando su sitio.
  const at = Math.floor(text.length * said);
  // Una frase cada vez: la que se está diciendo.
  const sentences: { start: number; end: number }[] = [];
  for (const m of text.matchAll(/[^.?!…]+[.?!…»]*/g)) {
    const lead = m[0].length - m[0].trimStart().length;
    if (m[0].trim()) sentences.push({ start: m.index! + lead, end: m.index! + m[0].length });
  }
  const cur = [...sentences].reverse().find((x) => x.start <= Math.max(at, 1)) ??
    sentences[0] ?? { start: 0, end: text.length };
  const shown = text.slice(cur.start, Math.max(cur.start + 1, Math.min(at + 2, cur.end)));
  const hidden = text.slice(cur.start + shown.length, cur.end);
  const card = Math.min(width * 0.62, 300);

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#FFFFFF', '#E7F5F8', '#D5ECF1']} style={StyleSheet.absoluteFill} />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <GlobeMap
          people={people}
          height={height}
          distScale={point ? 1.05 : 1.45}
          shiftY={0.12}
          interactive={false}
          transparent
          hidePeople={scene?.type !== 'end'}
          focusPoint={point}
          memories={pins}
        />
      </View>

      {/* Tocar a la izquierda: volver; a la derecha: seguir. Mantener: pausa. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Seguir"
        onPressIn={() => setPaused(true)}
        onPressOut={() => setPaused(false)}
        onPress={(e) => {
          if (index === -1) return setIndex(0);
          go(e.nativeEvent.locationX < width * 0.3 ? -1 : 1);
        }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.bars}>
          {scenes.map((_, i) => (
            <View key={i} style={styles.bar}>
              <View
                style={[
                  styles.barFill,
                  { width: `${i < index ? 100 : i > index ? 0 : Math.min(100, said * 100)}%` },
                ]}
              />
            </View>
          ))}
        </View>
        <View style={styles.topRow}>
          <Text style={styles.topTitle} numberOfLines={1}>
            {group?.name} · Nuestra historia
          </Text>
          {!!voice && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={voiceOn ? 'Silenciar a la narradora' : 'Oír a la narradora'}
              onPress={() => setVoiceOn((v) => !v)}
              style={styles.round}>
              <Icon icon={voiceOn ? Volume2 : VolumeX} color={INK} />
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar la historia"
            onPress={close}
            style={styles.round}>
            <Icon icon={X} color={INK} />
          </Pressable>
        </View>
      </View>

      {index === -1 ? (
        <Animated.View
          entering={FadeIn.duration(700)}
          exiting={FadeOut.duration(400)}
          pointerEvents="none"
          style={[styles.cover, { top: height * 0.16 }]}>
          <LogoMark size={44} />
          <Text style={styles.coverTitle}>{narration?.title || 'Nuestra historia'}</Text>
          <Text style={styles.coverSub}>
            {state === 'writing'
              ? 'La narradora está repasando vuestros recuerdos…'
              : state === 'voicing'
                ? 'Poniéndole voz…'
                : `Desde ${story.items.find((i) => i.type === 'origin')?.type === 'origin' ? 'donde empezó todo' : 'el primer recuerdo'}`}
          </Text>
        </Animated.View>
      ) : (
        <>
          {year != null && (
            <Animated.Text
              key={`y-${index}`}
              entering={FadeIn.duration(600)}
              style={[styles.year, { top: insets.top + 64 }]}>
              {year}
            </Animated.Text>
          )}
          {/* El capítulo en el que estamos, discreto bajo la cabecera. */}
          {!!chapterAt[index] && (
            <Text
              numberOfLines={1}
              pointerEvents="none"
              style={[styles.chapterLine, { top: insets.top + 48 }]}>
              Capítulo {chapterAt[index]!.n} · {chapterAt[index]!.name}
            </Text>
          )}
          {/* La tarjeta de la escena */}
          <View style={[styles.cardWrap, { top: insets.top + 120 }]} pointerEvents="box-none">
            {scene?.type === 'memory' && (scene.moment.imageUri || scene.moment.text) && (
              <Animated.View
                key={`c-${index}`}
                entering={ZoomIn.duration(520)}
                pointerEvents="none"
                style={[
                  styles.polaroid,
                  { width: card, transform: [{ rotate: `${index % 2 ? 3 : -3}deg` }] },
                ]}>
                {scene.moment.imageUri ? (
                  <Image
                    source={{ uri: scene.moment.imageUri }}
                    style={{ width: card - 16, height: card - 16, borderRadius: 2 }}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.paper, { width: card - 16, height: card * 0.7 }]}>
                    <Text numberOfLines={6} style={styles.paperText}>
                      {scene.moment.text}
                    </Text>
                  </View>
                )}
                {!!scene.moment.place && (
                  <Text numberOfLines={1} style={styles.caption}>
                    {scene.moment.place.name.split(',')[0]}
                  </Text>
                )}
              </Animated.View>
            )}
            {scene?.type === 'origin' && (
              <Animated.View
                key={`c-${index}`}
                entering={ZoomIn.duration(520)}
                pointerEvents="none"
                style={styles.pill}>
                <Icon icon={MapPin} size={18} color="#C2477A" />
                <Text style={styles.pillText}>
                  Aquí empezó todo
                  {scene.origin ? ` · ${scene.origin.place.split(',')[0]}` : ''}
                </Text>
              </Animated.View>
            )}
            {(scene?.type === 'gap' || scene?.type === 'end') && (
              <Animated.View key={`c-${index}`} entering={ZoomIn.duration(520)}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    addMemory(
                      scene.type === 'gap'
                        ? Math.round((scene.gap.from + scene.gap.to) / 2)
                        : undefined,
                    )
                  }
                  style={styles.ask}>
                  <Icon icon={Plus} size={18} color="#FFFFFF" />
                  <Text style={styles.askText}>
                    {scene.type === 'gap'
                      ? `Contar qué pasó en ${gapLabel(scene.gap)}`
                      : 'Añadir un recuerdo'}
                  </Text>
                </Pressable>
              </Animated.View>
            )}
          </View>

          {/* Subtítulo */}
          <View
            style={[styles.subtitle, { bottom: insets.bottom + (last ? 110 : 56) }]}
            pointerEvents="none">
            <Text style={styles.subtitleText}>
              {shown}
              <Text style={{ color: 'transparent' }}>{hidden}</Text>
            </Text>
          </View>
          {last && (
            <Animated.View
              entering={FadeIn.delay(600)}
              style={[styles.endRow, { bottom: insets.bottom + 40 }]}>
              <Pressable accessibilityRole="button" onPress={() => setIndex(0)} hitSlop={8}>
                <Text style={styles.endLink}>Volver a empezar</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={close} hitSlop={8}>
                <Text style={styles.endLink}>Cerrar</Text>
              </Pressable>
            </Animated.View>
          )}
        </>
      )}
      {/* Al empezar un capítulo, su título a toda pantalla, como en un libro. */}
      {!!scene?.chapter && elapsed.current < 2600 && (
        <Animated.View
          key={`cap-${index}`}
          entering={FadeIn.duration(500)}
          exiting={FadeOut.duration(700)}
          pointerEvents="none"
          style={styles.chapterCard}>
          <Text style={styles.chapterNo}>Capítulo {chapterAt[index]?.n}</Text>
          <Text style={styles.chapterName}>{scene.chapter}</Text>
          <View style={styles.chapterRule} />
        </Animated.View>
      )}
      {!!note && index <= 0 && (
        <Text style={[styles.note, { bottom: insets.bottom + 14 }]} pointerEvents="none">
          {note}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#E7F5F8' },
  top: { position: 'absolute', left: 0, right: 0, paddingHorizontal: 14, gap: 10 },
  bars: { flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(31,33,36,0.15)' },
  barFill: { height: 3, borderRadius: 2, backgroundColor: INK },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topTitle: { flex: 1, color: INK, fontSize: 15, fontWeight: '600' },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cover: { position: 'absolute', left: 24, right: 24, alignItems: 'center', gap: 10 },
  coverTitle: { fontFamily: HandBold, fontSize: 44, color: INK, textAlign: 'center' },
  coverSub: { fontFamily: Hand, fontSize: 22, color: '#5A6168', textAlign: 'center' },
  year: {
    position: 'absolute',
    alignSelf: 'center',
    fontFamily: HandBold,
    fontSize: 42,
    color: '#C2477A',
    textShadowColor: 'rgba(255,255,255,0.95)',
    textShadowRadius: 12,
  },
  chapterLine: {
    position: 'absolute',
    left: 24,
    right: 24,
    textAlign: 'center',
    fontFamily: Hand,
    fontSize: 18,
    color: '#5A6168',
  },
  chapterCard: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 32,
    backgroundColor: 'rgba(250,247,240,0.94)',
    zIndex: 20,
  },
  chapterNo: { fontSize: 14, letterSpacing: 2, color: '#A86A1F', fontWeight: '600' },
  chapterName: {
    fontFamily: HandBold,
    fontSize: 46,
    lineHeight: 50,
    color: INK,
    textAlign: 'center',
  },
  chapterRule: { width: 56, height: 2, borderRadius: 1, backgroundColor: '#A86A1F', marginTop: 4 },
  cardWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  polaroid: {
    backgroundColor: '#FFFFFF',
    padding: 8,
    paddingBottom: 4,
    borderRadius: 3,
    boxShadow: '0 18px 40px rgba(20,40,60,0.28)',
  },
  paper: { backgroundColor: '#F7F0E2', padding: 14, justifyContent: 'center' },
  paperText: {
    fontFamily: Hand,
    fontSize: 24,
    lineHeight: 25,
    color: '#3C3F44',
    textAlign: 'center',
  },
  caption: { fontFamily: Hand, fontSize: 20, color: '#2A2A2A', textAlign: 'center', marginTop: 2 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 999,
    boxShadow: '0 10px 30px rgba(20,40,60,0.18)',
  },
  pillText: { color: INK, fontSize: 16, fontWeight: '600' },
  ask: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: INK,
    paddingHorizontal: 18,
    height: 48,
    borderRadius: 999,
    boxShadow: '0 10px 30px rgba(20,40,60,0.25)',
  },
  askText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  subtitle: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignSelf: 'center',
    maxWidth: 560,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.8)',
    boxShadow: '0 10px 30px rgba(20,40,60,0.12)',
  },
  subtitleText: {
    fontFamily: Hand,
    color: INK,
    fontSize: 28,
    lineHeight: 33,
    textAlign: 'center',
  },
  endRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 28,
  },
  endLink: { color: INK, fontSize: 16, fontWeight: '600', textDecorationLine: 'underline' },
  note: {
    position: 'absolute',
    left: 24,
    right: 24,
    textAlign: 'center',
    color: '#5A6168',
    fontSize: 13,
  },
});
