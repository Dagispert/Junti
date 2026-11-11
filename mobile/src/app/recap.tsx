import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InlineVideo, VoiceNote, Waveform } from '@/components/media-players';
import { PolaroidPile, Scribble, Sticker, StickyNote } from '@/components/scrapbook';
import { SkyBadge } from '@/components/sky-badge';
import { Avatar, Photo } from '@/components/ui';
import { WorldMap } from '@/components/world-map';
import { Hand, HandBold } from '@/constants/theme';
import { useStore } from '@/data/store';
import type { Moment, Narration } from '@/data/types';
import { progress, useClock } from '@/lib/clock';
import { usePreview } from '@/lib/music';
import { speechSupported, stopSpeech, unlockSpeech } from '@/lib/speech';
import { Subtitle } from '@/components/subtitle';
import { styleOf } from '@/lib/narrative';
import { buildRecap } from '@/lib/recap';
import { clockIn } from '@/lib/time';

type Slide =
  | { type: 'cover' }
  | { type: 'story' }
  | { type: 'moment'; moment: Moment; line?: string }
  | { type: 'loved'; moment: Moment }
  | { type: 'scene'; line: string }
  | { type: 'stats' }
  | { type: 'end' };

const PAPER = '#F4EFE6';
const INK = '#2A2724';

/**
 * El resumen de una semana o un mes como una historia: avanza sola, se toca a
 * la derecha para seguir y a la izquierda para volver, y se mantiene pulsado
 * para pausar. De fondo, una canción de vuestra banda sonora.
 */
export default function RecapScreen() {
  const { groupId, kind, from } = useLocalSearchParams<{
    groupId: string;
    kind: 'week' | 'month';
    from: string;
  }>();
  const { moments, user, proposals, songs, group, events, narrate } = useStore();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const recap = useMemo(
    () =>
      buildRecap(
        kind === 'month' ? 'month' : 'week',
        Number(from),
        moments.filter((m) => m.groupId === groupId),
        user,
        proposals,
        songs.filter((s) => s.groupId === groupId),
        events.filter((e) => e.groupId === groupId),
      ),
    // Se calcula una vez al abrir: la historia no cambia mientras se ve.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groupId, kind, from],
  );

  // La crónica de la narradora, si el grupo la tiene activada. Mientras se
  // escribe (o si falla) se ven las frases de siempre.
  const narrating = !!group(groupId)?.narrativeEnabled && recap.moments.length > 0;
  const [narration, setNarration] = useState<Narration | null>(null);
  const [writing, setWriting] = useState(false);
  const [narrationNote, setNarrationNote] = useState('');
  const write = async (force = false) => {
    setWriting(true);
    setNarrationNote('');
    try {
      const result = await narrate({
        groupId,
        kind: recap.kind,
        from: recap.from,
        to: recap.to,
        label: recap.range,
        force,
      });
      if (result.narration) {
        setNarration(result.narration);
        if (force) setStory(result.narration);
      }
      if (result.reason === 'limit') setNarrationNote('Ya no quedan más versiones para este resumen.');
    } catch (error) {
      setNarrationNote(error instanceof Error ? error.message : String(error));
    }
    setWriting(false);
  };
  useEffect(() => {
    if (narrating) write();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrating]);

  // La crónica que se cuenta: se fija al salir de la portada, para que la
  // historia no cambie a medias si la narradora termina tarde.
  const [story, setStory] = useState<Narration | null>(null);

  const slides: Slide[] = useMemo(() => {
    const list: Slide[] = [{ type: 'cover' }];
    const scenes = story?.scenes ?? [];
    if (scenes.length) {
      // Cada escena acompaña a su momento; las generales, a un collage.
      for (const scene of scenes) {
        const moment = scene.momentId
          ? recap.moments.find((m) => m.id === scene.momentId)
          : undefined;
        list.push(
          moment
            ? { type: 'moment', moment, line: scene.text }
            : { type: 'scene', line: scene.text },
        );
      }
      list.push({ type: 'stats' }, { type: 'end' });
      return list;
    }
    if (recap.story.length) list.push({ type: 'story' });
    for (const m of recap.picks) list.push({ type: 'moment', moment: m });
    if (recap.loved && recap.loved.reactions.length + recap.loved.comments.length > 1)
      list.push({ type: 'loved', moment: recap.loved });
    list.push({ type: 'stats' }, { type: 'end' });
    return list;
  }, [recap, story]);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const slide = slides[index];
  // Las diapositivas con una frase de la narradora avanzan cuando ella termina.
  const line = 'line' in slide ? slide.line : undefined;
  const [voiceOn, setVoiceOn] = useState(speechSupported);
  const duration = line
    ? (line.length / 15) * 1000 + 1600
    : slide.type === 'story'
      ? 4200 + recap.story.length * 1800
      : slide.type === 'end'
        ? 6000
        : 5200;

  // Reloj de la diapositiva (se reinicia en cada una y se detiene en pausa).
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
  useEffect(() => {
    if (index === 0 && narration && story !== narration) {
      setStory(narration);
      // Que dé tiempo a leer el título de la crónica en la portada.
      elapsed.current = Math.min(elapsed.current, 1500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, narration]);
  // Si la narradora sigue escribiendo, la portada espera (como mucho 25 s).
  const waiting = slide.type === 'cover' && writing && !narration && elapsed.current < 25_000;
  useEffect(() => {
    if (line) return; // la frase de la narradora decide cuándo pasar
    if (elapsed.current >= duration && !waiting && index < slides.length - 1)
      setIndex((i) => i + 1);
  });

  // Banda sonora: una canción del periodo o, si no, la última del grupo.
  const song =
    recap.songs.find((s) => s.preview) ?? songs.find((s) => s.groupId === groupId && s.preview);
  const audio = usePreview(song?.preview, true);
  // La voz en primer plano: la música baja mientras habla la narradora.
  useEffect(() => {
    audio.volume(line && voiceOn ? 0.18 : 0.85);
  });
  const [muted, setMuted] = useState(false);
  const started = useRef(false);
  useEffect(() => {
    if (audio.available && !started.current && !muted) {
      started.current = true;
      audio.toggle();
    }
  });

  const close = () => {
    stopSpeech();
    if (audio.playing) audio.toggle();
    router.back();
  };
  const go = (d: number) => {
    const next = index + d;
    if (next < 0) return;
    if (next >= slides.length) return close();
    setIndex(next);
  };

  const pressStart = useRef(0);
  const touched = useRef(false);
  const t = elapsed.current;
  const first = (id: string) => user(id).name.split(' ')[0];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Barras de progreso */}
      <View style={styles.bars}>
        {slides.map((_, i) => (
          <View key={i} style={styles.bar}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${i < index ? 100 : i > index ? 0 : Math.min(100, (t / duration) * 100)}%`,
                },
              ]}
            />
          </View>
        ))}
      </View>
      <View style={styles.top}>
        <Text style={styles.topTitle}>
          {group(groupId)?.name} · {recap.range}
        </Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {speechSupported && !!story && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={voiceOn ? 'Silenciar a la narradora' : 'Oír a la narradora'}
              onPress={() => setVoiceOn((v) => !v)}
              style={[styles.round, !voiceOn && styles.musicOff]}>
              <Text style={styles.roundText}>{voiceOn ? '🗣️' : '🗣️ Voz'}</Text>
            </Pressable>
          )}
          {audio.available && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={audio.playing ? 'Silenciar música' : 'Poner música'}
              onPress={() => {
                setMuted(audio.playing);
                audio.toggle();
              }}
              style={[styles.round, !audio.playing && styles.musicOff]}>
              <Text style={styles.roundText}>{audio.playing ? '♪' : '♪ Música'}</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar resumen"
            onPress={close}
            style={styles.round}>
            <Text style={styles.roundText}>✕</Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Avanzar"
        style={{ flex: 1 }}
        onPressIn={() => {
          if (!touched.current) {
            touched.current = true;
            unlockSpeech();
          }
          pressStart.current = Date.now();
          setPaused(true);
        }}
        onPressOut={() => setPaused(false)}
        onPress={(e) => {
          if (Date.now() - pressStart.current > 350) return; // fue una pausa, no un toque
          go(e.nativeEvent.locationX < width * 0.3 ? -1 : 1);
        }}>
        <Animated.View key={index} entering={FadeIn.duration(450)} style={styles.slide}>
          {slide.type === 'cover' && (
            <View style={styles.center}>
              {recap.picks.some((m) => m.imageUri || m.videoUri) && (
                <PolaroidPile
                  moments={recap.picks.filter((m) => m.imageUri || m.videoUri)}
                  size={Math.min(width - 40, 340)}
                />
              )}
              <Animated.Text entering={FadeInDown.delay(700).duration(700)} style={styles.big}>
                {recap.title}
              </Animated.Text>
              <Animated.Text entering={FadeInDown.delay(950).duration(700)} style={styles.sub}>
                {recap.range}
                {recap.ongoing ? ' · hasta hoy' : ''}
              </Animated.Text>
              {song && (
                <Animated.Text entering={FadeIn.delay(1500)} style={styles.music}>
                  ♪ {song.title} — {song.artist}
                </Animated.Text>
              )}
              {narration ? (
                <Animated.Text entering={FadeIn.delay(1800)} style={styles.narrator}>
                  ✨ «{narration.title || recap.title}», narrado en estilo{' '}
                  {styleOf(narration.style).label.toLowerCase()}
                </Animated.Text>
              ) : (
                writing && (
                  <Animated.Text entering={FadeIn.delay(1800)} style={styles.narrator}>
                    ✨ La narradora está preparando la historia…
                  </Animated.Text>
                )
              )}
            </View>
          )}

          {slide.type === 'scene' && (
            <View style={[styles.center, { paddingBottom: 170, gap: 18 }]}>
              {recap.picks.some((m) => m.imageUri || m.videoUri) ? (
                <PolaroidPile
                  moments={recap.picks.filter((m) => m.imageUri || m.videoUri)}
                  size={Math.min(width - 60, 320)}
                />
              ) : (
                <Sticker emoji="✨" size={84} rotate={-8} delay={200} />
              )}
              {!!story?.title && <Text style={styles.narrationTitle}>{story.title}</Text>}
            </View>
          )}

          {slide.type === 'story' && (
            <View style={[styles.center, { paddingHorizontal: 28, gap: 22 }]}>
              {recap.story.map((line, i) => (
                <Animated.Text
                  key={i}
                  entering={FadeInDown.delay(300 + i * 1800).duration(900)}
                  style={[styles.storyLine, i === 0 && { fontSize: 26, lineHeight: 33 }]}>
                  {line}
                </Animated.Text>
              ))}
            </View>
          )}

          {(slide.type === 'moment' || slide.type === 'loved') && (
            <MomentSlide
              moment={slide.moment}
              loved={slide.type === 'loved'}
              duration={duration}
              who={user(slide.moment.authorId).name}
              city={user(slide.moment.authorId).city}
              narrated={!!line}
            />
          )}

          {!!line && (
            <Subtitle
              key={`${index}-${line}`}
              text={line}
              voice={voiceOn}
              paused={paused}
              onDone={() => go(1)}
              bottom={insets.bottom + 22}
            />
          )}

          {slide.type === 'stats' && (
            <View style={[styles.center, { gap: 18, paddingHorizontal: 24 }]}>
              <Text style={styles.kicker}>
                {recap.kind === 'week' ? 'La semana en números' : 'El mes en números'}
              </Text>
              <View style={styles.statsGrid}>
                {[
                  [recap.stats.moments, recap.stats.moments === 1 ? 'momento' : 'momentos'],
                  [recap.stats.photos, recap.stats.photos === 1 ? 'foto' : 'fotos'],
                  [recap.stats.reactions, 'reacciones'],
                  [recap.stats.comments, 'comentarios'],
                ].map(([n, label], i) => (
                  <View key={i} style={styles.stat}>
                    <Text style={styles.statN}>
                      {Math.round(Number(n) * progress(t, 200 + i * 150, 900))}
                    </Text>
                    <Text style={styles.statL}>{label}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.people}>
                {recap.authors.map((id, i) => (
                  <Animated.View
                    key={id}
                    entering={ZoomIn.delay(600 + i * 120).springify()}
                    style={{ alignItems: 'center', gap: 4 }}>
                    <Avatar userId={id} size={52} />
                    <Text style={styles.personName}>{first(id)}</Text>
                  </Animated.View>
                ))}
              </View>
              {recap.authors.some((id) => user(id).lat != null) && (
                <View style={{ width: '100%' }}>
                  <WorldMap
                    height={170}
                    bare
                    people={recap.authors
                      .map((id) => user(id))
                      .filter((u) => u.lat != null && u.lng != null)
                      .map((u) => ({ id: u.id, name: u.name, lat: u.lat!, lng: u.lng!, tz: u.tz }))}
                  />
                </View>
              )}
              {recap.stats.cities.length > 0 && (
                <Scribble size={22}>Desde {recap.stats.cities.join(' · ')}</Scribble>
              )}
            </View>
          )}

          {slide.type === 'end' && (
            <View style={[styles.center, { gap: 18 }]}>
              <Sticker emoji="🍍" size={84} rotate={-8} delay={200} />
              <Text style={styles.big}>
                {recap.ongoing ? 'Y la semana sigue…' : 'Hasta la próxima'}
              </Text>
              <Text style={[styles.sub, { textAlign: 'center', paddingHorizontal: 30 }]}>
                {recap.kind === 'week'
                  ? 'Todo esto queda guardado en vuestra memoria.'
                  : 'Un mes más de vida compartida, guardado en vuestra memoria.'}
              </Text>
              <Pressable accessibilityRole="button" onPress={close} style={styles.cta}>
                <Text style={styles.ctaText}>Volver</Text>
              </Pressable>
              {narrating && (
                <Pressable
                  accessibilityRole="button"
                  disabled={writing}
                  onPress={async () => {
                    unlockSpeech();
                    await write(true);
                    setIndex(1);
                  }}
                  style={styles.again}>
                  <Text style={styles.againText}>
                    {writing ? '✨ Escribiendo otra versión…' : '✨ Otra versión de la crónica'}
                  </Text>
                </Pressable>
              )}
              {!!narrationNote && (
                <Text style={[styles.sub, { fontSize: 14, textAlign: 'center', paddingHorizontal: 30 }]}>
                  {narrationNote}
                </Text>
              )}
            </View>
          )}
        </Animated.View>
      </Pressable>
    </View>
  );
}

/** Una foto a lo grande con un lento acercamiento (efecto Ken Burns) y su nota. */
function MomentSlide({
  moment,
  loved,
  duration,
  who,
  city,
  narrated = false,
}: {
  moment: Moment;
  loved: boolean;
  duration: number;
  who: string;
  city: string;
  /** Con subtítulos debajo: la foto sube y se calla la nota de voz. */
  narrated?: boolean;
}) {
  const zoom = useSharedValue(1);
  useEffect(() => {
    zoom.value = withTiming(1.12, { duration: duration + 600, easing: Easing.linear });
  }, [zoom, duration]);
  const ken = useAnimatedStyle(() => ({ transform: [{ scale: zoom.value }] }));
  const emojis = [...new Set(moment.reactions.map((r) => r.emoji))];

  return (
    <View
      style={[styles.center, { paddingHorizontal: 22, gap: 16 }, narrated && { paddingBottom: 170 }]}>
      {loved && <Text style={[styles.kicker, { marginBottom: 18 }]}>Lo que más os llegó</Text>}
      {moment.imageUri || moment.videoUri ? (
        <Animated.View entering={ZoomIn.springify().damping(16)} style={styles.frame}>
          <View style={styles.photoBox}>
            {moment.videoUri ? (
              // En la historia, el vídeo se mueve solo, en silencio y en bucle.
              <InlineVideo
                uri={moment.videoUri}
                muted
                loop
                controls={false}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <Animated.View style={[StyleSheet.absoluteFill, ken]}>
                <Photo moment={moment} style={StyleSheet.absoluteFill} />
              </Animated.View>
            )}
          </View>
          {!!moment.text && (
            <StickyNote
              rotate={5}
              width={150}
              delay={500}
              style={{ position: 'absolute', top: -22, right: -12 }}>
              {moment.text}
            </StickyNote>
          )}
          {emojis.slice(0, 3).map((e, i) => (
            <Sticker
              key={e}
              emoji={e}
              size={50}
              rotate={-12 + i * 12}
              delay={800 + i * 150}
              style={{ position: 'absolute', bottom: -16, right: 10 + i * 44 }}
            />
          ))}
        </Animated.View>
      ) : (
        <Animated.View entering={ZoomIn.springify().damping(15)} style={styles.paper}>
          {moment.text ? (
            <Text style={styles.paperText}>{moment.text}</Text>
          ) : moment.voice ? (
            <View style={{ alignItems: 'center' }}>
              <Waveform wave={moment.voice.waveform} height={110} />
            </View>
          ) : null}
        </Animated.View>
      )}
      <Animated.View entering={FadeInDown.delay(300)} style={styles.byline}>
        <Avatar userId={moment.authorId} size={34} />
        <View>
          <Text style={styles.bylineName}>{who}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <SkyBadge tz={moment.authorTz} at={moment.createdAt} size={14} />
            <Text style={styles.bylineMeta}>
              {new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(moment.createdAt)} ·{' '}
              {clockIn(moment.authorTz, moment.createdAt)}
              {city ? ` en ${city}` : ''}
            </Text>
          </View>
        </View>
      </Animated.View>
      {moment.voice && !narrated && (
        <View style={{ alignSelf: 'stretch' }}>
          <VoiceNote voice={moment.voice} />
        </View>
      )}
      {loved &&
        moment.comments.slice(-2).map((c) => (
          <Scribble key={c.id} size={22} color={INK}>
            «{c.text}»
          </Scribble>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PAPER },
  bars: { flexDirection: 'row', gap: 4, paddingHorizontal: 12, paddingTop: 8 },
  bar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(42,39,36,0.15)',
    overflow: 'hidden',
  },
  barFill: { height: 3, backgroundColor: INK },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  topTitle: { color: 'rgba(42,39,36,0.6)', fontSize: 13, fontWeight: '500' },
  round: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundText: { color: INK, fontSize: 16 },
  musicOff: { width: 'auto', paddingHorizontal: 12 },
  slide: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  big: { color: INK, fontSize: 40, fontWeight: '500', letterSpacing: -1, textAlign: 'center' },
  sub: { color: 'rgba(42,39,36,0.6)', fontSize: 18 },
  music: { fontFamily: Hand, fontSize: 20, color: '#C2477A', marginTop: 8 },
  kicker: { fontFamily: HandBold, fontSize: 30, color: '#C2477A' },
  narrator: { fontFamily: Hand, fontSize: 20, color: '#C2477A', textAlign: 'center' },
  narrationTitle: {
    fontFamily: HandBold,
    fontSize: 34,
    lineHeight: 38,
    color: INK,
    textAlign: 'center',
  },
  again: { paddingVertical: 10, paddingHorizontal: 16 },
  againText: { fontFamily: Hand, fontSize: 21, color: '#C2477A' },
  storyLine: { color: INK, fontSize: 21, lineHeight: 29, letterSpacing: -0.2, textAlign: 'center' },
  frame: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 24,
    transform: [{ rotate: '-2deg' }],
    boxShadow: '0 22px 44px rgba(20,22,26,0.16)',
  },
  photoBox: { width: '100%', aspectRatio: 4 / 5, borderRadius: 16, overflow: 'hidden' },
  paper: {
    width: '86%',
    maxWidth: 360,
    minHeight: 220,
    backgroundColor: '#FFFDF6',
    padding: 28,
    justifyContent: 'center',
    transform: [{ rotate: '2deg' }],
    boxShadow: '0 18px 36px rgba(20,22,26,0.14)',
    borderRadius: 4,
  },
  paperText: { fontFamily: Hand, fontSize: 32, lineHeight: 34, color: INK, textAlign: 'center' },
  byline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'flex-start',
    paddingLeft: 6,
  },
  bylineName: { color: INK, fontSize: 16, fontWeight: '600' },
  bylineMeta: { color: 'rgba(42,39,36,0.6)', fontSize: 13 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  stat: {
    width: 140,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    boxShadow: '0 10px 24px rgba(20,22,26,0.08)',
  },
  statN: { color: INK, fontSize: 40, fontWeight: '600', letterSpacing: -1 },
  statL: { color: 'rgba(42,39,36,0.6)', fontSize: 14 },
  people: { flexDirection: 'row', gap: 14, flexWrap: 'wrap', justifyContent: 'center' },
  personName: { color: INK, fontSize: 13, fontWeight: '500' },
  cta: {
    marginTop: 10,
    backgroundColor: INK,
    paddingHorizontal: 28,
    height: 48,
    borderRadius: 18,
    justifyContent: 'center',
  },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '500' },
});
