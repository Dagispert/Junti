import { geoNaturalEarth1 } from 'd3-geo';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { LAND_ROWS, LAND_TOP } from '@/data/world-dots';
import { progress, useClock } from '@/lib/clock';
import { subsolarPoint, sunHeight } from '@/lib/geo';

import { SkyBadge } from './sky-badge';

export type MapPerson = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  tz: string;
  isMe?: boolean;
};

type Mode =
  /** Mapa vivo: arcos ya dibujados y luces que viajan sin parar. */
  | 'live'
  /** Entrada de la app: el mapa aparece, se encienden las ciudades y se trazan los arcos. */
  | 'intro'
  /** Al publicar: una luz sale de mi ciudad hacia las de los demás. */
  | 'send';

const INK = {
  bgTop: '#0A0E1A',
  bgBottom: '#141B30',
  day: '#F4C98E',
  dusk: '#B88DB8',
  night: '#334166',
  arc: '#FFD8A3',
  glow: '#FFC56E',
};

// ── Puntos de tierra, coloreados según sea de día o de noche ahora mismo ──

type Dots = { day: string; dusk: string; night: string; size: number };

function landDots(
  project: (p: [number, number]) => [number, number] | null,
  w: number,
  h: number,
  minute: number,
): Dots {
  const sun = subsolarPoint(minute * 60_000);
  let day = '';
  let dusk = '';
  let night = '';
  for (let r = 0; r < LAND_ROWS.length; r++) {
    const lat = LAND_TOP - r;
    const row = LAND_ROWS[r];
    for (let c = 0; c < 90; c++) {
      const nibble = parseInt(row[c], 16);
      if (!nibble) continue;
      for (let b = 0; b < 4; b++) {
        if (!(nibble & (8 >> b))) continue;
        const lng = -179.5 + c * 4 + b;
        const p = project([lng, lat]);
        if (!p || p[0] < -4 || p[0] > w + 4 || p[1] < -4 || p[1] > h + 4) continue;
        const seg = `M${p[0].toFixed(1)} ${p[1].toFixed(1)}h0`;
        const height = sunHeight(lat, lng, sun);
        if (height > 0.06) day += seg;
        else if (height > -0.16) dusk += seg;
        else night += seg;
      }
    }
  }
  const a = project([0, 20]);
  const b = project([1, 20]);
  const perDegree = a && b ? Math.abs(b[0] - a[0]) : 4;
  return { day, dusk, night, size: Math.max(1.6, Math.min(4.2, perDegree * 0.46)) };
}

const LandLayer = memo(function LandLayer({ dots, opacity }: { dots: Dots; opacity: number }) {
  const common = { strokeLinecap: 'round' as const, strokeWidth: dots.size, fill: 'none' };
  return (
    <>
      <Path d={dots.night} stroke={INK.night} opacity={opacity} {...common} />
      <Path d={dots.dusk} stroke={INK.dusk} opacity={opacity * 0.9} {...common} />
      <Path d={dots.day} stroke={INK.day} opacity={opacity * 0.85} {...common} />
    </>
  );
});

// ── Arcos entre ciudades ──

type Pt = { x: number; y: number };
type Arc = { from: Pt; to: Pt; ctrl: Pt; length: number; toId: string };

function makeArc(a: Pt, b: Pt, toId: string): Arc {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 1;
  // Se curva hacia arriba, como una ruta de avión.
  let nx = -dy / d;
  let ny = dx / d;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  const lift = Math.min(90, d * 0.32);
  const ctrl = { x: mx + nx * lift, y: my + ny * lift };
  let length = 0;
  let prev = a;
  for (let i = 1; i <= 16; i++) {
    const p = bezier({ from: a, to: b, ctrl, length: 0, toId }, i / 16);
    length += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return { from: a, to: b, ctrl, length, toId };
}

function bezier(arc: Arc, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * arc.from.x + 2 * u * t * arc.ctrl.x + t * t * arc.to.x,
    y: u * u * arc.from.y + 2 * u * t * arc.ctrl.y + t * t * arc.to.y,
  };
}

const arcPath = (a: Arc) =>
  `M${a.from.x.toFixed(1)} ${a.from.y.toFixed(1)}Q${a.ctrl.x.toFixed(1)} ${a.ctrl.y.toFixed(1)} ${a.to.x.toFixed(1)} ${a.to.y.toFixed(1)}`;

/** Una luz con estela que recorre un arco. */
function Comet({ arc, t, bright = 1 }: { arc: Arc; t: number; bright?: number }) {
  if (t <= 0 || t >= 1) return null;
  return (
    <>
      {[0.08, 0.055, 0.03, 0.012].map((lag, i) => {
        const p = bezier(arc, Math.max(0, t - lag));
        return (
          <Circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={1 + i * 0.4}
            fill={INK.arc}
            opacity={(0.12 + i * 0.12) * bright}
          />
        );
      })}
      {(() => {
        const p = bezier(arc, t);
        return (
          <>
            <Circle cx={p.x} cy={p.y} r={7} fill={INK.glow} opacity={0.22 * bright} />
            <Circle cx={p.x} cy={p.y} r={2.6} fill="#FFFFFF" opacity={bright} />
          </>
        );
      })()}
    </>
  );
}

type Props = {
  people: MapPerson[];
  height?: number;
  mode?: Mode;
  /** Ocultar las etiquetas con nombre y hora. */
  bare?: boolean;
  /** Bordes redondeados y fondo propio (en las tarjetas). */
  framed?: boolean;
};

/**
 * El mapa de Junti: la Tierra en puntos de luz, con el día y la noche de este
 * momento, las ciudades de cada integrante y arcos que las unen.
 */
export function WorldMap({ people, height = 220, mode = 'live', bare, framed = true }: Props) {
  const [width, setWidth] = useState(0);
  const minute = Math.floor(Date.now() / 60_000);
  const t = useClock(width > 0, mode === 'live' ? Infinity : 4000);

  const projection = useMemo(() => {
    if (!width) return null;
    const lats = people.map((p) => p.lat);
    const lngs = people.map((p) => p.lng);
    const midLng = lngs.length ? (Math.min(...lngs) + Math.max(...lngs)) / 2 : 10;
    const midLat = lats.length ? (Math.min(...lats) + Math.max(...lats)) / 2 : 30;
    const spanLng = Math.max(
      64,
      lngs.length ? (Math.max(...lngs) - Math.min(...lngs)) * 1.45 + 24 : 300,
    );
    const spanLat = Math.max(
      30,
      lats.length ? (Math.max(...lats) - Math.min(...lats)) * 1.5 + 18 : 140,
    );
    const box = {
      type: 'MultiPoint' as const,
      coordinates: [
        [midLng - spanLng / 2, Math.min(80, midLat + spanLat / 2)],
        [midLng + spanLng / 2, Math.max(-58, midLat - spanLat / 2)],
      ],
    };
    // El mapa se centra en el grupo; con poca separación se muestra al menos una región amplia.
    return geoNaturalEarth1()
      .rotate([-midLng, 0])
      .fitExtent(
        [
          [16, 16],
          [width - 16, height - 16],
        ],
        box,
      );
  }, [people, width, height]);

  const dots = useMemo(
    () =>
      projection
        ? landDots((p) => projection(p) as [number, number] | null, width, height, minute)
        : null,
    [projection, width, height, minute],
  );

  const placed = useMemo(() => {
    if (!projection) return [];
    return people
      .map((p) => {
        const xy = projection([p.lng, p.lat]);
        return xy ? { ...p, x: xy[0], y: xy[1] } : null;
      })
      .filter(Boolean) as (MapPerson & Pt)[];
  }, [people, projection]);

  // Personas en la misma ciudad comparten punto y etiqueta.
  const spots = useMemo(() => {
    const list: { x: number; y: number; members: (MapPerson & Pt)[] }[] = [];
    for (const p of placed) {
      const near = list.find((s) => Math.hypot(s.x - p.x, s.y - p.y) < 14);
      if (near) near.members.push(p);
      else list.push({ x: p.x, y: p.y, members: [p] });
    }
    return list;
  }, [placed]);

  const arcs = useMemo(() => {
    const me = spots.find((s) => s.members.some((m) => m.isMe));
    const list: Arc[] = [];
    if (mode === 'send' || me) {
      const origin = me ?? spots[0];
      for (const s of spots) if (s !== origin) list.push(makeArc(origin, s, s.members[0].id));
    }
    if (mode !== 'send') {
      // También entre los demás, para que se vea la red entera.
      for (let i = 0; i < spots.length; i++)
        for (let j = i + 1; j < spots.length; j++) {
          if (spots[i] === me || spots[j] === me) continue;
          if (list.length < 10) list.push(makeArc(spots[i], spots[j], spots[j].members[0].id));
        }
    }
    return list;
  }, [spots, mode]);

  // Etiquetas: encima de cada ciudad; si chocan con otra, se buscan huecos alrededor.
  const labels = useMemo(() => {
    const placedRects: { x: number; y: number; w: number; h: number }[] = [];
    const H = 22;
    return spots
      .map((spot, i) => ({ spot, i }))
      .sort((a, b) => a.spot.y - b.spot.y)
      .map(({ spot, i }) => {
        const names = spot.members.map((m) => (m.isMe ? 'Tú' : m.name.split(' ')[0])).join(', ');
        const text = `${names} · ${clock(spot.members[0].tz)}`;
        const w = Math.min(width - 12, 32 + text.length * 6.4);
        const x = Math.min(Math.max(6, spot.x - w / 2), width - w - 6);
        const candidates = [
          spot.y - 34,
          spot.y + 10,
          spot.y - 60,
          spot.y + 36,
          spot.y - 86,
          spot.y + 62,
        ];
        const free = (y: number) =>
          y >= 4 &&
          y + H <= height - 4 &&
          !placedRects.some(
            (r) => x < r.x + r.w && x + w > r.x && y < r.y + r.h + 3 && y + H + 3 > r.y,
          );
        const top = candidates.find(free) ?? candidates[0];
        placedRects.push({ x, y: top, w, h: H });
        return { spot, i, left: x, top, w, text };
      });
  }, [spots, width, height, minute]);

  // ── Línea de tiempo de cada modo ──
  const intro = mode === 'intro';
  const send = mode === 'send';
  const landIn = intro ? progress(t, 0, 900) : 1;
  const cityIn = (i: number) => (intro ? progress(t, 450 + i * 140, 500) : 1);
  const arcIn = (i: number) =>
    intro ? progress(t, 900 + i * 120, 900) : send ? progress(t, 0, 500) : 1;

  return (
    <View
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
      style={[{ height }, framed && styles.frame]}>
      {framed && (
        <LinearGradient colors={[INK.bgTop, INK.bgBottom]} style={StyleSheet.absoluteFill} />
      )}
      {projection && dots && (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <LandLayer dots={dots} opacity={landIn} />

          {arcs.map((arc, i) => {
            const shown = arcIn(i);
            return (
              <Path
                key={`a${i}`}
                d={arcPath(arc)}
                stroke={INK.arc}
                strokeWidth={1.3}
                fill="none"
                opacity={send ? 0.75 : 0.5}
                strokeDasharray={`${arc.length * shown} ${arc.length}`}
              />
            );
          })}

          {/* Luces viajeras: en «live» y tras la entrada, una por arco, desfasadas. */}
          {!send &&
            arcs.map((arc, i) => {
              const start = intro ? 1800 + i * 160 : i * 700;
              if (t < start) return null;
              const period = 2600 + (i % 3) * 500;
              const k = ((t - start) % period) / period;
              return <Comet key={`c${i}`} arc={arc} t={k * 1.15} bright={0.85} />;
            })}
          {send &&
            arcs.map((arc, i) => (
              <Comet key={`s${i}`} arc={arc} t={progress(t, 250 + i * 90, 1100) * 1.04} />
            ))}

          {spots.map((s, i) => {
            const shown = cityIn(i);
            const arrived =
              send && arcs.some((a) => a.toId === s.members[0].id) ? progress(t, 1250, 500) : 0;
            const pulse = mode === 'live' ? (Math.sin(t / 600 + i * 1.7) + 1) / 2 : 0;
            const r = (5 + pulse * 6 + arrived * 12) * shown;
            return (
              <G key={`p${i}`}>
                <Circle
                  cx={s.x}
                  cy={s.y}
                  r={r + 6}
                  fill={INK.glow}
                  opacity={(0.1 + arrived * 0.25) * shown}
                />
                <Circle cx={s.x} cy={s.y} r={r} fill={INK.glow} opacity={0.22 * shown} />
                <Circle cx={s.x} cy={s.y} r={3.2 * shown} fill="#FFFFFF" />
              </G>
            );
          })}
        </Svg>
      )}

      {!bare &&
        labels.map(({ spot, i, left, top, w, text }) => {
          const shown = cityIn(i);
          return (
            <View
              key={`l${i}`}
              pointerEvents="none"
              style={[
                styles.label,
                {
                  left,
                  top,
                  width: w,
                  opacity: shown,
                  transform: [{ translateY: (1 - shown) * 6 }],
                },
              ]}>
              <View style={styles.pill}>
                <SkyBadge tz={spot.members[0].tz} size={14} />
                <Text numberOfLines={1} style={styles.labelText}>
                  {text}
                </Text>
              </View>
            </View>
          );
        })}
    </View>
  );
}

function clock(tz: string): string {
  try {
    return new Intl.DateTimeFormat('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz,
    }).format(Date.now());
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  frame: { borderRadius: 26, overflow: 'hidden', backgroundColor: INK.bgTop },
  label: { position: 'absolute', alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 3,
    paddingLeft: 3,
    paddingRight: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(10,14,26,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,216,163,0.35)',
  },
  labelText: { color: '#F6EEDF', fontSize: 11, fontWeight: '500' },
});
