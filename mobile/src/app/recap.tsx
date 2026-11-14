import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { LogoMark } from '@/components/logo';
import { Atmosphere } from '@/components/atmosphere';
import {
  Captions,
  EXIT_MS,
  filmLayout,
  LinesShot,
  MomentShot,
  Move,
  NumbersShot,
  TitleShot,
  tone,
} from '@/components/film';
import { VoiceNote } from '@/components/media-players';
import { WorldMap } from '@/components/world-map';
import { Hand } from '@/constants/theme';
import { useStore } from '@/data/store';
import type { Moment, Narration } from '@/data/types';
import { useClock } from '@/lib/clock';
import {
  isDark,
  moodOf,
  nightness,
  type SceneLook,
  shotFor,
  type Sky,
  skyFromWeather,
  travelBetween,
  weatherWords,
  whereOf,
} from '@/lib/film';
import { localHour } from '@/lib/geo';
import { usePreview } from '@/lib/music';
import { narratorAudio, narratorStream, primeNarrator, stopNarrator } from '@/lib/narrator';
import { styleOf } from '@/lib/narrative';
import { buildRecap } from '@/lib/recap';
import { clockIn } from '@/lib/time';
import { fetchWeatherAt, type PastWeather } from '@/lib/weather';
import { Music, Share, Volume2, VolumeX, X } from 'lucide-react-native';
import { useExport } from '@/components/export-sheet';
import {
  canRecordScreen,
  NO_REC,
  prepareRecording,
  preloadImages,
  recordScreen,
} from '@/lib/dom-recorder';

type Slide =
  | { type: 'cover' }
  | { type: 'story' }
  | { type: 'moment'; moment: Moment; line?: string; scene?: number }
  | { type: 'loved'; moment: Moment }
  | { type: 'scene'; line: string; scene: number }
  | { type: 'stats'; line?: string; scene?: number }
  | { type: 'end'; line?: string; scene?: number };

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
  const { width, height } = useWindowDimensions();

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

  // La crónica de la narradora, si el grupo la tiene activada: primero el
  // texto y luego su voz. Mientras tanto (o si falla) se ven las frases de siempre.
  const narrating = !!group(groupId)?.narrativeEnabled && recap.moments.length > 0;
  const [narration, setNarration] = useState<Narration | null>(null);
  const [writing, setWriting] = useState(false);
  const [voicing, setVoicing] = useState(false);
  const [narrationNote, setNarrationNote] = useState('');
  // La crónica que se cuenta: se fija al salir de la portada, para que la
  // historia no cambie a medias si la narradora termina tarde.
  const [story, setStory] = useState<Narration | null>(null);
  const write = async (force = false) => {
    setWriting(true);
    setNarrationNote('');
    const args = {
      groupId,
      kind: recap.kind,
      from: recap.from,
      to: recap.to,
      label: recap.range,
    };
    try {
      const result = await narrate({ ...args, force });
      let text = result.narration;
      if (text) {
        setNarration(text);
        if (force) setStory(text);
      }
      if (result.reason === 'limit')
        setNarrationNote('Ya no quedan más versiones para este resumen.');
      if (result.reason === 'resting')
        setNarrationNote('Versión corta: la narradora está descansando y vuelve en un rato.');
      setWriting(false);
      if (text && !text.audioUrl) {
        setVoicing(true);
        const voiced = await narrate({ ...args, action: 'voice' });
        if (voiced.narration?.id === text.id && voiced.narration.generations === text.generations) {
          text = voiced.narration;
          setNarration(text);
          setStory((current) => (current?.id === text!.id ? text : current));
        }
      }
    } catch (error) {
      setNarrationNote(error instanceof Error ? error.message : String(error));
    }
    setWriting(false);
    setVoicing(false);
  };
  useEffect(() => {
    if (narrating) write();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrating]);

  const slides: Slide[] = useMemo(() => {
    const list: Slide[] = [{ type: 'cover' }];
    const scenes = story?.scenes ?? [];
    if (scenes.length) {
      // Cada escena acompaña a su momento; las cifras y la despedida, a sus
      // diapositivas; las generales, a un collage.
      scenes.forEach((e, scene) => {
        const moment = recap.moments.find((m) => m.id === e.momentId);
        if (moment) list.push({ type: 'moment', moment, line: e.text, scene });
        else if (e.momentId === 'stats') list.push({ type: 'stats', line: e.text, scene });
        else if (e.momentId === 'end') list.push({ type: 'end', line: e.text, scene });
        else list.push({ type: 'scene', line: e.text, scene });
      });
      if (!list.some((x) => x.type === 'stats')) list.push({ type: 'stats' });
      if (!list.some((x) => x.type === 'end')) list.push({ type: 'end' });
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
  const line = 'line' in slide ? slide.line : undefined;
  const scene = 'scene' in slide ? slide.scene : undefined;
  const [voiceOn, setVoiceOn] = useState(true);
  const duration = line
    ? (line.length / 15) * 1000 + 1800
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
    if (index === 0 && narration && story?.id !== narration.id) {
      setStory(narration);
      // Que dé tiempo a leer el título de la crónica en la portada.
      elapsed.current = Math.min(elapsed.current, 1500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, narration]);

  // La voz: un solo audio con toda la crónica; cada escena es un tramo.
  const voice = story?.audioUrl && story.sceneTimes?.length ? story : null;
  const player = narratorAudio();
  useEffect(() => {
    if (!player || !voice?.audioUrl) return;
    player.src = voice.audioUrl;
    player.load();
  }, [player, voice?.audioUrl]);
  useEffect(() => () => stopNarrator(), []);
  const times = voice?.sceneTimes ?? [];
  const sceneStart = scene !== undefined ? (times[scene] ?? 0) : 0;
  const sceneEnd =
    scene !== undefined
      ? (times[scene + 1] ?? voice?.audioDuration ?? player?.duration ?? sceneStart + 8)
      : 0;
  const voiced = !!(voice && player && scene !== undefined);
  // Colocar la voz en el tramo de esta escena y que hable (o calle en pausa).
  useEffect(() => {
    if (!player) return;
    if (!voiced) {
      player.pause();
      return;
    }
    if (player.currentTime < sceneStart - 0.4 || player.currentTime > sceneEnd - 0.1) {
      player.currentTime = sceneStart;
    }
    if (paused) player.pause();
    else player.play().catch(() => {});
  }, [player, voiced, index, paused, sceneStart, sceneEnd]);
  useEffect(() => {
    if (player) player.muted = !voiceOn;
  }, [player, voiceOn]);
  const now = voiced ? player!.currentTime : 0;
  const said = voiced ? Math.max(0, Math.min(1, (now - sceneStart) / (sceneEnd - sceneStart))) : 0;
  // Cuando la voz llega al final de su tramo, pasa a la siguiente foto.
  useEffect(() => {
    if (!voiced || paused || index >= slides.length - 1) return;
    const last = scene === times.length - 1;
    if (last ? player!.ended : now >= sceneEnd - 0.05) setIndex((i) => i + 1);
  });

  // Si la narradora sigue escribiendo o poniendo voz, la portada espera (hasta 30 s).
  const waiting =
    slide.type === 'cover' &&
    ((writing && !narration) || (voicing && !narration?.audioUrl)) &&
    elapsed.current < 30_000;
  useEffect(() => {
    if (line) return; // la narradora decide cuándo pasar
    if (elapsed.current >= duration && !waiting && index < slides.length - 1)
      setIndex((i) => i + 1);
  });

  // Banda sonora: una canción del periodo o, si no, la última del grupo.
  const song =
    recap.songs.find((s) => s.preview) ?? songs.find((s) => s.groupId === groupId && s.preview);
  const audio = usePreview(song?.preview, true);
  // La voz en primer plano: la música baja mientras habla la narradora.
  useEffect(() => {
    audio.volume(voiced && voiceOn && !paused ? 0.05 : 0.85);
  });
  const [muted, setMuted] = useState(false);
  const started = useRef(false);
  useEffect(() => {
    if (audio.available && !started.current && !muted) {
      started.current = true;
      audio.toggle();
    }
  });

  // Exportar como vídeo: se graba la pantalla tal cual mientras se vuelve a
  // contar desde la portada, con sus animaciones y la voz de la narradora.
  const exporter = useExport();
  const rootRef = useRef<unknown>(null);
  const recorder = useRef<ReturnType<typeof recordScreen> | null>(null);
  const finishing = useRef(false);
  const restarted = useRef(false);
  useEffect(() => {
    prepareRecording().catch(() => {});
  }, []);
  const exportVideo = async () => {
    const root = rootRef.current as unknown as HTMLElement | null;
    if (!root) return;
    const voiceTrack = voice ? narratorStream() : null; // dentro del toque
    finishing.current = false;
    restarted.current = false;
    setPaused(true);
    await preloadImages(
      root,
      recap.moments.map((m) => m.imageUri),
    );
    setPaused(false);
    setIndex(0);
    elapsed.current = 0;
    recorder.current = recordScreen(root, { audio: voiceTrack });
    exporter.recording(() => {
      recorder.current?.cancel();
      recorder.current = null;
    });
  };
  const lastSlide = index === slides.length - 1;
  useEffect(() => {
    if (!exporter.live || !recorder.current) return;
    exporter.progress(Math.min(1, (index + Math.min(1, barFill)) / Math.max(1, slides.length)));
    if (index === 0) restarted.current = true;
    if (!restarted.current) return;
    const done =
      lastSlide && (voiced ? player!.ended || now >= sceneEnd - 0.05 : elapsed.current >= duration);
    if (done && !finishing.current) {
      finishing.current = true;
      setTimeout(async () => {
        const rec = recorder.current;
        recorder.current = null;
        if (!rec) return;
        const blob = await rec.stop();
        exporter.ready(
          blob,
          recap.kind === 'week' ? 'junti-semana' : 'junti-mes',
          `${group(groupId)?.name ?? 'Junti'} · ${recap.range}`,
        );
      }, 1200);
    }
  });

  const close = () => {
    stopNarrator();
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
  const barFill = voiced ? said : t / duration;
  const first = (id: string) => user(id).name.split(' ')[0];

  // ── La película ──
  const layout = filmLayout(width, height, insets.top);
  // El tiempo que hacía donde y cuando se compartió cada momento (para su cielo).
  const [weather, setWeather] = useState<Record<string, PastWeather>>({});
  useEffect(() => {
    let alive = true;
    for (const m of recap.moments) {
      const where = whereOf(m, user(m.authorId));
      if (where.lat == null || where.lng == null) continue;
      fetchWeatherAt(where.lat, where.lng, m.createdAt).then(
        (w) => alive && w && setWeather((all) => ({ ...all, [m.id]: w })),
      );
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recap]);

  // Cómo se ve cada escena: su cielo, su ambiente, su plano y su rótulo.
  const looks: SceneLook[] = useMemo(() => {
    let nth = 0;
    let before: ReturnType<typeof whereOf> & { tz?: string } = null as never;
    const titleSky = (hour: number, cover = 0.1): Sky => ({
      hour,
      cover,
      precip: 'none',
      fog: false,
    });
    return slides.map((sl) => {
      const line = 'line' in sl ? sl.line : undefined;
      if (sl.type === 'moment' || sl.type === 'loved') {
        const m = sl.moment;
        const author = user(m.authorId);
        const where = { ...whereOf(m, author), tz: m.authorTz };
        const hour = localHour(m.authorTz, m.createdAt);
        const w = weather[m.id];
        const sky = skyFromWeather(hour, w?.code);
        const mood =
          (sky.precip === 'rain' ? 'lluvia' : sky.precip === 'snow' ? 'nieve' : null) ??
          moodOf(
            m.text,
            line,
            ...m.comments.map((c) => c.text),
            ...m.reactions.map((r) => r.emoji),
          ) ??
          (nightness(hour) > 0.6 ? 'noche' : 'calma');
        const day = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(m.createdAt);
        const look: SceneLook = {
          shot: shotFor(m, nth),
          sky,
          mood,
          dark: isDark(sky),
          place: where.name,
          when: [day, clockIn(m.authorTz, m.createdAt), w ? weatherWords(w.code, w.temp, hour) : '']
            .filter(Boolean)
            .join(' · '),
          travel: travelBetween(before, where, m.createdAt, m.id),
        };
        nth += 1;
        before = where;
        return look;
      }
      if (sl.type === 'stats') {
        const sky = titleSky(12.5, 0.15);
        return { shot: 'numbers', sky, mood: 'alegria', dark: isDark(sky) };
      }
      if (sl.type === 'end') {
        const sky = titleSky(recap.ongoing ? 19.6 : 21.4, 0.1);
        return {
          shot: 'finale',
          sky,
          mood: recap.ongoing ? 'nostalgia' : 'noche',
          dark: isDark(sky),
        };
      }
      if (sl.type === 'cover') {
        // La portada amanece: la historia empieza.
        const sky = titleSky(7.2, 0.15);
        return { shot: 'title', sky, mood: 'calma', dark: isDark(sky) };
      }
      const sky = titleSky(17.6, 0.25);
      const mood = moodOf(line) ?? 'nostalgia';
      return { shot: sl.type === 'story' ? 'lines' : 'montage', sky, mood, dark: isDark(sky) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides, weather]);
  const look = looks[index] ?? looks[0];
  const ink = tone(look.dark);

  // La escena que se va sigue un momento en pantalla mientras sale.
  const [leavingIndex, setLeavingIndex] = useState<number | null>(null);
  const prevIndex = useRef(index);
  useEffect(() => {
    if (prevIndex.current === index) return;
    const was = prevIndex.current;
    prevIndex.current = index;
    setLeavingIndex(was);
    const id = setTimeout(() => setLeavingIndex(null), EXIT_MS + 40);
    return () => clearTimeout(id);
  }, [index]);

  const nthOf = (i: number) =>
    slides.slice(0, i).filter((x) => x.type === 'moment' || x.type === 'loved').length;
  const picks = recap.picks.filter((m) => m.imageUri);

  const renderSlide = (i: number, leaving: boolean) => {
    const sl = slides[i];
    const lk = looks[i];
    if (!sl || !lk) return null;
    const key = `s-${i}`;
    if (sl.type === 'moment' || sl.type === 'loved')
      return (
        <MomentShot
          key={key}
          moment={sl.moment}
          look={lk}
          name={first(sl.moment.authorId)}
          kicker={sl.type === 'loved' ? 'Lo que más os llegó' : undefined}
          leaving={leaving}
          duration={duration}
          layout={layout}
          nth={nthOf(i)}
        />
      );
    if (sl.type === 'cover')
      return (
        <TitleShot
          key={key}
          look={lk}
          picks={picks}
          kicker={recap.kind === 'week' ? 'Vuestra semana' : 'Vuestro mes'}
          title={story?.title || recap.range}
          lines={[
            ...(story?.title
              ? [{ text: `${recap.range}${recap.ongoing ? ' · hasta hoy' : ''}` }]
              : []),
            ...(song
              ? [{ text: `♪ ${song.title} — ${song.artist}`, hand: true, accent: true }]
              : []),
            ...(narration
              ? [
                  {
                    text: `Narrado en estilo ${styleOf(narration.style).label.toLowerCase()}`,
                    hand: true,
                  },
                ]
              : writing
                ? [{ text: 'La narradora está preparando la historia…', hand: true }]
                : []),
          ]}
          leaving={leaving}
          layout={layout}
        />
      );
    if (sl.type === 'scene')
      return (
        <TitleShot
          key={key}
          look={lk}
          picks={picks}
          title={i === 1 ? story?.title || '' : ''}
          leaving={leaving}
          layout={layout}
        />
      );
    if (sl.type === 'story')
      return <LinesShot key={key} look={lk} lines={recap.story} leaving={leaving} />;
    if (sl.type === 'stats') {
      const placed = recap.authors
        .map((id) => user(id))
        .filter((u) => u.lat != null && u.lng != null);
      return (
        <NumbersShot
          key={key}
          look={lk}
          kicker={recap.kind === 'week' ? 'La semana en números' : 'El mes en números'}
          stats={[
            { n: recap.stats.moments, label: recap.stats.moments === 1 ? 'momento' : 'momentos' },
            { n: recap.stats.photos, label: recap.stats.photos === 1 ? 'foto' : 'fotos' },
            { n: recap.stats.reactions, label: 'reacciones' },
            { n: recap.stats.comments, label: 'comentarios' },
          ]}
          authors={recap.authors}
          first={first}
          cities={recap.stats.cities}
          leaving={leaving}
          layout={layout}>
          {placed.length > 0 && (
            <WorldMap
              height={150}
              bare
              people={placed.map((u) => ({
                id: u.id,
                name: u.name,
                lat: u.lat!,
                lng: u.lng!,
                tz: u.tz,
              }))}
            />
          )}
        </NumbersShot>
      );
    }
    // El final: todas las fotos vuelven volando y se despiden.
    return (
      <TitleShot
        key={key}
        look={lk}
        picks={picks}
        gather
        title={recap.ongoing ? 'Y la semana sigue…' : 'Hasta la próxima'}
        lines={[
          {
            text:
              recap.kind === 'week'
                ? 'Todo esto queda guardado en vuestra memoria.'
                : 'Un mes más de vida compartida, guardado en vuestra memoria.',
          },
        ]}
        leaving={leaving}
        layout={layout}>
        {!leaving && (
          <Move from={{ y: 16 }} delay={1300} style={{ alignItems: 'center', gap: 6 }}>
            <View {...NO_REC} style={{ alignItems: 'center', gap: 6 }}>
              <Pressable accessibilityRole="button" onPress={close} style={styles.cta}>
                <Text style={styles.ctaText}>Volver</Text>
              </Pressable>
              {narrating && (
                <Pressable
                  accessibilityRole="button"
                  disabled={writing}
                  onPress={async () => {
                    primeNarrator();
                    await write(true);
                    setIndex(1);
                  }}
                  style={styles.again}>
                  <Text style={[styles.againText, { color: ink.accent }]}>
                    {writing ? 'Escribiendo otra versión…' : 'Otra versión de la crónica'}
                  </Text>
                </Pressable>
              )}
              {!!narrationNote && (
                <Text style={[styles.note, { color: ink.soft }]}>{narrationNote}</Text>
              )}
            </View>
          </Move>
        )}
      </TitleShot>
    );
  };

  const current = slide.type === 'moment' || slide.type === 'loved' ? slide.moment : null;

  return (
    <View ref={rootRef as never} style={styles.root}>
      {/* El cielo de la escena: la hora y el tiempo que hacía, y lo que flota en el aire. */}
      <Atmosphere sky={look.sky} mood={look.mood} travel={look.travel} paused={paused} />

      {/* Tocar a la derecha: seguir; a la izquierda: volver; mantener: pausa. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Avanzar"
        disabled={exporter.live}
        style={StyleSheet.absoluteFill}
        onPressIn={() => {
          if (!touched.current) {
            touched.current = true;
            primeNarrator();
          }
          pressStart.current = Date.now();
          setPaused(true);
        }}
        onPressOut={() => setPaused(false)}
        onPress={(e) => {
          if (Date.now() - pressStart.current > 350) return; // fue una pausa, no un toque
          go(e.nativeEvent.locationX < width * 0.3 ? -1 : 1);
        }}
      />

      {/* Los planos: el que se va y el que llega, a la vez. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {leavingIndex !== null && leavingIndex !== index && renderSlide(leavingIndex, true)}
        {renderSlide(index, false)}
      </View>

      {!!line && (
        <Captions
          key={`${index}-${line}`}
          text={line}
          progress={voiced ? said : undefined}
          paused={paused}
          onDone={() => go(1)}
          dark={look.dark}
          bottom={insets.bottom + 30}
        />
      )}
      {/* Sin narradora, las notas de voz se pueden escuchar. */}
      {!line && current?.voice && (
        <View style={[styles.voice, { bottom: insets.bottom + 24 }]}>
          <VoiceNote voice={current.voice} />
        </View>
      )}

      <View style={[styles.chrome, { paddingTop: insets.top }]} pointerEvents="box-none">
        <View style={styles.bars} pointerEvents="none">
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.bar,
                { backgroundColor: look.dark ? 'rgba(255,255,255,0.25)' : 'rgba(42,39,36,0.15)' },
              ]}>
              <View
                style={[
                  styles.barFill,
                  {
                    backgroundColor: ink.ink,
                    width: `${i < index ? 100 : i > index ? 0 : Math.min(100, barFill * 100)}%`,
                  },
                ]}
              />
            </View>
          ))}
        </View>
        <View style={styles.top} {...NO_REC}>
          <Text numberOfLines={1} style={[styles.topTitle, { color: ink.soft }]}>
            {group(groupId)?.name} · {recap.range}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {!!voice && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={voiceOn ? 'Silenciar a la narradora' : 'Oír a la narradora'}
                onPress={() => setVoiceOn((v) => !v)}
                style={[styles.round, !voiceOn && styles.musicOff]}>
                <Icon icon={voiceOn ? Volume2 : VolumeX} color={INK} />
                {!voiceOn && <Text style={styles.roundText}>Voz</Text>}
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
                <Icon icon={Music} color={INK} />
                {!audio.playing && <Text style={styles.roundText}>Música</Text>}
              </Pressable>
            )}
            {canRecordScreen() && !exporter.live && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Exportar como vídeo"
                onPress={exportVideo}
                style={styles.round}>
                <Icon icon={Share} color={INK} />
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar resumen"
              onPress={close}
              style={styles.round}>
              <Icon icon={X} color={INK} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* La firma, solo en el vídeo que se graba: el logo y el nombre. */}
      {exporter.live && (
        <View pointerEvents="none" style={[styles.signature, { bottom: insets.bottom + 10 }]}>
          <LogoMark size={24} inverted={look.dark} />
          <Text style={[styles.signatureText, { color: ink.ink }]}>Junti</Text>
        </View>
      )}
      {exporter.overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A1030', overflow: 'hidden' },
  chrome: { position: 'absolute', top: 0, left: 0, right: 0 },
  signature: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    opacity: 0.9,
  },
  signatureText: { fontSize: 16, fontWeight: '700' },
  bars: { flexDirection: 'row', gap: 4, paddingHorizontal: 12, paddingTop: 8 },
  bar: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: 3 },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  topTitle: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  round: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  roundText: { color: INK, fontSize: 15, fontWeight: '500' },
  musicOff: { width: 'auto', paddingHorizontal: 12 },
  voice: { position: 'absolute', left: 20, right: 20 },
  cta: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 28,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    boxShadow: '0 10px 24px rgba(8,12,36,0.25)',
  },
  ctaText: { color: INK, fontSize: 17, fontWeight: '600' },
  again: { paddingVertical: 10, paddingHorizontal: 16 },
  againText: { fontFamily: Hand, fontSize: 21 },
  note: { fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
});
