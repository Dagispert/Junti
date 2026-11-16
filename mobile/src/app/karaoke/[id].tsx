import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Headphones, Mic, Play, RotateCcw, Send, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { Avatar } from '@/components/ui';
import { errorText, useStore } from '@/data/store';
import type { KaraokeGame, Moment } from '@/data/types';
import { canRecord, partAt, planMontage, recorderType, trackUrl } from '@/lib/karaoke';
import { lineAt } from '@/lib/lyrics';
import { markRead } from '@/lib/notifications';
import { mmss } from '@/lib/music';

const GOLD = '#F2B33D';
type Take = { uri: string; mime: string; duration: number; offset: number; poster?: string };

/**
 * El karaoke de un reto: grabarse cantando el trozo (con la canción sonando y
 * la letra pasando) y ver el montaje de todas las voces, que va alternando a
 * quien canta y acaba con todos juntos.
 */
export default function Karaoke() {
  const { id, watch } = useLocalSearchParams<{ id: string; watch?: string }>();
  useEffect(() => {
    if (id) markRead(`proposal:${id}`);
  }, [id]);
  const { proposals, moments, me } = useStore();
  const insets = useSafeAreaInsets();
  const proposal = proposals.find((p) => p.id === id);
  const game = proposal?.game;
  const [mode, setMode] = useState<'home' | 'record' | 'watch'>(watch ? 'watch' : 'home');
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (game) trackUrl(game).then(setUrl);
  }, [game]);

  // De cada persona, su última versión (si repitió, cuenta la nueva).
  const takes = useMemo(() => {
    const last = new Map<string, Moment>();
    for (const m of moments)
      if (m.proposalId === id && m.videoUri) {
        const prev = last.get(m.authorId);
        if (!prev || prev.sharedAt < m.sharedAt) last.set(m.authorId, m);
      }
    return [...last.values()].sort((a, b) => a.sharedAt - b.sharedAt);
  }, [moments, id]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!proposal || !game)
    return (
      <View style={[styles.stage, styles.center]}>
        <Text style={styles.light}>Este karaoke ya no está.</Text>
        <Pressable onPress={close} style={[styles.pill, { marginTop: 16 }]}>
          <Text style={styles.pillText}>Volver</Text>
        </Pressable>
      </View>
    );
  if (Platform.OS !== 'web')
    return (
      <View style={[styles.stage, styles.center]}>
        <Text style={styles.light}>El karaoke, por ahora, solo en la web.</Text>
      </View>
    );

  const open = !proposal.endsAt || proposal.endsAt > Date.now();
  const sung = takes.some((m) => m.authorId === me);
  return (
    <View style={[styles.stage, { paddingTop: insets.top }]}>
      {/* La portada, de fondo, muy difuminada */}
      {!!game.artwork && (
        <Image
          source={{ uri: game.artwork }}
          style={[StyleSheet.absoluteFill, { opacity: 0.35 }]}
          blurRadius={40}
          contentFit="cover"
        />
      )}
      <View style={styles.top}>
        <Pressable accessibilityLabel="Cerrar" onPress={close} style={styles.round}>
          <Icon icon={X} size={20} color="#FFFFFF" />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text numberOfLines={1} style={styles.songTitle}>
            {game.song}
          </Text>
          {!!game.artist && (
            <Text numberOfLines={1} style={styles.songArtist}>
              {game.artist}
            </Text>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {mode === 'home' && (
        <Home
          game={game}
          takes={takes}
          canSing={open}
          sung={sung}
          onSing={() => setMode('record')}
          onWatch={() => setMode('watch')}
        />
      )}
      {mode === 'record' && url && (
        <Recorder
          game={game}
          url={url}
          groupId={proposal.groupId}
          proposalId={proposal.id}
          onCancel={() => setMode('home')}
          onSent={() => setMode(takes.length ? 'watch' : 'home')}
        />
      )}
      {mode === 'watch' && url && (
        <Montage
          game={game}
          url={url}
          takes={takes}
          seed={proposal.id}
          onBack={() => setMode('home')}
        />
      )}
      {mode !== 'home' && !url && <ActivityIndicator color="#FFFFFF" style={{ marginTop: 80 }} />}
    </View>
  );
}

/* ───────────── Portada del karaoke ───────────── */

function Home({
  game,
  takes,
  canSing,
  sung,
  onSing,
  onWatch,
}: {
  game: KaraokeGame;
  takes: Moment[];
  canSing: boolean;
  sung: boolean;
  onSing: () => void;
  onWatch: () => void;
}) {
  const { user } = useStore();
  const length = Math.round(game.end - game.start);
  const names = takes.map((m) => user(m.authorId).name.split(' ')[0]);
  return (
    <View style={styles.home}>
      <View style={styles.cover}>
        {game.artwork ? (
          <Image
            source={{ uri: game.artwork }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <Icon icon={Mic} size={56} color="rgba(255,255,255,0.8)" />
        )}
      </View>
      <Text style={styles.meta}>
        {length >= 60 ? mmss(length) : `${length} segundos`} de canción ·{' '}
        {takes.length === 0
          ? 'nadie ha cantado aún'
          : takes.length === 1
            ? `ha cantado ${names[0]}`
            : `${takes.length} voces`}
      </Text>
      {takes.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          {takes.map((m) => (
            <Avatar key={m.id} userId={m.authorId} size={36} />
          ))}
        </View>
      )}
      <View style={{ gap: 12, alignSelf: 'stretch', marginTop: 8 }}>
        {takes.length > 0 && (
          <Pressable accessibilityRole="button" onPress={onWatch} style={[styles.big, styles.gold]}>
            <Icon icon={Play} size={20} color="#1D1F22" />
            <Text style={[styles.bigText, { color: '#1D1F22' }]}>
              {takes.length > 1 ? 'Ver el karaoke' : 'Ver cómo va'}
            </Text>
          </Pressable>
        )}
        {canSing && (
          <Pressable
            accessibilityRole="button"
            onPress={onSing}
            style={[styles.big, takes.length ? styles.ghost : styles.gold]}>
            <Icon icon={Mic} size={20} color={takes.length ? '#FFFFFF' : '#1D1F22'} />
            <Text style={[styles.bigText, { color: takes.length ? '#FFFFFF' : '#1D1F22' }]}>
              {sung ? 'Cantar otra vez' : 'Cantar'}
            </Text>
          </Pressable>
        )}
      </View>
      {canSing && (
        <View style={styles.tip}>
          <Icon icon={Headphones} size={18} color="rgba(255,255,255,0.75)" />
          <Text style={[styles.tipText, { textAlign: 'left' }]}>
            Con cascos suena mucho mejor: así solo se graba tu voz y la canción se pone después.
          </Text>
        </View>
      )}
    </View>
  );
}

/* ───────────── Letra que va pasando ───────────── */

function Lyrics({ game, time }: { game: KaraokeGame; time: number }) {
  const plain = useMemo(
    () =>
      (game.lyrics ?? '')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean),
    [game.lyrics],
  );
  const timed = game.lines?.length ? game.lines : null;
  const lines = timed ? timed.map((l) => l.text) : plain;
  if (!lines.length) return null;
  // Con ritmo, la línea que toca en este segundo; sin él, cada línea dura lo mismo.
  const progress = Math.max(0, Math.min(1, (time - game.start) / (game.end - game.start)));
  const current = timed
    ? lineAt(timed, time + 0.05)
    : time < game.start
      ? -1
      : Math.min(lines.length - 1, Math.floor(progress * lines.length));
  // Antes de la primera línea: se ve cuál viene, con una cuenta atrás de puntos.
  if (current < 0) {
    const waiting = timed ? timed[0].t - time : game.start - time;
    return (
      <View pointerEvents="none" style={styles.lyrics}>
        <Text style={styles.lyricDots}>
          {waiting > 0.2 && waiting < 3.5 ? '● '.repeat(Math.ceil(waiting)).trim() : ' '}
        </Text>
        <Text style={styles.lyricUpcoming}>{lines[0]}</Text>
        {!!lines[1] && <Text style={styles.lyricNext}>{lines[1]}</Text>}
        {!!lines[2] && <Text style={styles.lyricNext}>{lines[2]}</Text>}
      </View>
    );
  }
  return (
    <View pointerEvents="none" style={styles.lyrics}>
      {[-1, 0, 1, 2].map((d) => {
        const line = lines[current + d];
        if (!line) return <Text key={d} style={styles.lyricFar} />;
        return (
          <Text
            key={`${current + d}`}
            style={d === 0 ? styles.lyricNow : d < 0 ? styles.lyricPast : styles.lyricNext}>
            {line}
          </Text>
        );
      })}
    </View>
  );
}

/* ───────────── Grabarse cantando ───────────── */

function Recorder({
  game,
  url,
  groupId,
  proposalId,
  onCancel,
  onSent,
}: {
  game: KaraokeGame;
  url: string;
  groupId: string;
  proposalId: string;
  onCancel: () => void;
  onSent: () => void;
}) {
  const { addMoment } = useStore();
  const duration = game.end - game.start;
  const preview = useRef<HTMLVideoElement | null>(null);
  const review = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [phase, setPhase] = useState<'camera' | 'count' | 'singing' | 'review' | 'sending'>(
    'camera',
  );
  const [count, setCount] = useState(3);
  const [progress, setProgress] = useState(0);
  // el segundo de la canción (antes de empezar, un poco antes del trozo)
  const preroll = Math.min(3, game.start);
  const [time, setTime] = useState(game.start - preroll);
  const [error, setError] = useState('');
  const [take, setTake] = useState<Take | null>(null);
  const stopRef = useRef<() => void>(() => {});

  // La cámara frontal y el micrófono.
  useEffect(() => {
    if (!canRecord()) {
      setError('Este navegador no deja grabar vídeo. Prueba con Safari o Chrome actualizados.');
      return;
    }
    let alive = true;
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } },
        audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: true },
      })
      .then((s) => {
        if (!alive) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        if (preview.current) {
          preview.current.srcObject = s;
          preview.current.play().catch(() => {});
        }
      })
      .catch(() =>
        setError('Hace falta permiso para la cámara y el micrófono. Actívalo en el navegador.'),
      );
    const a = new Audio();
    a.preload = 'auto';
    a.src = url;
    audio.current = a;
    return () => {
      alive = false;
      stopRef.current();
      stream.current?.getTracks().forEach((t) => t.stop());
      a.pause();
      a.src = '';
    };
  }, [url]);

  const start = () => {
    const a = audio.current;
    if (!a || !stream.current) return;
    // En iPhone el audio solo arranca tras un toque: se «despierta» ahora, en silencio.
    a.muted = true;
    a.play()
      .then(() => {
        a.pause();
        a.muted = false;
        a.currentTime = game.start - preroll;
      })
      .catch(() => {
        a.muted = false;
      });
    setTime(game.start - preroll);
    setTake(null);
    setPhase('count');
    setCount(3);
    let n = 3;
    const tick = setInterval(() => {
      n -= 1;
      if (n > 0) setCount(n);
      else {
        clearInterval(tick);
        sing();
      }
    }, 900);
    stopRef.current = () => clearInterval(tick);
  };

  const sing = () => {
    const a = audio.current!;
    const s = stream.current!;
    const type = recorderType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(s, {
        ...(type ? { mimeType: type } : {}),
        videoBitsPerSecond: 1_200_000,
        audioBitsPerSecond: 128_000,
      });
    } catch {
      recorder = new MediaRecorder(s);
    }
    const chunks: Blob[] = [];
    let recStart = 0;
    let songStart = 0;
    let poster: string | undefined;
    let frame = 0;
    let done = false;
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstart = () => {
      recStart = performance.now();
      // unos segundos de canción antes del trozo, para ver venir la primera línea
      a.currentTime = game.start - preroll;
      a.play().catch(() => {});
    };
    a.onplaying = () => {
      if (!songStart) songStart = performance.now() - (a.currentTime - game.start) * 1000;
    };
    recorder.onstop = () => {
      const mime = (recorder.mimeType || type || 'video/webm').split(';')[0];
      const blob = new Blob(chunks, { type: mime });
      const offset = Math.max(0, ((songStart || recStart) - recStart) / 1000);
      const length = (performance.now() - recStart) / 1000;
      setTake({ uri: URL.createObjectURL(blob), mime, duration: length, offset, poster });
      setPhase('review');
    };
    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(frame);
      a.pause();
      if (recorder.state !== 'inactive') recorder.stop();
    };
    stopRef.current = finish;
    const loop = () => {
      const t = a.currentTime - game.start;
      setProgress(Math.max(0, Math.min(1, t / duration)));
      setTime(a.currentTime);
      // La portada: un fotograma a los dos segundos.
      if (!poster && t > 2 && preview.current?.videoWidth) {
        const v = preview.current;
        const c = document.createElement('canvas');
        const scale = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
        c.width = Math.round(v.videoWidth * scale);
        c.height = Math.round(v.videoHeight * scale);
        const g = c.getContext('2d')!;
        g.drawImage(v, 0, 0, c.width, c.height);
        poster = c.toDataURL('image/jpeg', 0.82);
      }
      if (t >= duration || a.ended) finish();
      else frame = requestAnimationFrame(loop);
    };
    recorder.start(1000);
    setPhase('singing');
    setProgress(0);
    setTime(game.start - preroll);
    frame = requestAnimationFrame(loop);
  };

  // Al revisar: tu vídeo con la canción a la vez.
  const [reviewing, setReviewing] = useState(false);
  const playReview = () => {
    const v = review.current;
    const a = audio.current;
    if (!v || !a || !take) return;
    if (reviewing) {
      v.pause();
      a.pause();
      setReviewing(false);
      return;
    }
    v.currentTime = take.offset;
    a.currentTime = game.start;
    setReviewing(true);
    Promise.all([v.play(), a.play()]).catch(() => setReviewing(false));
    const sync = () => {
      if (v.paused) return;
      const want = take.offset + (a.currentTime - game.start);
      if (Math.abs(v.currentTime - want) > 0.25) v.currentTime = want;
      if (a.currentTime - game.start >= duration || v.ended) {
        v.pause();
        a.pause();
        setReviewing(false);
        return;
      }
      requestAnimationFrame(sync);
    };
    requestAnimationFrame(sync);
  };

  const send = async () => {
    if (!take) return;
    review.current?.pause();
    audio.current?.pause();
    setPhase('sending');
    setError('');
    try {
      await addMoment({
        groupId,
        proposalId,
        media: {
          uri: take.uri,
          kind: 'video',
          mime: take.mime,
          duration: take.duration,
          poster: take.poster,
          clip: {
            start: Math.round(take.offset * 100) / 100,
            end: Math.round(Math.min(take.duration, take.offset + duration) * 100) / 100,
          },
        },
      });
      onSent();
    } catch (e) {
      setError(errorText(e));
      setPhase('review');
    }
  };

  const showCamera = phase !== 'review' && phase !== 'sending';
  return (
    <View style={styles.recorder}>
      <View style={styles.frame}>
        <video
          ref={preview}
          muted
          playsInline
          autoPlay
          style={{ ...videoFill, transform: 'scaleX(-1)', display: showCamera ? 'block' : 'none' }}
        />
        {take && !showCamera && (
          <video
            ref={review}
            src={take.uri}
            poster={take.poster}
            playsInline
            onClick={playReview}
            style={{ ...videoFill, transform: 'scaleX(-1)' }}
          />
        )}
        {phase === 'count' && (
          <View style={[StyleSheet.absoluteFill, styles.center, styles.dim]}>
            <Text style={styles.count}>{count}</Text>
          </View>
        )}
        {/* La letra se ve desde antes de empezar: así se sabe qué viene. */}
        {(phase === 'camera' || phase === 'count' || phase === 'singing') &&
          (!!game.lyrics || !!game.lines?.length) && <Lyrics game={game} time={time} />}
        {phase === 'singing' && (
          <>
            <View style={styles.progress}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
            <View style={styles.rec}>
              <View style={styles.recDot} />
              <Text style={styles.recText}>
                {time < game.start ? 'Prepárate…' : mmss(progress * duration)}
              </Text>
            </View>
          </>
        )}
        {phase === 'review' && !reviewing && (
          <Pressable
            accessibilityLabel="Ver cómo ha quedado"
            onPress={playReview}
            style={[StyleSheet.absoluteFill, styles.center]}>
            <View style={styles.playBig}>
              <Icon icon={Play} size={30} color="#1D1F22" />
            </View>
          </Pressable>
        )}
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.controls}>
        {phase === 'camera' && (
          <>
            <Pressable onPress={onCancel} style={styles.pill}>
              <Text style={styles.pillText}>Atrás</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Empezar a cantar"
              disabled={!!error}
              onPress={start}
              style={[styles.recButton, !!error && { opacity: 0.4 }]}>
              <View style={styles.recInner} />
            </Pressable>
            <View style={{ width: 72 }} />
          </>
        )}
        {phase === 'singing' && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Parar"
            onPress={() => stopRef.current()}
            style={styles.recButton}>
            <View style={styles.stopInner} />
          </Pressable>
        )}
        {(phase === 'review' || phase === 'sending') && (
          <>
            <Pressable
              accessibilityRole="button"
              disabled={phase === 'sending'}
              onPress={() => {
                review.current?.pause();
                audio.current?.pause();
                setReviewing(false);
                setTake(null);
                setPhase('camera');
                setTimeout(() => {
                  if (preview.current && stream.current) {
                    preview.current.srcObject = stream.current;
                    preview.current.play().catch(() => {});
                  }
                });
              }}
              style={styles.pill}>
              <Icon icon={RotateCcw} size={16} color="#FFFFFF" />
              <Text style={styles.pillText}>Repetir</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={phase === 'sending'}
              onPress={send}
              style={[styles.pill, styles.gold]}>
              {phase === 'sending' ? (
                <ActivityIndicator color="#1D1F22" />
              ) : (
                <Icon icon={Send} size={16} color="#1D1F22" />
              )}
              <Text style={[styles.pillText, { color: '#1D1F22' }]}>
                {phase === 'sending' ? 'Enviando…' : 'Enviar'}
              </Text>
            </Pressable>
          </>
        )}
      </View>
      {phase === 'camera' && !error && (
        <Text style={styles.tipText}>
          Toca el botón: cuenta 3, 2, 1 y empieza la canción. Canta el trozo entero.
        </Text>
      )}
    </View>
  );
}

/* ───────────── El montaje: todas las voces ───────────── */

function Montage({
  game,
  url,
  takes,
  seed,
  onBack,
}: {
  game: KaraokeGame;
  url: string;
  takes: Moment[];
  seed: string;
  onBack: () => void;
}) {
  const { user } = useStore();
  const duration = game.end - game.start;
  const parts = useMemo(
    () =>
      planMontage(
        duration,
        takes.map((m) => m.id),
        seed,
      ),
    [duration, takes, seed],
  );
  const videos = useRef(new Map<string, HTMLVideoElement>());
  const [state, setState] = useState<'loading' | 'ready' | 'intro' | 'playing' | 'ended'>(
    'loading',
  );
  const [active, setActive] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const frame = useRef(0);
  // La letra (si tiene ritmo marcado), verso a verso.
  const versos = useMemo(() => (game.lines ?? []).filter((l) => l.text.trim()), [game.lines]);
  const [verso, setVerso] = useState(-1);

  // El sonido va aparte de los vídeos: la canción y la voz de cada uno se
  // descargan y se mezclan con Web Audio, con un único reloj. Los vídeos van
  // en silencio y siguen ese reloj. (En el iPhone, varios vídeos con sonido a
  // la vez se pausan entre sí y todo iba a tropezones.)
  const bytes = useRef(new Map<string, Promise<ArrayBuffer | null>>());
  useEffect(() => {
    const get = (src: string) =>
      fetch(src)
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .catch(() => null);
    bytes.current.set('cancion', get(url));
    for (const m of takes) if (m.videoUri) bytes.current.set(m.id, get(m.videoUri));
  }, [takes, url]);
  const ctx = useRef<AudioContext | null>(null);
  const fuentes = useRef<AudioBufferSourceNode[]>([]);
  const ganancias = useRef(new Map<string, GainNode>());
  const sonido = useRef<Promise<Map<string, AudioBuffer>> | null>(null);

  // Esperar a que todo pueda empezar (como mucho unos segundos).
  useEffect(() => {
    let alive = true;
    const els = [...videos.current.values()];
    const ready = (el: HTMLMediaElement) =>
      el.readyState >= 3
        ? Promise.resolve()
        : new Promise<void>((r) => {
            el.addEventListener('canplay', () => r(), { once: true });
            el.addEventListener('error', () => r(), { once: true });
          });
    Promise.race([
      Promise.all([...els.map(ready), bytes.current.get('cancion')]),
      new Promise((r) => setTimeout(r, 6000)),
    ]).then(() => alive && setState((s) => (s === 'loading' ? 'ready' : s)));
    return () => {
      alive = false;
    };
  }, [takes, url]);

  const parar = () => {
    cancelAnimationFrame(frame.current);
    fuentes.current.forEach((f) => {
      try {
        f.stop();
      } catch {
        // ya parada
      }
    });
    fuentes.current = [];
    videos.current.forEach((v) => v.pause());
  };
  useEffect(
    () => () => {
      parar();
      ctx.current?.close().catch(() => {});
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const clipOf = (m: Moment) => m.videoClip?.start ?? 0;

  // Al tocar: se crea el sonido (en iPhone solo se puede tras un toque), se
  // «despiertan» los vídeos, sale la portada unos segundos y empieza el montaje.
  const introTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(introTimer.current), []);
  const start = () => {
    if (!ctx.current) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      ctx.current = new Ctx();
    }
    const c = ctx.current;
    c.resume().catch(() => {});
    // un sonido vacío dentro del toque: así el iPhone deja sonar lo demás
    const b = c.createBuffer(1, 1, 22050);
    const s0 = c.createBufferSource();
    s0.buffer = b;
    s0.connect(c.destination);
    s0.start();
    for (const v of videos.current.values()) {
      v.muted = true;
      v.play()
        .then(() => v.pause())
        .catch(() => {});
    }
    // decodificar mientras se ve la portada
    sonido.current ??= (async () => {
      const out = new Map<string, AudioBuffer>();
      for (const [id, p] of bytes.current) {
        const ab = await p;
        if (!ab) continue;
        try {
          out.set(id, await c.decodeAudioData(ab.slice(0)));
        } catch {
          // sin sonido para esa voz: el vídeo sale igual
        }
      }
      return out;
    })();
    setState('intro');
    const desde = performance.now();
    introTimer.current = setTimeout(async () => {
      const buffers = await sonido.current!;
      // si decodificar tardó más que la portada, se empieza en cuanto esté
      setTimeout(() => play(buffers), Math.max(0, INTRO_MS - (performance.now() - desde)));
    }, 0);
  };

  const play = (buffers: Map<string, AudioBuffer>) => {
    const c = ctx.current;
    if (!c) return;
    c.resume().catch(() => {});
    parar();
    const cuando = c.currentTime + 0.25;
    // Todo pasa por un compresor: las voces pueden ir fuertes sin saturar.
    const salida = c.createDynamicsCompressor();
    salida.threshold.value = -14;
    salida.ratio.value = 4;
    salida.connect(c.destination);
    const fuente = (buf: AudioBuffer, offset: number, nivel: number, id?: string) => {
      const src = c.createBufferSource();
      src.buffer = buf;
      const g = c.createGain();
      g.gain.value = nivel;
      src.connect(g).connect(salida);
      src.start(cuando, Math.max(0, Math.min(offset, buf.duration - 0.05)));
      fuentes.current.push(src);
      if (id) ganancias.current.set(id, g);
    };
    const cancion = buffers.get('cancion');
    // la canción, de fondo (10 %); las voces, delante
    if (cancion) fuente(cancion, game.start, MUSICA);
    ganancias.current.clear();
    for (const m of takes) {
      const buf = buffers.get(m.id);
      if (buf) fuente(buf, clipOf(m), 0, m.id);
      const v = videos.current.get(m.id);
      if (!v) continue;
      v.muted = true;
      v.currentTime = clipOf(m);
    }
    // los vídeos arrancan justo cuando empieza a sonar
    setTimeout(
      () => videos.current.forEach((v) => v.play().catch(() => {})),
      Math.max(0, (cuando - c.currentTime) * 1000),
    );
    setState('playing');
    let current = '';
    let versoVisto = -2;
    const saltos = new Map<string, number>();
    const loop = () => {
      const t = c.currentTime - cuando;
      setProgress(Math.max(0, Math.min(1, t / duration)));
      // la letra: el verso que toca ahora en la canción
      const enCancion = game.start + Math.max(0, t);
      let v = -1;
      for (let i = 0; i < versos.length; i++) if (versos[i].t <= enCancion + 0.15) v = i;
      if (v !== versoVisto) {
        versoVisto = v;
        setVerso(v);
      }
      const part = partAt(parts, Math.max(0, t));
      const singing = part?.singers ?? [];
      const key = singing.join(',');
      if (key !== current) {
        current = key;
        setActive(singing);
        // la voz de quien canta sube y las demás bajan (con un fundido corto)
        for (const [id, g] of ganancias.current)
          g.gain.setTargetAtTime(singing.includes(id) ? VOZ : 0, c.currentTime, 0.04);
      }
      const ahora = performance.now();
      for (const m of takes) {
        const v = videos.current.get(m.id);
        if (!v || t < 0) continue;
        const want = clipOf(m) + t;
        if (v.paused && !v.ended && want < (v.duration || 1e9)) v.play().catch(() => {});
        // Recolocar solo si se ha ido bastante, sin otro salto a medias y no más
        // de uno cada segundo y medio (en el iPhone cada salto tarda).
        if (
          !v.seeking &&
          Math.abs(v.currentTime - want) > 0.6 &&
          want < (v.duration || 1e9) &&
          ahora - (saltos.get(m.id) ?? 0) > 1500
        ) {
          saltos.set(m.id, ahora);
          v.currentTime = want;
        }
      }
      if (t >= duration) {
        parar();
        setState('ended');
        return;
      }
      frame.current = requestAnimationFrame(loop);
    };
    frame.current = requestAnimationFrame(loop);
  };

  // Dónde va cada vídeo: el que canta, a pantalla completa; en el final, en mosaico.
  const grid = active.length > 1;
  const cols = Math.ceil(Math.sqrt(active.length || 1));
  const rows = Math.ceil((active.length || 1) / cols);
  const place = (mid: string): React.CSSProperties => {
    const i = active.indexOf(mid);
    if (i < 0) return { left: '0%', top: '0%', width: '100%', height: '100%', opacity: 0 };
    if (!grid) return { left: '0%', top: '0%', width: '100%', height: '100%', opacity: 1 };
    const c = i % cols;
    const r = Math.floor(i / cols);
    return {
      left: `${(c / cols) * 100}%`,
      top: `${(r / rows) * 100}%`,
      width: `${100 / cols}%`,
      height: `${100 / rows}%`,
      opacity: 1,
    };
  };
  const solo = !grid && active[0] ? takes.find((m) => m.id === active[0]) : undefined;

  return (
    <View style={styles.recorder}>
      <View style={styles.frame}>
        {takes.map((m) => (
          <video
            muted
            key={m.id}
            ref={(el) => {
              if (el) videos.current.set(m.id, el);
              else videos.current.delete(m.id);
            }}
            src={m.videoUri}
            poster={m.imageUri}
            crossOrigin="anonymous"
            playsInline
            preload="auto"
            style={{
              position: 'absolute',
              objectFit: 'cover',
              transform: 'scaleX(-1)',
              transition:
                'left .45s cubic-bezier(.2,.85,.25,1), top .45s cubic-bezier(.2,.85,.25,1), width .45s cubic-bezier(.2,.85,.25,1), height .45s cubic-bezier(.2,.85,.25,1), opacity .35s ease',
              background: '#111',
              ...(state === 'ready' || state === 'loading' || state === 'intro'
                ? {
                    left: 0,
                    top: 0,
                    width: '100%',
                    height: '100%',
                    opacity: m === takes[0] ? 1 : 0,
                  }
                : place(m.id)),
            }}
          />
        ))}
        {state === 'playing' && (
          <>
            <View style={styles.progress}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
            <View style={styles.who}>
              <Text style={styles.whoText}>
                {grid
                  ? 'Todos juntos'
                  : solo
                    ? `Canta ${user(solo.authorId).name.split(' ')[0]}`
                    : ''}
              </Text>
            </View>
            {verso >= 0 && (
              <View pointerEvents="none" style={styles.letra}>
                <Animated.Text
                  key={verso}
                  entering={FadeInDown.duration(260)}
                  style={styles.letraAhora}>
                  {versos[verso].text}
                </Animated.Text>
                {!!versos[verso + 1] && (
                  <Text numberOfLines={1} style={styles.letraLuego}>
                    {versos[verso + 1].text}
                  </Text>
                )}
              </View>
            )}
          </>
        )}
        {state !== 'playing' && (
          <TitleCard
            game={game}
            names={takes.map((m) => user(m.authorId).name.split(' ')[0])}
            singers={takes.map((m) => m.authorId)}
            state={state}
            onPlay={start}
          />
        )}
      </View>
      <View style={styles.controls}>
        <Pressable onPress={onBack} style={styles.pill}>
          <Text style={styles.pillText}>Atrás</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Volumen de la canción y de las voces en el montaje. */
const MUSICA = 0.1;
const VOZ = 1.6;

/** Lo que dura la portada antes de que empiece el montaje. */
const INTRO_MS = 3200;

/**
 * La portada del karaoke: la carátula, la canción y quién canta. Se ve antes
 * de empezar (con el botón), como entrada animada y otra vez al final.
 */
function TitleCard({
  game,
  names,
  singers,
  state,
  onPlay,
}: {
  game: KaraokeGame;
  names: string[];
  singers: string[];
  state: 'loading' | 'ready' | 'intro' | 'ended';
  onPlay: () => void;
}) {
  const intro = state === 'intro';
  const list =
    names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : names[0];
  const anim = (name: string, delay: number, ms = 700) =>
    intro ? { animation: `${name} ${ms}ms cubic-bezier(.2,.85,.25,1) ${delay}ms both` } : {};
  return (
    <div
      role={intro ? undefined : 'button'}
      aria-label={state === 'ended' ? 'Ver otra vez' : 'Ver el karaoke'}
      onClick={state === 'ready' || state === 'ended' ? onPlay : undefined}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background: '#16171B',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: 24,
        textAlign: 'center',
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        cursor: state === 'loading' || intro ? 'default' : 'pointer',
        zIndex: 5,
        ...(intro ? { animation: `kOut 600ms ease ${INTRO_MS - 600}ms both` } : {}),
      }}>
      <style>{`
        @keyframes kCover { from { opacity: 0; transform: scale(.55) rotate(-8deg) } to { opacity: 1; transform: none } }
        @keyframes kUp { from { opacity: 0; transform: translateY(18px) } to { opacity: 1; transform: none } }
        @keyframes kBg { from { transform: scale(1.35) } to { transform: scale(1.1) } }
        @keyframes kOut { to { opacity: 0; transform: scale(1.06) } }
        @keyframes kSpin { to { transform: rotate(360deg) } }
      `}</style>
      {/* la carátula, enorme y difuminada, de fondo */}
      {!!game.artwork && (
        <div
          style={{
            position: 'absolute',
            inset: -40,
            background: `url("${game.artwork}") center / cover`,
            filter: 'blur(38px) saturate(1.3)',
            opacity: 0.55,
            transform: 'scale(1.1)',
            ...anim('kBg', 0, INTRO_MS),
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 50% 40%, rgba(0,0,0,0) 0%, rgba(0,0,0,.55) 75%)',
        }}
      />
      <div
        style={{
          position: 'relative',
          fontSize: 13,
          letterSpacing: 3,
          color: GOLD,
          fontWeight: 800,
          ...anim('kUp', 100),
        }}>
        KARAOKE
      </div>
      {/* la carátula (o un disco, si es una pista subida sin carátula) */}
      <div
        style={{
          position: 'relative',
          width: 'min(62%, 240px)',
          aspectRatio: '1',
          borderRadius: game.artwork ? 16 : '50%',
          overflow: 'hidden',
          boxShadow: '0 28px 70px rgba(0,0,0,.6)',
          background: game.artwork
            ? `url("${game.artwork}") center / cover`
            : `radial-gradient(circle, ${GOLD} 0 16%, #111 17% 19%, #2a2b30 20% 100%)`,
          ...anim('kCover', 250, 900),
        }}>
        {!game.artwork && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background:
                'repeating-radial-gradient(circle, rgba(255,255,255,.05) 0 2px, transparent 2px 5px)',
              animation: intro ? 'kSpin 2.4s linear infinite' : undefined,
            }}
          />
        )}
      </div>
      <div style={{ position: 'relative', ...anim('kUp', 650) }}>
        <div style={{ color: '#fff', fontSize: 26, fontWeight: 800, lineHeight: 1.15 }}>
          {game.song}
        </div>
        {!!game.artist && (
          <div style={{ color: 'rgba(255,255,255,.75)', fontSize: 16, marginTop: 4 }}>
            {game.artist}
          </div>
        )}
      </div>
      {names.length > 0 && (
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            ...anim('kUp', 1100),
          }}>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {singers.slice(0, 8).map((id) => (
              <Avatar key={id} userId={id} size={30} />
            ))}
          </View>
          <div style={{ color: 'rgba(255,255,255,.85)', fontSize: 15 }}>
            {names.length > 1 ? `Cantan ${list}` : `Canta ${list}`}
          </div>
        </div>
      )}
      {state === 'loading' && (
        <div style={{ position: 'relative', color: 'rgba(255,255,255,.75)', fontSize: 14 }}>
          Preparando las voces…
        </div>
      )}
      {(state === 'ready' || state === 'ended') && (
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            marginTop: 6,
          }}>
          <View style={styles.playBig}>
            <Icon icon={state === 'ended' ? RotateCcw : Play} size={30} color="#1D1F22" />
          </View>
          <div style={{ color: 'rgba(255,255,255,.75)', fontSize: 14 }}>
            {state === 'ended'
              ? 'Otra vez'
              : names.length > 1
                ? 'Por turnos y al final, todos'
                : ''}
          </div>
        </div>
      )}
    </div>
  );
}

const videoFill: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  background: '#111',
};

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: '#121316', overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
  light: { color: '#FFFFFF', fontSize: 17 },
  top: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  songTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  songArtist: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  home: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
    paddingBottom: 40,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  cover: {
    width: 220,
    height: 220,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
  } as never,
  meta: { color: 'rgba(255,255,255,0.8)', fontSize: 15, textAlign: 'center' },
  big: {
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigText: { fontSize: 17, fontWeight: '700' },
  gold: { backgroundColor: GOLD },
  ghost: { backgroundColor: 'rgba(255,255,255,0.14)' },
  tip: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 4 },
  tipText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    lineHeight: 19,
    textAlign: 'center',
    flexShrink: 1,
  },
  recorder: {
    flex: 1,
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingBottom: 24,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  frame: {
    flex: 1,
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  dim: { backgroundColor: 'rgba(0,0,0,0.35)' },
  count: { color: '#FFFFFF', fontSize: 120, fontWeight: '800' },
  progress: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: GOLD },
  rec: {
    position: 'absolute',
    top: 26,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF4D4D' },
  recText: { color: '#FFFFFF', fontSize: 13, fontVariant: ['tabular-nums'] },
  who: {
    position: 'absolute',
    top: 26,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  whoText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  letra: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 34,
    alignItems: 'center',
    gap: 6,
  },
  letraAhora: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  letraLuego: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  lyrics: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 22,
    gap: 6,
    alignItems: 'center',
    backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0))',
  } as never,
  lyricNow: {
    color: GOLD,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 6,
  },
  lyricUpcoming: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 6,
  },
  lyricDots: { color: GOLD, fontSize: 18, letterSpacing: 4, textAlign: 'center' },
  lyricPast: { color: 'rgba(255,255,255,0.45)', fontSize: 16, textAlign: 'center' },
  lyricNext: { color: 'rgba(255,255,255,0.85)', fontSize: 17, textAlign: 'center' },
  lyricFar: { fontSize: 16 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    alignSelf: 'stretch',
    minHeight: 76,
    paddingHorizontal: 8,
  },
  pill: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    minWidth: 72,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  pillText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  recButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 'auto',
  } as never,
  recInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#FF4D4D' },
  stopInner: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#FF4D4D' },
  playBig: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { color: '#FFB4B4', fontSize: 15, textAlign: 'center' },
});
