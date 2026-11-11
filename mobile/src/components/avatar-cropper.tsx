import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useRef, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
} from 'react-native';

import { Radius, Spacing, useTheme } from '@/constants/theme';

import { Button, Lead, Notice, Title } from './ui';

const MAX_ZOOM = 4;
/** Tamaño final de la foto de perfil, en píxeles. */
const OUTPUT = 512;

type Props = {
  uri: string;
  width: number;
  height: number;
  busy?: boolean;
  onCancel: () => void;
  onDone: (croppedUri: string) => void;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Encuadrar la foto de perfil: arrastrar para mover y pellizcar (o la barra) para
 * acercar. Lo que queda dentro del círculo es lo que verán los demás.
 */
export function AvatarCropper({ uri, width, height, busy, onCancel, onDone }: Props) {
  const theme = useTheme();
  const { width: screen } = useWindowDimensions();
  const frame = Math.min(screen - 64, 300);
  // A zoom 1 la foto cubre justo el círculo por su lado más corto.
  const base = frame / Math.min(width, height);

  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const [notice, setNotice] = useState('');
  const viewRef = useRef(view);
  viewRef.current = view;

  /** Mantiene la foto cubriendo todo el círculo, sin huecos. */
  const fit = (x: number, y: number, zoom: number) => {
    const z = clamp(zoom, 1, MAX_ZOOM);
    const maxX = (width * base * z - frame) / 2;
    const maxY = (height * base * z - frame) / 2;
    return { x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY), zoom: z };
  };

  // ── Arrastrar y pellizcar sobre la foto ──
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
          // Al empezar a pellizcar a mitad de gesto, se toma ese momento como referencia.
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

  // ── Barra de zoom ──
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
    setNotice('');
    try {
      const { x, y, zoom } = viewRef.current;
      const scale = base * zoom; // píxeles de pantalla por píxel de la foto
      const size = Math.min(width, height, frame / scale);
      const originX = clamp((width * scale - frame) / 2 - x, 0, Infinity) / scale;
      const originY = clamp((height * scale - frame) / 2 - y, 0, Infinity) / scale;
      const rect = {
        originX: Math.round(clamp(originX, 0, width - size)),
        originY: Math.round(clamp(originY, 0, height - size)),
        width: Math.round(size),
        height: Math.round(size),
      };
      const rendered = await ImageManipulator.manipulate(uri)
        .crop(rect)
        .resize({ width: Math.min(OUTPUT, rect.width), height: Math.min(OUTPUT, rect.width) })
        .renderAsync();
      const result = await rendered.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
      onDone(result.uri);
    } catch {
      setNotice('No se ha podido recortar la foto. Prueba con otra.');
    }
  };

  const shownW = width * base * view.zoom;
  const shownH = height * base * view.zoom;

  return (
    <View style={styles.wrap}>
      <View style={{ gap: Spacing.two }}>
        <Title>Encuadra tu foto</Title>
        <Lead strong="Arrastra para moverla">y pellizca o usa la barra para acercarla.</Lead>
      </View>

      <View
        {...photoPan.panHandlers}
        accessibilityLabel="Encuadre de la foto"
        style={[
          styles.frame,
          { width: frame, height: frame, borderRadius: frame / 2, backgroundColor: theme.soft },
        ]}>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: shownW,
            height: shownH,
            left: (frame - shownW) / 2 + view.x,
            top: (frame - shownH) / 2 + view.y,
          }}>
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="fill" />
        </View>
      </View>

      <View style={styles.zoomRow}>
        <Text style={[styles.zoomLabel, { color: theme.textSecondary }]}>−</Text>
        <View
          {...sliderPan.panHandlers}
          accessibilityLabel="Zoom"
          onLayout={(e) => (track.current.width = e.nativeEvent.layout.width || 1)}
          style={styles.track}>
          <View pointerEvents="none" style={[styles.line, { backgroundColor: theme.border }]} />
          <View
            pointerEvents="none"
            style={[
              styles.knob,
              { left: zoomToPos(view.zoom) - 12, backgroundColor: theme.accent },
            ]}
          />
        </View>
        <Text style={[styles.zoomLabel, { color: theme.textSecondary }]}>+</Text>
      </View>

      <Notice>{notice}</Notice>
      <View style={styles.actions}>
        <Button label="Cancelar" variant="quiet" onPress={onCancel} />
        <Button label={busy ? 'Guardando…' : 'Usar esta foto'} disabled={busy} onPress={save} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.four, alignItems: 'stretch' },
  frame: { alignSelf: 'center', overflow: 'hidden', cursor: 'grab', touchAction: 'none' } as never,
  zoomRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: 8 },
  zoomLabel: { fontSize: 22, width: 16, textAlign: 'center' },
  track: { flex: 1, height: 40, justifyContent: 'center', touchAction: 'none' } as never,
  line: { height: 4, borderRadius: Radius.pill },
  knob: { position: 'absolute', width: 24, height: 24, borderRadius: 12, top: 8 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
