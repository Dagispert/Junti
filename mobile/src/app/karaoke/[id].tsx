import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Headphones, Mic, Play, RotateCcw, Send, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { Avatar } from '@/components/ui';
import { errorText, useStore } from '@/data/store';
import type { KaraokeGame, Moment } from '@/data/types';
import { canRecord, mixer, partAt, planMontage, recorderType, trackUrl } from '@/lib/karaoke';
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
        <Montage game={game} url={url} takes={takes} seed={proposal.id} onBack={() => setMode('home')} />
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
          <Image source={{ uri: game.artwork }} style={StyleSheet.absoluteFill} contentFit="cover" />
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

function Lyrics({ text, progress }: { text: string; progress: number }) {
  const lines = useMemo(
    () =>
      text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean),
    [text],
  );
  if (!lines.length) return null;
  // Cada línea dura lo mismo; la actual, en grande y en el centro.
  const current = Math.min(lines.length - 1, Math.floor(progress * lines.length));
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
        a.currentTime = game.start;
      })
      .catch(() => {
        a.muted = false;
      });
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
      a.currentTime = game.start;
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
        {phase === 'singing' && (
          <>
            <View style={styles.progress}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
            <View style={styles.rec}>
              <View style={styles.recDot} />
              <Text style={styles.recText}>{mmss(progress * duration)}</Text>
            </View>
            {!!game.lyrics && <Lyrics text={game.lyrics} progress={progress} />}
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
  const audio = useRef<HTMLAudioElement | null>(null);
  const mix = useRef<ReturnType<typeof mixer> | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'playing' | 'ended'>('loading');
  const [active, setActive] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const frame = useRef(0);

  // Esperar a que todo pueda empezar (como mucho unos segundos).
  useEffect(() => {
    let alive = true;
    const els = [audio.current, ...videos.current.values()].filter(Boolean) as HTMLMediaElement[];
    const ready = (el: HTMLMediaElement) =>
      el.readyState >= 3
        ? Promise.resolve()
        : new Promise<void>((r) => {
            el.addEventListener('canplay', () => r(), { once: true });
            el.addEventListener('error', () => r(), { once: true });
          });
    Promise.race([Promise.all(els.map(ready)), new Promise((r) => setTimeout(r, 6000))]).then(
      () => alive && setState((s) => (s === 'loading' ? 'ready' : s)),
    );
    return () => {
      alive = false;
    };
  }, [takes, url]);

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      audio.current?.pause();
      videos.current.forEach((v) => v.pause());
      mix.current?.close();
    },
    [],
  );

  const clipOf = (m: Moment) => m.videoClip?.start ?? 0;

  const play = () => {
    const a = audio.current;
    if (!a) return;
    if (!mix.current) {
      mix.current = mixer();
      mix.current.add(a, 0.75);
      videos.current.forEach((v) => mix.current!.add(v, 0));
    }
    mix.current.resume();
    a.currentTime = game.start;
    for (const m of takes) {
      const v = videos.current.get(m.id);
      if (!v) continue;
      v.currentTime = clipOf(m);
      v.play().catch(() => {});
    }
    a.play().catch(() => {});
    setState('playing');
    let current = '';
    const loop = () => {
      const t = a.currentTime - game.start;
      setProgress(Math.max(0, Math.min(1, t / duration)));
      const part = partAt(parts, t);
      const singing = part?.singers ?? [];
      const key = singing.join(',');
      if (key !== current) {
        current = key;
        setActive(singing);
      }
      for (const m of takes) {
        const v = videos.current.get(m.id);
        if (!v) continue;
        const want = clipOf(m) + t;
        if (!v.paused && Math.abs(v.currentTime - want) > 0.3 && want < (v.duration || 1e9))
          v.currentTime = want;
        mix.current?.set(v, singing.includes(m.id) ? 1 : 0);
      }
      if (t >= duration || a.ended) {
        a.pause();
        videos.current.forEach((v) => v.pause());
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
        <audio ref={audio} src={url} crossOrigin="anonymous" preload="auto" />
        {takes.map((m) => (
          <video
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
              ...(state === 'ready' || state === 'loading'
                ? { left: 0, top: 0, width: '100%', height: '100%', opacity: m === takes[0] ? 1 : 0 }
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
            {!!game.lyrics && <Lyrics text={game.lyrics} progress={progress} />}
          </>
        )}
        {state !== 'playing' && (
          <Pressable
            accessibilityLabel={state === 'ended' ? 'Ver otra vez' : 'Ver el karaoke'}
            disabled={state === 'loading'}
            onPress={play}
            style={[StyleSheet.absoluteFill, styles.center, styles.dim]}>
            {state === 'loading' ? (
              <>
                <ActivityIndicator color="#FFFFFF" />
                <Text style={[styles.tipText, { marginTop: 12 }]}>Preparando las voces…</Text>
              </>
            ) : (
              <>
                <View style={styles.playBig}>
                  <Icon icon={state === 'ended' ? RotateCcw : Play} size={30} color="#1D1F22" />
                </View>
                <Text style={[styles.tipText, { marginTop: 12 }]}>
                  {state === 'ended'
                    ? 'Otra vez'
                    : takes.length > 1
                      ? `${takes.length} voces, por turnos y al final todos`
                      : 'De momento, una voz'}
                </Text>
              </>
            )}
          </Pressable>
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
