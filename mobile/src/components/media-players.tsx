import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { memo, useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/constants/theme';
import type { Moment } from '@/data/types';
import { mmss } from '@/lib/music';

import { Photo } from './ui';

// En la web el vídeo es una etiqueta <video>: «top/left/right/bottom: 0» no la estira
// (es un elemento «reemplazado»), así que el tamaño se fija con ancho y alto al 100 %.
const FILL = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' } as const;

/**
 * La superficie del vídeo, aislada: si se volviera a dibujar al cambiar otra cosa
 * (el icono del sonido), el reproductor web recargaría el vídeo y lo cortaría.
 */
const Surface = memo(function Surface({ player }: { player: VideoPlayer }) {
  return (
    <VideoView player={player} style={FILL} contentFit="cover" nativeControls={false} playsInline />
  );
});

/** Reproduce o pausa según el vídeo esté a la vista (en la web). */
function useAutoplayWhenVisible(player: VideoPlayer, host: { current: unknown }, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const node = host.current as unknown as Element | null;
    if (Platform.OS !== 'web' || !node || typeof IntersectionObserver === 'undefined') {
      const id = setTimeout(() => player.play(), 50);
      return () => clearTimeout(id);
    }
    const io = new IntersectionObserver(
      ([entry]) =>
        entry.isIntersecting && entry.intersectionRatio > 0.4 ? player.play() : player.pause(),
      { threshold: [0, 0.4, 0.8] },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [player, host, enabled]);
}

/** Vídeo silencioso en bucle (vistas previas e historias). */
export function InlineVideo({
  uri,
  muted = true,
  loop = true,
  controls = false,
  style,
}: {
  uri: string;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const host = useRef<any>(null);
  const player = useVideoPlayer(uri, (p) => {
    p.loop = loop;
    p.muted = muted;
  });
  useAutoplayWhenVisible(player, host, true);
  return (
    <View ref={host} style={[StyleSheet.absoluteFill, { overflow: 'hidden' }, style]}>
      <VideoView
        player={player}
        style={FILL}
        contentFit="cover"
        nativeControls={controls}
        playsInline
      />
    </View>
  );
}

/** Primer fotograma de un vídeo sin portada guardada (vídeo en pausa). */
export function VideoFrame({ uri }: { uri: string }) {
  const player = useVideoPlayer(`${uri}#t=0.1`, (p) => {
    p.muted = true;
  });
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { overflow: 'hidden', backgroundColor: '#2B2E33' }]}>
      <VideoView
        player={player}
        style={FILL}
        contentFit="cover"
        nativeControls={false}
        playsInline
      />
    </View>
  );
}

/**
 * Vídeo de un momento, como en Instagram: se reproduce solo y en silencio
 * mientras está a la vista; al tocarlo suena (y al volver a tocar, se calla).
 */
export function VideoMoment({ moment, style }: { moment: Moment; style?: StyleProp<ViewStyle> }) {
  const host = useRef<any>(null);
  const [sound, setSound] = useState(false);
  const player = useVideoPlayer(moment.videoUri ?? null, (p) => {
    p.loop = true;
    p.muted = true;
  });
  useAutoplayWhenVisible(player, host, !!moment.videoUri);

  const toggle = () => {
    const next = !sound;
    player.muted = !next;
    if (next) {
      // Al activar el sonido, desde el principio, como en las redes.
      player.currentTime = 0;
      player.play();
    }
    setSound(next);
  };

  return (
    <Pressable
      ref={host}
      accessibilityRole="button"
      accessibilityLabel={sound ? 'Silenciar el vídeo' : 'Activar el sonido del vídeo'}
      onPress={toggle}
      style={[{ overflow: 'hidden', backgroundColor: '#1B1C1E' }, style]}>
      {moment.imageUri && <Photo moment={moment} style={StyleSheet.absoluteFill} badge={false} />}
      <Surface player={player} />
      <View pointerEvents="none" style={styles.sound}>
        <Text style={styles.soundText}>{sound ? '🔊' : '🔇'}</Text>
      </View>
      {!!moment.videoDuration && (
        <Text pointerEvents="none" style={styles.duration}>
          {mmss(moment.videoDuration)}
        </Text>
      )}
    </Pressable>
  );
}

/** Normaliza la forma de onda para que la voz se vea, aunque se grabara bajito. */
export function normalizeWave(wave: number[], count?: number): number[] {
  const src = wave.length ? wave : Array.from({ length: 32 }, (_, i) => 30 + ((i * 37) % 50));
  const max = Math.max(1, ...src);
  const out = src.map((v) => Math.sqrt(v / max) * 100);
  if (!count || count === out.length) return out;
  return Array.from({ length: count }, (_, i) => out[Math.floor((i / count) * out.length)]);
}

/** Barras de sonido grandes, para una nota de voz sin foto. */
export function Waveform({
  wave,
  color = '#E2703A',
  height = 120,
}: {
  wave: number[];
  color?: string;
  height?: number;
}) {
  const bars = normalizeWave(wave, 40);
  return (
    <View
      pointerEvents="none"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height, width: '82%' }}>
      {bars.map((v, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: Math.max(6, (v / 100) * height),
            borderRadius: 4,
            backgroundColor: color,
            opacity: 0.35 + (v / 100) * 0.65,
          }}
        />
      ))}
    </View>
  );
}

/**
 * Nota de voz: botón de reproducir, forma de onda que se va coloreando y tiempo.
 * La duración se toma de la guardada: algunos navegadores no la saben leer del audio.
 */
export function VoiceNote({
  voice,
  compact,
  tint = '#E2703A',
}: {
  voice: { uri: string; duration: number; waveform: number[] };
  compact?: boolean;
  tint?: string;
}) {
  const theme = useTheme();
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const available = Platform.OS === 'web' && typeof Audio !== 'undefined';

  useEffect(() => {
    if (!available) return;
    const a = new Audio(voice.uri);
    a.preload = 'none';
    audio.current = a;
    const tick = () => setPosition(a.currentTime);
    const end = () => {
      setPlaying(false);
      setPosition(0);
    };
    a.addEventListener('timeupdate', tick);
    a.addEventListener('ended', end);
    a.addEventListener('pause', () => setPlaying(false));
    a.addEventListener('play', () => setPlaying(true));
    return () => {
      a.pause();
      a.src = '';
    };
  }, [voice.uri, available]);

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => setPlaying(false));
    else a.pause();
  };
  const bars = normalizeWave(voice.waveform, 40);
  const progress = voice.duration ? Math.min(1, position / voice.duration) : 0;
  const h = compact ? 22 : 30;
  const active = playing || position > 0;

  return (
    <View
      style={[styles.voice, { backgroundColor: theme.soft }, compact && { paddingVertical: 6 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Pausar la nota de voz' : 'Escuchar la nota de voz'}
        onPress={toggle}
        style={[
          styles.voiceBtn,
          { backgroundColor: theme.accent },
          compact && { width: 32, height: 32 },
        ]}>
        <Text
          style={{
            color: theme.onAccent,
            fontSize: compact ? 12 : 14,
            marginLeft: playing ? 0 : 2,
          }}>
          {playing ? '❚❚' : '▶'}
        </Text>
      </Pressable>
      <View style={[styles.wave, { height: h }]}>
        {bars.map((v, i) => {
          const done = active && i / bars.length <= progress;
          return (
            <View
              key={i}
              style={{
                flex: 1,
                height: Math.max(4, (v / 100) * h),
                borderRadius: 2,
                backgroundColor: done ? tint : theme.textSecondary,
                opacity: done ? 1 : 0.5,
              }}
            />
          );
        })}
      </View>
      <Text style={[styles.voiceTime, { color: theme.textSecondary }]}>
        {mmss(active ? position : voice.duration)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sound: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundText: { fontSize: 15 },
  duration: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  voice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    paddingRight: 14,
    borderRadius: 999,
  },
  voiceBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wave: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2 },
  voiceTime: { fontSize: 12, fontVariant: ['tabular-nums'], minWidth: 30, textAlign: 'right' },
});
