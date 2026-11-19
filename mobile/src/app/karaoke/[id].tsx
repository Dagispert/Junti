import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Headphones, Mic, Play, RotateCcw, Send, Share2, Trash2, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { Avatar } from '@/components/ui';
import { errorText, useStore } from '@/data/store';
import type { KaraokeGame, Moment } from '@/data/types';
import { apuntarError } from '@/lib/errores';
import { shareFile } from '@/lib/export-media';
import {
  audioDeTipo,
  canRecord,
  guardarVozToma,
  partAt,
  planMontage,
  recorderType,
  tieneOpus,
  trackUrl,
  vocesEnWav,
} from '@/lib/karaoke';
import { idParaPublicar } from '@/lib/cola';
import { sonar } from '@/lib/sonidos';
import {
  ALTO,
  ANCHO,
  firmaTomas,
  difuminar,
  imagenLimpia,
  pildora,
  pintarAvatar,
  pintarLogo,
  pintarPalabra,
  pintarVideo,
  subirMontaje,
  textoCentrado,
  useMontaje,
} from '@/lib/montaje';
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
      {mode === 'watch' && (game.cerrado || (!open && !takes.length)) && (
        <MontajeGuardado game={game} onBack={() => setMode('home')} />
      )}
      {mode === 'watch' && url && !(game.cerrado || (!open && !takes.length)) && (
        <Montage
          game={game}
          url={url}
          takes={takes}
          seed={proposal.id}
          groupId={proposal.groupId}
          abierto={open}
          onBack={() => setMode('home')}
        />
      )}
      {mode === 'record' && !url && <ActivityIndicator color="#FFFFFF" style={{ marginTop: 80 }} />}
    </View>
  );
}

/* ───────────── Borrar mi vídeo (si salió mal) ───────────── */

/** «Borrar mi vídeo y repetirlo», con su pregunta antes. */
function BorrarMiToma({ toma, onBorrado }: { toma: Moment; onBorrado?: () => void }) {
  const { deleteMoment } = useStore();
  const [borrando, setBorrando] = useState<'' | 'preguntar' | 'borrando'>('');
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      {borrando === 'preguntar' ? (
        <>
          <Text style={[styles.tipText, { marginTop: 0 }]}>
            Se borrará tu vídeo del karaoke y podrás grabarlo otra vez. ¿Lo borramos?
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              accessibilityRole="button"
              onPress={async () => {
                setBorrando('borrando');
                try {
                  await deleteMoment(toma.id);
                  onBorrado?.();
                } catch {
                  // si falla, se puede volver a intentar
                }
                setBorrando('');
              }}
              style={[styles.pill, { backgroundColor: '#E8563F' }]}>
              <Text style={[styles.pillText, { color: '#FFFFFF' }]}>Sí, borrarlo</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setBorrando('')}
              style={[styles.pill, { backgroundColor: 'rgba(255,255,255,0.14)' }]}>
              <Text style={[styles.pillText, { color: '#FFFFFF' }]}>Aún no</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <Pressable
          accessibilityRole="button"
          disabled={borrando === 'borrando'}
          onPress={() => setBorrando('preguntar')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8 }}>
          <Icon icon={Trash2} size={15} color="rgba(255,255,255,0.75)" />
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '600' }}>
            {borrando === 'borrando' ? 'Borrando…' : 'Borrar mi vídeo y repetirlo'}
          </Text>
        </Pressable>
      )}
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
  const { user, me } = useStore();
  const montaje = useMontaje(game);
  const cerrado = !canSing && !!montaje.video;
  // borrar mi vídeo (si salió mal) para poder cantar otra vez
  const mio = takes.find((m) => m.authorId === me);
  const length = Math.round(game.end - game.start);
  const names = takes.map((m) => user(m.authorId).name.split(' ')[0]);
  return (
    <View style={styles.home}>
      <View style={[styles.cover, cerrado && styles.coverVideo]}>
        {cerrado ? (
          // terminado: la portada del karaoke de todos (el vídeo, al tocar «Ver»;
          // así no se descarga solo cada vez que se abre)
          <img
            src={montaje.poster ?? game.artwork}
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : game.artwork ? (
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
        {cerrado
          ? 'terminado'
          : takes.length === 0
            ? 'nadie ha cantado aún'
            : takes.length === 1
              ? `ha cantado ${names[0]}`
              : `${takes.length} voces`}
      </Text>
      {(takes.length > 0 || !!game.montaje?.voces?.length) && (
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          {(takes.length ? takes.map((m) => m.authorId) : (game.montaje?.voces ?? [])).map((u) => (
            <Avatar key={u} userId={u} size={36} />
          ))}
        </View>
      )}
      <View style={{ gap: 12, alignSelf: 'stretch', marginTop: 8 }}>
        {(takes.length > 0 || cerrado) && (
          <Pressable accessibilityRole="button" onPress={onWatch} style={[styles.big, styles.gold]}>
            <Icon icon={Play} size={20} color="#1D1F22" />
            <Text style={[styles.bigText, { color: '#1D1F22' }]}>
              {cerrado || takes.length > 1 ? 'Ver el karaoke' : 'Ver cómo va'}
            </Text>
          </Pressable>
        )}
        {canSing && !sung && (
          <Pressable
            accessibilityRole="button"
            onPress={onSing}
            style={[styles.big, takes.length ? styles.ghost : styles.gold]}>
            <Icon icon={Mic} size={20} color={takes.length ? '#FFFFFF' : '#1D1F22'} />
            <Text style={[styles.bigText, { color: takes.length ? '#FFFFFF' : '#1D1F22' }]}>
              Cantar
            </Text>
          </Pressable>
        )}
      </View>
      {canSing && sung && (
        <Text style={styles.tipText}>
          Ya has cantado. Cuando canten los demás, sus voces se suman al karaoke.
        </Text>
      )}
      {canSing && mio && <BorrarMiToma toma={mio} />}
      {canSing && !sung && (
        <View style={styles.tip}>
          <Icon icon={Headphones} size={18} color="rgba(255,255,255,0.75)" />
          <Text style={[styles.tipText, { textAlign: 'left' }]}>
            Mientras grabas, la canción suena muy bajita para que no se cuele en tu vídeo: guíate
            por la letra. Luego se pone debajo de todas las voces.
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
  const { addMoment, me } = useStore();
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

  // El volumen de la canción: al grabar, casi sin oírse (2 %) para que no se
  // cuele en tu vídeo; al revisar, normal. Va por Web Audio porque el iPhone
  // no deja cambiar el volumen de un audio normal.
  const sonido = useRef<{ ctx: AudioContext; gain: GainNode } | null>(null);
  const conVolumen = (a: HTMLAudioElement) => {
    if (sonido.current) return;
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const gain = ctx.createGain();
      ctx.createMediaElementSource(a).connect(gain).connect(ctx.destination);
      ctx.resume().catch(() => {});
      sonido.current = { ctx, gain };
    } catch {
      // sin Web Audio: se usa el volumen del audio (vale en Android y ordenador)
    }
  };
  const volumen = (v: number) => {
    const a = audio.current;
    if (sonido.current) {
      sonido.current.ctx.resume().catch(() => {});
      sonido.current.gain.gain.value = v;
    } else if (a) a.volume = v;
  };
  useEffect(() => () => void sonido.current?.ctx.close().catch(() => {}), []);

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
    // (para poder pasarla por Web Audio y bajarle el volumen)
    a.crossOrigin = 'anonymous';
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
    conVolumen(a);
    volumen(VOL_GRABANDO);
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
    // al revisar, la canción se oye normal
    volumen(1);
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
      const momentId = idParaPublicar();
      await addMoment({
        id: momentId,
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
      // Si la voz va en Opus (Chrome, Android), se guarda también en WAV: si no,
      // en el iPhone no se oye. Va aparte y sin esperar.
      if (audioDeTipo(take.mime) === 'opus') {
        const uri = take.uri;
        (async () => {
          const Ctx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          const c = new Ctx();
          try {
            const buf = await c.decodeAudioData(await (await fetch(uri)).arrayBuffer());
            await guardarVozToma(groupId, me, momentId, buf);
          } finally {
            c.close().catch(() => {});
          }
        })().catch((e) => apuntarError(e, 'aviso'));
      }
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

/* ───────────── El karaoke ya cerrado: solo queda el montaje ───────────── */

function MontajeGuardado({ game, onBack }: { game: KaraokeGame; onBack: () => void }) {
  const montaje = useMontaje(game);
  const [compartiendo, setCompartiendo] = useState(false);
  const compartir = async () => {
    if (!montaje.video) return;
    setCompartiendo(true);
    try {
      const blob = await (await fetch(montaje.video)).blob();
      await shareFile(
        blob,
        `karaoke.${/mp4/.test(blob.type) ? 'mp4' : 'webm'}`,
        `Karaoke: ${game.song}`,
      );
    } catch {
      // se puede volver a intentar
    }
    setCompartiendo(false);
  };
  return (
    <View style={styles.recorder}>
      <View style={styles.frame}>
        {montaje.video ? (
          <video
            src={montaje.video}
            poster={montaje.poster}
            controls
            autoPlay
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.center]}>
            {game.montaje ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={[styles.light, { textAlign: 'center', padding: 24 }]}>
                Este karaoke terminó sin que nadie llegara a cantar.
              </Text>
            )}
          </View>
        )}
      </View>
      <View style={styles.controls}>
        <Pressable onPress={onBack} style={styles.pill}>
          <Text style={styles.pillText}>Atrás</Text>
        </Pressable>
        {!!montaje.video && (
          <Pressable
            accessibilityRole="button"
            disabled={compartiendo}
            onPress={compartir}
            style={[styles.pill, { backgroundColor: '#F6C945' }]}>
            <Icon icon={Share2} size={16} color="#1D1F22" />
            <Text style={[styles.pillText, { color: '#1D1F22' }]}>
              {compartiendo ? 'Preparando…' : 'Compartir el vídeo'}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/* ───────────── El montaje: todas las voces ───────────── */

function Montage({
  game,
  url,
  takes,
  seed,
  groupId,
  abierto,
  onBack,
}: {
  game: KaraokeGame;
  url: string;
  takes: Moment[];
  seed: string;
  groupId: string;
  /** si aún se puede cantar (y por tanto borrar tu vídeo para repetirlo) */
  abierto: boolean;
  onBack: () => void;
}) {
  const { user, me, group } = useStore();
  const grupo = group(groupId);
  // Si el montaje guardado no tiene todas las voces, se graba ahora, mientras se ve.
  const firma = firmaTomas(takes.map((m) => m.id));
  // (y también si el guardado lleva el sonido en Opus y este móvil graba AAC: así
  // queda uno que se oye en todos los móviles)
  const tipoAqui = recorderType();
  const hayQueGrabar =
    !game.cerrado &&
    !!tipoAqui &&
    takes.length > 0 &&
    (game.montaje?.firma !== firma ||
      (game.montaje?.audio === 'opus' && audioDeTipo(tipoAqui) === 'aac'));
  const grab = useRef<{
    lienzo: HTMLCanvasElement;
    c2d: CanvasRenderingContext2D;
    rec: MediaRecorder;
    trozos: Blob[];
    dest: MediaStreamAudioDestinationNode;
    portada: Blob | null;
    arte: HTMLImageElement | null;
    /** la carátula ya difuminada (para el fondo de la portada y del cierre) */
    difuso: HTMLCanvasElement | null;
    fase: 'portada' | 'canto' | 'cierre';
    t0: number;
    /** las fotos de perfil de quien canta (por toma) */
    caras: Map<string, HTMLImageElement | null>;
    /** cada fotograma dibujado se manda a la grabación (algunos navegadores dejan de captarlos solos) */
    fotograma: () => void;
  } | null>(null);
  const [guardado, setGuardado] = useState<'' | 'grabando' | 'subiendo' | 'listo' | 'error'>('');
  const [archivo, setArchivo] = useState<Blob | null>(null);
  const [compartiendo, setCompartiendo] = useState(false);
  const montajeGuardado = useMontaje(game);
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
  /** las tomas cuya voz viene de su WAV */
  const deWav = useRef(new Set<string>());
  /** quién no se oye (su voz no se pudo leer en este móvil) */
  const [mudos, setMudos] = useState<string[]>([]);
  useEffect(() => {
    const get = (src: string) =>
      fetch(src)
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .catch(() => null);
    bytes.current.set('cancion', get(url));
    // la voz de cada uno: su WAV si lo tiene (se oye en todos los móviles); si no, el vídeo
    const wavs = vocesEnWav(takes.map((m) => m.id)).catch(() => new Map<string, string>());
    for (const m of takes)
      bytes.current.set(
        m.id,
        wavs.then((w) => {
          if (w.has(m.id)) {
            deWav.current.add(m.id);
            return get(w.get(m.id)!);
          }
          return m.videoUri ? get(m.videoUri) : null;
        }),
      );
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
      // si se sale a medias, la grabación no vale
      const g = grab.current;
      if (g && g.rec.state !== 'inactive') {
        g.rec.onstop = null;
        g.rec.stop();
      }
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
        // como mucho unos segundos por archivo: si no, se empieza sin esa voz
        const conTiempo = <T,>(pr: Promise<T>, ms: number) =>
          Promise.race([pr, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
        let buf: AudioBuffer | null = null;
        let fallo: unknown = null;
        try {
          buf = await conTiempo(c.decodeAudioData(ab.slice(0)), 8000);
        } catch (e) {
          fallo = e;
        }
        const opus = id !== 'cancion' && tieneOpus(ab);
        if (!buf && opus) {
          // el iPhone no sabe leer Opus por sí mismo: se decodifica aparte
          try {
            const { decodificarOpus } = await import('@/lib/opus');
            buf = await conTiempo(decodificarOpus(ab, c), 15000);
          } catch (e) {
            fallo = e;
          }
        }
        if (buf) {
          out.set(id, buf);
          // una toma en Opus sin su WAV: se deja guardado para que los demás
          // no tengan que decodificarla otra vez
          if (opus && !deWav.current.has(id))
            guardarVozToma(groupId, me, id, buf).catch((e) => apuntarError(e, 'aviso'));
        } else
          apuntarError(
            new Error(
              `Karaoke: no se pudo leer la voz (${id}): ${fallo ? ((fallo as Error)?.message ?? fallo) : 'tarda demasiado'}`,
            ),
            'aviso',
          );
      }
      return out;
    })();
    setState('intro');
    sonar('tele');
    if (hayQueGrabar && !grab.current && !archivo) empezarGrabacion(c);
    const desde = performance.now();
    introTimer.current = setTimeout(async () => {
      const buffers = await sonido.current!;
      // si falta la voz de alguien, el montaje no se guarda (saldría incompleto)
      setMudos(takes.filter((m) => !buffers.has(m.id)).map((m) => m.authorId));
      if (grab.current && takes.some((m) => !buffers.has(m.id))) {
        const g = grab.current;
        grab.current = null;
        if (g.rec.state !== 'inactive') {
          g.rec.onstop = null;
          g.rec.stop();
        }
        setGuardado('');
      }
      // si decodificar tardó más que la portada, se empieza en cuanto esté
      setTimeout(
        () => {
          try {
            play(buffers);
          } catch (e) {
            apuntarError(e, 'error');
            setState('ready');
          }
        },
        Math.max(0, INTRO_MS - (performance.now() - desde)),
      );
    }, 0);
  };

  // ── Grabar el montaje tal como se ve ──
  const empezarGrabacion = (c: AudioContext) => {
    try {
      const lienzo = document.createElement('canvas');
      lienzo.width = ANCHO;
      lienzo.height = ALTO;
      const c2d = lienzo.getContext('2d');
      if (!c2d || !lienzo.captureStream) return;
      const dest = c.createMediaStreamDestination();
      // un «silencio» conectado desde el principio: así la pista de sonido existe
      // ya durante la portada (si no, algunos navegadores la descartan)
      const silencio = c.createConstantSource();
      silencio.offset.value = 0;
      silencio.connect(dest);
      silencio.start();
      const pistaVideo = lienzo.captureStream(30).getVideoTracks();
      const stream = new MediaStream([...pistaVideo, ...dest.stream.getAudioTracks()]);
      const rec = new MediaRecorder(stream, {
        mimeType: recorderType() || undefined,
        // (1 Mbps: en el móvil se ve igual y pesa un tercio)
        videoBitsPerSecond: 1_000_000,
      });
      const trozos: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && trozos.push(e.data);
      const g: NonNullable<typeof grab.current> = {
        lienzo,
        c2d,
        rec,
        trozos,
        dest,
        portada: null,
        arte: null,
        difuso: null,
        fase: 'portada',
        t0: performance.now(),
        caras: new Map(),
        fotograma: () =>
          (pistaVideo[0] as MediaStreamTrack & { requestFrame?: () => void })?.requestFrame?.(),
      };
      for (const m of takes)
        imagenLimpia(user(m.authorId).avatarUri).then((img) => g.caras.set(m.id, img));
      grab.current = g;
      imagenLimpia(game.artwork).then((img) => {
        if (!img || grab.current !== g) return;
        g.arte = img;
        g.difuso = difuminar(img);
      });
      // el primer fotograma ya es la portada (si no, el vídeo empieza en negro)
      pintarPortada(c2d, null, null, 0);
      rec.start(1000);
      setGuardado('grabando');
      // la portada mientras se ve la de la pantalla
      const portada = () => {
        const actual = grab.current;
        if (!actual || actual.rec.state !== 'recording' || actual.fase !== 'portada') return;
        pintarPortada(
          actual.c2d,
          actual.arte,
          actual.difuso,
          (performance.now() - actual.t0) / 1000,
        );
        actual.fotograma();
        requestAnimationFrame(portada);
      };
      requestAnimationFrame(portada);
    } catch {
      grab.current = null;
    }
  };
  const nombres = takes.map((m) => user(m.authorId).name.split(' ')[0]);
  const quienesCantan =
    nombres.length > 1
      ? `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`
      : (nombres[0] ?? '');

  /** El fondo: la carátula muy difuminada y oscurecida (o un degradado, sin carátula). */
  const pintarFondo = (
    c2d: CanvasRenderingContext2D,
    difuso: HTMLCanvasElement | null,
    u: number,
  ) => {
    c2d.fillStyle = '#0E0F12';
    c2d.fillRect(0, 0, ANCHO, ALTO);
    if (difuso) {
      // se mueve muy despacio, como si respirara
      const z = 1.15 + Math.min(u, 8) * 0.012;
      const w = ANCHO * z;
      const h = ALTO * z;
      c2d.imageSmoothingEnabled = true;
      c2d.imageSmoothingQuality = 'high';
      c2d.drawImage(difuso, (ANCHO - w) / 2, (ALTO - h) / 2, w, h);
    }
    const sombra = c2d.createLinearGradient(0, 0, 0, ALTO);
    sombra.addColorStop(0, 'rgba(10,10,14,0.55)');
    sombra.addColorStop(0.55, 'rgba(10,10,14,0.35)');
    sombra.addColorStop(1, 'rgba(10,10,14,0.85)');
    c2d.fillStyle = sombra;
    c2d.fillRect(0, 0, ANCHO, ALTO);
  };

  /** La portada del vídeo: la carátula entra creciendo y luego los textos. */
  const pintarPortada = (
    c2d: CanvasRenderingContext2D,
    arte: HTMLImageElement | null,
    difuso: HTMLCanvasElement | null,
    u: number,
  ) => {
    pintarFondo(c2d, difuso, u);
    const ent = (desde: number, dura = 0.6) => {
      const x = Math.max(0, Math.min(1, (u - desde) / dura));
      return 1 - Math.pow(1 - x, 3);
    };
    const lado = 420;
    const k = ent(0.1, 0.8);
    if (arte) {
      const l = lado * (0.86 + 0.14 * k);
      c2d.save();
      c2d.globalAlpha = k;
      c2d.shadowColor = 'rgba(0,0,0,0.55)';
      c2d.shadowBlur = 24;
      c2d.shadowOffsetY = 12;
      c2d.beginPath();
      c2d.roundRect((ANCHO - l) / 2, 330 + (lado - l) / 2, l, l, 28);
      c2d.clip();
      c2d.drawImage(arte, (ANCHO - l) / 2, 330 + (lado - l) / 2, l, l);
      c2d.restore();
    }
    c2d.save();
    c2d.globalAlpha = ent(0.6);
    textoCentrado(c2d, 'KARAOKE', 830, 24, 700, 'rgba(255,255,255,0.6)');
    c2d.restore();
    c2d.save();
    c2d.globalAlpha = ent(0.75);
    const alto = textoCentrado(c2d, game.song, 890, 56, 700, '#FFFFFF');
    if (game.artist)
      textoCentrado(c2d, game.artist, 890 + alto + 4, 32, 500, 'rgba(255,255,255,0.75)');
    c2d.restore();
    c2d.save();
    c2d.globalAlpha = ent(1.1);
    // las caras de quienes cantan, en fila
    const r = 30;
    const paso = r * 1.5;
    const x0 = ANCHO / 2 - ((takes.length - 1) * paso) / 2;
    takes.forEach((m, i) => {
      const cara = caraDe(m.id);
      pintarAvatar(c2d, cara.img, cara.inicial, x0 + i * paso, 1050, r);
    });
    textoCentrado(c2d, `Cantan ${quienesCantan}`, 1130, 30, 600, '#F6C945');
    c2d.restore();
  };

  /** El cierre: «junti», el grupo y la canción. */
  const pintarCierre = (
    c2d: CanvasRenderingContext2D,
    difuso: HTMLCanvasElement | null,
    u: number,
  ) => {
    pintarFondo(c2d, difuso, 6 + u);
    c2d.fillStyle = `rgba(10,10,14,${Math.min(0.5, u * 0.5)})`;
    c2d.fillRect(0, 0, ANCHO, ALTO);
    const ent = (desde: number, dura = 0.6) => {
      const x = Math.max(0, Math.min(1, (u - desde) / dura));
      return 1 - Math.pow(1 - x, 3);
    };
    // el logo, con la animación de la pantalla de carga, y debajo «junti»
    pintarLogo(c2d, ANCHO / 2, 470, 190, Math.min(1, u / 1.6));
    c2d.save();
    const k = ent(1.2, 0.6);
    c2d.globalAlpha = k;
    pintarPalabra(c2d, ANCHO / 2, 650 + (1 - k) * 20, 92);
    c2d.restore();
    c2d.save();
    c2d.globalAlpha = ent(1.6);
    textoCentrado(c2d, grupo?.name ?? '', 790, 36, 600, '#FFFFFF');
    textoCentrado(
      c2d,
      `${game.song}${game.artist ? ` · ${game.artist}` : ''}`,
      845,
      28,
      500,
      'rgba(255,255,255,0.7)',
    );
    c2d.restore();
    c2d.save();
    c2d.globalAlpha = ent(2);
    textoCentrado(c2d, 'Cerca, aunque estéis lejos', 1120, 26, 500, 'rgba(255,255,255,0.55)');
    c2d.restore();
  };

  const caraDe = (tomaId: string) => {
    const m = takes.find((x) => x.id === tomaId);
    return {
      img: grab.current?.caras.get(tomaId),
      inicial: m ? user(m.authorId).name : '?',
    };
  };

  const pintarFotograma = (singing: string[], verso: number, solo?: Moment) => {
    const g = grab.current;
    if (!g) return;
    const c2d = g.c2d;
    c2d.fillStyle = '#000';
    c2d.fillRect(0, 0, ANCHO, ALTO);
    const quien = singing.length ? singing : takes[0] ? [takes[0].id] : [];
    const cols = Math.ceil(Math.sqrt(quien.length || 1));
    const rows = Math.ceil((quien.length || 1) / cols);
    quien.forEach((id, i) => {
      const v = videos.current.get(id);
      if (!v) return;
      const cw = ANCHO / cols;
      const ch = ALTO / rows;
      pintarVideo(c2d, v, (i % cols) * cw, Math.floor(i / cols) * ch, cw, ch);
    });
    pildora(
      c2d,
      singing.length > 1
        ? 'Todos juntos'
        : solo
          ? `Canta ${user(solo.authorId).name.split(' ')[0]}`
          : '',
      28,
      48,
      singing.map(caraDe),
    );
    if (verso >= 0 && versos[verso]) {
      const alto = textoCentrado(c2d, versos[verso].text, ALTO - 190, 46, 700, '#FFFFFF');
      if (versos[verso + 1])
        textoCentrado(
          c2d,
          versos[verso + 1].text,
          ALTO - 190 + alto + 6,
          30,
          600,
          'rgba(255,255,255,0.7)',
        );
    }
  };

  const terminarGrabacion = () => {
    const g = grab.current;
    if (!g || g.rec.state === 'inactive') return;
    g.rec.onstop = () => {
      const tipo = g.rec.mimeType || recorderType() || 'video/mp4';
      const video = new Blob(g.trozos, { type: tipo.split(';')[0] });
      grab.current = null;
      setArchivo(video);
      setGuardado('subiendo');
      subirMontaje({
        groupId,
        me,
        proposalId: seed,
        video,
        poster: g.portada?.size ? g.portada : null,
        firma,
        duracion: duration,
        voces: takes.map((m) => m.authorId),
        audio: audioDeTipo(tipo),
      }).then(
        () => setGuardado('listo'),
        (e) => {
          apuntarError(e, 'error');
          setGuardado('error');
        },
      );
    };
    setTimeout(() => g.rec.stop(), 300);
  };

  const compartir = async () => {
    setCompartiendo(true);
    try {
      let blob = archivo;
      if (!blob && montajeGuardado.video) blob = await (await fetch(montajeGuardado.video)).blob();
      if (blob)
        await shareFile(
          blob,
          `karaoke-${game.song.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}.${/mp4/.test(blob.type) ? 'mp4' : 'webm'}`,
          `Karaoke: ${game.song}`,
        );
    } catch {
      // si no se pudo, no pasa nada: se puede volver a intentar
    }
    setCompartiendo(false);
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
    if (grab.current) {
      salida.connect(grab.current.dest);
      grab.current.fase = 'canto';
    }
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
      if (grab.current) {
        const solo = singing.length === 1 ? takes.find((m) => m.id === singing[0]) : undefined;
        try {
          pintarFotograma(singing, versoVisto, solo);
          grab.current?.fotograma();
        } catch (e) {
          // si dibujar falla, se sigue viendo el karaoke (sin grabarlo)
          apuntarError(e, 'error');
          const g = grab.current;
          grab.current = null;
          if (g.rec.state !== 'inactive') {
            g.rec.onstop = null;
            g.rec.stop();
          }
          setGuardado('error');
        }
      }
      if (grab.current) {
        // la portada del montaje: un fotograma de la mitad
        if (!grab.current.portada && t > duration / 2) {
          const g = grab.current;
          g.portada = new Blob();
          g.lienzo.toBlob((b) => (g.portada = b), 'image/jpeg', 0.85);
        }
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
        sonar('aplausos');
        const g = grab.current;
        if (g) {
          // el cierre de Junti (unos segundos) antes de terminar el vídeo
          g.fase = 'cierre';
          const desde = performance.now();
          const cierre = () => {
            if (grab.current !== g || g.rec.state !== 'recording') return;
            const u = (performance.now() - desde) / 1000;
            pintarCierre(g.c2d, g.difuso, u);
            g.fotograma();
            if (u < CIERRE_S) requestAnimationFrame(cierre);
            else terminarGrabacion();
          };
          requestAnimationFrame(cierre);
        }
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
            <View style={[styles.who, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
              <View style={{ flexDirection: 'row' }}>
                {active.map((tid, i) => {
                  const t = takes.find((m) => m.id === tid);
                  return t ? (
                    <View
                      key={tid}
                      style={{
                        marginLeft: i ? -8 : 0,
                        borderRadius: 13,
                        borderWidth: 2,
                        borderColor: '#FFFFFF',
                      }}>
                      <Avatar userId={t.authorId} size={22} />
                    </View>
                  ) : null;
                })}
              </View>
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
        {(archivo || (!hayQueGrabar && montajeGuardado.video)) && state !== 'playing' && (
          <Pressable
            accessibilityRole="button"
            disabled={compartiendo}
            onPress={compartir}
            style={[styles.pill, { backgroundColor: '#F6C945' }]}>
            <Icon icon={Share2} size={16} color="#1D1F22" />
            <Text style={[styles.pillText, { color: '#1D1F22' }]}>
              {compartiendo ? 'Preparando…' : 'Compartir el vídeo'}
            </Text>
          </Pressable>
        )}
      </View>
      {/* tu vídeo salió mal: se borra aquí mismo y vuelves a la portada para repetirlo */}
      {abierto && state !== 'playing' && takes.some((m) => m.authorId === me) && (
        <BorrarMiToma toma={takes.find((m) => m.authorId === me)!} onBorrado={onBack} />
      )}
      {mudos.length > 0 && (
        <Text style={styles.guardado}>
          No se ha podido leer la voz de {mudos.map((u) => user(u).name.split(' ')[0]).join(' y ')}.
          El vídeo con todas las voces no se guarda así; vuelve a intentarlo en un rato.
        </Text>
      )}
      {!!guardado && (
        <Text style={styles.guardado}>
          {guardado === 'grabando'
            ? 'Se está guardando el karaoke para el grupo mientras lo ves.'
            : guardado === 'subiendo'
              ? 'Guardando el karaoke…'
              : guardado === 'listo'
                ? 'Karaoke guardado.'
                : 'No se ha podido guardar; se intentará la próxima vez que se vea.'}
        </Text>
      )}
    </View>
  );
}

/** Lo que dura el cierre de Junti al final del vídeo grabado. */
const CIERRE_S = 4;

/** Volumen de la canción y de las voces en el montaje. */
const MUSICA = 0.1;
/** Lo que suena la canción mientras grabas (para que no se cuele en tu vídeo). */
const VOL_GRABANDO = 0.02;
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
  coverVideo: { width: 220, height: 390, borderRadius: 24, overflow: 'hidden' },
  guardado: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 24,
  },
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
