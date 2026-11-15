import { router } from 'expo-router';
import { Play, RotateCcw, X } from 'lucide-react-native';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { Hand, HandBold } from '@/constants/theme';
import { useStore } from '@/data/store';
import type { Moment } from '@/data/types';
import { type CanisterPose, makeCanister } from '@/lib/canister3d';
import { FilmString, filmPaths, straightTrack, windowPath } from '@/lib/filmstrip';
import { primeNarrator } from '@/lib/narrator';
import { monthStart } from '@/lib/recap';
import { filmLayout, unrollSchedule } from '@/lib/serpentine';

import { Icon } from './icon';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createPortal } = require('react-dom') as {
  createPortal: (node: React.ReactNode, el: Element) => React.ReactNode;
};

// El carrete a pantalla completa. Llega como el planeta: pequeño, desde el
// centro, girando y acercándose. Queda flotando con la lengüeta fuera; se tira
// de ella y, si se lanza fuerte (o se toca «Abrir»), la lengüeta se guarda, el
// carrete se va a la esquina de arriba a la izquierda y desde ahí sale la
// cinta entera, con las fotos montadas en ella, rebotando de pared a pared.
// La cinta tiene física: vibra al salir, se aplasta y rebota en cada pared, y
// se puede pellizcar con el dedo.

const FILM = '#24150D';
const AMBER = '#7A4322';
const FILL = '#4A2A18';
const FRAME_W = 80;
const FRAME_H = 72;
const THICK = 100;
const ROW_H = THICK + 46;
const GAP = 8;
const PEEK = 30;
const REST = 4.6;
/** Lo que la cinta se esconde dentro del carrete (bajo la boca). */
const TUCK = 16;
const TAB = THICK * 0.9;
/** Cinta libre al final: la lengüeta y su curva, sin fotos. */
const TAIL = TAB + THICK * 0.55 + 14;
/** Cinta libre al principio, junto al carrete. */
const LEAD = TUCK + 26;

type Phase =
  | 'enter'
  | 'closed'
  | 'drag'
  | 'stow'
  | 'opening'
  | 'unroll'
  | 'open'
  | 'rewind'
  | 'return'
  | 'leave';

const mix = (a: string, b: string, k: number) => {
  const x = parseInt(a.slice(1), 16),
    y = parseInt(b.slice(1), 16);
  const c = (s: number) =>
    Math.round(((x >> s) & 255) * k + ((y >> s) & 255) * (1 - k))
      .toString(16)
      .padStart(2, '0');
  return `#${c(16)}${c(8)}${c(0)}`;
};
/** Pone los trazados de la cinta en su grupo SVG (cuerpo, centro ámbar, perforaciones). */
function paint(g: SVGGElement | null, f: ReturnType<typeof filmPaths> | null) {
  if (!g) return;
  const [body, amber, holes] = g.children;
  body.setAttribute('d', f?.body ?? '');
  amber.setAttribute('d', f?.amber ?? '');
  holes.setAttribute('d', f?.holes ?? '');
}
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** El giro de un fotograma según la cinta: casi derecho, se ladea un poco en las curvas. */
const lean = (tx: number, ty: number) => 0.28 * Math.sin(2 * Math.atan2(ty, tx));

export function RollViewer({
  moments,
  label,
  month,
  year,
  color,
  groupId,
  onClose,
}: {
  moments: Moment[];
  label: string;
  month: string;
  year: string;
  color: string;
  groupId?: string;
  onClose: () => void;
}) {
  const { user } = useStore();
  const uid = `jrv${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  const [phase, setPhaseState] = useState<Phase>('enter');
  const canister = useMemo(
    () => makeCanister(color, month, year, moments.length),
    [color, month, year, moments.length],
  );
  useEffect(() => () => canister.dispose(), [canister]);

  // Dónde va el carrete: en el centro (cerrado) o en la esquina (abierto).
  const B = Math.min(vp.w * 0.72, 330);
  const BH = B * 1.2;
  const center = { x: (vp.w - B) / 2, y: (vp.h - BH) / 2 - 40, s: 1 };
  // En la esquina, el carrete se encoge hasta que su ranura mide lo que la cinta.
  const fit = useMemo(() => {
    const rest: CanisterPose = { dist: REST, yaw: 0, tilt: 0, spin: 0 };
    const m = canister.mouth(B, BH, rest);
    const sl = canister.slot();
    const len = Math.hypot((sl.top.x - sl.bot.x) * B, (sl.top.y - sl.bot.y) * BH);
    return { m, len };
  }, [canister, B, BH]);
  const cs = Math.max(0.4, Math.min(0.85, THICK / fit.len));
  const corner = { x: -B * cs * 0.12, y: 44, s: cs };
  const mouthX = corner.x + fit.m.x * B * cs - TUCK;
  const mouthY = corner.y + fit.m.y * BH * cs;

  const sp = useMemo(
    () =>
      filmLayout({
        x0: mouthX,
        y0: mouthY,
        left: 6,
        right: vp.w - 6,
        rowH: ROW_H,
        win: FRAME_W,
        gap: GAP,
        n: moments.length,
        lead: LEAD,
        tail: TAIL,
      }),
    [mouthX, mouthY, vp.w, moments.length],
  );
  const L = sp.length;
  const photoWins = useMemo(() => sp.windows.filter((w) => w.photo != null), [sp]);
  const fillWins = useMemo(() => sp.windows.filter((w) => w.photo == null), [sp]);
  // Los fotogramas de relleno llevan las reacciones del mes (las más usadas primero).
  const fills = useMemo(() => {
    const count = new Map<string, number>();
    for (const m of moments)
      for (const r of m.reactions) count.set(r.emoji, (count.get(r.emoji) ?? 0) + 1);
    const list = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([e, n]) => ({ e, n }));
    return list.length ? list : ['📷', '✨', '♡', '☀️'].map((e) => ({ e, n: 0 }));
  }, [moments]);
  const string = useMemo(() => new FilmString(L + 40), [L]);

  // Todo lo que se mueve va por referencias (sin repintar React a cada fotograma).
  const st = useRef({
    phase: 'enter' as Phase,
    dist: 15,
    yaw: -7.5,
    tilt: -0.9,
    spin: 0,
    p: 0, // 0 = centro, 1 = esquina
    peek: 0,
    peekTarget: PEEK,
    shown: 0,
    t0: 0,
    fade: 0,
    still: 0,
  });
  const setPhase = (p: Phase) => {
    st.current.phase = p;
    st.current.still = 0;
    if (p === 'opening' || p === 'unroll' || p === 'return') st.current.t0 = performance.now();
    setPhaseState(p);
  };
  const sched = useRef<ReturnType<typeof unrollSchedule> | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const canBox = useRef<HTMLDivElement>(null);
  const shadow = useRef<HTMLDivElement>(null);
  const strip = useRef<SVGGElement>(null);
  const tongue = useRef<SVGGElement>(null);
  const fillPath = useRef<SVGPathElement>(null);
  const fillText = useRef<(SVGTextElement | null)[]>([]);
  const frameEls = useRef<(HTMLDivElement | null)[]>([]);
  const developed = useRef<boolean[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const titleBig = useRef<HTMLDivElement>(null);
  const titleTop = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const geo = useRef({ B, BH, center, corner, sp, L, photoWins, fillWins, string });
  geo.current = { B, BH, center, corner, sp, L, photoWins, fillWins, string };

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const born = last;

    // La cinta, sus fotogramas de relleno y las fotos, montadas sobre ella.
    const paintFilm = (g: typeof geo.current, shown: number) => {
      const tr = g.string.bend(g.sp.at);
      paint(strip.current, shown > 0.5 ? filmPaths(tr, 0, shown, THICK, TAB) : null);
      // cada fotograma va con la cinta: su sitio final menos lo que falta por salir
      const back = g.L - shown;
      const usable = shown - TAB - THICK * 0.55;
      let d = '';
      g.fillWins.forEach((w, i) => {
        const qc = w.q - back;
        const qa = Math.max(0, qc - FRAME_W / 2);
        const qb = Math.min(usable, qc + FRAME_W / 2);
        if (qb > qa) d += windowPath(tr, qa, qb, FRAME_H / 2);
        const t = fillText.current[i];
        if (!t) return;
        if (qc < FRAME_W * 0.2 || qc > usable) {
          t.setAttribute('opacity', '0');
          return;
        }
        const p = tr(qc);
        t.setAttribute('opacity', '1');
        t.setAttribute(
          'transform',
          `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${((lean(-p.ny, p.nx) * 180) / Math.PI).toFixed(1)})`,
        );
      });
      fillPath.current?.setAttribute('d', d);
      g.photoWins.forEach((w, i) => {
        const el = frameEls.current[i];
        if (!el) return;
        const qc = w.q - back;
        if (qc < -FRAME_W / 2) {
          el.style.visibility = 'hidden';
          return;
        }
        const p = tr(qc);
        el.style.visibility = 'visible';
        el.style.transform = `translate(${(p.x - FRAME_W / 2).toFixed(1)}px, ${(p.y - FRAME_H / 2).toFixed(1)}px) rotate(${lean(-p.ny, p.nx).toFixed(3)}rad)`;
        // se revela al salir del carrete
        if (qc > 0 && !developed.current[i]) {
          developed.current[i] = true;
          el.dataset.dev = '1';
        }
      });
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = st.current;
      const g = geo.current;
      const k = (r: number) => 1 - Math.pow(1 - r, dt * 60);
      const life = (now - born) / 1000;

      // la entrada: de lejos y girando, como el planeta
      if (s.phase !== 'leave') {
        s.dist += (REST - s.dist) * k(0.06);
        s.yaw += (0 - s.yaw) * k(0.055);
      }
      if (s.phase === 'enter' && s.dist < REST + 0.25) setPhase('closed');
      const idle = s.phase === 'closed' || s.phase === 'drag' || s.phase === 'enter';
      const sway = idle ? Math.sin(life * 1.3) * 0.08 : 0;

      // la lengüeta que asoma (y que se guarda antes de moverse)
      const peekGoal = s.phase === 'closed' ? PEEK : s.phase === 'drag' ? s.peekTarget : 0;
      const prevPeek = s.peek;
      s.peek +=
        (peekGoal - s.peek) * k(s.phase === 'drag' ? 0.5 : s.phase === 'stow' ? 0.22 : 0.14);
      if (s.phase === 'stow' && s.peek < 1.5) {
        s.peek = 0;
        setPhase('opening');
      }
      // a la esquina, y desde ahí la cinta
      if (s.phase === 'opening') {
        const t = (now - s.t0) / 1000 / 0.75;
        s.p = Math.min(1, t);
        if (t >= 1) {
          sched.current = unrollSchedule(g.sp, 1050);
          setPhase('unroll');
        }
      }
      const prevShown = s.shown;
      if (s.phase === 'unroll' && sched.current) {
        const tt = (now - s.t0) / 1000;
        s.shown = sched.current.at(tt);
        // la punta culebrea al salir
        g.string.drive(s.shown - 6, 8 * Math.sin(tt * 13), 0.22);
        if (tt >= sched.current.total + 0.2) setPhase('open');
      } else if (s.phase === 'rewind') {
        // la cinta vuelve a entrar entera, y solo entonces el carrete vuelve al centro
        s.shown -= Math.max(300, s.shown * 2.2) * dt;
        if (s.shown <= 0) {
          s.shown = 0;
          sched.current = null;
          setPhase('return');
        }
      } else if (s.phase === 'return') {
        s.p = Math.max(0, 1 - (now - s.t0) / 1000 / 0.7);
        if (s.p <= 0) setPhase('closed');
      }
      // cada vez que la cinta llena una vuelta, choca con la pared y rebota
      if (s.shown > prevShown) {
        for (const seg of g.sp.segs) {
          if (seg.kind !== 'arc') continue;
          const mid = seg.s0 + seg.len * 0.6;
          if (prevShown < mid && s.shown >= mid) {
            g.string.kick(seg.s0 + seg.len * 0.5, -seg.side * 520, seg.len * 0.32);
            g.string.kick(seg.s0 - 50, seg.side * 160, 40);
          }
        }
      }
      g.string.step(dt, s.shown);
      // el eje gira con la cinta que entra o sale
      s.spin -= (s.shown - prevShown + (s.peek - prevPeek)) * 0.025;

      const e = ease(s.p);
      const x = g.center.x + (g.corner.x - g.center.x) * e;
      const y = g.center.y + (g.corner.y - g.center.y) * e;
      const sc = g.center.s + (g.corner.s - g.center.s) * e;
      const tilt = -0.42 * (1 - e) + sway * 0.4;
      const bob = idle ? Math.sin(life * 1.6) * 8 : 0;
      if (s.phase === 'leave') {
        s.fade = Math.min(1, s.fade + dt / 0.42);
        s.dist += (16 - s.dist) * k(0.09);
        s.yaw += (7 - s.yaw) * k(0.05);
        if (root.current) root.current.style.opacity = String(1 - s.fade);
        if (s.fade >= 1) {
          onCloseRef.current();
          return;
        }
      }
      if (canBox.current) {
        canBox.current.style.transform = `translate(${x}px, ${y + bob}px) scale(${sc})`;
      }
      if (shadow.current) {
        const near = Math.max(0, Math.min(1, (8 - s.dist) / (8 - REST)));
        shadow.current.style.transform = `translate(${x + g.B * sc * 0.2}px, ${y + g.BH * sc * 0.93}px) scale(${sc * (1 - bob / 80)})`;
        shadow.current.style.opacity = String(near * (1 - e) * 0.9);
      }
      // con la cinta abierta y quieta, se deja de redibujar
      const settled = s.phase === 'open' && g.string.energy() < 0.03;
      s.still = settled ? s.still + 1 : 0;
      if (s.still < 3) {
        const pose = { dist: s.dist, yaw: s.yaw + sway, tilt, spin: s.spin };
        const c = canvas.current;
        const ctx = c?.getContext('2d');
        if (ctx) canister.draw(ctx, g.B, g.BH, pose);
        // la lengüeta, saliendo de la ranura con su mismo alto
        const sl = canister.slot();
        const tx = (v: { x: number; y: number }) => ({
          x: x + v.x * g.B * sc,
          y: y + bob + v.y * g.BH * sc,
        });
        const t1 = tx(sl.top),
          t2 = tx(sl.bot);
        const h = Math.hypot(t1.x - t2.x, t1.y - t2.y);
        const nx = (t1.x - t2.x) / h,
          ny = (t1.y - t2.y) / h;
        const track = straightTrack((t1.x + t2.x) / 2, (t1.y + t2.y) / 2, -ny, nx, nx, ny);
        paint(tongue.current, s.peek > 0.5 ? filmPaths(track, -TUCK, s.peek, h, h * 0.9) : null);
        paintFilm(g, s.shown);
      }
      if (titleBig.current) titleBig.current.style.opacity = String(1 - Math.min(1, e * 2));
      if (titleTop.current) {
        titleTop.current.style.opacity = String(Math.max(0, e * 2 - 1));
        titleTop.current.style.transform = `translateY(${(1 - e) * 10}px)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [canister]);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const leave = () => setPhase('leave');
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && leave();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  const open = () => {
    if (st.current.phase !== 'closed' && st.current.phase !== 'drag') return;
    scroller.current?.scrollTo({ top: 0 });
    sched.current = null;
    setPhase('stow');
  };

  // ── Tirar de la lengüeta (cerrado) o pellizcar la cinta (abierta) ──
  const drag = useRef<{ x: number; vx: number; lastX: number; lastT: number } | null>(null);
  const grab = useRef<{ q: number; nx: number; ny: number; x: number; y: number } | null>(null);
  const local = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onDown = (e: React.PointerEvent) => {
    const s = st.current;
    if (s.phase === 'open') {
      // ¿se ha tocado la cinta? (el punto más cercano)
      const pt = local(e);
      let best = { q: -1, d: Infinity };
      for (let q = LEAD; q < L - TAB; q += 6) {
        const p = sp.at(q);
        const dd = Math.hypot(p.x - pt.x, p.y - pt.y);
        if (dd < best.d) best = { q, d: dd };
      }
      if (best.d < THICK / 2 + 14) {
        const p = sp.at(best.q);
        const side = (pt.x - p.x) * p.nx + (pt.y - p.y) * p.ny;
        // un pellizco: la cinta se aparta del dedo y vibra
        string.kick(best.q, (side > 0 ? -1 : 1) * 420, 30);
        grab.current = { q: best.q, nx: p.nx, ny: p.ny, x: pt.x, y: pt.y };
        s.still = 0;
      }
      return;
    }
    if (s.phase !== 'closed') return;
    drag.current = { x: e.clientX, vx: 0, lastX: e.clientX, lastT: performance.now() };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setPhase('drag');
  };
  const onMove = (e: React.PointerEvent) => {
    const gb = grab.current;
    if (gb) {
      // arrastrar la cinta con el dedo: tira de ella por su normal
      const pt = local(e);
      const off = (pt.x - gb.x) * gb.nx + (pt.y - gb.y) * gb.ny;
      string.drive(gb.q, Math.max(-20, Math.min(20, off * 0.5)), 0.25);
      st.current.still = 0;
      return;
    }
    const d = drag.current;
    if (!d) return;
    const now = performance.now();
    d.vx = (e.clientX - d.lastX) / Math.max(1, now - d.lastT);
    d.lastX = e.clientX;
    d.lastT = now;
    const dx = Math.max(0, e.clientX - d.x);
    st.current.peekTarget = PEEK + Math.min(170, dx * 0.8 - (dx * dx) / 2600);
  };
  const onUp = () => {
    grab.current = null;
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const dx = d.lastX - d.x;
    setPhase('closed');
    // lanzada fuerte, o un toque: se abre
    if (d.vx > 0.5 || dx > 130 || Math.abs(dx) < 6) open();
  };

  const tint = mix(color, '#F7F4EE', 0.13);
  const isOpen = phase !== 'enter' && phase !== 'closed' && phase !== 'drag' && phase !== 'leave';
  const contentH = Math.max(vp.h, sp.height + 150);
  const top = (m: Moment) => [...new Set(m.reactions.map((r) => r.emoji))].slice(0, 2);
  const go = (fn: () => void) => {
    onClose();
    setTimeout(fn, 0);
  };

  return createPortal(
    <div
      ref={root}
      role="dialog"
      aria-label={`Carrete de ${label}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3000,
        background: tint,
        animation: 'jrv-in 260ms ease-out',
        fontFamily: 'system-ui, sans-serif',
      }}>
      <div
        ref={scroller}
        style={{
          position: 'absolute',
          inset: 0,
          overflowY: phase === 'open' ? 'auto' : 'hidden',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
        }}>
        <div
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          data-open={phase === 'open' ? '1' : '0'}
          style={{
            position: 'relative',
            height: isOpen ? contentH : vp.h,
            touchAction: phase === 'closed' || phase === 'drag' ? 'none' : 'pan-y',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            cursor: phase === 'closed' ? 'grab' : phase === 'drag' ? 'grabbing' : 'default',
          }}>
          <svg
            width={vp.w}
            height={contentH}
            style={{ position: 'absolute', inset: 0, overflow: 'visible', zIndex: 1 }}
            aria-hidden>
            <defs>
              <filter id={`${uid}s`} x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="5" stdDeviation="5" floodOpacity="0.2" />
              </filter>
            </defs>
            <g ref={strip}>
              <path fill={FILM} filter={`url(#${uid}s)`} />
              <path fill={AMBER} opacity={0.4} />
              <path fill={tint} />
            </g>
            {/* los fotogramas de relleno (en las vueltas): las reacciones del mes */}
            <path ref={fillPath} fill={FILL} stroke="#140B06" strokeWidth={1.5} />
            {fillWins.map((w, i) => {
              const f = fills[i % fills.length];
              return (
                <text
                  key={w.q}
                  ref={(el) => {
                    fillText.current[i] = el;
                  }}
                  opacity={0}
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{ fontSize: 22 }}>
                  {f.e}
                  {f.n > 1 && (
                    <tspan dx={2} dy={9} style={{ fontSize: 12, fontWeight: 700 }} fill="#F1D9B8">
                      {f.n}
                    </tspan>
                  )}
                </text>
              );
            })}
            {/* la lengüeta (con el carrete cerrado), por debajo del carrete */}
            <g ref={tongue}>
              <path fill={FILM} filter={`url(#${uid}s)`} />
              <path fill={AMBER} opacity={0.4} />
              <path fill={tint} />
            </g>
          </svg>

          {/* las fotos, montadas en la cinta */}
          {photoWins.map((w, i) => {
            const m = moments[w.photo!];
            const emojis = top(m);
            const comment = m.comments[m.comments.length - 1];
            return (
              <div
                key={m.id}
                ref={(el) => {
                  frameEls.current[i] = el;
                }}
                className="jrv-frame"
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: FRAME_W,
                  height: FRAME_H,
                  zIndex: 1,
                  visibility: 'hidden',
                  pointerEvents: phase === 'open' ? 'auto' : 'none',
                }}>
                <button
                  type="button"
                  aria-label={m.text ?? `Foto de ${user(m.authorId).name}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() =>
                    go(() => router.push({ pathname: '/moment/[id]', params: { id: m.id } }))
                  }
                  style={frameStyle}>
                  {m.imageUri ? (
                    <img
                      src={m.imageUri}
                      alt=""
                      draggable={false}
                      className="jrv-img"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  ) : (
                    <div className="jrv-img" style={paperStyle}>
                      {m.text ?? (m.voice ? 'Nota de voz' : '')}
                    </div>
                  )}
                </button>
                {emojis.length > 0 && (
                  <div style={stickerStyle(i)}>
                    {emojis.join('')}
                    {m.reactions.length > 1 && (
                      <span style={{ fontSize: 11, marginLeft: 2, fontWeight: 600 }}>
                        {m.reactions.length}
                      </span>
                    )}
                  </div>
                )}
                <div className="jrv-note" style={noteStyle}>
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

          {/* la sombra y el carrete */}
          <div
            ref={shadow}
            aria-hidden
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: B * 0.6,
              height: 26,
              transformOrigin: '0 0',
              borderRadius: '50%',
              background: 'radial-gradient(closest-side, rgba(0,0,0,.22), rgba(0,0,0,0))',
              pointerEvents: 'none',
            }}
          />
          <div
            ref={canBox}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: B,
              height: BH,
              transformOrigin: '0 0',
              zIndex: 2,
              pointerEvents: 'none',
            }}>
            <canvas
              ref={canvas}
              role="img"
              aria-label={`Carrete de ${label}: ${moments.length} fotos`}
              width={Math.round(B * 2)}
              height={Math.round(BH * 2)}
              style={{ width: B, height: BH, display: 'block' }}
            />
          </div>

          {/* con el carrete cerrado: el mes en grande y la pista */}
          <div
            ref={titleBig}
            style={{
              position: 'absolute',
              left: 24,
              right: 24,
              top: center.y + BH + 6,
              textAlign: 'center',
              pointerEvents: 'none',
              opacity: 0,
            }}>
            <div
              style={{ fontFamily: HandBold, fontSize: 34, color: '#1D1F22', lineHeight: '36px' }}>
              {label}
            </div>
            <div style={{ fontFamily: Hand, fontSize: 20, color: '#5F5C55', marginTop: 4 }}>
              {moments.length} {moments.length === 1 ? 'foto' : 'fotos'} ·{' '}
              <span
                style={{
                  display: 'inline-block',
                  animation: 'jrv-hint 1.6s ease-in-out infinite',
                }}>
                tira de la cinta →
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* el título, arriba, con el carrete abierto */}
      <div
        ref={titleTop}
        style={{
          position: 'absolute',
          left: B * cs * 0.82,
          right: 60,
          top: 14,
          fontFamily: HandBold,
          fontSize: 24,
          color: '#1D1F22',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          opacity: 0,
          pointerEvents: 'none',
          zIndex: 4,
        }}>
        {label}
      </div>
      <button type="button" aria-label="Cerrar el carrete" onClick={leave} style={closeStyle}>
        <Icon icon={X} size={20} color="#1D1F22" />
      </button>

      {/* abajo: abrir / rebobinar y ver la historia del mes */}
      <div style={barStyle(tint)}>
        {isOpen ? (
          <button
            type="button"
            onClick={() => phase === 'open' && setPhase('rewind')}
            style={{ ...pill, background: 'rgba(29,31,34,.08)', color: '#1D1F22' }}>
            <Icon icon={RotateCcw} size={16} color="#1D1F22" />
            Rebobinar
          </button>
        ) : (
          <button
            type="button"
            onClick={open}
            style={{ ...pill, background: 'rgba(29,31,34,.08)', color: '#1D1F22' }}>
            Abrir el carrete
          </button>
        )}
        {groupId && moments.length > 0 && (
          <button
            type="button"
            onClick={() => {
              primeNarrator();
              const from = String(monthStart(moments[0].createdAt));
              go(() =>
                router.push({ pathname: '/recap', params: { groupId, kind: 'month', from } }),
              );
            }}
            style={{ ...pill, background: color, color: '#FFFFFF' }}>
            <Icon icon={Play} size={16} color="#FFFFFF" />
            Ver la historia
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

const frameStyle: React.CSSProperties = {
  width: FRAME_W,
  height: FRAME_H,
  padding: 0,
  border: 0,
  borderRadius: 3,
  overflow: 'hidden',
  background: '#F3EEE2',
  boxShadow: '0 0 0 2px rgba(20,10,4,.6) inset',
  cursor: 'pointer',
  display: 'block',
};
const paperStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  padding: 7,
  boxSizing: 'border-box',
  fontFamily: Hand,
  fontSize: 14,
  lineHeight: '15px',
  color: '#1D1F22',
  overflow: 'hidden',
  textAlign: 'left',
};
const stickerStyle = (i: number): React.CSSProperties => ({
  position: 'absolute',
  top: -16,
  right: -10,
  padding: '2px 7px',
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
  top: FRAME_H + 18,
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
const closeStyle: React.CSSProperties = {
  position: 'absolute',
  top: 10,
  right: 12,
  width: 40,
  height: 40,
  borderRadius: 20,
  border: 0,
  background: 'rgba(255,255,255,.75)',
  boxShadow: '0 2px 8px rgba(0,0,0,.08)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  zIndex: 5,
};
const barStyle = (tint: string): React.CSSProperties => ({
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  padding: '28px 16px max(18px, env(safe-area-inset-bottom))',
  display: 'flex',
  justifyContent: 'center',
  gap: 10,
  background: `linear-gradient(to top, ${tint} 55%, ${tint}00)`,
  zIndex: 5,
});
const pill: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  height: 46,
  padding: '0 20px',
  borderRadius: 23,
  border: 0,
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
};
if (typeof document !== 'undefined' && !document.getElementById('jrv-css')) {
  const s = document.createElement('style');
  s.id = 'jrv-css';
  s.textContent =
    '@keyframes jrv-in{from{opacity:0}to{opacity:1}}' +
    '@keyframes jrv-hint{0%,100%{transform:translateX(0)}50%{transform:translateX(8px)}}' +
    // la foto sale como un negativo y se revela
    '.jrv-frame .jrv-img{filter:sepia(1) brightness(.35) contrast(1.3);transition:filter 1.2s ease-out}' +
    '.jrv-frame[data-dev="1"] .jrv-img{filter:none}' +
    // los comentarios, solo con la cinta quieta
    '.jrv-note{opacity:0;transition:opacity .4s}' +
    '[data-open="1"] .jrv-note{opacity:1}';
  document.head.appendChild(s);
}
