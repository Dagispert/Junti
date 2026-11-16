import { router, useLocalSearchParams } from 'expo-router';
import { Music, Pause, Play, Plus, Share, Volume2, VolumeX, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useExport } from '@/components/export-sheet';
import { type FilmControl, FilmPlayer } from '@/components/film-player';
import { Icon } from '@/components/icon';
import { LogoMark } from '@/components/logo';
import { Resting } from '@/components/narrator-resting';
import { accentNight, DEFAULT_ACCENT } from '@/lib/accent';
import { Hand } from '@/constants/theme';
import { useStore } from '@/data/store';
import type { Narration } from '@/data/types';
import {
  canRecordScreen,
  mixStreams,
  NO_REC,
  prepareRecording,
  recordScreen,
} from '@/lib/dom-recorder';
import { usePreview } from '@/lib/music';
import { narratorAudio, narratorStream, primeNarrator, stopNarrator } from '@/lib/narrator';
import { buildStory, parseGap, templateScenes } from '@/lib/story';
import { datosHistoria, fotosEnLinea } from '@/pelicula/datos';
import { planificar } from '@/pelicula/guion';

// «Nuestra historia» como película dibujada a mano: los años pasan en el reloj
// de paletas, la libreta une los lugares, y el calendario va año a año con
// cada recuerdo. En los huecos, un botón para contar qué pasó.

const INK = '#1D1F22';

export default function StoryFilm() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { group: groupById, moments, narrate, user, songs } = useStore();
  const group = groupById(groupId);
  const insets = useSafeAreaInsets();
  // El acento de la pantalla: el color del grupo (aclarado sobre el fondo oscuro).
  const accent = accentNight(group?.color ?? DEFAULT_ACCENT);
  const story = useMemo(
    () =>
      buildStory(
        group?.origins ?? [],
        moments.filter((m) => m.groupId === groupId),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groupId],
  );

  const narrating = !!group?.narrativeEnabled;
  const [narration, setNarration] = useState<Narration | null>(null);
  const [state, setState] = useState<'writing' | 'voicing' | 'ready'>(
    narrating ? 'writing' : 'ready',
  );
  // La narradora no está (Google saturado o sin conexión): hay versión sencilla.
  const [resting, setResting] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!narrating) return;
    let alive = true;
    const args = {
      groupId,
      kind: 'story' as const,
      from: 0,
      to: 0,
      label: 'Nuestra historia',
      ...(attempt ? { force: true } : {}),
    };
    setResting(false);
    setState('writing');
    (async () => {
      try {
        const result = await narrate(args);
        if (alive && result.reason === 'resting') setResting(true);
        let text = result.narration;
        if (alive && text) setNarration(text);
        if (text && !text.audioUrl) {
          if (alive) setState('voicing');
          const voiced = await narrate({ ...args, action: 'voice' });
          if (voiced.narration?.id === text.id) text = voiced.narration;
          if (alive) setNarration(text);
        }
      } catch {
        // sin narradora: se cuenta con frases sencillas (y se avisa)
        if (alive) setResting(true);
      }
      if (alive) setState('ready');
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, narrating, attempt]);

  // La banda sonora del grupo: la última canción con fragmento.
  const soundtrack = useMemo(() => songs.filter((x) => x.groupId === groupId), [songs, groupId]);
  const song = soundtrack.find((x) => x.preview);
  const [photos, setPhotos] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    fotosEnLinea(
      [...story.memories.map((m) => m.imageUri), song?.artwork].filter((u): u is string => !!u),
    ).then(setPhotos);
    prepareRecording().catch(() => {});
  }, [story]);
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setWaited(true), 90_000);
    return () => clearTimeout(id);
  }, []);
  const ready = !!photos && (state === 'ready' || waited);

  const [started, setStarted] = useState(false);
  const data = useMemo(() => {
    if (!started || !group) return null;
    const scenes = narration?.scenes?.length ? narration.scenes : templateScenes(story.items);
    return datosHistoria(story, {
      group,
      user,
      scenes,
      narration,
      title: narration?.title || 'Nuestra historia',
      photos: photos ?? {},
      song: song ? { title: song.title, artist: song.artist, artwork: song.artwork } : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);
  const plan = useMemo(() => (data ? planificar(data) : null), [data]);

  const voice = narration?.audioUrl && narration.sceneTimes?.length ? narration : null;
  const player = narratorAudio();
  useEffect(() => {
    if (!player || !voice?.audioUrl) return;
    player.src = voice.audioUrl;
    player.load();
  }, [player, voice?.audioUrl]);
  useEffect(() => () => stopNarrator(), []);
  const [voiceOn, setVoiceOn] = useState(true);
  // La música: entera hasta que habla la narradora; mientras habla, al 2 %.
  const audio = usePreview(song?.preview, true);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    if (!player) return;
    let quiet: ReturnType<typeof setTimeout> | undefined;
    const on = () => {
      clearTimeout(quiet);
      setSpeaking(true);
    };
    const off = () => {
      clearTimeout(quiet);
      quiet = setTimeout(() => setSpeaking(false), 1500);
    };
    player.addEventListener('playing', on);
    player.addEventListener('pause', off);
    player.addEventListener('ended', off);
    return () => {
      clearTimeout(quiet);
      player.removeEventListener('playing', on);
      player.removeEventListener('pause', off);
      player.removeEventListener('ended', off);
    };
  }, [player]);
  useEffect(() => {
    audio.volume(voiceOn && voice && speaking ? 0.02 : 0.8);
  });
  const startMusic = () => {
    if (audio.available && !audio.playing) audio.toggle();
  };
  const [paused, setPaused] = useState(false);
  const [time, setTime] = useState({ t: 0, total: 1 });
  const [ended, setEnded] = useState(false);

  const exporter = useExport();
  const rootRef = useRef<unknown>(null);
  const control = useRef<FilmControl | null>(null);
  const recorder = useRef<ReturnType<typeof recordScreen> | null>(null);
  const exportVideo = () => {
    const root = rootRef.current as unknown as HTMLElement | null;
    if (!root) return;
    // la voz y la música en una sola pista (el grabador solo graba una)
    const music = audio.available ? audio.stream() : null;
    if (music) {
      audio.restart();
      if (!audio.playing) audio.toggle();
    }
    const track = mixStreams([voice ? narratorStream() : null, music]);
    control.current?.seek(0);
    setPaused(false);
    setEnded(false);
    recorder.current = recordScreen(root, { audio: track });
    exporter.recording(() => {
      recorder.current?.cancel();
      recorder.current = null;
    });
  };
  useEffect(() => {
    if (exporter.live && recorder.current) exporter.progress(Math.min(1, time.t / time.total));
  });
  const onEnd = async () => {
    setEnded(true);
    const rec = recorder.current;
    if (rec) {
      recorder.current = null;
      exporter.ready(
        await rec.stop(),
        'junti-historia',
        `${group?.name ?? 'Junti'} · Nuestra historia`,
      );
    }
  };

  // ¿Estamos en un hueco? Entonces, el botón para contarlo.
  const gapNow = plan?.piezas.find((p) => time.t >= p.a && time.t < p.b && p.id.startsWith('gap:'));
  const gap = gapNow ? parseGap(gapNow.id) : null;
  const addMemory = (year?: number) => {
    stopNarrator();
    router.push({
      pathname: '/publish',
      params: { groupId, memory: '1', ...(year ? { year: String(year) } : {}) },
    });
  };
  const close = () => {
    stopNarrator();
    router.back();
  };

  return (
    <View ref={rootRef as never} style={styles.root}>
      {data ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={paused ? 'Seguir' : 'Pausar'}
          disabled={exporter.live}
          onPress={() => (ended ? null : setPaused((p) => !p))}
          style={StyleSheet.absoluteFill}>
          <FilmPlayer
            data={data}
            voice={voice ? player : null}
            paused={paused}
            muted={!voiceOn}
            control={control}
            onTime={(t, total) => {
              if (Math.abs(t - time.t) > 0.2 || total !== time.total) setTime({ t, total });
            }}
            onEnd={onEnd}
          />
        </Pressable>
      ) : (
        <View style={styles.wait}>
          <LogoMark size={44} inverted />
          <Text style={styles.waitTitle}>{narration?.title || 'Nuestra historia'}</Text>
          {ready && resting ? (
            <Resting
              accent={accent}
              kind="historia"
              onWatch={() => {
                primeNarrator();
                startMusic();
                setStarted(true);
              }}
              onRetry={() => setAttempt((a) => a + 1)}
              onLater={close}
            />
          ) : ready ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                primeNarrator();
                startMusic();
                setStarted(true);
              }}
              style={styles.play}>
              <Icon icon={Play} color={INK} />
              <Text style={styles.playText}>Ver vuestra historia</Text>
            </Pressable>
          ) : (
            <>
              <Text style={styles.waitNote}>
                {state === 'voicing'
                  ? 'Poniéndole voz…'
                  : 'La narradora está repasando vuestros recuerdos…'}
              </Text>
              <Pressable accessibilityRole="button" onPress={() => setWaited(true)} hitSlop={10}>
                <Text style={[styles.skip, { color: accent }]}>Empezar sin esperar</Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      <View
        style={[styles.top, { paddingTop: insets.top + 8 }]}
        pointerEvents="box-none"
        {...NO_REC}>
        {!!data && (
          <View style={styles.bar}>
            <View
              style={[
                styles.barFill,
                {
                  backgroundColor: accent,
                  width: `${Math.min(100, (time.t / time.total) * 100)}%`,
                },
              ]}
            />
          </View>
        )}
        <View style={styles.row}>
          <Text numberOfLines={1} style={styles.topTitle}>
            {group?.name} · Nuestra historia
          </Text>
          {!!data && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={paused ? 'Seguir' : 'Pausar'}
              onPress={() => setPaused((p) => !p)}
              style={styles.round}>
              <Icon icon={paused ? Play : Pause} color={INK} />
            </Pressable>
          )}
          {!!voice && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={voiceOn ? 'Silenciar a la narradora' : 'Oír a la narradora'}
              onPress={() => setVoiceOn((v) => !v)}
              style={styles.round}>
              <Icon icon={voiceOn ? Volume2 : VolumeX} color={INK} />
            </Pressable>
          )}
          {audio.available && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={audio.playing ? 'Silenciar música' : 'Poner música'}
              onPress={() => audio.toggle()}
              style={[styles.round, !audio.playing && { opacity: 0.6 }]}>
              <Icon icon={Music} color={INK} />
            </Pressable>
          )}
          {!!data && canRecordScreen() && !exporter.live && (
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
            accessibilityLabel="Cerrar la historia"
            onPress={close}
            style={styles.round}>
            <Icon icon={X} color={INK} />
          </Pressable>
        </View>
      </View>

      {!!gap && !exporter.live && (
        <View style={[styles.end, { bottom: insets.bottom + 110 }]} {...NO_REC}>
          <Pressable
            accessibilityRole="button"
            onPress={() => addMemory(Math.round((gap.from + gap.to) / 2))}
            style={styles.ask}>
            <Icon icon={Plus} size={18} color="#FFFFFF" />
            <Text style={styles.askText}>
              Contar qué pasó en {gap.from === gap.to ? gap.from : `${gap.from}–${gap.to}`}
            </Text>
          </Pressable>
        </View>
      )}

      {ended && !exporter.live && (
        <View style={[styles.end, { bottom: insets.bottom + 28 }]} {...NO_REC}>
          <Pressable
            accessibilityRole="button"
            onPress={() => (control.current?.seek(0), setEnded(false), setPaused(false))}
            style={styles.endBtn}>
            <Text style={styles.endText}>Volver a verla</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => addMemory()}
            style={[styles.endBtn, styles.endGhost]}>
            <Text style={[styles.endText, { color: '#F3F1E7' }]}>Añadir un recuerdo</Text>
          </Pressable>
        </View>
      )}

      {exporter.overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#141518', overflow: 'hidden' },
  wait: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 28 },
  waitTitle: { color: '#F3F1E7', fontFamily: Hand, fontSize: 42, textAlign: 'center' },
  waitNote: { color: '#A9A79C', fontFamily: Hand, fontSize: 22, textAlign: 'center' },
  skip: { color: '#E5568E', fontFamily: Hand, fontSize: 20, marginTop: 6 },
  play: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3F1E7',
    borderRadius: 26,
    height: 52,
    paddingHorizontal: 26,
  },
  playText: { color: INK, fontSize: 17, fontWeight: '600' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 14, gap: 10 },
  bar: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(160,160,150,0.35)',
    overflow: 'hidden',
  },
  barFill: { height: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topTitle: { flex: 1, color: '#A9A79C', fontSize: 13, fontWeight: '600' },
  round: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  end: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 10 },
  endBtn: {
    backgroundColor: '#F3F1E7',
    borderRadius: 24,
    height: 48,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  endGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(243,241,231,0.4)',
  },
  endText: { color: INK, fontSize: 16, fontWeight: '600' },
  ask: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: INK,
    borderRadius: 24,
    height: 48,
    paddingHorizontal: 22,
  },
  askText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  signature: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    opacity: 0.9,
  },
  signatureText: { color: '#F3F1E7', fontSize: 16, fontWeight: '700' },
});
