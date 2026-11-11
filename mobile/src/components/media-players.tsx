import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
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

/** Vídeo que se reproduce solo; para usarlo una vez que la persona lo ha pedido o en silencio. */
export function InlineVideo({
  uri,
  muted = false,
  loop = false,
  controls = true,
  style,
}: {
  uri: string;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = loop;
    p.muted = muted;
  });
  // Arranca en cuanto el vídeo está montado (antes, el navegador ignora la orden).
  useEffect(() => {
    const id = setTimeout(() => player.play(), 50);
    return () => clearTimeout(id);
  }, [player]);
  return (
    <VideoView player={player} style={style} contentFit="cover" nativeControls={controls} playsInline />
  );
}

/** Vídeo de un momento: su portada con ▶ y, al tocarla, el vídeo con sonido. */
export function VideoMoment({ moment, style }: { moment: Moment; style?: StyleProp<ViewStyle> }) {
  const [playing, setPlaying] = useState(false);
  if (playing && moment.videoUri) {
    return (
      <View style={[style, { backgroundColor: '#000' }]}>
        <InlineVideo uri={moment.videoUri} style={StyleSheet.absoluteFill} />
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Reproducir el vídeo"
      onPress={() => setPlaying(true)}
      style={style}>
      <Photo moment={moment} style={StyleSheet.absoluteFill} badge={false} />
      <View style={styles.bigPlay}>
        <Text style={styles.bigPlayText}>▶</Text>
      </View>
      {!!moment.videoDuration && <Text style={styles.duration}>{mmss(moment.videoDuration)}</Text>}
    </Pressable>
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
  const bars = voice.waveform.length
    ? voice.waveform
    : Array.from({ length: 32 }, (_, i) => 30 + ((i * 37) % 50));
  const progress = voice.duration ? Math.min(1, position / voice.duration) : 0;
  const h = compact ? 22 : 30;

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
        {bars.map((v, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: Math.max(3, (v / 100) * h),
              borderRadius: 2,
              backgroundColor:
                i / bars.length <= progress && (playing || position > 0)
                  ? tint
                  : theme.textSecondary,
              opacity: i / bars.length <= progress && (playing || position > 0) ? 1 : 0.45,
            }}
          />
        ))}
      </View>
      <Text style={[styles.voiceTime, { color: theme.textSecondary }]}>
        {mmss(playing || position ? position : voice.duration)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bigPlay: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -32,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 10px 24px rgba(0,0,0,0.25)',
  },
  bigPlayText: { fontSize: 24, color: '#1D1F22', marginLeft: 4 },
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
