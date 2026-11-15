// Las 20 vistas de la ventanilla. Cada una se dibuja dentro del cristal, en
// una caja de 380 × 380, con tinta oscura sobre el cristal claro, y devuelve
// su función de movimiento (el paisaje que pasa, la lluvia, las luces…).

import { cloud, ellipse } from '@/lib/doodle-ink';

import type { Escenario } from './guion';
import { el, mover, opacidad, type Taller } from './tinta';

export type Tinta = { ink: string; accent: string; glass: string };
type Dibujo = (T: Taller, g: SVGGElement, c: Tinta) => (t: number) => void;

const W = 380;

/** Una franja que se repite y pasa de derecha a izquierda (el paisaje del tren). */
function franja(
  g: Element,
  periodo: number,
  velocidad: number,
  dibujar: (g: SVGGElement, dx: number) => void,
) {
  const f = el('g', {}, g);
  dibujar(f, 0);
  dibujar(f, periodo);
  if (periodo < W) dibujar(f, periodo * 2);
  return (t: number) => mover(f, { x: -((t * velocidad) % periodo) });
}

const colinas = (y: number, amp: number, n: number) => {
  let d = `M-10,${y}`;
  for (let i = 0; i < n; i++) {
    const x = -10 + ((W + 20) / n) * i;
    d += ` Q${x + (W + 20) / n / 2},${y - amp * (0.6 + ((i * 37) % 5) / 10)} ${x + (W + 20) / n},${y}`;
  }
  return d;
};

const pino = (x: number, y: number, h: number) =>
  `M${x},${y} L${x},${y - h * 0.2} M${x - h * 0.3},${y - h * 0.2} L${x},${y - h} L${x + h * 0.3},${y - h * 0.2} Z`;

const arbol = (x: number, y: number, h: number) =>
  `M${x},${y} L${x},${y - h * 0.5} M${x - h * 0.32},${y - h * 0.62} C${x - h * 0.4},${y - h * 1.1} ${x + h * 0.4},${y - h * 1.1} ${x + h * 0.32},${y - h * 0.62} C${x + h * 0.2},${y - h * 0.42} ${x - h * 0.2},${y - h * 0.42} ${x - h * 0.32},${y - h * 0.62} Z`;

const sol = (T: Taller, g: Element, c: Tinta, x: number, y: number, r: number) => {
  T.tinta(g, ellipse(x, y, r), { color: c.ink, width: 2.4, fill: c.glass });
  const anillo = el('g', {}, g);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    el(
      'circle',
      { cx: x + Math.cos(a) * (r + 11), cy: y + Math.sin(a) * (r + 11), r: 2, fill: c.ink },
      anillo,
    );
  }
  return (t: number) => mover(anillo, { ox: x, oy: y, r: t * 8 });
};

const ESC: Record<Escenario, Dibujo> = {
  campo(T, g, c) {
    const s = sol(T, g, c, 290, 90, 26);
    const lejos = franja(g, 400, 12, (f, dx) => {
      T.tinta(f, colinas(250, 60, 4), { color: c.ink, width: 1.6, amp: 1 }).setAttribute(
        'transform',
        `translate(${dx},0)`,
      );
    });
    const medio = franja(g, 380, 45, (f, dx) => {
      const gg = el('g', { transform: `translate(${dx},0)` }, f);
      T.tinta(gg, arbol(80, 300, 70) + arbol(260, 300, 50), { color: c.ink, width: 2, amp: 0.8 });
      T.tinta(gg, `M-10,300 L${W + 10},301`, { color: c.ink, width: 1.8 });
    });
    const cerca = franja(g, 95, 260, (f, dx) => {
      const gg = el('g', { transform: `translate(${dx},0)` }, f);
      T.tinta(gg, 'M20,380 L22,318 M0,334 L95,330 M0,352 L95,349', {
        color: c.ink,
        width: 3,
        amp: 0.4,
      });
    });
    return (t) => (s(t), lejos(t), medio(t), cerca(t));
  },
  nubes(T, g, c) {
    const s = sol(T, g, c, 300, 80, 24);
    const mar = franja(g, 120, 18, (f, dx) => {
      let d = `M${dx - 10},250`;
      for (let x = dx - 10; x < dx + 130; x += 22) d += ` A12,12 0 0 1 ${x + 22},250`;
      T.tinta(f, d, { color: c.ink, width: 1.8, amp: 0.5 });
    });
    const pasan = franja(g, 420, 60, (f, dx) => {
      T.tinta(f, cloud(dx + 40, 170, 110), { color: c.ink, width: 2, fill: c.glass });
      T.tinta(f, cloud(dx + 250, 210, 80), { color: c.ink, width: 1.8, fill: c.glass });
    });
    // el ala del avión
    T.tinta(g, 'M380,330 L120,372 L110,392 L380,392 Z', {
      color: c.ink,
      width: 2.2,
      fill: c.glass,
    });
    T.tinta(g, 'M150,368 L380,340', { color: c.ink, width: 1.2, opacity: 0.6 });
    el('circle', { cx: 128, cy: 372, r: 5, fill: c.accent }, g);
    return (t) => (s(t), mar(t), pasan(t));
  },
  lluvia(T, g, c) {
    T.tinta(g, colinas(270, 40, 5), { color: c.ink, width: 1.4, opacity: 0.6 });
    T.tinta(g, cloud(30, 110, 160) + cloud(200, 140, 150), {
      color: c.ink,
      width: 2,
      fill: c.glass,
    });
    const gotas = el('g', {}, g);
    const lineas = Array.from({ length: 14 }, (_, i) =>
      el(
        'path',
        {
          d: `M${10 + i * 28},${150 + (i % 3) * 20} l-26,${180}`,
          stroke: c.accent,
          'stroke-width': 2,
          'stroke-dasharray': '8 14',
          'stroke-linecap': 'round',
          fill: 'none',
        },
        gotas,
      ),
    );
    // gotas en el cristal que resbalan
    const resbalan = Array.from({ length: 6 }, (_, i) =>
      el(
        'circle',
        { cx: 40 + i * 60, cy: 0, r: 4, fill: 'none', stroke: c.ink, 'stroke-width': 1.6 },
        g,
      ),
    );
    return (t) => {
      lineas.forEach((l, i) => l.setAttribute('stroke-dashoffset', String(-t * 120 - i * 7)));
      resbalan.forEach((r, i) =>
        r.setAttribute('cy', String(((t * (18 + i * 5) + i * 60) % 420) - 20)),
      );
    };
  },
  nieve(T, g, c) {
    T.tinta(g, colinas(260, 70, 3), { color: c.ink, width: 2 });
    const pinos = franja(g, 380, 50, (f, dx) => {
      const gg = el('g', { transform: `translate(${dx},0)` }, f);
      T.tinta(gg, pino(60, 380, 110) + pino(150, 380, 70) + pino(300, 380, 130), {
        color: c.ink,
        width: 2.2,
        fill: c.glass,
      });
    });
    const copos = Array.from({ length: 22 }, (_, i) =>
      el('circle', { r: 2.6 + (i % 3), fill: c.glass, stroke: c.ink, 'stroke-width': 1.2 }, g),
    );
    return (t) => {
      pinos(t);
      copos.forEach((p, i) => {
        p.setAttribute(
          'cx',
          String((((i * 53 + Math.sin(t + i) * 12 - t * 30) % 400) + 400) % 400),
        );
        p.setAttribute('cy', String((t * (24 + (i % 5) * 6) + i * 37) % 400));
      });
    };
  },
  playa(T, g, c) {
    const s = sol(T, g, c, 270, 100, 30);
    T.tinta(g, 'M-10,230 L390,231', { color: c.ink, width: 2 });
    const olas = [250, 280, 312].map((y, i) =>
      franja(g, 40, 14 + i * 10, (f, dx) => {
        let d = `M${dx - 10},${y}`;
        for (let x = dx - 10; x < dx + 400; x += 40)
          d += ` C${x + 10},${y - 9} ${x + 30},${y - 9} ${x + 40},${y}`;
        T.tinta(f, d, { color: c.ink, width: 1.8, amp: 0.4 });
      }),
    );
    T.tinta(g, 'M-10,345 C120,330 260,340 390,330 L390,390 L-10,390 Z', {
      color: c.ink,
      width: 2,
      fill: c.glass,
    });
    const palmera = franja(g, 380, 70, (f, dx) => {
      const gg = el('g', { transform: `translate(${dx},0)` }, f);
      T.tinta(
        gg,
        'M90,390 C96,330 104,280 120,250 M120,250 C90,240 70,250 56,268 M120,250 C140,232 168,236 186,252 M120,250 C112,226 94,214 76,214 M120,250 C134,224 154,214 174,216',
        { color: c.ink, width: 2.6 },
      );
      T.tinta(gg, 'M260,350 L300,300 M250,300 C270,280 320,280 340,300 Z', {
        color: c.ink,
        width: 2,
        fill: c.accent,
      });
    });
    return (t) => (s(t), olas.forEach((o) => o(t)), palmera(t));
  },
  montana(T, g, c) {
    T.tinta(g, 'M-10,280 L80,150 L140,220 L220,90 L310,210 L390,160 L390,280 Z', {
      color: c.ink,
      width: 2.2,
      fill: c.glass,
    });
    T.tinta(g, 'M200,118 L220,90 L240,118 L228,112 L220,124 L210,112 Z M64,174 L80,150 L94,170', {
      color: c.ink,
      width: 1.6,
    });
    const pinos = franja(g, 380, 70, (f, dx) => {
      const gg = el('g', { transform: `translate(${dx},0)` }, f);
      T.tinta(
        gg,
        pino(40, 390, 90) + pino(110, 390, 130) + pino(250, 390, 100) + pino(330, 390, 70),
        { color: c.ink, width: 2.2, fill: c.glass },
      );
    });
    const pajaro = el('g', {}, g);
    T.tinta(pajaro, 'M0,0 q6,-6 12,0 q6,-6 12,0', { color: c.ink, width: 1.8 });
    return (t) => (
      pinos(t),
      mover(pajaro, { x: 60 + ((t * 25) % 300), y: 80 + Math.sin(t * 2) * 8 })
    );
  },
  ciudad_noche(T, g, c) {
    el('rect', { x: 0, y: 0, width: W, height: W, fill: c.ink }, g);
    T.tinta(g, ellipse(300, 70, 22), { color: c.glass, width: 2, fill: c.glass });
    el('circle', { cx: 290, cy: 64, r: 20, fill: c.ink }, g);
    const luces: SVGRectElement[] = [];
    const edificios = franja(g, 400, 30, (f, dx) => {
      const gg = el('g', { transform: `translate(${dx},0)` }, f);
      [
        [10, 180, 70],
        [90, 120, 60],
        [160, 220, 80],
        [250, 150, 60],
        [320, 200, 70],
      ].forEach(([x, y, w]) => {
        T.tinta(gg, `M${x},400 L${x},${y} L${x + w},${y} L${x + w},400`, {
          color: c.glass,
          width: 2,
        });
        for (let yy = y + 16; yy < 380; yy += 30)
          for (let xx = x + 10; xx < x + w - 12; xx += 20)
            luces.push(el('rect', { x: xx, y: yy, width: 9, height: 12, fill: c.accent }, gg));
      });
    });
    return (t) => {
      edificios(t);
      luces.forEach((l, i) =>
        opacidad(l, (i * 7919 + Math.floor(t * 1.5) * 31) % 10 > 3 ? 1 : 0.12),
      );
    };
  },
  ciudad(T, g, c) {
    const s = sol(T, g, c, 70, 70, 20);
    const edificios = franja(g, 400, 40, (f, dx) => {
      const gg = el('g', { transform: `translate(${dx},0)` }, f);
      [
        [0, 200, 60],
        [70, 140, 70],
        [150, 230, 60],
        [220, 110, 80],
        [310, 190, 70],
      ].forEach(([x, y, w]) => {
        T.tinta(gg, `M${x},400 L${x},${y} L${x + w},${y} L${x + w},400`, {
          color: c.ink,
          width: 2,
        });
        let d = '';
        for (let yy = y + 18; yy < 380; yy += 28) d += `M${x + 10},${yy} L${x + w - 10},${yy} `;
        T.tinta(gg, d, { color: c.ink, width: 1, opacity: 0.5 });
      });
    });
    const farola = franja(g, 190, 220, (f, dx) => {
      T.tinta(f, `M${dx + 40},400 L${dx + 40},300 C${dx + 40},286 ${dx + 54},282 ${dx + 66},290`, {
        color: c.ink,
        width: 3,
      });
      el('circle', { cx: dx + 68, cy: 296, r: 6, fill: c.accent }, f);
    });
    return (t) => (s(t), edificios(t), farola(t));
  },
  fiesta(T, g, c) {
    T.tinta(g, 'M-10,40 C120,110 260,110 390,40', { color: c.ink, width: 2 });
    for (let i = 0; i < 8; i++) {
      const x = 14 + i * 48,
        y = 40 + Math.sin(((i + 0.5) / 8) * Math.PI) * 52;
      T.tinta(g, `M${x - 14},${y} L${x + 14},${y} L${x},${y + 30} Z`, {
        color: c.ink,
        width: 1.6,
        fill: i % 2 ? c.accent : c.glass,
      });
    }
    const globos = [60, 150, 250, 320].map((x, i) => {
      const b = el('g', {}, g);
      T.tinta(b, ellipse(x, 300, 28, 34), {
        color: c.ink,
        width: 2.2,
        fill: i % 2 ? c.accent : c.glass,
      });
      T.tinta(b, `M${x},334 C${x - 8},360 ${x + 8},380 ${x},410`, { color: c.ink, width: 1.4 });
      return b;
    });
    const confeti = Array.from({ length: 18 }, (_, i) =>
      el('rect', { width: 6, height: 10, fill: i % 2 ? c.accent : c.ink }, g),
    );
    return (t) => {
      globos.forEach((b, i) =>
        mover(b, { y: -((t * (22 + i * 6) + i * 70) % 420) + 60, x: Math.sin(t + i) * 6 }),
      );
      confeti.forEach((p, i) =>
        p.setAttribute(
          'transform',
          `translate(${(i * 61) % 380},${(t * 40 + i * 47) % 400}) rotate(${t * 120 + i * 40})`,
        ),
      );
    };
  },
  cena(T, g, c) {
    T.tinta(g, 'M-10,290 L390,291', { color: c.ink, width: 2.4 });
    T.tinta(g, 'M110,290 L118,180 L136,180 L144,290', { color: c.ink, width: 2.2, fill: c.glass });
    const llama = el('g', {}, g);
    T.tinta(llama, 'M127,176 C112,160 122,138 127,128 C132,138 142,160 127,176 Z', {
      color: c.ink,
      width: 1.6,
      fill: c.accent,
    });
    const copa = (x: number) =>
      T.tinta(
        g,
        `M${x - 26},170 C${x - 26},220 ${x + 26},220 ${x + 26},170 Z M${x},212 L${x},270 M${x - 22},272 L${x + 22},272`,
        { color: c.ink, width: 2.2, fill: c.glass },
      );
    const izq = el('g', {}, g),
      der = el('g', {}, g);
    copa(230);
    izq.appendChild(g.lastChild!);
    copa(300);
    der.appendChild(g.lastChild!);
    T.tinta(g, ellipse(80, 300, 60, 10) + ellipse(300, 300, 60, 10), { color: c.ink, width: 1.8 });
    const chispa = T.tinta(g, 'M265,140 L265,120 M252,146 L238,134 M278,146 L292,134', {
      color: c.accent,
      width: 2.4,
    });
    return (t) => {
      mover(llama, { ox: 127, oy: 176, sx: 1 + Math.sin(t * 9) * 0.08, r: Math.sin(t * 5) * 4 });
      const brinda = Math.max(0, Math.sin(t * 1.2)) ** 6;
      mover(izq, { ox: 230, oy: 270, r: 10 * brinda });
      mover(der, { ox: 300, oy: 270, r: -10 * brinda });
      opacidad(chispa, brinda > 0.8 ? 1 : 0);
    };
  },
  cafe(T, g, c) {
    const s = sol(T, g, c, 280, 230, 40);
    T.tinta(g, 'M-10,250 L390,251', { color: c.ink, width: 2 });
    el('rect', { x: 0, y: 252, width: W, height: 140, fill: c.glass }, g);
    T.tinta(g, 'M-10,300 L390,301', { color: c.ink, width: 2.4 });
    T.tinta(g, ellipse(130, 300, 70, 12), { color: c.ink, width: 2, fill: c.glass });
    T.tinta(g, 'M80,214 L180,214 L172,290 C170,302 90,302 88,290 Z', {
      color: c.ink,
      width: 2.4,
      fill: c.glass,
    });
    T.tinta(g, ellipse(130, 216, 46, 7), { color: c.ink, width: 1.6, fill: c.ink });
    T.tinta(g, 'M180,228 C210,228 210,268 174,268', { color: c.ink, width: 2.4 });
    const vapor = [104, 130, 156].map((x) => {
      const v = el('g', {}, g);
      T.tinta(v, `M${x},200 c-9,-12 9,-20 0,-32 c-9,-12 9,-20 0,-32`, { color: c.ink, width: 2 });
      return v;
    });
    return (t) => {
      s(t);
      vapor.forEach((v, i) => {
        const p = (t * 0.6 + i * 0.33) % 1;
        mover(v, { y: -p * 30 });
        opacidad(v, Math.sin(Math.PI * p));
      });
    };
  },
  musica(T, g, c) {
    let d = '';
    for (let i = 0; i < 5; i++) d += `M-10,${150 + i * 22} L390,${150 + i * 22} `;
    T.tinta(g, d, { color: c.ink, width: 1.2, opacity: 0.5 });
    const notas = Array.from({ length: 6 }, (_, i) => {
      const n = el('g', {}, g);
      T.tinta(n, ellipse(0, 0, 11, 8), {
        color: c.ink,
        width: 2,
        fill: i % 3 === 0 ? c.accent : c.ink,
      });
      T.tinta(n, 'M10,0 L10,-56 C22,-50 30,-42 26,-28', { color: c.ink, width: 2.4 });
      return n;
    });
    return (t) =>
      notas.forEach((n, i) => {
        const x = 400 - ((t * 50 + i * 70) % 440);
        mover(n, { x, y: 240 - (i % 3) * 22 + Math.sin(t * 3 + i) * 14 });
      });
  },
  deporte(T, g, c) {
    T.tinta(g, 'M-10,300 L390,301 M190,300 L190,390', { color: c.ink, width: 2 });
    T.tinta(g, ellipse(190, 345, 50, 14), { color: c.ink, width: 1.6 });
    const porteria = franja(g, 400, 60, (f, dx) =>
      T.tinta(f, `M${dx + 300},300 L${dx + 300},200 L${dx + 380},200 L${dx + 380},300`, {
        color: c.ink,
        width: 2.6,
      }),
    );
    const balon = el('g', {}, g);
    T.tinta(balon, ellipse(0, 0, 22), { color: c.ink, width: 2.4, fill: c.glass });
    T.tinta(balon, 'M-8,-6 L0,-12 L8,-6 L5,4 L-5,4 Z', { color: c.ink, width: 1.4, fill: c.ink });
    return (t) => {
      porteria(t);
      const k = (t * 1.3) % 1;
      mover(balon, { x: 120 + Math.sin(t * 0.7) * 60, y: 278 - 160 * 4 * k * (1 - k), r: t * 200 });
    };
  },
  otono(T, g, c) {
    const arboles = franja(g, 380, 30, (f, dx) => {
      const gg = el('g', { transform: `translate(${dx},0)` }, f);
      T.tinta(gg, arbol(100, 360, 220) + arbol(290, 360, 160), { color: c.ink, width: 2.4 });
    });
    T.tinta(g, 'M-10,360 L390,361', { color: c.ink, width: 2 });
    const hojas = Array.from({ length: 12 }, (_, i) => {
      const h = el('g', {}, g);
      T.tinta(h, 'M0,-8 C8,-4 8,4 0,8 C-8,4 -8,-4 0,-8 Z M0,-8 L0,8', {
        color: c.ink,
        width: 1.2,
        fill: i % 2 ? c.accent : c.glass,
      });
      return h;
    });
    return (t) => {
      arboles(t);
      hojas.forEach((h, i) =>
        mover(h, {
          x: ((((i * 71 - t * 20) % 400) + 400) % 400) + Math.sin(t * 2 + i) * 14,
          y: (t * (26 + (i % 4) * 8) + i * 33) % 380,
          r: t * 90 + i * 30,
        }),
      );
    };
  },
  primavera(T, g, c) {
    T.tinta(g, 'M-10,330 L390,331', { color: c.ink, width: 2 });
    const flores = [50, 120, 200, 280, 340].map((x, i) => {
      const f = el('g', {}, g);
      const h = 80 + (i % 3) * 30;
      T.tinta(f, `M${x},330 C${x - 6},${330 - h / 2} ${x + 6},${330 - h / 2} ${x},${330 - h}`, {
        color: c.ink,
        width: 2.2,
      });
      const corola = el('g', {}, f);
      for (let p = 0; p < 6; p++) {
        const a = (p / 6) * Math.PI * 2;
        T.tinta(corola, ellipse(x + Math.cos(a) * 12, 330 - h + Math.sin(a) * 12, 9, 9), {
          color: c.ink,
          width: 1.6,
          fill: i % 2 ? c.accent : c.glass,
        });
      }
      el('circle', { cx: x, cy: 330 - h, r: 6, fill: c.ink }, corola);
      return { corola, x, y: 330 - h };
    });
    const mariposa = el('g', {}, g);
    const ala = T.tinta(mariposa, 'M0,0 C-20,-24 -30,4 0,0 C30,4 20,-24 0,0 Z', {
      color: c.ink,
      width: 1.8,
      fill: c.accent,
    });
    return (t) => {
      flores.forEach((f, i) =>
        mover(f.corola, {
          ox: f.x,
          oy: f.y,
          s: 0.6 + 0.4 * Math.min(1, Math.max(0, (t % 8) / 2 - i * 0.2)),
        }),
      );
      mover(mariposa, { x: 190 + Math.sin(t * 0.8) * 120, y: 120 + Math.sin(t * 1.7) * 40 });
      mover(ala, { sy: 0.4 + 0.6 * Math.abs(Math.sin(t * 9)) });
    };
  },
  estrellas(T, g, c) {
    el('rect', { x: 0, y: 0, width: W, height: W, fill: c.ink }, g);
    T.tinta(
      g,
      'M110,60 C70,60 46,90 46,124 C46,158 74,184 110,184 C86,172 74,150 74,124 C74,96 88,72 110,60 Z',
      { color: c.glass, width: 2, fill: c.glass },
    );
    const estrellas = Array.from({ length: 16 }, (_, i) => {
      const x = ((i * 97) % 360) + 10,
        y = ((i * 61) % 300) + 20;
      return T.tinta(g, `M${x - 6},${y} L${x + 6},${y} M${x},${y - 6} L${x},${y + 6}`, {
        color: i % 4 ? c.glass : c.accent,
        width: 2,
      });
    });
    const fugaz = el('g', {}, g);
    T.tinta(fugaz, 'M0,0 L-70,-30', { color: c.accent, width: 2.4 });
    T.tinta(g, colinas(350, 30, 4), { color: c.glass, width: 2 });
    return (t) => {
      estrellas.forEach((e, i) => opacidad(e, 0.3 + 0.7 * Math.abs(Math.sin(t * 1.4 + i))));
      const k = (t % 5) / 1.2;
      opacidad(fugaz, k < 1 ? Math.sin(Math.PI * k) : 0);
      mover(fugaz, { x: 140 + k * 200, y: 60 + k * 80 });
    };
  },
  tormenta(T, g, c) {
    const fondo = el('rect', { x: 0, y: 0, width: W, height: W, fill: c.ink, opacity: 0 }, g);
    T.tinta(g, cloud(10, 130, 200) + cloud(170, 110, 200), {
      color: c.ink,
      width: 2.4,
      fill: c.glass,
    });
    const rayo = T.tinta(g, 'M200,140 L170,220 L200,220 L176,300', { color: c.accent, width: 4 });
    const lluvia = Array.from({ length: 12 }, (_, i) =>
      el(
        'path',
        {
          d: `M${20 + i * 30},150 l-30,240`,
          stroke: c.ink,
          'stroke-width': 1.8,
          'stroke-dasharray': '10 16',
          fill: 'none',
        },
        g,
      ),
    );
    return (t) => {
      const flash = t % 3.2 < 0.18;
      opacidad(rayo, flash ? 1 : 0);
      fondo.setAttribute('opacity', flash ? '0.12' : '0');
      lluvia.forEach((l, i) => l.setAttribute('stroke-dashoffset', String(-t * 160 - i * 9)));
    };
  },
  mar(T, g, c) {
    const s = sol(T, g, c, 280, 110, 24);
    const horizonte = el('g', {}, g);
    T.tinta(horizonte, 'M-30,220 L410,221', { color: c.ink, width: 2 });
    const faro = T.tinta(
      horizonte,
      'M70,220 L74,170 L84,170 L88,220 M72,170 L86,170 L84,160 L74,160 Z',
      { color: c.ink, width: 1.8 },
    );
    void faro;
    const olas = [250, 290, 330].map((y, i) =>
      franja(g, 60, 16 + i * 12, (f, dx) => {
        let d = `M${dx - 10},${y}`;
        for (let x = dx - 10; x < dx + 420; x += 60)
          d += ` C${x + 15},${y - 12} ${x + 45},${y - 12} ${x + 60},${y}`;
        T.tinta(f, d, { color: c.ink, width: 2, amp: 0.4 });
      }),
    );
    const gaviota = el('g', {}, g);
    T.tinta(gaviota, 'M0,0 q8,-8 16,0 q8,-8 16,0', { color: c.ink, width: 2 });
    return (t) => {
      s(t);
      mover(horizonte, { y: Math.sin(t * 1.1) * 8, r: Math.sin(t * 0.8) * 2, ox: 190, oy: 220 });
      olas.forEach((o) => o(t));
      mover(gaviota, { x: 380 - ((t * 30) % 420), y: 120 + Math.sin(t * 2) * 10 });
    };
  },
  anden(T, g, c) {
    T.tinta(g, 'M-10,300 L390,301 M-10,320 L390,321', { color: c.ink, width: 2 });
    T.tinta(g, 'M40,300 L40,120 L340,120 L340,300 M30,120 L350,120 L330,90 L50,90 Z', {
      color: c.ink,
      width: 1.6,
      opacity: 0.6,
    });
    T.tinta(g, 'M150,140 L230,140 L230,170 L150,170 Z', { color: c.ink, width: 1.6 });
    const reloj = el('g', {}, g);
    T.tinta(reloj, ellipse(190, 155, 11), { color: c.ink, width: 1.6, fill: c.glass });
    const persona = (dir: number) => {
      const p = el('g', {}, g);
      T.tinta(
        p,
        `${ellipse(0, -96, 13)} M0,-82 L0,-30 M0,-30 L-14,0 M0,-30 L14,0 M0,-70 L${dir * 26},-56`,
        { color: c.ink, width: 3 },
      );
      return p;
    };
    const a = persona(1),
      b = persona(-1);
    const corazon = el('g', {}, g);
    T.tinta(
      corazon,
      'M0,14 C-14,4 -22,-4 -22,-12 C-22,-20 -16,-24 -10,-24 C-5,-24 -1,-21 0,-16 C1,-21 5,-24 10,-24 C16,-24 22,-20 22,-12 C22,-4 14,4 0,14 Z',
      { color: c.ink, width: 2, fill: c.accent },
    );
    return (t) => {
      const k = Math.min(1, (t % 7) / 3);
      const e = 1 - (1 - k) ** 3;
      mover(a, { x: 40 + 130 * e, y: 300 + (k < 1 ? -Math.abs(Math.sin(t * 9)) * 4 : 0) });
      mover(b, { x: 340 - 130 * e, y: 300 + (k < 1 ? -Math.abs(Math.sin(t * 9 + 1)) * 4 : 0) });
      const h = Math.max(0, (t % 7) - 3);
      mover(corazon, { x: 190, y: 170 - h * 10, s: Math.min(1, h * 2) });
      opacidad(corazon, h > 0 ? 1 - Math.max(0, h - 2.5) : 0);
      mover(reloj, {});
    };
  },
  casa(T, g, c) {
    const s = sol(T, g, c, 280, 90, 26);
    T.tinta(g, colinas(240, 40, 4), { color: c.ink, width: 1.6, opacity: 0.6 });
    T.tinta(g, 'M-10,300 L390,301 L390,320 L-10,320 Z', {
      color: c.ink,
      width: 2.4,
      fill: c.glass,
    });
    T.tinta(g, 'M60,300 L54,250 L106,250 L100,300 Z', { color: c.ink, width: 2.2, fill: c.accent });
    const planta = el('g', {}, g);
    T.tinta(
      planta,
      'M80,250 C70,210 50,200 40,196 M80,250 C84,200 100,180 114,176 M80,250 C80,214 76,194 80,170',
      { color: c.ink, width: 2.2 },
    );
    const gato = el('g', {}, g);
    T.tinta(
      gato,
      'M200,300 C196,270 230,254 270,262 C300,268 312,284 310,300 Z M290,268 L296,250 L304,266 M304,266 L314,254 L314,274',
      { color: c.ink, width: 2.2, fill: c.glass },
    );
    const cola = el('g', {}, g);
    T.tinta(cola, 'M200,296 C176,296 170,280 180,270', { color: c.ink, width: 2.4 });
    const zzz = el('g', {}, g);
    const z = T.tinta(zzz, 'M0,0 L12,0 L0,12 L12,12', { color: c.ink, width: 1.8 });
    void z;
    return (t) => {
      s(t);
      mover(planta, { ox: 80, oy: 250, r: Math.sin(t * 0.9) * 3 });
      mover(gato, { ox: 255, oy: 300, sy: 1 + Math.sin(t * 2) * 0.03 });
      mover(cola, { ox: 200, oy: 296, r: Math.sin(t * 1.6) * 10 });
      const p = (t * 0.4) % 1;
      mover(zzz, { x: 310 + p * 20, y: 240 - p * 40, s: 0.6 + p * 0.6 });
      opacidad(zzz, Math.sin(Math.PI * p));
    };
  },
};

export function dibujarEscenario(id: Escenario, T: Taller, g: SVGGElement, c: Tinta) {
  return ESC[id](T, g, c);
}
