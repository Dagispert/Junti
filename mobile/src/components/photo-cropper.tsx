import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useEffect, useRef, useState } from 'react';
import {
  Image as RNImage,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';

import { Notice } from './ui';

const MAX_ZOOM = 5;
/** Lado largo máximo de la foto recortada. */
const OUTPUT = 2048;

const SHAPES = [
  { id: 'original', label: 'Original', ratio: 0 },
  { id: 'square', label: 'Cuadrada', ratio: 1 },
  { id: 'portrait', label: 'Vertical', ratio: 4 / 5 },
  { id: 'landscape', label: 'Horizontal', ratio: 16 / 9 },
] as const;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Recortar una foto antes de publicarla: se elige la forma, se arrastra para
 * encuadrar y se pellizca (o se usa la barra) para acercar. Solo se publica lo
 * que queda dentro del marco.
 */
export function PhotoCropper({
  uri,
  onCancel,
  onDone,
}: {
  uri: string;
  onCancel: () => void;
  onDone: (croppedUri: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [shape, setShape] = useState<(typeof SHAPES)[number]['id']>('original');
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    RNImage.getSize(
      uri,
      (w, h) => setSize({ w, h }),
      () => setNotice('No se ha podido abrir la foto.'),
    );
  }, [uri]);

  const w = size?.w ?? 1;
  const h = size?.h ?? 1;
  const ratio = SHAPES.find((s) => s.id === shape)!.ratio || w / h;
  const maxW = Math.min(screenW - 32, 520);
  const maxH = screenH * 0.56;
  const frameW = Math.min(maxW, maxH * ratio);
  const frameH = frameW / ratio;
  // A zoom 1 la foto cubre justo el marco.
  const base = Math.max(frameW / w, frameH / h);

  const geo = useRef({ w, h, base, frameW, frameH });
  geo.current = { w, h, base, frameW, frameH };
  const fit = (x: number, y: number, zoom: number) => {
    const g = geo.current;
    const z = clamp(zoom, 1, MAX_ZOOM);
    const maxX = (g.w * g.base * z - g.frameW) / 2;
    const maxY = (g.h * g.base * z - g.frameH) / 2;
    return { x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY), zoom: z };
  };
  const viewRef = useRef(view);
  viewRef.current = view;
  // Al cambiar de forma, se vuelve a encajar.
  useEffect(() => setView((v) => fit(v.x, v.y, v.zoom)), [shape, size]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = useRef({ x: 0, y: 0, zoom: 1, distance: 0, pinching: false });
  const distance = (e: GestureResponderEvent) => {
    const [a, b] = e.nativeEvent.touches;
    return a && b ? Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) : 0;
  };
  const photoPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const d = distance(e);
        start.current = { ...viewRef.current, distance: d, pinching: d > 0 };
      },
      onPanResponderMove: (e, g) => {
        const d = distance(e);
        const s = start.current;
        if (d > 0) {
          if (!s.pinching) start.current = { ...viewRef.current, distance: d, pinching: true };
          const ref = start.current;
          setView(fit(ref.x, ref.y, (ref.zoom * d) / ref.distance));
        } else if (!s.pinching) {
          setView(fit(s.x + g.dx, s.y + g.dy, s.zoom));
        }
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  const track = useRef({ width: 1, startPos: 0 });
  const zoomToPos = (z: number) => ((z - 1) / (MAX_ZOOM - 1)) * track.current.width;
  const posToZoom = (p: number) =>
    1 + (clamp(p, 0, track.current.width) / track.current.width) * (MAX_ZOOM - 1);
  const sliderPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        track.current.startPos = e.nativeEvent.locationX;
        const v = viewRef.current;
        setView(fit(v.x, v.y, posToZoom(track.current.startPos)));
      },
      onPanResponderMove: (_e, g) => {
        const v = viewRef.current;
        setView(fit(v.x, v.y, posToZoom(track.current.startPos + g.dx)));
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  const save = async () => {
    if (!size) return;
    setNotice('');
    const { x, y, zoom } = viewRef.current;
    // Sin forma nueva ni zoom: la foto tal cual.
    if (shape === 'original' && zoom <= 1.001) return onDone(uri);
    setBusy(true);
    try {
      const scale = base * zoom; // píxeles de pantalla por píxel de la foto
      const cw = Math.min(w, frameW / scale);
      const ch = Math.min(h, frameH / scale);
      const ox = ((w * scale - frameW) / 2 - x) / scale;
      const oy = ((h * scale - frameH) / 2 - y) / scale;
      const rect = {
        originX: Math.round(clamp(ox, 0, w - cw)),
        originY: Math.round(clamp(oy, 0, h - ch)),
        width: Math.round(cw),
        height: Math.round(ch),
      };
      const shrink = Math.min(1, OUTPUT / Math.max(rect.width, rect.height));
      let job = ImageManipulator.manipulate(uri).crop(rect);
      if (shrink < 1)
        job = job.resize({
          width: Math.round(rect.width * shrink),
          height: Math.round(rect.height * shrink),
        });
      const rendered = await job.renderAsync();
      const result = await rendered.saveAsync({ compress: 0.9, format: SaveFormat.JPEG });
      onDone(result.uri);
    } catch {
      setNotice('No se ha podido recortar la foto. Prueba otra vez.');
      setBusy(false);
    }
  };

  const shownW = w * base * view.zoom;
  const shownH = h * base * view.zoom;
  return (
    <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={onCancel} hitSlop={8}>
          <Text style={styles.headerText}>Cancelar</Text>
        </Pressable>
        <Text style={styles.title}>Recortar</Text>
        <Pressable
          accessibilityRole="button"
          disabled={busy || !size}
          onPress={save}
          style={[styles.done, (busy || !size) && { opacity: 0.5 }]}>
          <Text style={styles.doneText}>{busy ? 'Recortando…' : 'Listo'}</Text>
        </Pressable>
      </View>

      <View style={styles.stage}>
        <View
          {...photoPan.panHandlers}
          accessibilityLabel="Encuadre de la foto"
          style={[styles.frame, { width: frameW, height: frameH }]}>
          {size && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                width: shownW,
                height: shownH,
                left: (frameW - shownW) / 2 + view.x,
                top: (frameH - shownH) / 2 + view.y,
              }}>
              <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="fill" />
            </View>
          )}
          {/* Regla de tercios, para encuadrar */}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {[1, 2].map((i) => (
              <View key={`v${i}`} style={[styles.guideV, { left: `${(i * 100) / 3}%` }]} />
            ))}
            {[1, 2].map((i) => (
              <View key={`h${i}`} style={[styles.guideH, { top: `${(i * 100) / 3}%` }]} />
            ))}
          </View>
        </View>
      </View>

      <View style={styles.shapes}>
        {SHAPES.map((s) => (
          <Pressable
            key={s.id}
            accessibilityRole="button"
            accessibilityState={{ selected: shape === s.id }}
            onPress={() => setShape(s.id)}
            style={[styles.shape, shape === s.id && styles.shapeOn]}>
            <Text style={[styles.shapeText, shape === s.id && { color: '#14161A' }]}>
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.zoomRow}>
        <Text style={styles.zoomLabel}>−</Text>
        <View
          {...sliderPan.panHandlers}
          accessibilityLabel="Zoom"
          onLayout={(e) => (track.current.width = e.nativeEvent.layout.width || 1)}
          style={styles.track}>
          <View pointerEvents="none" style={styles.line} />
          <View pointerEvents="none" style={[styles.knob, { left: zoomToPos(view.zoom) - 12 }]} />
        </View>
        <Text style={styles.zoomLabel}>+</Text>
      </View>
      <Text style={styles.hint}>Arrastra para encuadrar y pellizca para acercar.</Text>
      <Notice>{notice}</Notice>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#14161A', paddingHorizontal: 16, gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  headerText: { color: '#FFFFFF', fontSize: 16 },
  done: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: Radius.pill,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
  },
  doneText: { color: '#14161A', fontSize: 15, fontWeight: '600' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: {
    overflow: 'hidden',
    backgroundColor: '#2B2E33',
    cursor: 'grab',
    touchAction: 'none',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
  } as never,
  guideV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  guideH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  shapes: { flexDirection: 'row', justifyContent: 'center', gap: 8, flexWrap: 'wrap' },
  shape: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  shapeOn: { backgroundColor: '#FFFFFF' },
  shapeText: { color: '#FFFFFF', fontSize: 14, fontWeight: '500' },
  zoomRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: 8 },
  zoomLabel: { fontSize: 24, width: 16, textAlign: 'center', color: '#C9CDD2' },
  track: { flex: 1, height: 40, justifyContent: 'center', touchAction: 'none' } as never,
  line: { height: 4, borderRadius: Radius.pill, backgroundColor: 'rgba(255,255,255,0.25)' },
  knob: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    top: 8,
    backgroundColor: '#FFFFFF',
  },
  hint: { color: '#9AA0A6', fontSize: 13, textAlign: 'center' },
});
