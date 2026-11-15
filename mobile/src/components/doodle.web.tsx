import {
  createContext,
  type CSSProperties,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import { Hand } from '@/constants/theme';
import {
  clamp,
  cloud,
  damped,
  DIGITS,
  ease,
  ellipse,
  hand,
  lerp,
  roundRect,
  span,
  squircle,
} from '@/lib/doodle-ink';
import type { DoodleSpec, Feeling, Weather } from '@/lib/doodles';

// Dibujos a mano animados (la técnica de la animación «Rumbo a ti», con los
// colores de cada escena): el contorno del mosaico se dibuja solo, las cifras
// caen como paletas, la pluma traza la ruta, las barras crecen… La línea
// «hierve» 8 veces por segundo. Todo es una función del tiempo t del dibujo,
// así que se pausa con la escena y se graba igual en el vídeo exportado.

export type DoodleColors = { ink: string; accent: string; paper: string };

const Time = createContext(0);
const Colors = createContext<DoodleColors>({ ink: '#222', accent: '#C2477A', paper: '#FFFDF6' });

/** El reloj del dibujo: segundos desde que empezó (negativo durante la espera). */
function useTime(delay: number, paused: boolean) {
  const [t, setT] = useState(-delay / 1000);
  const acc = useRef(-delay / 1000);
  const stop = useRef(paused);
  stop.current = paused;
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!stop.current) {
        acc.current += dt;
        setT(acc.current);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return t;
}

const hash = (s: string) => {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 9973;
};
const useUid = () => useId().replace(/[^a-zA-Z0-9]/g, '');

/** Un trazo de rotulador: se dibuja (k de 0 a 1) y hierve. */
function Ink({
  d,
  k = 1,
  color,
  width = 2,
  fill = 'none',
  amp = 1,
  step,
  close,
  dash,
  opacity,
  cap = 'round',
}: {
  d: string;
  k?: number;
  color?: string;
  width?: number;
  fill?: string;
  amp?: number;
  step?: number;
  close?: boolean;
  dash?: string;
  opacity?: number;
  cap?: 'round' | 'butt';
}) {
  const t = useContext(Time);
  const c = useContext(Colors);
  if (k <= 0.001) return null;
  const v = hand(d, { amp, step, close, seed: hash(d) });
  const frame = Math.floor(Math.max(0, t) * 8) % 3;
  const reveal =
    k < 0.999
      ? { pathLength: 1, strokeDasharray: '1 2', strokeDashoffset: 1 - k }
      : dash
        ? { strokeDasharray: dash }
        : {};
  return (
    <path
      d={v[frame]}
      fill={fill}
      fillOpacity={fill === 'none' ? undefined : Math.min(1, k * 1.5)}
      stroke={width ? (color ?? c.ink) : 'none'}
      strokeWidth={width}
      strokeLinecap={cap}
      strokeLinejoin="round"
      opacity={opacity}
      {...reveal}
    />
  );
}

/** Una cifra de rotulador grueso (esqueleto propio, no tipografía). */
function Digit({
  ch,
  x,
  y,
  h,
  k = 1,
  color,
  weight = 13,
}: {
  ch: string;
  x: number;
  y: number;
  h: number;
  k?: number;
  color?: string;
  weight?: number;
}) {
  const d = DIGITS[ch];
  if (!d) return null;
  return (
    <g transform={`translate(${x},${y}) scale(${h / 100})`}>
      <Ink d={d} k={k} width={weight} color={color} amp={0.6} step={3} close={false} />
    </g>
  );
}

/**
 * Cifra de paletas: pasa de «from» a «to» con k (0…1). Primero cae la mitad
 * de arriba de la vieja sobre la bisagra; luego baja la de abajo de la nueva.
 */
function FlipDigit({
  from,
  to,
  x,
  y,
  h,
  k,
  color,
}: {
  from: string;
  to: string;
  x: number;
  y: number;
  h: number;
  k: number;
  color?: string;
}) {
  const c = useContext(Colors);
  const id = useUid();
  const w = h * 0.62;
  const mid = y + h / 2;
  const half = (ch: string, top: boolean, s = 1) => (
    <g clipPath={`url(#${id}${top ? 'a' : 'b'})`}>
      <g transform={`translate(0,${mid}) scale(1,${Math.max(0.001, s)}) translate(0,${-mid})`}>
        <rect x={x - 6} y={top ? y - 8 : mid} width={w + 12} height={h / 2 + 8} fill={c.paper} />
        <Digit ch={ch} x={x} y={y} h={h} color={color} />
      </g>
    </g>
  );
  const kk = from === to ? 1 : k;
  return (
    <g>
      <defs>
        <clipPath id={`${id}a`}>
          <rect x={x - 10} y={y - 12} width={w + 20} height={h / 2 + 12} />
        </clipPath>
        <clipPath id={`${id}b`}>
          <rect x={x - 10} y={mid} width={w + 20} height={h / 2 + 12} />
        </clipPath>
      </defs>
      {kk <= 0 ? (
        <>
          {half(from, true)}
          {half(from, false)}
        </>
      ) : kk >= 1 ? (
        <>
          {half(to, true)}
          {half(to, false)}
        </>
      ) : (
        <>
          {half(to, true)}
          {half(from, false)}
          {kk < 0.5 ? half(from, true, 1 - kk * 2) : half(to, false, kk * 2 - 1)}
        </>
      )}
      <line x1={x - 4} x2={x + w + 4} y1={mid} y2={mid} stroke={c.paper} strokeWidth={1.6} />
    </g>
  );
}

/** El mosaico: cuadrado redondeado que se dibuja y se rellena de papel. */
function Tile({ t, d, children }: { t: number; d: string; children?: ReactNode }) {
  const c = useContext(Colors);
  const k = span(t, 0, 0.5, ease.inOut);
  return (
    <>
      <Ink d={d} k={span(t, 0.05, 0.3)} width={0} fill={c.paper} amp={1} />
      <Ink d={d} k={k} width={2.2} amp={1} />
      {children}
    </>
  );
}

/** El rótulo bajo el dibujo, que se escribe de izquierda a derecha. */
function Caption({
  text,
  t,
  at,
  x,
  y,
  width,
  size = 22,
}: {
  text?: string;
  t: number;
  at: number;
  x: number;
  y: number;
  width: number;
  size?: number;
}) {
  const c = useContext(Colors);
  const id = useUid();
  if (!text) return null;
  const k = span(t, at, 0.6, ease.inOut);
  return (
    <>
      <defs>
        <clipPath id={id}>
          <rect x={x - width / 2} y={y - size} width={width * k} height={size * 1.6} />
        </clipPath>
      </defs>
      <text
        x={x}
        y={y}
        clipPath={`url(#${id})`}
        fill={c.ink}
        fontFamily={Hand}
        fontSize={size}
        textAnchor="middle">
        {text}
      </text>
    </>
  );
}

// ── Los dibujos ─────────────────────────────────────────────────────────────

const TILE = squircle(100, 100, 172, 172);

/** Reloj de paletas: la hora local del momento; la última paleta cae. */
function Clock({ t, time, before }: { t: number; time: string; before: string }) {
  const c = useContext(Colors);
  const [a, b] = [before.replace(':', ''), time.replace(':', '')];
  const xs = [24, 60, 112, 148];
  const h = 50;
  const show = span(t, 0.3, 0.3);
  return (
    <Tile t={t} d={TILE}>
      <g opacity={show}>
        {xs.map((x, i) => (
          <FlipDigit
            key={i}
            from={a[i] ?? '0'}
            to={b[i] ?? '0'}
            x={x}
            y={74}
            h={h}
            k={span(t, 0.75 + (3 - i) * 0.08, 0.36, ease.in)}
          />
        ))}
        <Digit ch=":" x={86} y={74} h={h} weight={16} />
      </g>
      <circle
        cx={160}
        cy={160}
        r={4.5}
        fill={c.accent}
        opacity={show * (Math.floor(t * 2.2) % 2 ? 0.35 : 1)}
      />
    </Tile>
  );
}

/** Taco de calendario: las hojas se arrancan hacia arriba, día a día. */
function TearOff({ t, month, days }: { t: number; month: string; days: string[] }) {
  const c = useContext(Colors);
  const id = useUid();
  const hinge = 56;
  const flip = (j: number) => span(t, 0.7 + j * 0.34, 0.3, ease.inOut);
  let current = 0;
  for (let j = 0; j < days.length - 1; j++) if (flip(j) >= 1) current = j + 1;
  const k = current < days.length - 1 ? flip(current) : 0;
  const number = (day: string) => {
    const h = 74;
    const w = day.length * h * 0.76 - h * 0.16;
    return [...day].map((ch, i) => (
      <Digit key={i} ch={ch} x={100 - w / 2 + i * h * 0.76} y={88} h={h} weight={14} />
    ));
  };
  const page = (day: string, back = false) => (
    <g clipPath={`url(#${id})`}>
      <rect x={0} y={hinge} width={200} height={140} fill={c.paper} />
      {!back && number(day)}
    </g>
  );
  const cos = Math.cos(Math.PI * k);
  return (
    <>
      {/* el grosor del taco */}
      <Ink d={squircle(100, 108, 172, 172)} k={span(t, 0.2, 0.4)} width={1.4} fill={c.paper} />
      <Tile t={t} d={TILE}>
        <defs>
          <clipPath id={id}>
            <path d={squircle(100, 100, 168, 168)} />
          </clipPath>
        </defs>
        <g opacity={span(t, 0.3, 0.3)}>
          {page(days[Math.min(current + (k > 0 ? 1 : 0), days.length - 1)])}
          {k > 0 && (
            <g
              transform={`translate(0,${hinge}) scale(${1 + Math.sin(Math.PI * k) * 0.08},${Math.sign(cos) * Math.max(0.02, Math.abs(cos))}) translate(0,${-hinge})`}
              opacity={1 - span(t, 0.7 + current * 0.34 + 0.2, 0.1)}>
              {page(days[current], cos < 0)}
              <Ink d={squircle(100, 100, 172, 172)} width={1.6} />
            </g>
          )}
          {/* cabecera con el mes */}
          <g clipPath={`url(#${id})`}>
            <rect x={0} y={0} width={200} height={hinge} fill={c.accent} />
          </g>
          <text x={100} y={45} fill={c.paper} fontFamily={Hand} fontSize={30} textAnchor="middle">
            {month}
          </text>
          <Ink d={`M18,${hinge} L182,${hinge + 1}`} width={1.6} />
          <Ink d="M66,6 L66,24 M134,6 L134,24" width={3} color={c.ink} />
        </g>
        <Ink d={TILE} width={2.2} k={span(t, 0, 0.5, ease.inOut)} />
      </Tile>
    </>
  );
}

/** Cuadrícula del mes: se rellena de puntos y se rodean los días vividos. */
function MonthGrid({
  t,
  month,
  days,
  offset,
  marked,
}: {
  t: number;
  month: string;
  days: number;
  offset: number;
  marked: number[];
}) {
  const c = useContext(Colors);
  const id = useUid();
  const rows = Math.ceil((offset + days) / 7);
  const cw = 22,
    x0 = 23,
    y0 = 82,
    ch = Math.min(19, 96 / rows);
  const pos = (day: number) => {
    const i = offset + day - 1;
    return { x: x0 + (i % 7) * cw + cw / 2, y: y0 + Math.floor(i / 7) * ch + ch / 2 };
  };
  return (
    <Tile t={t} d={TILE}>
      <defs>
        <clipPath id={id}>
          <path d={squircle(100, 100, 168, 168)} />
        </clipPath>
      </defs>
      <g opacity={span(t, 0.3, 0.3)}>
        <g clipPath={`url(#${id})`}>
          <rect x={0} y={0} width={200} height={50} fill={c.accent} />
        </g>
        <text x={100} y={40} fill={c.paper} fontFamily={Hand} fontSize={28} textAnchor="middle">
          {month}
        </text>
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((l, i) => (
          <text
            key={l + i}
            x={x0 + i * cw + cw / 2}
            y={70}
            fill={c.ink}
            opacity={0.6}
            fontFamily={Hand}
            fontSize={13}
            textAnchor="middle">
            {l}
          </text>
        ))}
        {Array.from({ length: days }, (_, i) => {
          const p = pos(i + 1);
          const on = marked.includes(i + 1);
          const k = span(t, 0.5 + i * 0.018, 0.2);
          return on ? (
            <text
              key={i}
              x={p.x}
              y={p.y + 4}
              fill={c.ink}
              fontFamily={Hand}
              fontSize={12}
              textAnchor="middle"
              opacity={k}>
              {i + 1}
            </text>
          ) : (
            <circle key={i} cx={p.x} cy={p.y} r={1.4} fill={c.ink} opacity={k * 0.55} />
          );
        })}
        {marked.map((day, j) => {
          const p = pos(day);
          return (
            <Ink
              key={day}
              d={ellipse(p.x, p.y, 9.5, 8)}
              k={span(t, 1.2 + j * 0.14, 0.32, ease.inOut)}
              color={c.accent}
              width={1.8}
              amp={0.9}
            />
          );
        })}
      </g>
    </Tile>
  );
}

const ROUTE =
  'M44,140 C60,152 82,150 92,132 C104,112 134,124 130,102 C126,82 96,84 100,104 C104,124 140,114 150,88 C155,76 157,68 160,60';

/** La ruta: la pluma traza el camino discontinuo de una ciudad a la otra. */
function Route({ t, from, to, km }: { t: number; from: string; to: string; km: string }) {
  const c = useContext(Colors);
  const id = useUid();
  const probe = useRef<SVGPathElement | null>(null);
  const kd = span(t, 0.55, 1.5, ease.inOut);
  const ks = span(t, 2.4, 0.5, ease.in);
  let pen = { x: 44, y: 140 };
  const p = probe.current;
  if (p) {
    const L = p.getTotalLength();
    const q = p.getPointAtLength(L * kd);
    pen = { x: q.x, y: q.y };
  }
  const penX = pen.x + (kd >= 1 ? 2 : 0) + ks * 70;
  const penY = pen.y - Math.sin(Math.PI * span(t, 2.05, 0.3)) * 8 + ks * 90;
  let lines = '';
  for (let y = 46; y < 176; y += 18) lines += `M${y < 64 ? 60 : 24},${y} L176,${y + 0.5} `;
  return (
    <Tile t={t} d={TILE}>
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse" x={0} y={0} width={200} height={200}>
          <path
            d={ROUTE}
            ref={probe}
            fill="none"
            stroke="#fff"
            strokeWidth={8}
            pathLength={1}
            strokeDasharray="1 2"
            strokeDashoffset={1 - kd}
          />
        </mask>
      </defs>
      <Ink d={lines} width={1} opacity={0.18} k={span(t, 0.3, 0.4)} step={9} />
      <g mask={`url(#${id})`}>
        <Ink d={ROUTE} width={2} dash="5 5" cap="butt" amp={0.6} />
      </g>
      <circle
        cx={44}
        cy={140}
        r={4.6 * ease.back(span(t, 0.4, 0.3, ease.linear))}
        fill={c.accent}
      />
      <Ink d="M152,52 L168,68" k={span(t, 2.05, 0.15)} color={c.accent} width={2.6} />
      <Ink d="M168,52 L152,68" k={span(t, 2.2, 0.15)} color={c.accent} width={2.6} />
      <g opacity={span(t, 0.5, 0.4)}>
        <text x={34} y={168} fill={c.ink} fontFamily={Hand} fontSize={15} opacity={0.75}>
          {from.length > 14 ? from.slice(0, 13) + '…' : from}
        </text>
      </g>
      <g opacity={span(t, 2.2, 0.4)}>
        <text x={172} y={42} fill={c.ink} fontFamily={Hand} fontSize={15} textAnchor="end">
          {to.length > 14 ? to.slice(0, 13) + '…' : to}
        </text>
        <text x={104} y={186} fill={c.accent} fontFamily={Hand} fontSize={16} textAnchor="middle">
          {km}
        </text>
      </g>
      {/* la pluma (punta en el camino, cuerpo hacia abajo a la izquierda) */}
      {ks < 1 && t > 0.3 && (
        <g
          transform={`translate(${penX},${penY}) rotate(${140 - 40 * ks}) scale(0.42)`}
          opacity={span(t, 0.3, 0.2) * (1 - ks)}>
          <Ink d="M0,0 L18,-6 L18,6 Z" width={1.6} fill={c.paper} amp={0.3} step={4} />
          <Ink d="M18,-9 L132,-10 L132,10 L18,9 Z" width={2} fill={c.ink} amp={0.3} step={4} />
          <Ink
            d="M132,-10 L144,-10 L144,10 L132,10 Z"
            width={1.6}
            fill={c.accent}
            amp={0.3}
            step={4}
          />
        </g>
      )}
    </Tile>
  );
}

/** El tiempo que hacía: sol con su anillo de puntos, nubes, lluvia, nieve… */
function Sky({ t, sky, temp }: { t: number; sky: Weather; temp?: number }) {
  const c = useContext(Colors);
  const show = span(t, 0.35, 0.3);
  const tempText = temp == null ? '' : `${temp < 0 ? '-' : ''}${Math.abs(temp)}°`;
  const body = (() => {
    if (sky === 'sol')
      return (
        <>
          <Ink d={ellipse(76, 78, 28)} k={span(t, 0.4, 0.5, ease.inOut)} width={2.6} />
          <g transform={`rotate(${t * 10} 76 78)`}>
            {Array.from({ length: 30 }, (_, i) => {
              const a = (i / 30) * Math.PI * 2;
              return (
                <circle
                  key={i}
                  cx={76 + Math.cos(a) * 39}
                  cy={78 + Math.sin(a) * 39}
                  r={2.3}
                  fill={c.ink}
                  opacity={span(t, 0.8 + i * 0.02, 0.1)}
                />
              );
            })}
          </g>
        </>
      );
    if (sky === 'luna')
      return (
        <>
          <Ink
            d="M92,44 C68,44 52,62 52,84 C52,106 70,122 92,122 C78,114 70,100 70,84 C70,66 78,52 92,44 Z"
            k={span(t, 0.4, 0.6, ease.inOut)}
            width={2.4}
            fill={c.accent}
          />
          {[
            [128, 54],
            [150, 92],
            [118, 112],
            [42, 140],
          ].map(([x, y], i) => (
            <Ink
              key={i}
              d={`M${x - 5},${y} L${x + 5},${y} M${x},${y - 5} L${x},${y + 5}`}
              width={1.8}
              k={span(t, 0.9 + i * 0.15, 0.2)}
              opacity={0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i))}
            />
          ))}
        </>
      );
    if (sky === 'niebla')
      return (
        <>
          {[60, 84, 108, 132].map((y, i) => (
            <g key={y} transform={`translate(${Math.sin(t * 0.9 + i) * 8},0)`}>
              <Ink
                d={`M${30 + (i % 2) * 14},${y} C60,${y - 8} 90,${y + 8} 120,${y} C140,${y - 6} 156,${y + 4} ${168 - (i % 2) * 20},${y}`}
                width={2.4}
                k={span(t, 0.4 + i * 0.12, 0.4)}
              />
            </g>
          ))}
        </>
      );
    const drift = Math.sin(t * 0.8) * 6;
    return (
      <>
        {sky === 'nubes' && <Ink d={ellipse(118, 58, 20)} width={2.2} k={span(t, 0.35, 0.4)} />}
        <g transform={`translate(${drift},0)`}>
          <Ink
            d={cloud(32, sky === 'nubes' ? 104 : 86, 118)}
            width={2.4}
            fill={c.paper}
            k={span(t, 0.4, 0.6, ease.inOut)}
          />
        </g>
        {sky === 'nubes' && (
          <g transform={`translate(${-drift},0)`}>
            <Ink d={cloud(96, 70, 62)} width={2} fill={c.paper} k={span(t, 0.6, 0.5)} />
          </g>
        )}
        {sky === 'lluvia' &&
          [44, 64, 84, 104, 124, 144].map((x, i) => (
            <path
              key={x}
              d={`M${x},96 L${x - 10},${150 - (i % 2) * 12}`}
              stroke={c.accent}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeDasharray="6 9"
              strokeDashoffset={-t * 46 - i * 5}
              opacity={span(t, 0.9, 0.3)}
            />
          ))}
        {sky === 'nieve' &&
          [40, 66, 92, 118, 144].map((x, i) => {
            const y = 96 + ((((t * 22 + i * 13) % 60) + 60) % 60);
            const sx = x + Math.sin(t * 2 + i) * 5;
            return (
              <Ink
                key={x}
                d={`M${sx - 4},${y} L${sx + 4},${y} M${sx},${y - 4} L${sx},${y + 4} M${sx - 3},${y - 3} L${sx + 3},${y + 3}`}
                width={1.6}
                k={span(t, 0.9 + i * 0.1, 0.2)}
              />
            );
          })}
      </>
    );
  })();
  const temps = [...tempText];
  return (
    <Tile t={t} d={TILE}>
      <g opacity={show}>
        {body}
        {temps.map((ch, i) => (
          <Digit
            key={i}
            ch={ch}
            x={176 - (temps.length - i) * 22}
            y={134}
            h={34}
            weight={13}
            k={span(t, 1.1 + i * 0.12, 0.3, ease.inOut)}
          />
        ))}
      </g>
    </Tile>
  );
}

/** De qué habla: café humeante, un corazón que late, notas, olas, banderines. */
function FeelingArt({ t, feeling }: { t: number; feeling: Feeling }) {
  const c = useContext(Colors);
  const k = (a: number, d = 0.5) => span(t, a, d, ease.inOut);
  let art: ReactNode = null;
  if (feeling === 'comida')
    art = (
      <>
        <Ink d={ellipse(100, 142, 50, 9)} k={k(0.4)} width={2.2} fill={c.paper} />
        <Ink
          d="M64,90 L136,90 L130,136 C128,144 72,144 70,136 Z"
          k={k(0.5)}
          width={2.4}
          fill={c.paper}
        />
        <Ink d={ellipse(100, 92, 34, 5)} k={k(0.7)} width={1.6} fill={c.ink} />
        <Ink d="M136,100 C156,100 156,124 132,124" k={k(0.8)} width={2.4} />
        {[82, 100, 118].map((x, i) => {
          const ph = (t * 0.7 + i * 0.33) % 1;
          return (
            <g
              key={x}
              transform={`translate(0,${-ph * 16})`}
              opacity={span(t, 1, 0.3) * Math.sin(Math.PI * ph)}>
              <Ink
                d={`M${x},80 C${x - 7},72 ${x + 7},66 ${x},58 C${x - 7},50 ${x + 7},44 ${x},36`}
                width={2}
              />
            </g>
          );
        })}
      </>
    );
  if (feeling === 'amor') {
    const heart =
      'M100,152 C66,128 44,108 44,82 C44,62 58,50 74,50 C86,50 96,58 100,70 C104,58 114,50 126,50 C142,50 156,62 156,82 C156,108 134,128 100,152 Z';
    const beat = 1 + 0.07 * Math.max(0, Math.sin(t * 7)) * span(t, 1.2, 0.3);
    art = (
      <g transform={`translate(100,100) scale(${beat}) translate(-100,-100)`}>
        <Ink d={heart} k={span(t, 1.0, 0.4)} width={0} fill={c.accent} />
        <Ink d={heart} k={k(0.4, 0.7)} width={3} />
        <Ink d="M60,80 C60,70 66,64 74,64" k={k(1.1, 0.3)} width={2} color={c.paper} />
      </g>
    );
  }
  if (feeling === 'musica')
    art = (
      <>
        <Ink
          d="M30,60 L170,60 M30,80 L170,80 M30,100 L170,100 M30,120 L170,120 M30,140 L170,140"
          k={k(0.35)}
          width={1}
          opacity={0.3}
          step={10}
        />
        {[
          [70, 0],
          [124, 1],
        ].map(([x, i]) => (
          <g
            key={x}
            transform={`translate(0,${-Math.abs(Math.sin(t * 4 + i * 1.6)) * 8 * span(t, 1, 0.3)})`}>
            <Ink d={ellipse(x, 132 - i * 16, 11, 8)} k={k(0.5 + i * 0.2)} width={2} fill={c.ink} />
            <Ink
              d={`M${x + 10},${132 - i * 16} L${x + 10},${70 - i * 16}`}
              k={k(0.7 + i * 0.2)}
              width={2.6}
            />
            <Ink
              d={`M${x + 10},${70 - i * 16} C${x + 22},${76 - i * 16} ${x + 30},${84 - i * 16} ${x + 26},${98 - i * 16}`}
              k={k(0.9 + i * 0.2)}
              width={2.4}
              color={c.accent}
            />
          </g>
        ))}
      </>
    );
  if (feeling === 'mar')
    art = (
      <>
        <Ink
          d="M58,96 C58,76 74,62 100,62 C126,62 142,76 142,96"
          k={k(0.4)}
          width={2.4}
          fill={c.accent}
        />
        <Ink d="M24,96 L176,96" k={k(0.3)} width={2.2} />
        {[112, 132, 152].map((y, i) => {
          let d = `M${-20 + (i % 2) * 12},${y}`;
          for (let x = -20 + (i % 2) * 12; x < 220; x += 20)
            d += ` C${x + 5},${y - 7} ${x + 15},${y - 7} ${x + 20},${y}`;
          return (
            <g key={y} transform={`translate(${-((t * (14 + i * 6)) % 20)},0)`}>
              <Ink d={d} k={k(0.6 + i * 0.15)} width={2} step={6} />
            </g>
          );
        })}
      </>
    );
  if (feeling === 'fiesta') {
    const swing = Math.sin(t * 2.4) * 4;
    art = (
      <>
        <Ink d={`M20,50 C70,${84 + swing} 130,${84 + swing} 180,50`} k={k(0.35)} width={2} />
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const x = 36 + i * 26;
          const y = 50 + Math.sin(((i + 0.5) / 6) * Math.PI) * (32 + swing);
          return (
            <Ink
              key={i}
              d={`M${x - 9},${y - 2} L${x + 9},${y - 2} L${x},${y + 20} Z`}
              k={k(0.6 + i * 0.08, 0.3)}
              width={1.6}
              fill={i % 2 ? c.ink : c.accent}
            />
          );
        })}
        {Array.from({ length: 9 }, (_, i) => {
          const y = 96 + ((((t * 30 + i * 23) % 80) + 80) % 80);
          const x = 30 + ((i * 37) % 140);
          return (
            <Ink
              key={i}
              d={`M${x},${y} l${i % 2 ? 6 : -6},5`}
              width={2.4}
              color={i % 3 ? c.accent : c.ink}
              k={span(t, 1, 0.2)}
            />
          );
        })}
      </>
    );
  }
  return (
    <Tile t={t} d={TILE}>
      {art}
    </Tile>
  );
}

/** El gráfico del periodo: barras a mano que crecen; la mayor, rodeada. */
function Bars({ t, labels, values }: { t: number; labels: string[]; values: number[] }) {
  const c = useContext(Colors);
  const max = Math.max(1, ...values);
  const top = values.indexOf(max);
  const n = values.length;
  const slot = 290 / n;
  const bw = Math.min(30, slot * 0.56);
  const base = 150;
  return (
    <>
      <Ink d={roundRect(4, 4, 332, 186, 30)} k={span(t, 0.05, 0.3)} width={0} fill={c.paper} />
      <Ink d={roundRect(4, 4, 332, 186, 30)} k={span(t, 0, 0.5, ease.inOut)} width={2.2} />
      <Ink d={`M22,${base} L318,${base + 1}`} k={span(t, 0.3, 0.4)} width={2} />
      {values.map((v, i) => {
        const cx = 25 + slot * i + slot / 2;
        const g = ease.back(span(t, 0.5 + i * 0.09, 0.45, ease.linear));
        const h = Math.max(v ? 6 : 2, (v / max) * 96) * g;
        const x = cx - bw / 2;
        const shape = `M${x},${base} L${x},${base - h} L${x + bw},${base - h} L${x + bw},${base}`;
        const hatch =
          h > 10
            ? Array.from(
                { length: Math.floor(h / 9) },
                (_, j) => `M${x + 3},${base - 4 - j * 9} L${x + bw - 3},${base - 9 - j * 9}`,
              ).join(' ')
            : '';
        return (
          <g key={i}>
            {i === top && h > 2 && (
              <rect x={x} y={base - h} width={bw} height={h} fill={c.accent} opacity={0.9} />
            )}
            {!!hatch && i !== top && <Ink d={hatch} width={1.1} opacity={0.4} step={8} />}
            {h > 1 && <Ink d={`${shape}`} width={2} amp={0.5} step={6} />}
            {v > 0 && (
              <text
                x={cx}
                y={base - h - 7}
                fill={i === top ? c.accent : c.ink}
                fontFamily={Hand}
                fontSize={17}
                textAnchor="middle"
                opacity={span(t, 0.8 + i * 0.09, 0.2)}>
                {v}
              </text>
            )}
            <text
              x={cx}
              y={base + 22}
              fill={c.ink}
              fontFamily={Hand}
              fontSize={n > 6 ? 16 : 14}
              textAnchor="middle"
              opacity={span(t, 0.4 + i * 0.05, 0.2) * (i === top ? 1 : 0.7)}>
              {labels[i]}
            </text>
          </g>
        );
      })}
      {(() => {
        const cx = 25 + slot * top + slot / 2;
        return (
          <Ink
            d={ellipse(cx, base + 16, Math.max(16, slot * 0.45), 14)}
            k={span(t, 1.6, 0.45, ease.inOut)}
            color={c.accent}
            width={2.2}
            amp={1.4}
          />
        );
      })()}
    </>
  );
}

/** Los años pasan como un contador de paletas (de un recuerdo al siguiente). */
function Years({ t, from, to }: { t: number; from: number; to: number }) {
  const steps = Math.min(10, Math.abs(to - from));
  const seq = Array.from({ length: steps + 1 }, (_, i) =>
    String(Math.round(lerp(from, to, steps ? i / steps : 1))),
  );
  const per = 0.17;
  const pos = clamp((t - 0.45) / per, 0, Math.max(0, seq.length - 1));
  const i = Math.min(seq.length - 1, Math.floor(pos));
  const k = i >= seq.length - 1 ? 1 : ease.in(pos - i);
  const a = seq[i].padStart(4, '0'),
    b = seq[Math.min(seq.length - 1, i + 1)].padStart(4, '0');
  const h = 62;
  const xs = [32, 78, 124, 170].map((x) => x - 4);
  return (
    <>
      <Tile t={t} d={roundRect(8, 8, 224, 104, 28)}>
        <g opacity={span(t, 0.3, 0.25)}>
          {xs.map((x, j) => (
            <FlipDigit key={j} from={a[j]} to={b[j]} x={x} y={29} h={h} k={k} />
          ))}
        </g>
      </Tile>
    </>
  );
}

/** Un hueco en la historia: dos años con un camino discontinuo y una interrogación. */
function GapArt({ t, from, to }: { t: number; from: number; to: number }) {
  const c = useContext(Colors);
  const year = (y: number, x: number, at: number) =>
    [...String(y)].map((ch, i) => (
      <Digit
        key={i}
        ch={ch}
        x={x + i * 17}
        y={50}
        h={24}
        weight={14}
        k={span(t, at + i * 0.08, 0.25, ease.inOut)}
      />
    ));
  const wob = damped(t, 1.6, 1.5, 1.5) * 10 + Math.sin(t * 1.8) * 3;
  return (
    <>
      <Ink d={roundRect(6, 38, 82, 50, 16)} k={span(t, 0, 0.4)} width={2} fill={c.paper} />
      <Ink d={roundRect(152, 38, 82, 50, 16)} k={span(t, 0.15, 0.4)} width={2} fill={c.paper} />
      {year(from, 15, 0.35)}
      {year(to, 161, 0.5)}
      <Ink
        d="M92,63 C108,40 132,86 148,63"
        k={span(t, 0.8, 0.7, ease.inOut)}
        width={2}
        dash="5 6"
        cap="butt"
      />
      <g transform={`rotate(${wob} 120 40)`}>
        <Digit
          ch="?"
          x={104}
          y={2}
          h={46}
          weight={13}
          color={c.accent}
          k={span(t, 1.3, 0.5, ease.inOut)}
        />
      </g>
    </>
  );
}

/** Donde empezó todo: un alfiler que cae, rebota y se rodea a mano. */
function Origin({ t }: { t: number }) {
  const c = useContext(Colors);
  const fall = span(t, 0.4, 0.45, ease.in);
  const bounce = damped(t, 0.85, 2.6, 6) * 10;
  const y = lerp(-80, 0, fall) - Math.abs(bounce);
  return (
    <Tile t={t} d={TILE}>
      <Ink
        d={ellipse(100, 148, 26, 6)}
        k={span(t, 0.8, 0.3)}
        width={0}
        fill={c.ink}
        opacity={0.18}
      />
      <Ink
        d={ellipse(100, 140, 58, 26)}
        k={span(t, 1.1, 0.7, ease.inOut)}
        color={c.accent}
        width={2}
        dash="6 6"
        cap="butt"
      />
      <g transform={`translate(0,${y})`} opacity={fall > 0 ? 1 : 0}>
        <Ink
          d="M100,146 C86,120 70,106 70,82 C70,64 84,50 100,50 C116,50 130,64 130,82 C130,106 114,120 100,146 Z"
          width={2.4}
          fill={c.accent}
        />
        <Ink d={ellipse(100, 81, 10)} width={2} fill={c.paper} />
      </g>
    </Tile>
  );
}

// ── El componente ───────────────────────────────────────────────────────────

const BOXES: Record<DoodleSpec['kind'], [number, number]> = {
  reloj: [200, 200],
  calendario: [200, 212],
  mes: [200, 200],
  ruta: [200, 200],
  tiempo: [200, 200],
  animo: [200, 200],
  barras: [340, 194],
  anios: [240, 120],
  hueco: [240, 96],
  origen: [200, 200],
};

/**
 * Un dibujo a mano animado. «size» es el ancho en píxeles; el rótulo (si lo
 * hay) va debajo y se escribe solo. «delay» en milisegundos.
 */
export function Doodle({
  spec,
  size = 120,
  colors,
  delay = 0,
  paused = false,
  leaving = false,
  style,
}: {
  spec: DoodleSpec;
  size?: number;
  colors: DoodleColors;
  delay?: number;
  paused?: boolean;
  leaving?: boolean;
  style?: CSSProperties;
}) {
  const t = useTime(delay, paused);
  const [w, h] = BOXES[spec.kind];
  const capH = spec.caption ? (spec.kind === 'barras' ? 34 : 44) : 0;
  const pop = ease.back(span(t, 0, 0.45, ease.linear));
  const art = (() => {
    switch (spec.kind) {
      case 'reloj':
        return <Clock t={t} time={spec.time} before={spec.before} />;
      case 'calendario':
        return <TearOff t={t} month={spec.month} days={spec.days} />;
      case 'mes':
        return (
          <MonthGrid
            t={t}
            month={spec.month}
            days={spec.days}
            offset={spec.offset}
            marked={spec.marked}
          />
        );
      case 'ruta':
        return <Route t={t} from={spec.from} to={spec.to} km={spec.km} />;
      case 'tiempo':
        return <Sky t={t} sky={spec.sky} temp={spec.temp} />;
      case 'animo':
        return <FeelingArt t={t} feeling={spec.feeling} />;
      case 'barras':
        return <Bars t={t} labels={spec.labels} values={spec.values} />;
      case 'anios':
        return <Years t={t} from={spec.from} to={spec.to} />;
      case 'hueco':
        return <GapArt t={t} from={spec.from} to={spec.to} />;
      case 'origen':
        return <Origin t={t} />;
    }
  })();
  return (
    <div
      aria-hidden
      style={{
        width: size,
        opacity: leaving ? 0 : t < 0 ? 0 : 1,
        transform: leaving ? 'translateY(-10px) scale(0.92)' : 'none',
        transition: 'opacity 260ms ease-in, transform 260ms ease-in',
        pointerEvents: 'none',
        ...style,
      }}>
      <Time.Provider value={t}>
        <Colors.Provider value={colors}>
          <svg
            viewBox={`-6 -6 ${w + 12} ${h + 12 + capH}`}
            width={size}
            height={(size * (h + 12 + capH)) / (w + 12)}
            style={{ display: 'block', overflow: 'visible' }}>
            <g
              transform={`translate(${w / 2},${h / 2}) scale(${0.6 + 0.4 * pop}) translate(${-w / 2},${-h / 2})`}
              opacity={clamp(t * 4)}>
              {art}
            </g>
            <Caption
              text={spec.caption}
              t={t}
              at={spec.kind === 'barras' ? 1.8 : 0.9}
              x={w / 2}
              y={h + capH - 2}
              width={w + 60}
              size={spec.kind === 'barras' ? 24 : 32}
            />
          </svg>
        </Colors.Provider>
      </Time.Provider>
    </div>
  );
}

/** Si el dibujo se puede mostrar (en la web sí). */
export const canDoodle = () => true;
