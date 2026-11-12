import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react-native';
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

import { Icon } from './icon';
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

/**
 * Reproduce o pausa según el vídeo esté a la vista. En la web se comprueba la
 * posición cada poco (más fiable que IntersectionObserver dentro de listas con
 * su propio desplazamiento y tarjetas que entran animadas).
 */
function useAutoplayWhenVisible(player: VideoPlayer, host: { current: unknown }, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const node = host.current as Element | null;
    if (Platform.OS !== 'web' || !node || typeof node.getBoundingClientRect !== 'function') {
      const id = setTimeout(() => player.play(), 50);
      return () => clearTimeout(id);
    }
    let shown: boolean | null = null;
    const check = () => {
      const r = node.getBoundingClientRect();
      const h = window.innerHeight;
      const w = window.innerWidth;
      const visibleH = Math.min(r.bottom, h) - Math.max(r.top, 0);
      const visibleW = Math.min(r.right, w) - Math.max(r.left, 0);
      const on =
        !document.hidden &&
        r.width > 0 &&
        r.height > 0 &&
        visibleH > r.height * 0.35 &&
        visibleW > r.width * 0.35;
      if (on !== shown) {
        shown = on;
        if (on) player.play();
        else player.pause();
      }
    };
    check();
    const id = setInterval(check, 600);
    return () => {
      clearInterval(id);
      player.pause();
    };
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

/**
 * Clip animado de un vídeo, como un GIF: los primeros segundos en bucle, sin
 * sonido, y solo mientras está a la vista. Se usa en vez de una portada fija.
 */
export function VideoClip({ uri, seconds = 3 }: { uri: string; seconds?: number }) {
  const host = useRef<any>(null);
  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
    p.loop = true;
    p.timeUpdateEventInterval = 0.2;
  });
  useEffect(() => {
    const sub = player.addListener('timeUpdate', ({ currentTime }) => {
      if (currentTime >= seconds) player.currentTime = 0;
    });
    return () => sub.remove();
  }, [player, seconds]);
  useAutoplayWhenVisible(player, host, true);
  return (
    <View ref={host} pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      <Surface player={player} />
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
      {moment.imageUri && (
        <Photo moment={moment} style={StyleSheet.absoluteFill} badge={false} animate={false} />
      )}
      <Surface player={player} />
      <View pointerEvents="none" style={styles.sound}>
        <Icon icon={sound ? Volume2 : VolumeX} size={16} color="#fff" />
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
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height, width: '82%' }}>
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
      style={[styles.voice, { backgroundColor: theme.soft }, compact && { paddingVertical: 8 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Pausar la nota de voz' : 'Escuchar la nota de voz'}
        onPress={toggle}
        style={[
          styles.voiceBtn,
          { backgroundColor: theme.accent },
          compact && { width: 32, height: 32 },
        ]}>
        <Icon icon={playing ? Pause : Play} size={compact ? 14 : 16} color={theme.onAccent} />
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
    height: 36,
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
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  voice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 8,
    paddingRight: 16,
    borderRadius: 999,
  },
  voiceBtn: {
    width: 38,
    height: 40,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wave: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2 },
  voiceTime: { fontSize: 13, fontVariant: ['tabular-nums'], minWidth: 30, textAlign: 'right' },
});
