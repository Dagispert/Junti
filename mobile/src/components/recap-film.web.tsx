import { router, useLocalSearchParams } from 'expo-router';
import { Music, Pause, Play, Share, Volume2, VolumeX, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useExport } from '@/components/export-sheet';
import { type FilmControl, FilmPlayer } from '@/components/film-player';
import { Icon } from '@/components/icon';
import { Resting } from '@/components/narrator-resting';
import { cargarJuegos, esMinijuego, imagenesDeJuegos } from '@/lib/juegos-pelicula';
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
import { whereOf } from '@/lib/film';
import { analizarRitmo, type Ritmo } from '@/lib/beats';
import { usePreview } from '@/lib/music';
import { narratorAudio, narratorStream, primeNarrator, stopNarrator } from '@/lib/narrator';
import { buildRecap } from '@/lib/recap';
import { fetchWeatherAt, type PastWeather } from '@/lib/weather';
import type { JuegoPieza } from '@/pelicula/guion';
import { datosPelicula, fotosEnLinea } from '@/pelicula/datos';

// El resumen de la semana o del mes como una película dibujada a mano (ver
// src/pelicula). La narradora la cuenta; antes de empezar, se espera a que
// tenga el texto y la voz, y se pide un toque (para que el audio pueda sonar).

const INK = '#1D1F22';

export default function RecapFilm() {
  const { groupId, kind, from } = useLocalSearchParams<{
    groupId: string;
    kind: 'week' | 'month';
    from: string;
  }>();
  const { moments, user, proposals, songs, questions, group, events, narrate } = useStore();
  const insets = useSafeAreaInsets();
  // El acento de la pantalla: el color del grupo (aclarado sobre el fondo oscuro).
  const accent = accentNight(group(groupId)?.color ?? DEFAULT_ACCENT);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groupId, kind, from],
  );

  // ── La crónica de la narradora (texto y luego voz) ──
  const narrating = !!group(groupId)?.narrativeEnabled && recap.moments.length > 0;
  const [narration, setNarration] = useState<Narration | null>(null);
  const [writing, setWriting] = useState(narrating);
  const [voicing, setVoicing] = useState(false);
  const [note, setNote] = useState('');
  // La narradora no está (Google saturado o sin conexión): hay versión sencilla.
  const [resting, setResting] = useState(false);
  const write = async (force = false) => {
    setWriting(true);
    setNote('');
    setResting(false);
    const args = { groupId, kind: recap.kind, from: recap.from, to: recap.to, label: recap.range };
    try {
      const result = await narrate({ ...args, force });
      let text = result.narration;
      if (text) setNarration(text);
      if (result.reason === 'limit') setNote('Ya no quedan más versiones para este resumen.');
      if (result.reason === 'resting') setResting(true);
      setWriting(false);
      if (text && !text.audioUrl) {
        setVoicing(true);
        const voiced = await narrate({ ...args, action: 'voice' });
        if (voiced.narration?.id === text.id) {
          text = voiced.narration;
          setNarration(text);
        }
      }
    } catch {
      setResting(true);
    }
    setWriting(false);
    setVoicing(false);
  };
  useEffect(() => {
    if (narrating) write();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrating]);

  // ── El tiempo que hacía (para elegir la vista) y las fotos en la página ──
  const [weather, setWeather] = useState<Record<string, PastWeather>>({});
  const [photos, setPhotos] = useState<Record<string, string> | null>(null);
  const [juegos, setJuegos] = useState<Record<string, JuegoPieza>>({});
  useEffect(() => {
    let alive = true;
    for (const m of recap.moments) {
      const w = whereOf(m, user(m.authorId));
      if (w.lat == null || w.lng == null) continue;
      fetchWeatherAt(w.lat, w.lng, m.createdAt).then(
        (x) => alive && x && setWeather((all) => ({ ...all, [m.id]: x })),
      );
    }
    // los minijuegos del periodo (con sus imágenes) y luego todas las fotos en la página
    const delPeriodo = proposals.filter(
      (p) =>
        p.groupId === groupId &&
        esMinijuego(p) &&
        p.startsAt >= recap.from &&
        p.startsAt < recap.to,
    );
    cargarJuegos(delPeriodo, moments, user)
      .catch(() => ({}) as Record<string, JuegoPieza>)
      .then((j) => {
        if (!alive) return null;
        setJuegos(j);
        return fotosEnLinea(
          [
            ...imagenesDeJuegos(j),
            ...recap.moments.flatMap((m) => [
              m.imageUri,
              ...(m.gallery ?? []).map((g) => (g.kind === 'photo' ? g.uri : g.poster)),
            ]),
            song?.artwork,
            // las carátulas de las canciones del periodo (salen en su animación)
            ...songs
              .filter(
                (x) => x.groupId === groupId && x.createdAt >= recap.from && x.createdAt < recap.to,
              )
              .map((x) => x.artwork),
          ].filter((u): u is string => !!u),
        );
      })
      .then((p) => alive && p && setPhotos(p));
    prepareRecording().catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recap]);

  // Se espera a la narradora (hasta 40 s) y a las fotos.
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setWaited(true), 90_000);
    return () => clearTimeout(id);
  }, []);
  const ready = !!photos && (!narrating || waited || (!writing && !voicing));

  const [started, setStarted] = useState(false);
  // la banda sonora: una canción del periodo o, si no, la última del grupo
  const song =
    recap.songs.find((s) => s.preview) ?? songs.find((s) => s.groupId === groupId && s.preview);
  // el pulso de la canción, para que la película se mueva a su ritmo
  const [ritmo, setRitmo] = useState<Ritmo | null>(null);
  useEffect(() => {
    analizarRitmo(song?.preview).then(setRitmo);
  }, [song?.preview]);
  const data = useMemo(
    () =>
      started
        ? datosPelicula(recap, {
            accent: group(groupId)?.color,
            group: group(groupId)?.name ?? 'Junti',
            user,
            narration,
            weather,
            photos: photos ?? {},
            song: song
              ? { title: song.title, artist: song.artist, artwork: song.artwork }
              : undefined,
            ritmo,
            groupId,
            extras: { questions, proposals, songs, moments, juegos },
          })
        : null,
    // Se fija al empezar: la película no cambia mientras se ve.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [started],
  );

  // ── Voz y música ──
  const voice = narration?.audioUrl && narration.sceneTimes?.length ? narration : null;
  const player = narratorAudio();
  useEffect(() => {
    if (!player || !voice?.audioUrl) return;
    player.src = voice.audioUrl;
    player.load();
  }, [player, voice?.audioUrl]);
  useEffect(() => () => stopNarrator(), []);
  const [voiceOn, setVoiceOn] = useState(true);
  const audio = usePreview(song?.preview, true);
  const [paused, setPaused] = useState(false);
  const [time, setTime] = useState({ t: 0, total: 1 });
  const [ended, setEnded] = useState(false);
  // La música suena entera hasta que habla la narradora; en cuanto empieza a
  // hablar, baja al 2 % y se queda de fondo. Solo vuelve a subir si la voz
  // calla un buen rato (al final, o en pausa).
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

  const start = () => {
    primeNarrator();
    setStarted(true);
    setEnded(false);
    if (audio.available && !audio.playing) audio.toggle();
  };

  // ── Exportar: se graba la pantalla mientras se cuenta desde el principio ──
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
      const blob = await rec.stop();
      exporter.ready(
        blob,
        recap.kind === 'week' ? 'junti-semana' : 'junti-mes',
        `${group(groupId)?.name ?? 'Junti'} · ${recap.range}`,
      );
    }
  };

  const close = () => {
    stopNarrator();
    if (audio.playing) audio.toggle();
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
        // La espera: la narradora prepara la historia; luego, un toque para empezar.
        <View style={styles.wait}>
          <Text style={styles.waitKicker}>
            {recap.kind === 'week' ? 'VUESTRA SEMANA' : 'VUESTRO MES'}
          </Text>
          <Text style={styles.waitTitle}>{narration?.title || recap.range}</Text>
          {ready && resting ? (
            <Resting
              accent={accent}
              kind={recap.kind === 'week' ? 'semana' : 'mes'}
              onWatch={start}
              onRetry={() => write(true)}
              onLater={close}
            />
          ) : ready ? (
            <Pressable accessibilityRole="button" onPress={start} style={styles.play}>
              <Icon icon={Play} color={INK} />
              <Text style={styles.playText}>Ver la película</Text>
            </Pressable>
          ) : (
            <Text style={styles.waitNote}>
              {writing
                ? 'La narradora está escribiendo vuestra historia…'
                : voicing
                  ? 'Poniéndole voz…'
                  : 'Preparando las fotos…'}
            </Text>
          )}
          {!ready && (
            <Pressable accessibilityRole="button" onPress={() => setWaited(true)} hitSlop={10}>
              <Text style={[styles.skip, { color: accent }]}>Empezar sin esperar</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* La barra de progreso y los botones (no salen en el vídeo exportado). */}
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
            {group(groupId)?.name} · {recap.range}
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
            accessibilityLabel="Cerrar resumen"
            onPress={close}
            style={styles.round}>
            <Icon icon={X} color={INK} />
          </Pressable>
        </View>
      </View>

      {/* Al terminar: volver a verla, otra versión, cerrar. */}
      {ended && !exporter.live && (
        <View style={[styles.end, { bottom: insets.bottom + 28 }]} {...NO_REC}>
          <Pressable
            accessibilityRole="button"
            onPress={() => (control.current?.seek(0), setEnded(false), setPaused(false))}
            style={styles.endBtn}>
            <Text style={styles.endText}>Volver a verla</Text>
          </Pressable>
          {narrating && (
            <Pressable
              accessibilityRole="button"
              disabled={writing}
              onPress={async () => {
                await write(true);
                setStarted(false);
              }}
              style={[styles.endBtn, styles.endGhost]}>
              <Text style={[styles.endText, { color: '#F3F1E7' }]}>
                {writing ? 'Escribiendo…' : 'Otra versión'}
              </Text>
            </Pressable>
          )}
          {!!note && <Text style={styles.note}>{note}</Text>}
        </View>
      )}

      {exporter.overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#141518', overflow: 'hidden' },
  wait: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 28 },
  waitKicker: { color: '#A9A79C', fontSize: 13, letterSpacing: 3, fontWeight: '600' },
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
  note: { color: '#A9A79C', fontSize: 13, textAlign: 'center', paddingHorizontal: 30 },
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
