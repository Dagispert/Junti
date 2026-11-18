// Dibujar encima de una foto antes de publicarla (para señalar algo, rodearlo,
// escribir a mano…). Lo dibujado queda dentro de la foto. Solo web.

import { RotateCcw, Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from './icon';

type Trazo = { c: string; w: number; pts: [number, number][] };

const COLORES = ['#FFFFFF', '#1F1F1F', '#E8563F', '#F6D04D', '#5BA55B', '#3F7FD6', '#F28FB0'];
/** grosor (sobre 360 px de ancho de foto) */
const GROSORES = [3, 6, 11];
/** lado largo máximo de la foto que se publica */
const SALIDA = 2048;

function pintar(ctx: CanvasRenderingContext2D, trazos: Trazo[], w: number, h: number) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const t of trazos) {
    ctx.strokeStyle = t.c;
    ctx.lineWidth = (t.w * w) / 360;
    // un borde suave, para que se vea sobre cualquier foto
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = (2 * w) / 360;
    ctx.beginPath();
    const [x0, y0] = t.pts[0];
    ctx.moveTo(x0 * w, y0 * h);
    if (t.pts.length === 1) ctx.lineTo(x0 * w + 0.01, y0 * h);
    for (let i = 1; i < t.pts.length - 1; i++) {
      const [x, y] = t.pts[i];
      const [nx, ny] = t.pts[i + 1];
      ctx.quadraticCurveTo(x * w, y * h, ((x + nx) / 2) * w, ((y + ny) / 2) * h);
    }
    if (t.pts.length > 1) {
      const [xl, yl] = t.pts[t.pts.length - 1];
      ctx.lineTo(xl * w, yl * h);
    }
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

export function DibujarFoto({
  uri,
  onCancel,
  onDone,
}: {
  uri: string;
  onCancel: () => void;
  /** la foto con lo dibujado (o la misma si no se dibujó nada) */
  onDone: (uri: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState('');
  const lienzo = useRef<HTMLCanvasElement | null>(null);
  const trazos = useRef<Trazo[]>([]);
  const actual = useRef<Trazo | null>(null);
  const [color, setColor] = useState(COLORES[2]);
  const [grosor, setGrosor] = useState(GROSORES[1]);
  const [n, setN] = useState(0);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const i = new window.Image();
    i.onload = () => setImg(i);
    i.onerror = () => setError('No se ha podido abrir la foto.');
    i.src = uri;
  }, [uri]);

  // la foto, tan grande como quepa entre la barra de arriba y las herramientas
  const altoLibre = H - insets.top - insets.bottom - 64 - 150;
  const anchoLibre = W - 24;
  const esc = img ? Math.min(anchoLibre / img.naturalWidth, altoLibre / img.naturalHeight) : 1;
  const fw = img ? Math.round(img.naturalWidth * esc) : 0;
  const fh = img ? Math.round(img.naturalHeight * esc) : 0;

  const redibujar = () => {
    const c = lienzo.current;
    if (!c || !fw) return;
    const ctx = c.getContext('2d')!;
    const dpr = c.width / fw;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, fw, fh);
    pintar(ctx, actual.current ? [...trazos.current, actual.current] : trazos.current, fw, fh);
  };
  useEffect(() => {
    const c = lienzo.current;
    if (!c || !fw) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    c.width = Math.round(fw * dpr);
    c.height = Math.round(fh * dpr);
    redibujar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fw, fh]);

  const punto = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = lienzo.current!.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    ];
  };

  const listo = async () => {
    if (!img) return;
    if (!trazos.current.length) return onDone(uri);
    setGuardando(true);
    try {
      const s = Math.min(1, SALIDA / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * s),
        h = Math.round(img.naturalHeight * s);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      pintar(ctx, trazos.current, w, h);
      const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/jpeg', 0.9));
      if (!blob) throw new Error('sin foto');
      onDone(URL.createObjectURL(blob));
    } catch {
      setError('No se ha podido guardar el dibujo.');
      setGuardando(false);
    }
  };

  return (
    <View style={[styles.fondo, { paddingTop: insets.top, paddingBottom: insets.bottom + 10 }]}>
      <View style={styles.barra}>
        <Pressable accessibilityRole="button" onPress={onCancel} hitSlop={10}>
          <Text style={styles.textoBarra}>Cancelar</Text>
        </Pressable>
        <Text style={[styles.textoBarra, { fontWeight: '700' }]}>Dibujar</Text>
        <Pressable accessibilityRole="button" onPress={listo} disabled={guardando} hitSlop={10}>
          <Text style={[styles.textoBarra, { fontWeight: '700', color: '#F6C945' }]}>
            {guardando ? 'Guardando…' : 'Listo'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.centro}>
        {!!error && <Text style={{ color: '#FFFFFF' }}>{error}</Text>}
        {img && (
          <div style={{ position: 'relative', width: fw, height: fh }}>
            <img
              src={uri}
              alt=""
              draggable={false}
              style={{ width: fw, height: fh, display: 'block', borderRadius: 6 }}
            />
            <canvas
              ref={lienzo}
              aria-label="Dibuja encima de la foto"
              style={{
                position: 'absolute',
                inset: 0,
                width: fw,
                height: fh,
                touchAction: 'none',
                cursor: 'crosshair',
              }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                actual.current = { c: color, w: grosor, pts: [punto(e)] };
                redibujar();
              }}
              onPointerMove={(e) => {
                if (!actual.current) return;
                const ev = e.nativeEvent;
                const lista = ev.getCoalescedEvents?.() ?? [];
                for (const x of lista.length ? lista : [ev]) actual.current.pts.push(punto(x));
                redibujar();
              }}
              onPointerUp={() => {
                if (actual.current) trazos.current.push(actual.current);
                actual.current = null;
                redibujar();
                setN(trazos.current.length);
              }}
              onPointerCancel={() => {
                actual.current = null;
                redibujar();
              }}
            />
          </div>
        )}
      </View>

      {/* colores */}
      <View style={styles.fila}>
        {COLORES.map((c) => {
          const on = c === color;
          return (
            <Pressable
              key={c}
              accessibilityRole="radio"
              accessibilityLabel={`Color ${c}`}
              aria-checked={on}
              onPress={() => setColor(c)}
              style={[
                styles.color,
                {
                  backgroundColor: c,
                  borderColor: on ? '#FFFFFF' : 'rgba(255,255,255,0.25)',
                  transform: [{ scale: on ? 1.18 : 1 }],
                },
              ]}
            />
          );
        })}
      </View>
      {/* grosor, deshacer y borrar */}
      <View style={styles.fila}>
        {GROSORES.map((g) => {
          const on = g === grosor;
          return (
            <Pressable
              key={g}
              accessibilityRole="radio"
              accessibilityLabel={g === 3 ? 'Fino' : g === 6 ? 'Medio' : 'Gordo'}
              aria-checked={on}
              onPress={() => setGrosor(g)}
              style={[styles.boton, on && { backgroundColor: 'rgba(255,255,255,0.16)' }]}>
              <View
                style={{ width: g + 5, height: g + 5, borderRadius: 99, backgroundColor: color }}
              />
            </Pressable>
          );
        })}
        <View style={{ width: 12 }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Deshacer"
          disabled={!n}
          onPress={() => {
            trazos.current.pop();
            setN(trazos.current.length);
            redibujar();
          }}
          style={[styles.boton, { opacity: n ? 1 : 0.35 }]}>
          <Icon icon={RotateCcw} size={20} color="#FFFFFF" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Borrar todo lo dibujado"
          disabled={!n}
          onPress={() => {
            trazos.current = [];
            setN(0);
            redibujar();
          }}
          style={[styles.boton, { opacity: n ? 1 : 0.35 }]}>
          <Icon icon={Trash2} size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: '#0E0F12', gap: 12 },
  barra: {
    height: 52,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textoBarra: { color: '#FFFFFF', fontSize: 17 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  color: { width: 30, height: 30, borderRadius: 15, borderWidth: 3 },
  boton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
