import { router } from 'expo-router';
import { Play, RotateCcw } from 'lucide-react-native';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Hand, HandBold } from '@/constants/theme';
import { useStore } from '@/data/store';
import type { Moment } from '@/data/types';
import { makeCanister, MONTH_COLORS } from '@/lib/canister3d';
import { primeNarrator } from '@/lib/narrator';
import { monthStart } from '@/lib/recap';
import { offsetPath, serpentine, unrollSchedule } from '@/lib/serpentine';

import { Icon } from './icon';

// El carrete del mes en 3D (con la piel del planeta). Llega acercándose como el
// planeta; al terminar asoma la punta de la cinta. Se arrastra a la derecha y
// sale un poco; lanzada con fuerza, se desprende entera y rebota de pared a
// pared hasta que se ven todas las fotos, sin montarse. «Rebobinar» la recoge.

const FILM = '#3E2C22';
const HOLES = '#E9DFCF';
const FRAME_W = 88;
const FRAME_H = 80;
const THICK = FRAME_H + 22; // ancho de la cinta
const ROW_H = THICK + 52; // cinta + la nota de debajo
const STAGE_H = 210;
const CAN_W = 168;
const PEEK = 28;
/** Distancia final de la cámara (la entrada viene de lejos, como el planeta). */
const REST = 4.4;
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

type Phase = 'waiting' | 'entering' | 'peek' | 'drag' | 'unroll' | 'open' | 'rewind';

const DEMO_HINT = 'junti-carrete-deslizado';

export function FilmRoll3D({
  moments,
  label,
  index = 0,
  groupId,
}: {
  moments: Moment[];
  label: string;
  index?: number;
  groupId?: string;
}) {
  const { user } = useStore();
  const ordered = useMemo(() => [...moments].sort((a, b) => a.createdAt - b.createdAt), [moments]);
  const first = new Date(ordered[0]?.createdAt ?? Date.now());
  const color = MONTH_COLORS[first.getMonth()];

  const maskId = `jroll${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [phase, setPhase] = useState<Phase>('waiting');
  const [shown, setShown] = useState(0); // cinta desplegada (px por la cinta)
  const [jiggle, setJiggle] = useState(0); // rebote contra la pared
  const [mouth, setMouth] = useState({ x: CAN_W - 22, y: STAGE_H * 0.5 });
  const [hinted, setHinted] = useState(() => {
    try {
      return localStorage.getItem(DEMO_HINT) === '1';
    } catch {
      return false;
    }
  });

  // La cinta en zigzag, para el ancho de la pantalla.
  const sp = useMemo(
    () =>
      width
        ? serpentine({
            x0: mouth.x,
            y0: mouth.y,
            left: 6,
            right: width - 6,
            rowH: ROW_H,
            frameW: FRAME_W,
            frameH: FRAME_H,
            gap: 8,
            n: ordered.length,
            pad: 8,
          })
        : null,
    [width, mouth.x, mouth.y, ordered.length],
  );
  const sprockets = useMemo(
    () => (sp ? [offsetPath(sp, THICK / 2 - 8), offsetPath(sp, -(THICK / 2 - 8))] : ['', '']),
    [sp],
  );
  const mainPath = useMemo(() => (sp ? offsetPath(sp, 0) : ''), [sp]);

  // Estado de la animación (fuera de React, para el bucle de dibujo).
  const st = useRef({
    dist: 12,
    yaw: 2.2,
    spin: 0,
    wobble: 0,
    shown: 0,
    target: PEEK,
    t0: 0,
    dragX: 0,
    phase: 'waiting' as Phase,
  });
  st.current.phase = phase;
  const canister = useMemo(
    () => makeCanister(color, MESES[first.getMonth()], String(first.getFullYear()), ordered.length),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [color, ordered.length],
  );
  useEffect(() => () => canister.dispose(), [canister]);

  // Medidas y entrada al verse en pantalla (una sola vez).
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && st.current.phase === 'waiting') {
          setTimeout(() => setPhase('entering'), index * 120);
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, [index]);

  // El bucle: dibuja el carrete y mueve la cinta mientras hay algo que animar.
  const sched = useRef<ReturnType<typeof unrollSchedule> | null>(null);
  useEffect(() => {
    if (phase === 'waiting') return;
    let raf = 0;
    let last = performance.now();
    let calm = 0;
    const s = st.current;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const c = canvas.current;
      // entrada del planeta: se acerca girando
      const k = 1 - Math.pow(1 - 0.055, dt * 60);
      s.dist += (REST - s.dist) * k;
      s.yaw += (0 - s.yaw) * k;
      if (s.phase === 'entering' && s.dist < REST + 0.15) {
        s.target = PEEK;
        setPhase('peek');
      }
      // la cinta
      let prev = s.shown;
      if (s.phase === 'unroll' && sched.current) {
        const tt = (now - s.t0) / 1000;
        s.shown = sched.current.at(tt);
        const hit = sched.current.hits.filter((h) => h <= tt).pop();
        if (hit != null) {
          const since = tt - hit;
          setJiggle(Math.exp(-7 * since) * Math.sin(since * 34) * 7);
        }
        if (tt >= sched.current.total + 0.5) {
          setJiggle(0);
          setPhase('open');
        }
      } else if (s.phase === 'rewind') {
        s.shown += (0 - s.shown) * (1 - Math.pow(1 - 0.16, dt * 60));
        if (s.shown < PEEK + 2) {
          s.shown = PEEK;
          setPhase('peek');
        }
      } else if (s.phase === 'drag') {
        s.shown += (s.target - s.shown) * 0.5;
      } else if (s.phase === 'peek') {
        s.shown += (PEEK - s.shown) * (1 - Math.pow(1 - 0.18, dt * 60));
      }
      // el carrete gira con la cinta que suelta
      s.spin -= (s.shown - prev) * 0.03;
      s.wobble = s.phase === 'drag' ? Math.sin(now / 90) * 0.3 : s.wobble * 0.9;
      prev = s.shown;
      setShown(s.shown);
      if (c) {
        const ctx = c.getContext('2d');
        if (ctx) canister.draw(ctx, c.clientWidth, c.clientHeight, s);
        const m = canister.mouth(c.clientWidth, c.clientHeight);
        const mx = Math.round(m.x * c.clientWidth),
          my = Math.round(m.y * c.clientHeight);
        setMouth((o) => (Math.abs(o.x - mx) > 1 || Math.abs(o.y - my) > 1 ? { x: mx, y: my } : o));
      }
      // en reposo, deja de dibujar
      const moving =
        s.phase === 'entering' ||
        s.phase === 'drag' ||
        s.phase === 'unroll' ||
        s.phase === 'rewind' ||
        Math.abs(s.dist - REST) > 0.01;
      calm = moving ? 0 : calm + dt;
      if (calm < 0.6) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, canister]);

  // ── El arrastre ──
  const drag = useRef<{ x: number; t: number; vx: number; lastX: number; lastT: number } | null>(
    null,
  );
  const maxPeek = sp ? Math.max(PEEK, sp.segs[0].len - 8) : 160;
  const onDown = (e: React.PointerEvent) => {
    if (phase !== 'peek') return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = {
      x: e.clientX,
      t: performance.now(),
      vx: 0,
      lastX: e.clientX,
      lastT: performance.now(),
    };
    setPhase('drag');
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const now = performance.now();
    d.vx = (e.clientX - d.lastX) / Math.max(1, now - d.lastT);
    d.lastX = e.clientX;
    d.lastT = now;
    const dx = Math.max(0, e.clientX - d.x);
    // sale siguiendo al dedo, cada vez más dura (como una goma)
    st.current.target = PEEK + Math.min(maxPeek - PEEK, dx * 0.75 - (dx * dx) / 2400);
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const dx = d.lastX - d.x;
    const strong = d.vx > 0.55 || dx > 150;
    if (strong && sp) {
      // ¡se desprende! la cinta entera sale disparada
      sched.current = unrollSchedule(sp, 900 + d.vx * 900);
      st.current.t0 = performance.now();
      setPhase('unroll');
      if (!hinted) {
        setHinted(true);
        try {
          localStorage.setItem(DEMO_HINT, '1');
        } catch {
          // sin almacenamiento
        }
      }
    } else {
      setPhase('peek');
    }
  };

  const open = phase === 'unroll' || phase === 'open' || phase === 'rewind';
  const stageH = open && sp ? Math.max(STAGE_H, sp.height + 30) : STAGE_H;
  const L = sp?.length ?? 1;
  // Las reacciones más usadas del mes: pegatinas en los fotogramas que las tienen.
  const top = (m: Moment) => [...new Set(m.reactions.map((r) => r.emoji))].slice(0, 2);

  return (
    <View style={{ gap: 4 }}>
      <View style={styles.titleRow}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text numberOfLines={1} style={[styles.month, { flexShrink: 1 }]}>
          {label}
        </Text>
        {open && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Rebobinar la cinta"
            onPress={() => setPhase('rewind')}
            style={[styles.pill, styles.ghost]}>
            <Icon icon={RotateCcw} size={14} color="#1D1F22" />
            <Text style={[styles.pillText, { color: '#1D1F22' }]}>Rebobinar</Text>
          </Pressable>
        )}
        {groupId && ordered.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Ver el resumen de ${label}`}
            onPress={() => {
              primeNarrator();
              router.push({
                pathname: '/recap',
                params: { groupId, kind: 'month', from: String(monthStart(ordered[0].createdAt)) },
              });
            }}
            style={[styles.pill, { backgroundColor: '#1D1F22' }]}>
            <Icon icon={Play} size={14} color="#FFFFFF" />
            <Text style={styles.pillText}>Resumen</Text>
          </Pressable>
        )}
      </View>
      <div
        ref={host}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{
          position: 'relative',
          height: stageH,
          transition: 'height 700ms cubic-bezier(.2,.8,.2,1)',
          touchAction: phase === 'peek' || phase === 'drag' ? 'pan-y' : 'auto',
          userSelect: 'none',
          cursor: phase === 'peek' ? 'grab' : phase === 'drag' ? 'grabbing' : 'default',
        }}>
        {/* el carrete */}
        <canvas
          ref={canvas}
          aria-label={`Carrete de ${label}: ${ordered.length} fotos`}
          role="img"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: CAN_W,
            height: STAGE_H,
            zIndex: 2,
            pointerEvents: 'none',
          }}
          width={CAN_W * 2}
          height={STAGE_H * 2}
        />
        {/* la cinta */}
        {sp && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transform: `translateX(${jiggle.toFixed(2)}px)`,
              zIndex: 1,
            }}>
            <svg
              width="100%"
              height={stageH}
              style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
              aria-hidden>
              <defs>
                <mask id={maskId} maskUnits="userSpaceOnUse">
                  <path
                    d={mainPath}
                    fill="none"
                    stroke="#fff"
                    strokeWidth={THICK + 2}
                    strokeDasharray={`${shown} ${L + 4000}`}
                  />
                </mask>
              </defs>
              <path
                d={mainPath}
                fill="none"
                stroke={FILM}
                strokeWidth={THICK}
                strokeDasharray={`${shown} ${L + 4000}`}
              />
              <g mask={`url(#${maskId})`}>
                {sprockets.map((d, i) => (
                  <path
                    key={i}
                    d={d}
                    fill="none"
                    stroke={HOLES}
                    strokeWidth={6}
                    strokeDasharray="7 7"
                    opacity={0.9}
                  />
                ))}
              </g>
            </svg>
            {/* los fotogramas: aparecen cuando la cinta llega a ellos */}
            {sp.frames.map((f) => {
              const m = ordered[f.i];
              const on = shown >= f.end - FRAME_W * 0.35;
              const emojis = top(m);
              const comment = m.comments[m.comments.length - 1];
              return (
                <div
                  key={m.id}
                  style={{
                    position: 'absolute',
                    left: f.x,
                    top: f.y,
                    width: FRAME_W,
                    opacity: on ? 1 : 0,
                    transform: on ? 'none' : 'translateY(6px) scale(.96)',
                    transition: 'opacity 260ms ease, transform 420ms cubic-bezier(.2,1.4,.4,1)',
                    pointerEvents: on && phase === 'open' ? 'auto' : 'none',
                  }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={m.text ?? `Foto de ${user(m.authorId).name}`}
                    onPress={() => router.push({ pathname: '/moment/[id]', params: { id: m.id } })}>
                    <div style={frameStyle}>
                      {m.imageUri ? (
                        <img
                          src={m.imageUri}
                          alt=""
                          draggable={false}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                        />
                      ) : (
                        <div style={paperStyle}>{m.text ?? (m.voice ? 'Nota de voz' : '')}</div>
                      )}
                    </div>
                  </Pressable>
                  {emojis.length > 0 && (
                    <div style={stickerStyle(f.i)}>
                      {emojis.join('')}
                      {m.reactions.length > 1 && (
                        <span style={{ fontSize: 11, marginLeft: 2 }}>{m.reactions.length}</span>
                      )}
                    </div>
                  )}
                  <div style={noteStyle}>
                    {comment ? (
                      <>
                        <b>{user(comment.userId).name.split(' ')[0]}</b>: {comment.text}
                        {m.comments.length > 1 ? ` · +${m.comments.length - 1}` : ''}
                      </>
                    ) : (
                      <>
                        {user(m.authorId).name.split(' ')[0]} ·{' '}
                        {new Intl.DateTimeFormat('es-ES', {
                          day: 'numeric',
                          month: 'short',
                        }).format(m.createdAt)}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {/* la pista, hasta que se haya deslizado una vez */}
        {phase === 'peek' && !hinted && (
          <div style={{ ...hintStyle, left: mouth.x + 40, top: mouth.y - 12 }}>
            desliza la cinta →
          </div>
        )}
      </div>
    </View>
  );
}

const frameStyle: React.CSSProperties = {
  width: FRAME_W,
  height: FRAME_H,
  borderRadius: 4,
  overflow: 'hidden',
  background: '#F3EEE2',
  boxShadow: '0 0 0 2px rgba(0,0,0,.25) inset',
};
const paperStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  padding: 8,
  boxSizing: 'border-box',
  fontFamily: Hand,
  fontSize: 15,
  lineHeight: '16px',
  color: '#1D1F22',
  overflow: 'hidden',
};
const stickerStyle = (i: number): React.CSSProperties => ({
  position: 'absolute',
  top: -14,
  right: -8,
  padding: '2px 6px',
  borderRadius: 14,
  background: '#FFFFFF',
  boxShadow: '0 4px 10px rgba(0,0,0,.18)',
  fontSize: 16,
  transform: `rotate(${i % 2 ? 8 : -6}deg)`,
  display: 'flex',
  alignItems: 'center',
});
const noteStyle: React.CSSProperties = {
  position: 'absolute',
  top: FRAME_H + 16,
  left: -6,
  width: FRAME_W + 12,
  fontFamily: Hand,
  fontSize: 14,
  lineHeight: '15px',
  color: '#3A3530',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};
const hintStyle: React.CSSProperties = {
  position: 'absolute',
  fontFamily: Hand,
  fontSize: 20,
  color: '#6B6A62',
  pointerEvents: 'none',
  animation: 'jroll-hint 1.6s ease-in-out infinite',
  zIndex: 3,
};
if (typeof document !== 'undefined' && !document.getElementById('jroll-css')) {
  const s = document.createElement('style');
  s.id = 'jroll-css';
  s.textContent =
    '@keyframes jroll-hint{0%,100%{transform:translateX(0);opacity:.75}50%{transform:translateX(10px);opacity:1}}';
  document.head.appendChild(s);
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  month: { fontFamily: HandBold, fontSize: 24, color: '#1D1F22', flex: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  ghost: { backgroundColor: 'rgba(29,31,34,0.08)' },
  pillText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
});
