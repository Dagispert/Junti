import { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { useTheme } from '@/constants/theme';
import { videoFrames } from '@/lib/media';
import { mmss } from '@/lib/music';

import type { Clip } from './media-players';

const HANDLE = 18;
const MIN = 1;

/**
 * Elegir qué parte del vídeo se enseña: una tira con sus fotogramas y dos
 * asas (inicio y final). Arrastrando el tramo entero se mueve sin cambiar
 * su duración. Como mucho «max» segundos.
 */
export function VideoTrimmer({
  uri,
  duration,
  value,
  onChange,
  max,
}: {
  uri: string;
  duration: number;
  value: Clip;
  onChange: (clip: Clip) => void;
  max: number;
}) {
  const theme = useTheme();
  const [frames, setFrames] = useState<string[]>([]);
  const [width, setWidth] = useState(1);
  useEffect(() => {
    let alive = true;
    videoFrames(uri, 8).then((f) => alive && setFrames(f));
    return () => {
      alive = false;
    };
  }, [uri]);

  const latest = useRef({ value, width, duration, max, onChange });
  latest.current = { value, width, duration, max, onChange };
  const toX = (t: number) => (t / duration) * width;

  // Una sola forma de arrastrar para las tres piezas: el asa de inicio, la de
  // final o el tramo entero.
  const drag = (part: 'start' | 'end' | 'move') => {
    const from = { start: 0, end: 0 };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        from.start = latest.current.value.start;
        from.end = latest.current.value.end;
      },
      onPanResponderMove: (_e, g) => {
        const { width: w, duration: d, max: m, onChange: set } = latest.current;
        const dt = (g.dx / w) * d;
        let { start, end } = from;
        if (part === 'move') {
          const len = end - start;
          start = Math.max(0, Math.min(d - len, start + dt));
          end = start + len;
        } else if (part === 'start') {
          start = Math.max(0, Math.max(end - m, Math.min(end - MIN, start + dt)));
        } else {
          end = Math.min(d, Math.min(start + m, Math.max(start + MIN, end + dt)));
        }
        set({ start: Math.round(start * 10) / 10, end: Math.round(end * 10) / 10 });
      },
    });
  };
  const startPan = useRef(drag('start')).current;
  const endPan = useRef(drag('end')).current;
  const movePan = useRef(drag('move')).current;

  const left = toX(value.start);
  const right = toX(value.end);
  return (
    <View style={{ gap: 8 }}>
      <View
        accessibilityLabel="Tramo del vídeo"
        onLayout={(e) => setWidth(Math.max(1, e.nativeEvent.layout.width))}
        style={[styles.track, { backgroundColor: theme.soft }]}>
        <View style={[StyleSheet.absoluteFill, styles.frames]} pointerEvents="none">
          {frames.map((f, i) => (
            <Image key={i} source={{ uri: f }} style={{ flex: 1 }} contentFit="cover" />
          ))}
        </View>
        {/* Lo que no se enseña, apagado. */}
        <View pointerEvents="none" style={[styles.dim, { left: 0, width: left }]} />
        <View pointerEvents="none" style={[styles.dim, { left: right, right: 0 }]} />
        <View
          {...movePan.panHandlers}
          style={[styles.window, { left, width: Math.max(0, right - left) }]}
        />
        <View
          {...startPan.panHandlers}
          accessibilityLabel="Inicio del tramo"
          style={[styles.handle, { left: left - HANDLE / 2 }]}>
          <View style={styles.grip} />
        </View>
        <View
          {...endPan.panHandlers}
          accessibilityLabel="Final del tramo"
          style={[styles.handle, { left: right - HANDLE / 2 }]}>
          <View style={styles.grip} />
        </View>
      </View>
      <Text style={{ color: theme.textSecondary, fontSize: 13, textAlign: 'center' }}>
        {mmss(value.start)} – {mmss(value.end)} · se verán {Math.round(value.end - value.start)} s
        {duration > max + 0.5 ? ` (como mucho ${max} s)` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 56,
    borderRadius: 10,
    overflow: 'visible',
    marginHorizontal: HANDLE / 2,
    touchAction: 'none',
  } as never,
  frames: { flexDirection: 'row', borderRadius: 10, overflow: 'hidden' },
  dim: { position: 'absolute', top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.72)' },
  window: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderTopWidth: 3,
    borderBottomWidth: 3,
    borderColor: '#F2B33D',
    cursor: 'grab',
  } as never,
  handle: {
    position: 'absolute',
    top: -2,
    bottom: -2,
    width: HANDLE,
    borderRadius: 6,
    backgroundColor: '#F2B33D',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'ew-resize',
    touchAction: 'none',
  } as never,
  grip: { width: 3, height: 18, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.35)' },
});
