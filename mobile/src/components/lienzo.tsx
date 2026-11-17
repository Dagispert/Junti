// El lienzo para dibujar con el dedo (web): colores, grosores, deshacer y
// borrar. Los trazos se guardan de 0 a 1, así se exporta a cualquier tamaño.

import { Eraser, RotateCcw, Trash2 } from 'lucide-react-native';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/constants/theme';

import { Icon } from './icon';

type Trazo = { c: string; w: number; pts: [number, number][] };

export const COLORES = [
  '#1F1F1F',
  '#E2603F',
  '#F2A541',
  '#F6D04D',
  '#5BA55B',
  '#3F7FD6',
  '#8B5E3C',
];
const GOMA = '#FFFFFF';
const GROSORES = [3, 7, 14];

export type LienzoRef = {
  /** el dibujo en PNG (fondo blanco) */
  exportar: (lado?: number) => Promise<Blob>;
};

function pintar(ctx: CanvasRenderingContext2D, trazos: Trazo[], lado: number) {
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, lado, lado);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const t of trazos) {
    ctx.strokeStyle = t.c;
    ctx.lineWidth = (t.w * lado) / 360;
    ctx.beginPath();
    const [x0, y0] = t.pts[0];
    ctx.moveTo(x0 * lado, y0 * lado);
    // un punto suelto también se ve
    if (t.pts.length === 1) ctx.lineTo(x0 * lado + 0.01, y0 * lado);
    for (let i = 1; i < t.pts.length - 1; i++) {
      const [x, y] = t.pts[i];
      const [nx, ny] = t.pts[i + 1];
      ctx.quadraticCurveTo(x * lado, y * lado, ((x + nx) / 2) * lado, ((y + ny) / 2) * lado);
    }
    if (t.pts.length > 1) {
      const [xl, yl] = t.pts[t.pts.length - 1];
      ctx.lineTo(xl * lado, yl * lado);
    }
    ctx.stroke();
  }
}

export const Lienzo = forwardRef<LienzoRef, { lado: number; onCambio?: (trazos: number) => void }>(
  function Lienzo({ lado, onCambio }, ref) {
    const theme = useTheme();
    const lienzo = useRef<HTMLCanvasElement | null>(null);
    const trazos = useRef<Trazo[]>([]);
    const actual = useRef<Trazo | null>(null);
    const [color, setColor] = useState(COLORES[0]);
    const [grosor, setGrosor] = useState(GROSORES[1]);
    const [goma, setGoma] = useState(false);
    const [, setN] = useState(0);

    const redibujar = () => {
      const c = lienzo.current;
      if (!c) return;
      const ctx = c.getContext('2d')!;
      const dpr = c.width / lado;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pintar(ctx, actual.current ? [...trazos.current, actual.current] : trazos.current, lado);
    };
    const cambio = () => {
      setN(trazos.current.length);
      onCambio?.(trazos.current.length);
    };

    useEffect(() => {
      const c = lienzo.current;
      if (!c) return;
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      c.width = Math.round(lado * dpr);
      c.height = Math.round(lado * dpr);
      redibujar();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lado]);

    useImperativeHandle(ref, () => ({
      exportar: (l = 720) =>
        new Promise<Blob>((ok, mal) => {
          const c = document.createElement('canvas');
          c.width = l;
          c.height = l;
          pintar(c.getContext('2d')!, trazos.current, l);
          c.toBlob(
            (b) => (b ? ok(b) : mal(new Error('No se pudo guardar el dibujo'))),
            'image/png',
          );
        }),
    }));

    const punto = (e: PointerEvent | React.PointerEvent): [number, number] => {
      const r = lienzo.current!.getBoundingClientRect();
      return [
        Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
        Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
      ];
    };

    return (
      <View style={{ gap: 12, alignItems: 'center' }}>
        <canvas
          ref={lienzo}
          aria-label="Lienzo para dibujar"
          style={{
            width: lado,
            height: lado,
            borderRadius: 18,
            background: '#FFFFFF',
            boxShadow: '0 10px 30px rgba(20,22,26,.18)',
            touchAction: 'none',
            cursor: 'crosshair',
            display: 'block',
          }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            actual.current = {
              c: goma ? GOMA : color,
              w: goma ? grosor * 2 : grosor,
              pts: [punto(e)],
            };
            redibujar();
          }}
          onPointerMove={(e) => {
            if (!actual.current) return;
            const ev = e.nativeEvent;
            const lista = ev.getCoalescedEvents?.() ?? [ev];
            for (const x of lista.length ? lista : [ev]) actual.current.pts.push(punto(x));
            redibujar();
          }}
          onPointerUp={() => {
            if (actual.current) trazos.current.push(actual.current);
            actual.current = null;
            redibujar();
            cambio();
          }}
          onPointerCancel={() => {
            actual.current = null;
            redibujar();
          }}
        />
        {/* colores */}
        <View style={styles.fila}>
          {COLORES.map((c) => {
            const on = !goma && c === color;
            return (
              <Pressable
                key={c}
                accessibilityRole="radio"
                accessibilityLabel={`Color ${c}`}
                aria-checked={on}
                onPress={() => {
                  setColor(c);
                  setGoma(false);
                }}
                style={[
                  styles.color,
                  {
                    backgroundColor: c,
                    borderColor: on ? theme.text : 'transparent',
                    transform: [{ scale: on ? 1.15 : 1 }],
                  },
                ]}
              />
            );
          })}
        </View>
        {/* grosor, goma, deshacer y borrar */}
        <View style={styles.fila}>
          {GROSORES.map((g) => {
            const on = g === grosor;
            return (
              <Pressable
                key={g}
                accessibilityRole="radio"
                accessibilityLabel={g === 3 ? 'Fino' : g === 7 ? 'Medio' : 'Gordo'}
                aria-checked={on}
                onPress={() => setGrosor(g)}
                style={[styles.boton, { backgroundColor: on ? theme.soft : 'transparent' }]}>
                <View
                  style={{
                    width: g + 4,
                    height: g + 4,
                    borderRadius: 99,
                    backgroundColor: goma ? theme.textSecondary : color,
                  }}
                />
              </Pressable>
            );
          })}
          <View style={{ width: 8 }} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Goma"
            aria-checked={goma}
            onPress={() => setGoma((v) => !v)}
            style={[styles.boton, { backgroundColor: goma ? theme.soft : 'transparent' }]}>
            <Icon icon={Eraser} size={20} color={theme.text} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Deshacer"
            disabled={!trazos.current.length}
            onPress={() => {
              trazos.current.pop();
              redibujar();
              cambio();
            }}
            style={[styles.boton, { opacity: trazos.current.length ? 1 : 0.35 }]}>
            <Icon icon={RotateCcw} size={20} color={theme.text} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Borrar todo"
            disabled={!trazos.current.length}
            onPress={() => {
              trazos.current = [];
              redibujar();
              cambio();
            }}
            style={[styles.boton, { opacity: trazos.current.length ? 1 : 0.35 }]}>
            <Icon icon={Trash2} size={20} color={theme.text} />
          </Pressable>
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  color: { width: 30, height: 30, borderRadius: 15, borderWidth: 3 },
  boton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
