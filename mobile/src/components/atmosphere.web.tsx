import { useEffect, useRef } from 'react';

import { type Mood, nightness, type Sky, skyColors, type Travel } from '@/lib/film';

// El cielo de cada escena del resumen, pintado en un lienzo: el color de la
// hora que era allí, el sol o la luna en su sitio, estrellas, nubes según lo
// cubierto que estaba, lo que caía (lluvia, nieve) y lo que flota en el aire
// según de qué se habla (confeti, vapor, hojas, notas, corazones…). Al cambiar
// de escena no hay corte: el cielo se funde y el sol recorre su camino.

type Props = {
  sky: Sky;
  mood: Mood;
  /** Si la escena llega desde otra ciudad: un avión de papel cruza el cielo. */
  travel?: Travel | null;
  paused?: boolean;
};

type P = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  vr: number;
  ph: number;
  c: string;
  g?: string;
};
type Kind =
  | 'dust'
  | 'sparkle'
  | 'confetti'
  | 'steam'
  | 'streaks'
  | 'rain'
  | 'snow'
  | 'waves'
  | 'leaves'
  | 'notes'
  | 'hearts'
  | 'fireflies';
type Layer = { kind: Kind; alpha: number; on: boolean; ps: P[] };

const KIND: Record<Mood, Kind> = {
  calma: 'dust',
  nostalgia: 'dust',
  alegria: 'sparkle',
  fiesta: 'confetti',
  comida: 'steam',
  viaje: 'streaks',
  lluvia: 'rain',
  nieve: 'snow',
  mar: 'waves',
  naturaleza: 'leaves',
  musica: 'notes',
  amor: 'hearts',
  noche: 'fireflies',
};
const COUNT: Record<Kind, number> = {
  dust: 26,
  sparkle: 16,
  confetti: 64,
  steam: 9,
  streaks: 10,
  rain: 110,
  snow: 70,
  waves: 3,
  leaves: 14,
  notes: 10,
  hearts: 12,
  fireflies: 14,
};
const CONFETTI = ['#F2B33D', '#C2477A', '#4FA6E6', '#2F7D4F', '#FFFFFF', '#D0532C'];
const LEAVES = ['#7FA650', '#C9A227', '#D0532C', '#8F6F3B'];
const NOTES = ['♪', '♫', '♩'];

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

/** Una partícula nueva de su tipo, repartida por toda la pantalla. */
function spawn(kind: Kind, w: number, h: number): P {
  const base = {
    x: rnd(0, w),
    y: rnd(0, h),
    vx: 0,
    vy: 0,
    r: 3,
    rot: 0,
    vr: 0,
    ph: rnd(0, 6.28),
    c: '',
  };
  switch (kind) {
    case 'dust':
      return { ...base, vy: -rnd(4, 12), r: rnd(1.5, 4.5) };
    case 'sparkle':
      return { ...base, y: rnd(0, h * 0.8), vy: -rnd(1, 4), r: rnd(4, 9) };
    case 'confetti':
      return {
        ...base,
        y: rnd(-h, h),
        vy: rnd(60, 140),
        vx: rnd(-20, 20),
        r: rnd(6, 10),
        rot: rnd(0, 6.28),
        vr: rnd(-4, 4),
        c: pick(CONFETTI),
      };
    case 'steam':
      return {
        ...base,
        x: rnd(w * 0.12, w * 0.88),
        y: rnd(h * 0.45, h + 40),
        vy: -rnd(18, 34),
        r: rnd(14, 26),
      };
    case 'streaks':
      return { ...base, y: rnd(h * 0.06, h * 0.78), vx: -rnd(220, 420), r: rnd(60, 160) };
    case 'rain':
      return { ...base, x: rnd(-w * 0.2, w * 1.2), vy: rnd(650, 900), vx: -120, r: rnd(12, 22) };
    case 'snow':
      return { ...base, vy: rnd(30, 70), r: rnd(1.5, 3.5) };
    case 'leaves':
      return {
        ...base,
        y: rnd(-h, h),
        vy: rnd(35, 70),
        r: rnd(6, 9),
        rot: rnd(0, 6.28),
        vr: rnd(-1.5, 1.5),
        c: pick(LEAVES),
      };
    case 'notes':
      return {
        ...base,
        y: rnd(h * 0.2, h + 60),
        vy: -rnd(25, 45),
        r: rnd(18, 30),
        rot: rnd(-0.3, 0.3),
        g: pick(NOTES),
      };
    case 'hearts':
      return {
        ...base,
        y: rnd(h * 0.2, h + 60),
        vy: -rnd(22, 40),
        r: rnd(12, 22),
        rot: rnd(-0.3, 0.3),
      };
    case 'fireflies':
      return { ...base, y: rnd(h * 0.25, h * 0.95), r: rnd(2, 3.5) };
    default:
      return base;
  }
}

const sprites = new Map<number, HTMLCanvasElement>();
/** Una nube de bordes suaves (a doble tamaño), hecha con varios copos difuminados. */
function cloudSprite(i: number, puffs: { dx: number; dy: number; r: number }[]) {
  let c = sprites.get(i);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = 520;
  c.height = 220;
  const g = c.getContext('2d')!;
  const cx = 260;
  const cy = 130;
  const all = [
    ...puffs.map((p) => ({ x: p.dx * 2.2, y: p.dy * 1.4, r: p.r * 2.1 })),
    { x: -40, y: 18, r: 70 },
    { x: 50, y: 20, r: 74 },
  ];
  for (const p of all) {
    const rg = g.createRadialGradient(cx + p.x, cy + p.y, 0, cx + p.x, cy + p.y, p.r);
    rg.addColorStop(0, 'rgba(255,255,255,0.75)');
    rg.addColorStop(0.55, 'rgba(255,255,255,0.45)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.beginPath();
    g.arc(cx + p.x, cy + p.y, p.r, 0, 6.2832);
    g.fill();
  }
  sprites.set(i, c);
  return c;
}

export function Atmosphere({ sky, mood, travel, paused }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const want = useRef({ sky, mood, travel, paused });
  want.current = { sky, mood, travel, paused };

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let w = 1;
    let h = 1;
    let dpr = 1;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };
    resize();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    observer?.observe(canvas);

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // Lo que se ve ahora mismo (va detrás de lo que se quiere, sin saltos).
    const first = skyColors(want.current.sky);
    let top = [...first.top];
    let bottom = [...first.bottom];
    let hour = want.current.sky.hour;
    let cover = want.current.sky.cover;
    let fog = want.current.sky.fog ? 1 : 0;
    const stars = Array.from({ length: 70 }, () => ({
      x: Math.random(),
      y: Math.random() * 0.66,
      r: rnd(0.6, 1.6),
      ph: rnd(0, 6.28),
    }));
    const clouds = Array.from({ length: 6 }, (_, i) => ({
      x: Math.random(),
      y: 0.06 + (i / 6) * 0.42 + rnd(-0.02, 0.02),
      s: rnd(0.7, 1.3),
      v: rnd(0.004, 0.011),
      puffs: Array.from({ length: 5 }, (_, k) => ({
        dx: (k - 2) * 26 + rnd(-6, 6),
        dy: rnd(-8, 8),
        r: rnd(22, 38),
      })),
    }));
    let layers: Layer[] = [];
    let flight: { key: string; t: number } | null = null;
    let seen = '';
    let time = 0;
    let last = performance.now();
    let raf = 0;

    const circle = (x: number, y: number, r: number) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 6.2832);
      ctx.fill();
    };

    const drawLayer = (layer: Layer, dt: number, dark: boolean) => {
      const a = layer.alpha;
      const s = dt / 1000;
      for (const p of layer.ps) {
        p.x += p.vx * s;
        p.y += p.vy * s;
        p.rot += p.vr * s;
        switch (layer.kind) {
          case 'dust': {
            p.x += Math.sin(time / 1400 + p.ph) * 0.15;
            if (p.y < -10) Object.assign(p, spawn('dust', w, h), { y: h + 10 });
            ctx.fillStyle = dark
              ? `rgba(255,236,190,${a * (0.22 + 0.16 * Math.sin(time / 1000 + p.ph))})`
              : `rgba(255,255,255,${a * (0.4 + 0.25 * Math.sin(time / 1000 + p.ph))})`;
            circle(p.x, p.y, p.r);
            break;
          }
          case 'sparkle': {
            if (p.y < -10) Object.assign(p, spawn('sparkle', w, h), { y: h * 0.8 });
            const k = 0.5 + 0.5 * Math.sin(time / 480 + p.ph);
            ctx.fillStyle = `rgba(255,246,205,${a * (0.25 + 0.6 * k)})`;
            const r = p.r * (0.5 + 0.6 * k);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y - r);
            ctx.quadraticCurveTo(p.x, p.y, p.x + r, p.y);
            ctx.quadraticCurveTo(p.x, p.y, p.x, p.y + r);
            ctx.quadraticCurveTo(p.x, p.y, p.x - r, p.y);
            ctx.quadraticCurveTo(p.x, p.y, p.x, p.y - r);
            ctx.fill();
            break;
          }
          case 'confetti': {
            p.x += Math.sin(time / 600 + p.ph) * 0.6;
            if (p.y > h + 12) Object.assign(p, spawn('confetti', w, h), { y: -12 });
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.scale(1, Math.cos(p.rot * 2));
            ctx.globalAlpha = a * 0.9;
            ctx.fillStyle = p.c;
            ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
            ctx.restore();
            ctx.globalAlpha = 1;
            break;
          }
          case 'steam': {
            p.x += Math.sin(time / 900 + p.ph) * 0.35;
            const life = Math.max(0, Math.min(1, (p.y - h * 0.4) / (h * 0.6)));
            if (life <= 0) Object.assign(p, spawn('steam', w, h), { y: h + 30 });
            const r = p.r * (1.9 - life);
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
            g.addColorStop(0, `rgba(255,255,255,${a * 0.2 * life})`);
            g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g;
            circle(p.x, p.y, r);
            break;
          }
          case 'streaks': {
            if (p.x + p.r < 0) Object.assign(p, spawn('streaks', w, h), { x: w + rnd(0, 120) });
            const g = ctx.createLinearGradient(p.x, 0, p.x + p.r, 0);
            g.addColorStop(0, `rgba(255,255,255,${a * 0.5})`);
            g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g;
            ctx.fillRect(p.x, p.y, p.r, 1.6);
            break;
          }
          case 'rain': {
            if (p.y > h + 20) Object.assign(p, spawn('rain', w, h), { y: -20 });
            ctx.strokeStyle = `rgba(225,238,255,${a * 0.5})`;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.r * 0.16, p.y + p.r);
            ctx.stroke();
            break;
          }
          case 'snow': {
            p.x += Math.sin(time / 800 + p.ph) * 0.5;
            if (p.y > h + 8) Object.assign(p, spawn('snow', w, h), { y: -8 });
            ctx.fillStyle = `rgba(255,255,255,${a * 0.9})`;
            circle(p.x, p.y, p.r);
            break;
          }
          case 'leaves': {
            p.x += Math.sin(time / 700 + p.ph) * 0.9;
            if (p.y > h + 12) Object.assign(p, spawn('leaves', w, h), { y: -12 });
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.globalAlpha = a * 0.85;
            ctx.fillStyle = p.c;
            ctx.beginPath();
            ctx.ellipse(0, 0, p.r, p.r * 0.45, 0, 0, 6.2832);
            ctx.fill();
            ctx.restore();
            ctx.globalAlpha = 1;
            break;
          }
          case 'notes':
          case 'hearts': {
            p.x += Math.sin(time / 900 + p.ph) * 0.4;
            if (p.y < -30) Object.assign(p, spawn(layer.kind, w, h), { y: h + 40 });
            const fade = Math.max(0, Math.min(1, p.y / (h * 0.5)));
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot + Math.sin(time / 1100 + p.ph) * 0.15);
            ctx.font = `${p.r}px Georgia, serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle =
              layer.kind === 'hearts'
                ? dark
                  ? `rgba(255,150,190,${a * 0.7 * fade})`
                  : `rgba(194,71,122,${a * 0.55 * fade})`
                : dark
                  ? `rgba(255,255,255,${a * 0.55 * fade})`
                  : `rgba(31,33,36,${a * 0.34 * fade})`;
            ctx.fillText(layer.kind === 'hearts' ? '♥' : (p.g ?? '♪'), 0, 0);
            ctx.restore();
            break;
          }
          case 'fireflies': {
            p.x += Math.cos(time / 1900 + p.ph) * 0.3;
            p.y += Math.sin(time / 1500 + p.ph * 2) * 0.22;
            const k = 0.35 + 0.65 * Math.max(0, Math.sin(time / 700 + p.ph));
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
            g.addColorStop(0, `rgba(255,240,150,${a * 0.85 * k})`);
            g.addColorStop(1, 'rgba(255,240,150,0)');
            ctx.fillStyle = g;
            circle(p.x, p.y, p.r * 5);
            break;
          }
          default:
            break;
        }
      }
      if (layer.kind === 'waves') {
        // El mar, abajo: tres olas a distinto paso.
        const bands = [
          [0.905, 9, 62, 2300, `rgba(64,150,172,${a * 0.3})`],
          [0.93, 7, 48, 1700, `rgba(44,122,152,${a * 0.34})`],
          [0.955, 5, 36, 1300, `rgba(255,255,255,${a * 0.2})`],
        ] as const;
        bands.forEach(([base, amp, len, speed, color], i) => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(0, h);
          for (let x = 0; x <= w + 12; x += 12)
            ctx.lineTo(x, h * base + Math.sin(x / len + time / speed + i * 1.7) * amp);
          ctx.lineTo(w, h);
          ctx.closePath();
          ctx.fill();
        });
      }
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(64, now - last);
      last = now;
      const T = want.current;
      if (T.paused && time > 0) return;
      time += dt;
      const k = reduce ? 1 : 1 - Math.exp(-dt / 650);

      // El cielo va hacia el de la escena.
      const goal = skyColors(T.sky);
      for (let i = 0; i < 3; i++) {
        top[i] += (goal.top[i] - top[i]) * k;
        bottom[i] += (goal.bottom[i] - bottom[i]) * k;
      }
      // La hora, por el camino más corto del reloj (el sol «viaja» al cambiar de escena).
      let dh = T.sky.hour - hour;
      if (dh > 12) dh -= 24;
      if (dh < -12) dh += 24;
      hour = (((hour + dh * (reduce ? 1 : 1 - Math.exp(-dt / 900))) % 24) + 24) % 24;
      cover += (T.sky.cover - cover) * k;
      fog += ((T.sky.fog ? 1 : 0) - fog) * k;
      const night = nightness(hour);
      const lum = 0.3 * bottom[0] + 0.59 * bottom[1] + 0.11 * bottom[2];
      const dark = lum * 0.6 + (0.3 * top[0] + 0.59 * top[1] + 0.11 * top[2]) * 0.4 < 120;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, `rgb(${top[0] | 0},${top[1] | 0},${top[2] | 0})`);
      g.addColorStop(1, `rgb(${bottom[0] | 0},${bottom[1] | 0},${bottom[2] | 0})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // Estrellas.
      if (night > 0.02) {
        for (const s of stars) {
          ctx.fillStyle = `rgba(255,255,255,${night * (1 - cover * 0.85) * (0.45 + 0.45 * Math.sin(time / 900 + s.ph))})`;
          circle(s.x * w, s.y * h, s.r);
        }
      }
      // El sol (de 5:30 a 20:30) o la luna, en su sitio del arco.
      const clear = 1 - cover * 0.85;
      if (hour > 5.5 && hour < 20.5) {
        const p = (hour - 5.5) / 15;
        const x = w * (0.1 + 0.8 * p);
        const y = h * (0.36 - Math.sin(p * Math.PI) * 0.25);
        const low = 1 - Math.sin(p * Math.PI); // cerca del horizonte, más naranja
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 120);
        glow.addColorStop(
          0,
          `rgba(255,${(238 - low * 60) | 0},${(190 - low * 90) | 0},${0.55 * clear})`,
        );
        glow.addColorStop(1, 'rgba(255,220,160,0)');
        ctx.fillStyle = glow;
        circle(x, y, 120);
        ctx.fillStyle = `rgba(255,${(247 - low * 40) | 0},${(214 - low * 80) | 0},${0.95 * clear})`;
        circle(x, y, 20);
      } else {
        const p = ((hour + 3.5) % 24) / 9;
        const x = w * (0.12 + 0.76 * p);
        const y = h * (0.3 - Math.sin(p * Math.PI) * 0.18);
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 70);
        glow.addColorStop(0, `rgba(244,241,232,${0.35 * clear})`);
        glow.addColorStop(1, 'rgba(244,241,232,0)');
        ctx.fillStyle = glow;
        circle(x, y, 70);
        ctx.fillStyle = `rgba(244,241,232,${0.95 * clear})`;
        circle(x, y, 15);
        ctx.fillStyle = `rgba(${top[0] | 0},${top[1] | 0},${top[2] | 0},${0.55 * clear})`;
        circle(x + 6, y - 4, 13);
      }
      // Nubes: pocas y finas si está despejado; grandes y densas si está cubierto.
      // Cada una es un dibujo suave (bordes difuminados), hecho una vez y reutilizado.
      clouds.forEach((c, i) => {
        if (!T.paused && !reduce) c.x += (c.v * dt) / 1000;
        if (c.x > 1.35) c.x = -0.35;
        const shown = i < 2 ? 1 : Math.min(1, cover * 1.6);
        const alpha = (0.32 + cover * 0.5) * shown * (night > 0.5 ? 0.45 : 1);
        if (alpha < 0.01) return;
        const sprite = cloudSprite(i, c.puffs);
        const scale = c.s * (1 + cover * 0.8) * Math.min(1.4, w / 390);
        const sw = sprite.width * scale * 0.5;
        const sh = sprite.height * scale * 0.5;
        ctx.globalAlpha = alpha;
        ctx.drawImage(sprite, c.x * w - sw / 2, c.y * h - sh / 2, sw, sh);
        if (cover > 0.6 && night < 0.5) {
          // Cubierto: la panza de la nube, gris.
          ctx.globalAlpha = alpha * (cover - 0.6) * 1.2;
          ctx.filter = 'brightness(0.72)';
          ctx.drawImage(sprite, c.x * w - sw / 2, c.y * h - sh / 2 + sh * 0.12, sw, sh * 0.9);
          ctx.filter = 'none';
        }
        ctx.globalAlpha = 1;
      });
      if (fog > 0.02) {
        const f = ctx.createLinearGradient(0, h * 0.25, 0, h);
        f.addColorStop(0, 'rgba(255,255,255,0)');
        f.addColorStop(1, `rgba(255,255,255,${0.42 * fog})`);
        ctx.fillStyle = f;
        ctx.fillRect(0, 0, w, h);
      }

      // El viaje desde la escena anterior: un avión de papel cruza el cielo.
      if (T.travel && T.travel.key !== seen) {
        seen = T.travel.key;
        flight = { key: seen, t: 0 };
      }
      if (flight) {
        flight.t += dt;
        const total = 2600;
        if (flight.t > total) flight = null;
        else {
          const u = Math.min(1, flight.t / 1900);
          const e = 1 - Math.pow(1 - u, 3);
          const fade =
            flight.t > total - 500 ? (total - flight.t) / 500 : Math.min(1, flight.t / 200);
          const ax = w * 0.1;
          const ay = h * 0.47;
          const bx = w * 0.9;
          const by = h * 0.4;
          const cx = w * 0.5;
          const cy = h * 0.2;
          const at = (q: number) => ({
            x: (1 - q) * (1 - q) * ax + 2 * (1 - q) * q * cx + q * q * bx,
            y: (1 - q) * (1 - q) * ay + 2 * (1 - q) * q * cy + q * q * by,
          });
          const ink = dark ? '255,255,255' : '31,33,36';
          ctx.strokeStyle = `rgba(${ink},${0.5 * fade})`;
          ctx.lineWidth = 2;
          ctx.setLineDash([2, 9]);
          ctx.lineCap = 'round';
          ctx.beginPath();
          for (let q = 0; q <= e + 0.001; q += 0.02) {
            const pt = at(Math.min(q, e));
            if (q === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          }
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = `rgba(${ink},${0.6 * fade})`;
          circle(ax, ay, 4);
          if (u >= 1) circle(bx, by, 4);
          // El avión, en la punta, mirando hacia donde va.
          const tip = at(e);
          const next = at(Math.min(1, e + 0.02));
          const before = at(Math.max(0, e - 0.02));
          ctx.save();
          ctx.translate(tip.x, tip.y);
          ctx.rotate(Math.atan2(next.y - before.y, next.x - before.x));
          ctx.fillStyle = dark ? `rgba(255,255,255,${fade})` : `rgba(255,255,255,${fade})`;
          ctx.strokeStyle = `rgba(${ink},${0.75 * fade})`;
          ctx.lineWidth = 1.5;
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(15, 0);
          ctx.lineTo(-11, -9);
          ctx.lineTo(-5, 0);
          ctx.lineTo(-11, 9);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }

      // Lo que cae y lo que flota: el ambiente de la escena y el tiempo que hacía.
      const kinds = new Set<Kind>([KIND[T.mood]]);
      if (T.sky.precip === 'rain') kinds.add('rain');
      if (T.sky.precip === 'snow') kinds.add('snow');
      for (const layer of layers) layer.on = kinds.has(layer.kind);
      for (const kind of kinds)
        if (!layers.some((l) => l.kind === kind))
          layers.push({
            kind,
            alpha: reduce ? 1 : 0,
            on: true,
            ps:
              kind === 'waves' ? [] : Array.from({ length: COUNT[kind] }, () => spawn(kind, w, h)),
          });
      for (const layer of layers) {
        layer.alpha = Math.max(0, Math.min(1, layer.alpha + ((layer.on ? 1 : -1) * dt) / 700));
        if (layer.alpha > 0.01) drawLayer(layer, reduce ? 0 : dt, dark);
      }
      layers = layers.filter((l) => l.on || l.alpha > 0.01);

      // Viñeta suave, como en el cine.
      const v = ctx.createRadialGradient(
        w / 2,
        h * 0.48,
        Math.min(w, h) * 0.45,
        w / 2,
        h * 0.48,
        Math.max(w, h) * 0.78,
      );
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, `rgba(0,0,0,${dark ? 0.3 : 0.12})`);
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        display: 'block',
      }}
    />
  );
}
