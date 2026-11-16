// La mesa de los momentos: cada momento llega lanzado a la mesa como una
// instantánea (con estela), aterriza, se pega con cinta, se escribe su frase,
// caen las pegatinas de las reacciones y se pegan las notas de los
// comentarios. La cámara viaja de uno a otro y los anteriores se quedan.
// La usa la película del resumen en lugar de la cámara instantánea.

import { ease, ellipse, lerp, roundRect, span } from '@/lib/doodle-ink';

import type { DatosPelicula, Pieza } from './guion';
import { el, lineas, mover, opacidad, revelar, type Taller, texto, uid, ver } from './tinta';

const W = 720,
  CX = 360;
/** Zona segura: arriba la isla del móvil; abajo, los subtítulos. */
const ARRIBA = 120,
  ABAJO = 1060;
const TINTA = '#1D1F22',
  GRIS = '#6B6A62';
const S = (t: number, a: number, d: number, c = ease.out) => span(t, a, d, c);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** El texto entero en un ancho: de mayor a menor tamaño; si no cabe, con «…». */
export function ajustar(text: string, ancho: number, tamaños: number[], maxLineas: number) {
  for (const size of tamaños) {
    const ls = lineas(text, Math.max(8, Math.floor(ancho / (size * 0.46))), 99);
    if (ls.length <= maxLineas) return { size, lines: ls };
  }
  const size = tamaños[tamaños.length - 1];
  return { size, lines: lineas(text, Math.max(8, Math.floor(ancho / (size * 0.46))), maxLineas) };
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/**
 * Monta la mesa dentro de «parent» y devuelve cómo pintarla en cada instante.
 * «piezas»: cuándo entra y sale cada momento; «fin»: cuándo se va la mesa.
 */
export type Mesa = {
  pintar: (t: number) => void;
  /** Dónde sale (en pantalla) la etiqueta del primer día, y a qué escala. */
  etiqueta: () => { x: number; y: number; z: number };
};

export function montarMesa(o: {
  T: Taller;
  defs: Element;
  parent: Element;
  d: DatosPelicula;
  A: string;
  piezas: { a: number; b: number }[];
  fin: number;
  semi: number;
  enSemi: (t: number) => number;
  /** Dónde está ahora (en pantalla) la casilla de cifras de cada foto: allí vuela. */
  destino?: (id: string) => { x: number; y: number; size: number } | null;
  /** Cuándo aterrizan las fotos en sus casillas. */
  aterriza?: number;
}): Mesa {
  const { T, defs, d, A, piezas, fin, semi, enSemi } = o;
  const paints: ((t: number) => void)[] = [];
  const mundo = el('g', {}, o.parent);
  const recorte = uid('rc');
  el(
    'rect',
    { width: 1, height: 1, rx: 0.06 },
    el('clipPath', { id: recorte, clipPathUnits: 'objectBoundingBox' }, defs),
  );

  /** Una instantánea: marco blanco, foto, sombra. Centrada en (0,0). */
  const instantanea = (parent: Element, href: string, w: number, conPie = 0.16) => {
    const g = el('g', {}, parent);
    const h = w * (1 + conPie);
    el(
      'rect',
      { x: -w / 2 + 6, y: -h / 2 + 10, width: w, height: h, rx: 6, fill: 'rgba(0,0,0,0.16)' },
      g,
    );
    el('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 6, fill: '#FFFFFF' }, g);
    const m = w * 0.06;
    el(
      'image',
      {
        href,
        x: -w / 2 + m,
        y: -h / 2 + m,
        width: w - 2 * m,
        height: w - 2 * m,
        preserveAspectRatio: 'xMidYMid slice',
        'clip-path': `url(#${recorte})`,
      },
      g,
    );
    T.tinta(g, roundRect(-w / 2, -h / 2, w, h, 6), { color: TINTA, width: 1.6, amp: 0.6 });
    return g;
  };

  // ═════════════════════════ 3. LOS DÍAS ═════════════════════════
  // Cada momento, en su sitio de la mesa (dos columnas que bajan, un poco
  // torcidas). Su tamaño se calcula para que todo quepa en la zona segura.
  type Carta = {
    p: Pieza;
    x: number;
    y: number;
    alto: number;
    g: SVGGElement;
    card: SVGGElement;
    foto?: SVGGElement;
    rot: number;
    blur: SVGFEGaussianBlurElement;
    fid: string;
    dia: Element[];
    circulo: Element;
    autor: Element;
    lineasTxt: { n: Element; clip: SVGRectElement; w: number }[];
    cinta: Element[];
    pegatinas: { g: SVGGElement; rayos: Element }[];
    notas: { g: SVGGElement; x: number; y: number; r: number }[];
    ondas: Element[];
    anims: ((u: number) => void)[];
  };
  const cartas: Carta[] = d.pieces.map((p, i) => {
    const pz0 = piezas[i]?.a ?? 0;
    const col = i % 2;
    const x = (col ? 1 : -1) * 330 + ((i * 53) % 40) - 20;
    const y = Math.floor(i / 2) * 1240 + col * 360;
    const g = el('g', {}, mundo);
    g.setAttribute('transform', `translate(${x},${y})`);
    // el día (con un círculo de rotulador alrededor del número)
    const dia1 = texto(g, (p.when.split(' ')[0] ?? '').toLowerCase(), {
      x: -40,
      y: 46,
      size: 46,
      color: TINTA,
      anchor: 'end',
    });
    const dia2 = texto(g, p.badge, { x: 20, y: 50, size: 58, color: A, anchor: 'start' });
    const circulo = T.tinta(g, ellipse(20 + p.badge.length * 15, 32, 52, 40), {
      color: A,
      width: 3,
    });
    const autor = texto(
      g,
      [p.author, p.when.split(' ').slice(1).join(' '), p.place].filter(Boolean).join(' · '),
      {
        x: 0,
        y: 112,
        size: 28,
        color: GRIS,
      },
    );
    const card = el('g', {}, g);
    const rot = ((i * 47) % 7) - 3;
    let y0 = 140;
    let foto: SVGGElement | undefined;
    const ondas: Element[] = [];
    const lineasTxt: Carta['lineasTxt'] = [];
    const WC = 540;
    const fid = uid('mb');
    const blur = el(
      'feGaussianBlur',
      { stdDeviation: '0 0' },
      el('filter', { id: fid, x: '-40%', y: '-40%', width: '180%', height: '180%' }, defs),
    );
    let altoTarjeta: number;
    // lo que se mueve en cada tipo (con el tiempo de la carta, «u»)
    const anims: ((u: number) => void)[] = [];
    const tipo = p.tipo ?? (p.photo ? 'foto' : p.wave?.length ? 'voz' : 'texto');
    const ex = p.extra ?? {};
    const IMG = { top: y0 + WC * 0.06, bottom: y0 + WC * 0.94, cy: y0 + WC / 2 };
    const sello = (parent: Element, cx: number, cy: number, txt: string, giro: number) => {
      const gS = el('g', {}, parent);
      const w = Math.max(150, txt.length * 17 + 40);
      T.tinta(gS, roundRect(cx - w / 2, cy - 30, w, 60, 10), { color: A, width: 3.4 });
      texto(gS, txt, { x: cx, y: cy + 12, size: 34, color: A, hand: false, weight: 700 });
      gS.setAttribute('data-c', `${cx},${cy},${giro}`);
      return gS;
    };
    const estampar = (gS: Element, u: number, t0: number) => {
      const [cx, cy, giro] = (gS.getAttribute('data-c') ?? '0,0,0').split(',').map(Number);
      const k = S(u, t0, 0.4, ease.back);
      mover(gS, { ox: cx, oy: cy, s: lerp(1.9, 1, k), r: giro });
      opacidad(gS, Math.min(1, k * 3) * 0.92);
    };
    if (
      p.photo &&
      ['foto', 'fotos', 'video', 'recuerdo', 'reto', 'karaoke', 'plan'].includes(tipo)
    ) {
      // la instantánea
      // con frase, el margen de abajo de la instantánea es más alto: ahí va
      // escrita, en un recuadro fijo del que nunca se sale
      const PIE = p.text ? 0.3 : 0.16;
      const hFoto = WC * (1 + PIE);
      foto = el('g', {}, card);
      foto.setAttribute('transform', `translate(0,${y0 + hFoto / 2})`);
      // ── varias fotos: dos más debajo, que se abren en abanico al posarse
      if (tipo === 'fotos')
        (ex.fotos ?? []).slice(0, 2).forEach((f, k) => {
          const atras = instantanea(foto!, f, WC * 0.9, 0.16);
          const lado = k ? 1 : -1;
          anims.push((u) => {
            const kk = S(u, 1.05 + k * 0.18, 0.7, ease.back);
            mover(atras, { x: lado * 105 * kk, y: -18 * kk, r: lado * 12 * kk });
          });
        });
      instantanea(foto, p.photo, WC, PIE);
      const L0 = -hFoto / 2; // (arriba de la instantánea, en su grupo)
      const m = WC * 0.06;
      // ── vídeo: perforaciones de película a los lados, un «play» que se dibuja
      //    y la barra de reproducción que avanza
      if (tipo === 'video') {
        for (const sx of [-1, 1]) {
          const bx = sx < 0 ? -WC / 2 + m : WC / 2 - m - 30;
          el(
            'rect',
            { x: bx, y: L0 + m, width: 30, height: WC - 2 * m, fill: 'rgba(20,20,22,0.82)' },
            foto,
          );
          for (let yy = L0 + m + 14; yy < L0 + WC - m - 20; yy += 34)
            el('rect', { x: bx + 8, y: yy, width: 14, height: 18, rx: 3, fill: '#F4F1EA' }, foto);
        }
        const play = el('g', {}, foto);
        el('circle', { cx: 0, cy: L0 + WC / 2, r: 62, fill: 'rgba(255,255,255,0.85)' }, play);
        const tri = T.tinta(
          play,
          `M-18,${L0 + WC / 2 - 30} L32,${L0 + WC / 2} L-18,${L0 + WC / 2 + 30} Z`,
          {
            color: TINTA,
            width: 3,
            fill: TINTA,
          },
        );
        const barra = el(
          'rect',
          { x: -WC / 2 + m + 40, y: L0 + WC - m - 26, width: 0, height: 8, rx: 4, fill: A },
          foto,
        );
        el(
          'rect',
          {
            x: -WC / 2 + m + 40,
            y: L0 + WC - m - 26,
            width: WC - 2 * m - 80,
            height: 8,
            rx: 4,
            fill: 'rgba(255,255,255,0.45)',
          },
          foto,
        ).after(barra);
        anims.push((u) => {
          revelar(tri, S(u, 1.1, 0.45));
          const ko = S(u, 2.0, 0.4);
          opacidad(play, (1 - ko) * S(u, 1.05, 0.3));
          mover(play, { ox: 0, oy: L0 + WC / 2, s: 1 + 0.3 * ko });
          barra.setAttribute('width', String((WC - 2 * m - 80) * S(u, 2.1, 2.2, ease.linear)));
        });
      }
      // ── recuerdo: la foto se revela (blanco → sepia → color), esquinas de
      //    álbum y un sello con «hace X años»
      if (tipo === 'recuerdo') {
        const sepia = el(
          'rect',
          { x: -WC / 2 + m, y: L0 + m, width: WC - 2 * m, height: WC - 2 * m, fill: '#B88A4E' },
          foto,
        );
        const blanco = el(
          'rect',
          { x: -WC / 2 + m, y: L0 + m, width: WC - 2 * m, height: WC - 2 * m, fill: '#FBF8F1' },
          foto,
        );
        const esquinas = el('g', {}, foto);
        for (const [sx, sy] of [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ]) {
          const cx = sx * (WC / 2 - m),
            cy = L0 + WC / 2 + sy * (WC / 2 - m);
          T.tinta(esquinas, `M${cx},${cy} l${-sx * 46},0 l${sx * 46},${-sy * 46} Z`, {
            color: TINTA,
            width: 1.6,
            fill: '#3B3530',
          });
        }
        const gS = sello(foto, WC / 2 - 130, L0 + m + 70, ex.edad ?? 'recuerdo', 8);
        anims.push((u) => {
          opacidad(blanco, 1 - S(u, 1.05, 0.7));
          opacidad(sepia, 0.85 * (1 - S(u, 1.7, 1.3, ease.inOut)));
          opacidad(esquinas, S(u, 1.0, 0.4));
          estampar(gS, u, 2.6);
        });
      }
      // ── respuesta a un reto: una banderola con el reto que se despliega y un ✓
      if (tipo === 'reto' || tipo === 'karaoke' || tipo === 'plan') {
        const titulo = ajustar(
          (tipo === 'karaoke' ? '♪ ' : tipo === 'plan' ? '' : 'reto: ') + (ex.titulo ?? ''),
          WC - 120,
          [30, 26],
          1,
        );
        const banda = el('g', {}, foto);
        const by = L0 + m + 26;
        T.tinta(
          banda,
          `M${-WC / 2 + 10},${by - 28} L${WC / 2 - 10},${by - 28} L${WC / 2 - 34},${by} L${WC / 2 - 10},${by + 28} L${-WC / 2 + 10},${by + 28} L${-WC / 2 + 34},${by} Z`,
          { color: TINTA, width: 2.4, fill: tipo === 'plan' ? '#FFFFFF' : A },
        );
        texto(banda, titulo.lines[0] ?? '', {
          x: 0,
          y: by + 10,
          size: titulo.size,
          color: tipo === 'plan' ? TINTA : '#FFFFFF',
        });
        const idB = uid('bd');
        const clipB = el(
          'rect',
          { x: -WC / 2, y: by - 40, width: 0, height: 80 },
          el('clipPath', { id: idB }, defs),
        );
        banda.setAttribute('clip-path', `url(#${idB})`);
        anims.push((u) => clipB.setAttribute('width', String(WC * S(u, 1.1, 0.6, ease.inOut))));
        if (tipo === 'reto') {
          const ok = el('g', {}, foto);
          const cx = WC / 2 - m - 70,
            cy = L0 + WC - m - 70;
          el('circle', { cx, cy, r: 46, fill: '#FFFFFF', stroke: A, 'stroke-width': 4 }, ok);
          const v = T.tinta(
            ok,
            `M${cx - 22},${cy + 2} L${cx - 6},${cy + 20} L${cx + 24},${cy - 18}`,
            { color: A, width: 7 },
          );
          anims.push((u) => {
            const k = S(u, 1.9, 0.4, ease.back);
            mover(ok, { ox: cx, oy: cy, s: lerp(1.8, 1, k) });
            opacidad(ok, Math.min(1, k * 3));
            revelar(v, S(u, 2.1, 0.35));
          });
        }
        // ── karaoke: un micrófono del que salen notas
        if (tipo === 'karaoke') {
          const mic = el('g', {}, foto);
          const mx = WC / 2 - m - 70,
            my = L0 + WC - m - 110;
          T.tinta(
            mic,
            `M${mx - 8},${my + 30} L${mx - 14},${my + 110} L${mx + 14},${my + 110} L${mx + 8},${my + 30} Z`,
            { color: TINTA, width: 2.4, fill: '#2B2E33' },
          );
          T.tinta(mic, ellipse(mx, my, 34), { color: TINTA, width: 2.4, fill: '#C8C9CC' });
          for (let k = -2; k <= 2; k++)
            T.tinta(mic, `M${mx - 30},${my + k * 10} L${mx + 30},${my + k * 10}`, {
              color: '#8E9094',
              width: 1.4,
            });
          const notas = [0, 1, 2].map((k) => {
            const n = el('g', {}, foto);
            T.tinta(
              n,
              'M0,0 m-10,0 a10,8 0 1,0 20,0 a10,8 0 1,0 -20,0 M10,0 L10,-36 C22,-30 28,-22 26,-12',
              {
                color: k % 2 ? A : TINTA,
                width: 3,
                fill: k % 2 ? A : TINTA,
              },
            );
            return n;
          });
          anims.push((u) => {
            const k = S(u, 1.3, 0.5, ease.back);
            mover(mic, { ox: mx, oy: my + 60, s: k, r: -14 });
            opacidad(mic, Math.min(1, k * 2));
            notas.forEach((n, j) => {
              const f = ((((u - 1.6) * 0.55 + j / 3) % 1) + 1) % 1;
              const on = u > 1.6;
              mover(n, { x: mx - 30 - 60 * f + j * 10, y: my - 30 - 190 * f, r: -10 + 20 * f });
              opacidad(n, on ? Math.sin(Math.PI * f) : 0);
            });
          });
        }
        // ── plan: una chincheta que cae y se clava arriba
        if (tipo === 'plan') {
          const pin = el('g', {}, foto);
          const px = -WC / 2 + 70,
            py = L0 + 10;
          T.tinta(
            pin,
            `M${px},${py + 46} C${px - 30},${py + 6} ${px - 30},${py - 30} ${px},${py - 30} C${px + 30},${py - 30} ${px + 30},${py + 6} ${px},${py + 46} Z`,
            {
              color: TINTA,
              width: 2.4,
              fill: A,
            },
          );
          el('circle', { cx: px, cy: py - 4, r: 11, fill: '#FFFFFF' }, pin);
          anims.push((u) => {
            const k = S(u, 1.5, 0.5, ease.back);
            mover(pin, { y: lerp(-320, 0, k) });
            opacidad(pin, k > 0 ? 1 : 0);
          });
        }
      }
      if (p.text) {
        const arriba = -hFoto / 2 + WC * 0.94 + 6,
          abajo = hFoto / 2 - 10;
        const alto = abajo - arriba;
        const ancho = WC - 44;
        // del tamaño más grande que quepa entero; si ni con el más pequeño
        // (aún legible) cabe, se corta con «…»
        const tamaños = [36, 32, 28, 26];
        let size = tamaños[tamaños.length - 1];
        let ls: string[] = [];
        for (const sz of tamaños) {
          const cabe = Math.max(1, Math.floor(alto / (sz * 1.15)));
          const l = lineas(p.text, Math.max(8, Math.floor(ancho / (sz * 0.46))), 99);
          if (l.length <= cabe) {
            size = sz;
            ls = l;
            break;
          }
        }
        if (!ls.length)
          ls = lineas(
            p.text,
            Math.max(8, Math.floor(ancho / (size * 0.46))),
            Math.max(1, Math.floor(alto / (size * 1.15))),
          );
        const lh = size * 1.15;
        const y1 = arriba + (alto - ls.length * lh) / 2 + size * 0.88;
        ls.forEach((ln, k) => {
          const id = uid('ln');
          const yy = y1 + k * lh;
          const clip = el(
            'rect',
            { x: -WC / 2, y: yy - size, width: 0, height: size * 1.4 },
            el('clipPath', { id }, defs),
          );
          const n = texto(foto!, ln, { x: 0, y: yy, size, color: TINTA });
          n.setAttribute('clip-path', `url(#${id})`);
          lineasTxt.push({ n, clip, w: WC });
        });
      }
      altoTarjeta = hFoto;
    } else if (tipo === 'voz') {
      // ── nota de voz: un casete con las bobinas girando y la onda que crece
      altoTarjeta = 420;
      T.tinta(card, roundRect(-WC / 2, y0, WC, 250, 22), {
        color: TINTA,
        width: 2.6,
        fill: '#2B2E33',
      });
      T.tinta(card, roundRect(-WC / 2 + 30, y0 + 24, WC - 60, 70, 10), {
        color: TINTA,
        width: 2,
        fill: '#FFF6C8',
      });
      texto(card, `nota de voz · ${p.author}`, { x: 0, y: y0 + 70, size: 32, color: TINTA });
      T.tinta(card, roundRect(-130, y0 + 112, 260, 96, 40), {
        color: '#F4F1EA',
        width: 2,
        fill: '#3C4046',
      });
      const bobinas = [-80, 80].map((bx) => {
        const b = el('g', {}, card);
        el('circle', { cx: bx, cy: y0 + 160, r: 38, fill: '#F4F1EA' }, b);
        for (let k = 0; k < 6; k++) {
          const an = (k / 6) * Math.PI * 2;
          el(
            'rect',
            {
              x: bx - 4,
              y: y0 + 160 - 30,
              width: 8,
              height: 16,
              rx: 3,
              fill: '#2B2E33',
              transform: `rotate(${(an * 180) / Math.PI} ${bx} ${y0 + 160})`,
            },
            b,
          );
        }
        el('circle', { cx: bx, cy: y0 + 160, r: 10, fill: '#2B2E33' }, b);
        return { b, bx };
      });
      anims.push((u) =>
        bobinas.forEach((x) =>
          mover(x.b, { ox: x.bx, oy: y0 + 160, r: Math.max(0, u - 1.1) * 160 }),
        ),
      );
      const nb = 22;
      for (let k = 0; k < nb; k++) {
        const v = p.wave?.[Math.floor((k / nb) * (p.wave?.length ?? 1))] ?? 30;
        const hb = 20 + (v / 100) * 120;
        const r = el(
          'rect',
          {
            x: -WC / 2 + 50 + k * 20.5,
            y: y0 + 340 - hb / 2,
            width: 10,
            height: hb,
            rx: 5,
            fill: k % 5 ? TINTA : A,
          },
          card,
        );
        ondas.push(r);
      }
    } else if (tipo === 'encuesta') {
      // ── encuesta: las barras se llenan con los votos y la ganadora se rodea
      const tit = ajustar(ex.titulo ?? '', WC - 60, [40, 36, 32], 3);
      const opts = (ex.opciones ?? []).slice(0, 4);
      const total = Math.max(
        1,
        opts.reduce((a, o) => a + o.votos, 0),
      );
      const top = Math.max(...opts.map((o) => o.votos), 0);
      const hTit = tit.lines.length * tit.size * 1.18 + 40;
      altoTarjeta = hTit + opts.length * 96 + 40;
      T.tinta(card, roundRect(-WC / 2, y0, WC, altoTarjeta, 18), {
        color: TINTA,
        width: 2.4,
        fill: '#FFFFFF',
      });
      texto(card, 'encuesta', {
        x: -WC / 2 + 30,
        y: y0 + 34,
        size: 24,
        color: A,
        hand: false,
        weight: 700,
        anchor: 'start',
        spacing: 2,
      });
      tit.lines.forEach((ln, k) =>
        texto(card, ln, {
          x: 0,
          y: y0 + 34 + (k + 1) * tit.size * 1.18,
          size: tit.size,
          color: TINTA,
        }),
      );
      opts.forEach((o, k) => {
        const ry = y0 + hTit + 20 + k * 96;
        const fila = el('g', {}, card);
        const lab = ajustar(o.texto, WC - 160, [30, 26], 1);
        texto(fila, lab.lines[0] ?? '', {
          x: -WC / 2 + 34,
          y: ry + 26,
          size: lab.size,
          color: TINTA,
          anchor: 'start',
        });
        T.tinta(fila, roundRect(-WC / 2 + 30, ry + 40, WC - 140, 26, 13), {
          color: TINTA,
          width: 2,
        });
        const barra = el(
          'rect',
          {
            x: -WC / 2 + 32,
            y: ry + 42,
            width: 0,
            height: 22,
            rx: 11,
            fill: o.votos === top && top > 0 ? A : '#C9C4B8',
          },
          fila,
        );
        const num = texto(fila, '0', { x: WC / 2 - 50, y: ry + 64, size: 36, color: TINTA });
        const gana =
          o.votos === top && top > 0
            ? T.tinta(
                fila,
                ellipse(
                  -WC / 2 + 34 + (lab.lines[0]?.length ?? 5) * lab.size * 0.24,
                  ry + 16,
                  (lab.lines[0]?.length ?? 5) * lab.size * 0.27 + 26,
                  30,
                ),
                { color: A, width: 3 },
              )
            : null;
        anims.push((u) => {
          const t0 = enSemi(pz0 + 1.0) - pz0 + k * semi * 2;
          const ka = S(u, t0, 0.4, ease.back);
          mover(fila, { y: 20 * (1 - ka) });
          opacidad(fila, Math.min(1, ka * 2));
          const kb = S(u, t0 + 0.3, 0.8);
          barra.setAttribute('width', String(((WC - 144) * o.votos * kb) / total));
          num.textContent = String(Math.round(o.votos * kb));
          if (gana) revelar(gana, S(u, t0 + 1.4, 0.5, ease.inOut));
        });
      });
    } else if (tipo === 'quiz') {
      // ── quiz: la tarjeta se da la vuelta y enseña la respuesta (si ya se puede)
      const tit = ajustar(ex.titulo ?? '', WC - 80, [40, 36, 32], 4);
      altoTarjeta = Math.max(380, tit.lines.length * tit.size * 1.18 + 230);
      const frente = el('g', {}, card);
      const dorso = el('g', {}, card);
      T.tinta(frente, roundRect(-WC / 2, y0, WC, altoTarjeta, 22), {
        color: TINTA,
        width: 2.6,
        fill: A,
      });
      texto(frente, '?', {
        x: 0,
        y: y0 + altoTarjeta / 2 + 20,
        size: 200,
        color: '#FFFFFF',
        hand: false,
        weight: 800,
      });
      texto(frente, 'quiz', {
        x: 0,
        y: y0 + 50,
        size: 30,
        color: '#FFFFFF',
        hand: false,
        weight: 700,
        spacing: 4,
      });
      T.tinta(dorso, roundRect(-WC / 2, y0, WC, altoTarjeta, 22), {
        color: TINTA,
        width: 2.6,
        fill: '#FFFFFF',
      });
      tit.lines.forEach((ln, k) =>
        texto(dorso, ln, { x: 0, y: y0 + 60 + k * tit.size * 1.18, size: tit.size, color: TINTA }),
      );
      const ok = (ex.opciones ?? []).find((o) => o.correcta);
      const acertaron = ok?.votos ?? 0;
      const total = (ex.opciones ?? []).reduce((a, o) => a + o.votos, 0);
      const ry = y0 + 60 + tit.lines.length * tit.size * 1.18 + 30;
      const resp = ex.abierta || !ok ? '¿lo sabéis?' : ok.texto;
      const fr = ajustar(resp, WC - 140, [40, 34, 30], 1);
      T.tinta(dorso, roundRect(-WC / 2 + 40, ry, WC - 80, 80, 40), {
        color: A,
        width: 3,
        fill: '#FBE3EC',
      });
      texto(dorso, fr.lines[0] ?? '', { x: 0, y: ry + 52, size: fr.size, color: TINTA });
      texto(
        dorso,
        ex.abierta ? `${total} lo han contestado` : `acertaron ${acertaron} de ${total}`,
        { x: 0, y: ry + 130, size: 30, color: GRIS },
      );
      anims.push((u) => {
        const kf = S(u, 1.9, 0.6, ease.inOut);
        const sx = Math.cos(Math.PI * kf);
        ver(frente, sx > 0);
        ver(dorso, sx <= 0);
        mover(frente, { sx: Math.max(0.001, sx), ox: 0 });
        mover(dorso, { sx: Math.max(0.001, -sx), ox: 0 });
      });
    } else if (tipo === 'pregunta') {
      // ── pregunta: la pregunta en un bocadillo y las respuestas que van saliendo
      const tit = ajustar(ex.titulo ?? '', WC - 80, [40, 36, 32], 3);
      const hQ = tit.lines.length * tit.size * 1.18 + 40;
      let yy = y0;
      const bq = el('g', {}, card);
      T.tinta(
        bq,
        `${roundRect(-WC / 2, yy, WC, hQ, 26)} M${-WC / 2 + 60},${yy + hQ - 2} l-10,40 l50,-40`,
        { color: TINTA, width: 2.6, fill: A },
      );
      tit.lines.forEach((ln, k) =>
        texto(bq, ln, {
          x: 0,
          y: yy + 22 + (k + 1) * tit.size * 1.1,
          size: tit.size,
          color: '#FFFFFF',
        }),
      );
      yy += hQ + 60;
      const resps = (ex.respuestas ?? []).slice(0, 3);
      resps.forEach((r, k) => {
        const f = ajustar(`${r.who}: ${r.text}`, WC - 170, [32, 28], 3);
        const h = f.lines.length * f.size * 1.2 + 34;
        const lado = k % 2 ? 1 : -1;
        const bx = lado * 50;
        const b = el('g', {}, card);
        const w = WC - 110;
        T.tinta(
          b,
          `${roundRect(bx - w / 2, yy, w, h, 22)} M${bx + lado * (w / 2 - 50)},${yy + h - 2} l${lado * 10},34 l${-lado * 44},-34`,
          {
            color: TINTA,
            width: 2.2,
            fill: k % 2 ? '#FFF6C8' : '#FFFFFF',
          },
        );
        f.lines.forEach((ln, q) =>
          texto(b, ln, {
            x: bx - w / 2 + 22,
            y: yy + 16 + f.size + q * f.size * 1.2,
            size: f.size,
            color: TINTA,
            anchor: 'start',
          }),
        );
        const cy = yy + h / 2;
        anims.push((u) => {
          const kk = S(u, 1.5 + k * 0.6, 0.45, ease.back);
          mover(b, { ox: bx + lado * (w / 2 - 40), oy: cy + h / 2, s: kk });
          opacidad(b, Math.min(1, kk * 2));
        });
        yy += h + 50;
      });
      if (!resps.length)
        texto(card, 'aún sin respuestas', { x: 0, y: yy + 10, size: 32, color: GRIS });
      altoTarjeta = yy - y0 + (resps.length ? 0 : 40);
      anims.push((u) => {
        const k = S(u, 1.05, 0.45, ease.back);
        mover(bq, { ox: -WC / 2 + 60, oy: y0 + hQ, s: lerp(0.6, 1, k) });
      });
    } else if (tipo === 'cancion') {
      // ── canción: el disco sale de su funda, gira y baja el brazo
      altoTarjeta = 470;
      const FS = 330;
      const fx = -WC / 2 + FS / 2 + 10,
        fy = y0 + FS / 2 + 10;
      const disco = el('g', {}, card);
      el('circle', { cx: 0, cy: 0, r: FS / 2 - 8, fill: '#16171A' }, disco);
      for (const r of [140, 120, 100, 80])
        el(
          'circle',
          { cx: 0, cy: 0, r, fill: 'none', stroke: '#2E3036', 'stroke-width': 2 },
          disco,
        );
      el('circle', { cx: 0, cy: 0, r: 48, fill: A }, disco);
      el('circle', { cx: 0, cy: 0, r: 6, fill: '#F4F1EA' }, disco);
      const brillo = el(
        'path',
        {
          d: `M0,0 L${-FS / 2 + 14},-40 A${FS / 2 - 14},${FS / 2 - 14} 0 0,1 -40,${-FS / 2 + 14} Z`,
          fill: 'rgba(255,255,255,0.07)',
        },
        disco,
      );
      const funda = el('g', {}, card);
      el(
        'rect',
        { x: fx - FS / 2, y: fy - FS / 2, width: FS, height: FS, rx: 8, fill: '#FFFFFF' },
        funda,
      );
      if (ex.portada)
        el(
          'image',
          {
            href: ex.portada,
            x: fx - FS / 2 + 8,
            y: fy - FS / 2 + 8,
            width: FS - 16,
            height: FS - 16,
            preserveAspectRatio: 'xMidYMid slice',
          },
          funda,
        );
      else texto(funda, '♪', { x: fx, y: fy + 50, size: 160, color: A });
      T.tinta(funda, roundRect(fx - FS / 2, fy - FS / 2, FS, FS, 8), { color: TINTA, width: 2.2 });
      const brazo = el('g', {}, card);
      const ax = WC / 2 - 40,
        ay = y0 + 30;
      T.tinta(brazo, `M${ax},${ay} L${ax - 70},${ay + 220} L${ax - 98},${ay + 240}`, {
        color: TINTA,
        width: 6,
      });
      el(
        'circle',
        { cx: ax, cy: ay, r: 16, fill: '#C8C9CC', stroke: TINTA, 'stroke-width': 2 },
        brazo,
      );
      const tit = ajustar(ex.titulo ?? '', WC - 40, [42, 36, 32], 1);
      texto(card, tit.lines[0] ?? '', { x: 0, y: y0 + FS + 70, size: tit.size, color: TINTA });
      texto(card, ex.artista ?? '', { x: 0, y: y0 + FS + 110, size: 30, color: GRIS });
      anims.push((u) => {
        const ks = S(u, 1.2, 0.7, ease.inOut);
        mover(disco, { x: fx + 175 * ks, y: fy, r: Math.max(0, u - 1.6) * 200 });
        void brillo;
        mover(brazo, { ox: ax, oy: ay, r: lerp(-28, 0, S(u, 2.0, 0.5, ease.back)) });
        opacidad(brazo, S(u, 1.8, 0.3));
      });
    } else if (tipo === 'retoNuevo') {
      // ── reto lanzado: se clava una bandera con el reto y salen los que se animaron
      const tit = ajustar(ex.titulo ?? '', WC - 220, [38, 34, 30], 3);
      const hB = Math.max(150, 60 + tit.lines.length * tit.size * 1.12 + 34);
      const quienes = (ex.quienes ?? []).slice(0, 6);
      altoTarjeta = hB + 260 + (quienes.length ? 110 : 40);
      const px = -WC / 2 + 70;
      const suelo = T.tinta(
        card,
        `M${-WC / 2 + 10},${y0 + hB + 200} C${-80},${y0 + hB + 186} ${80},${y0 + hB + 214} ${WC / 2 - 10},${y0 + hB + 198}`,
        { color: TINTA, width: 3 },
      );
      const palo = T.tinta(card, `M${px},${y0 + hB + 200} L${px},${y0 + 10}`, {
        color: TINTA,
        width: 6,
      });
      const bandera = el('g', {}, card);
      T.tinta(
        bandera,
        `M${px},${y0 + 14} C${px + 140},${y0 - 6} ${WC / 2 - 120},${y0 + 34} ${WC / 2 - 20},${y0 + 14} L${WC / 2 - 20},${y0 + hB} C${WC / 2 - 120},${y0 + hB + 20} ${px + 140},${y0 + hB - 20} ${px},${y0 + hB} Z`,
        {
          color: TINTA,
          width: 2.4,
          fill: A,
        },
      );
      texto(bandera, 'reto', {
        x: px + 30,
        y: y0 + 50,
        size: 24,
        color: '#FFFFFF',
        hand: false,
        weight: 700,
        anchor: 'start',
        spacing: 3,
      });
      tit.lines.forEach((ln, k) =>
        texto(bandera, ln, {
          x: px + 30,
          y: y0 + 60 + (k + 1) * tit.size * 1.12,
          size: tit.size,
          color: '#FFFFFF',
          anchor: 'start',
        }),
      );
      const caras = quienes.map((q, k) => {
        const c = el('g', {}, card);
        const cx = -((quienes.length - 1) * 90) / 2 + k * 90,
          cy = y0 + hB + 290;
        T.tinta(c, ellipse(cx, cy, 36), {
          color: TINTA,
          width: 2.4,
          fill: k % 2 ? '#FBE3EC' : '#FFFFFF',
        });
        texto(c, q[0]?.toUpperCase() ?? '?', { x: cx, y: cy + 12, size: 36, color: TINTA });
        texto(c, q, { x: cx, y: cy + 68, size: 24, color: GRIS });
        return { c, cx, cy };
      });
      const nadie = quienes.length
        ? null
        : texto(card, '¿quién se anima?', { x: 0, y: y0 + hB + 260, size: 34, color: GRIS });
      anims.push((u) => {
        revelar(suelo, S(u, 1.0, 0.4));
        revelar(palo, S(u, 1.15, 0.45));
        const kb = S(u, 1.5, 0.6, ease.back);
        mover(bandera, { ox: px, oy: y0 + hB / 2, sx: Math.max(0.001, kb) });
        caras.forEach((c, k) => {
          const kc = S(u, enSemi(pz0 + 2.0) - pz0 + k * semi * 2, 0.4, ease.back);
          mover(c.c, { ox: c.cx, oy: c.cy, s: kc });
        });
        if (nadie) opacidad(nadie, S(u, 2.0, 0.4));
      });
    } else {
      // ── texto: una hoja rayada (del tamaño del texto) que se escribe a pluma
      const f = ajustar(p.text ?? '', WC - 90, [48, 42, 36, 32], 7);
      altoTarjeta = Math.round(f.lines.length * f.size * 1.2 + 110);
      T.tinta(card, roundRect(-WC / 2, y0, WC, altoTarjeta, 16), {
        color: TINTA,
        width: 2.4,
        fill: '#FFFDF6',
      });
      for (let yy = y0 + 70; yy < y0 + altoTarjeta - 20; yy += f.size * 1.2)
        T.tinta(card, `M${-WC / 2 + 24},${yy + 12} L${WC / 2 - 24},${yy + 12.5}`, {
          color: '#DAD6C4',
          width: 1.6,
        });
      texto(card, '“', { x: -WC / 2 + 40, y: y0 + 80, size: 100, color: A });
      f.lines.forEach((ln, k) => {
        const id = uid('ln');
        const clip = el(
          'rect',
          { x: -WC / 2, y: y0, width: 0, height: altoTarjeta },
          el('clipPath', { id }, defs),
        );
        const n = texto(card, ln, {
          x: -WC / 2 + 50,
          y: y0 + 72 + k * f.size * 1.2,
          size: f.size,
          color: TINTA,
          anchor: 'start',
        });
        n.setAttribute('clip-path', `url(#${id})`);
        lineasTxt.push({ n, clip, w: WC });
      });
      // la pluma que lo va escribiendo
      const pluma = el('g', {}, card);
      T.tinta(pluma, 'M0,0 L-10,-44 L-3,-110 L10,-110 L13,-44 Z', {
        color: TINTA,
        width: 2,
        fill: '#FFFFFF',
      });
      T.tinta(pluma, 'M0,0 L-4,-18 L6,-18 Z', { color: TINTA, width: 1.4, fill: TINTA });
      const nL = f.lines.length;
      anims.push((u) => {
        let li = -1,
          kk = 0;
        for (let k = 0; k < nL; k++) {
          const v = S(u, 1.2 + k * 0.42, 0.55, ease.linear);
          if (v > 0 && v < 1) {
            li = k;
            kk = v;
          }
        }
        ver(pluma, li >= 0);
        if (li >= 0)
          mover(pluma, {
            x: -WC / 2 + 50 + f.lines[li].length * f.size * 0.44 * kk,
            y: y0 + 72 + li * f.size * 1.2 + 4,
            r: 28,
          });
      });
    }
    y0 += altoTarjeta + 22;
    // las notas de los comentarios
    const cs = p.comments.slice(0, 2);
    const NW = cs.length > 1 ? 262 : 380;
    const notas = cs.map((c, j) => {
      const f = ajustar(`${c.who}: ${c.text}`, NW - 34, [30, 27, 25], 4);
      const hN = Math.round(f.lines.length * f.size * 1.2 + 34);
      const nx = cs.length > 1 ? (j ? 8 + NW / 2 : -8 - NW / 2) : 0;
      const ng = el('g', {}, g);
      T.tinta(ng, roundRect(-NW / 2, 0, NW, hN, 8), {
        color: TINTA,
        width: 2,
        fill: j % 2 ? '#FFE9F1' : '#FFF6C8',
      });
      // un trocito de cinta arriba
      el(
        'rect',
        {
          x: -34,
          y: -10,
          width: 68,
          height: 22,
          fill: 'rgba(255,255,255,0.7)',
          transform: 'rotate(-4)',
        },
        ng,
      );
      f.lines.forEach((ln, k) =>
        texto(ng, ln, {
          x: -NW / 2 + 16,
          y: 17 + f.size * 0.95 + k * f.size * 1.2,
          size: f.size,
          color: TINTA,
          anchor: 'start',
        }),
      );
      return { g: ng, x: nx, y: y0, r: cs.length > 1 ? (j ? 3 : -3) : -2, h: hN };
    });
    const alto = y0 + (notas.length ? Math.max(...notas.map((n) => n.h)) + 10 : 0);
    // la cinta que la sujeta
    const cinta = foto
      ? [-1, 1].map((sx) =>
          el(
            'rect',
            {
              x: -50,
              y: -16,
              width: 100,
              height: 32,
              fill: 'rgba(242,230,190,0.85)',
              transform: `translate(${sx * (WC / 2 - 40)},${140}) rotate(${sx * 32})`,
            },
            card,
          ),
        )
      : [];
    // pegatinas de las reacciones, sobre la esquina
    const pegatinas = [...new Set(p.reactions)].slice(0, 3).map((em, j) => {
      const pg = el('g', {}, g);
      const px = WC / 2 - 40 - j * 70,
        py = 180;
      pg.setAttribute('data-x', String(px));
      const rayos = T.tinta(
        pg,
        Array.from({ length: 8 }, (_, q) => {
          const an = (q / 8) * Math.PI * 2;
          return `M${px + Math.cos(an) * 44},${py + Math.sin(an) * 44} L${px + Math.cos(an) * 64},${py + Math.sin(an) * 64}`;
        }).join(' '),
        { color: A, width: 3 },
      );
      el(
        'circle',
        { cx: px, cy: py, r: 36, fill: '#FFFFFF', stroke: TINTA, 'stroke-width': 2 },
        pg,
      );
      texto(pg, em, { x: px, y: py + 13, size: 36, hand: false });
      return { g: pg, rayos };
    });
    return {
      p,
      x,
      y,
      alto,
      g,
      card,
      foto,
      rot,
      blur,
      fid,
      dia: [dia1, dia2],
      circulo,
      autor,
      lineasTxt,
      cinta,
      pegatinas,
      notas,
      ondas,
      anims,
    };
  });

  // la cámara de la mesa: encuadra cada carta (y al final, todas)
  const encuadre = (c: Carta) => {
    const z = Math.min(1, (ABAJO - ARRIBA - 30) / c.alto, 660 / 600);
    return { x: c.x, y: c.y + c.alto / 2, z };
  };
  const xs = cartas.map((c) => c.x),
    ys = cartas.flatMap((c) => [c.y, c.y + c.alto]);
  const todo = cartas.length
    ? (() => {
        const x0 = Math.min(...xs) - 320,
          x1 = Math.max(...xs) + 320,
          y0 = Math.min(...ys) - 40,
          y1 = Math.max(...ys) + 40;
        return {
          x: (x0 + x1) / 2,
          y: (y0 + y1) / 2,
          z: Math.min(W / (x1 - x0), (ABAJO - ARRIBA) / (y1 - y0)),
        };
      })()
    : { x: 0, y: 0, z: 1 };
  const centroSeguro = (ARRIBA + ABAJO) / 2;

  const da = piezas[0]?.a ?? 0;
  // al acabar, la mesa se queda quieta y sus fotos vuelan a las casillas
  const congela = fin - 0.15;
  /** La cámara de la mesa en el instante «t». */
  const camAt = (t: number) => {
    let cam = encuadre(cartas[0]);
    let giro = 0;
    piezas.forEach((pz, i) => {
      if (t >= pz.a - 0.3) {
        const prev = i
          ? encuadre(cartas[i - 1])
          : { ...encuadre(cartas[0]), z: encuadre(cartas[0]).z * 0.8 };
        const k = S(t, pz.a - 0.3, 1.1, ease.inOut);
        const cur = encuadre(cartas[i]);
        cam = {
          x: lerp(prev.x, cur.x, k),
          y: lerp(prev.y, cur.y, k),
          z: lerp(prev.z, cur.z, k) * (1 - 0.1 * Math.sin(Math.PI * k)),
        };
        giro = Math.sin(Math.PI * k) * (i % 2 ? 2.2 : -2.2);
      }
    });
    // deriva lenta (la cámara nunca está quieta)
    const z = cam.z * (1 + 0.025 * Math.sin((t - da) * 0.35));
    return { x: cam.x, y: cam.y, z, giro };
  };
  /** Un punto de la mesa, en pantalla. */
  const aPantalla = (px: number, py: number, c: ReturnType<typeof camAt>) => {
    const a = (c.giro * Math.PI) / 180;
    const dx = (px - c.x) * c.z,
      dy = (py - c.y) * c.z;
    return {
      x: CX + dx * Math.cos(a) - dy * Math.sin(a),
      y: centroSeguro + dx * Math.sin(a) + dy * Math.cos(a),
    };
  };
  const WC0 = 540; // (el ancho de la instantánea)
  // las copias que vuelan de la mesa a las casillas (en pantalla)
  const volando = el('g', {}, o.parent);
  const copias = cartas
    .map((c) => {
      if (!c.p.photo || !o.destino) return null;
      const g = el('g', {}, volando);
      const marco = el('rect', { fill: '#FFFFFF', rx: 8 }, g);
      const im = el(
        'image',
        { href: c.p.photo, preserveAspectRatio: 'xMidYMid slice', 'clip-path': `url(#${recorte})` },
        g,
      );
      return { c, g, marco, im };
    })
    .filter(Boolean) as {
    c: (typeof cartas)[number];
    g: SVGGElement;
    marco: SVGRectElement;
    im: SVGImageElement;
  }[];
  const aterriza = o.aterriza ?? fin + 1.4;

  paints.push((t) => {
    const on = t > da - 0.6 && t < aterriza + 0.4;
    ver(mundo, on && t < fin + 0.6);
    ver(volando, on && t >= congela && t < aterriza + 0.3);
    if (!on || !cartas.length) return;
    const cam = camAt(Math.min(t, congela));
    mundo.setAttribute(
      'transform',
      `translate(${CX},${centroSeguro}) rotate(${cam.giro.toFixed(2)}) scale(${cam.z.toFixed(4)}) translate(${(-cam.x).toFixed(1)},${(-cam.y).toFixed(1)})`,
    );
    // entra fundiendo; al final, lo que no vuela (marcos, textos, notas) se va
    opacidad(mundo, S(t, da - 0.6, 0.6) * (1 - S(t, congela, 0.35)));
    // las fotos vuelan a sus casillas (las de la mesa se esconden justo entonces)
    copias.forEach((cp, j) => {
      const dest = o.destino!(cp.c.p.id);
      // (la instantánea entera se va con ella: no queda el marco vacío)
      ver(cp.c.card, !(dest && t >= congela));
      if (!dest || t < congela) return;
      const k = S(
        t,
        congela + j * 0.05,
        Math.max(0.4, aterriza - congela - 0.05 - j * 0.05),
        ease.inOut,
      );
      // de dónde sale: la foto de la instantánea, tal como está en pantalla
      const ini = aPantalla(cp.c.x, cp.c.y + 140 + WC0 / 2, cam);
      const iniLado = WC0 * cam.z;
      const lado = lerp(iniLado, dest.size, k);
      const x = lerp(ini.x, dest.x, k);
      const y = lerp(ini.y, dest.y, k) - Math.sin(Math.PI * k) * 90;
      const m = lado * lerp(0.06, 0.024, k);
      cp.marco.setAttribute('x', String(-lado / 2));
      cp.marco.setAttribute('y', String(-lado / 2));
      cp.marco.setAttribute('width', String(lado));
      cp.marco.setAttribute('height', String(lado));
      cp.im.setAttribute('x', String(-lado / 2 + m));
      cp.im.setAttribute('y', String(-lado / 2 + m));
      cp.im.setAttribute('width', String(lado - 2 * m));
      cp.im.setAttribute('height', String(lado - 2 * m));
      mover(cp.g, { x, y, r: lerp(cam.giro + cp.c.rot, 0, k) });
      // al aterrizar se funde con su casilla
      opacidad(cp.g, 1 - S(t, aterriza - 0.05, 0.25));
    });
    // ── cada carta ──
    cartas.forEach((c, i) => {
      const pz = piezas[i];
      const u = t - pz.a;
      ver(c.g, u > -0.2);
      if (u <= -0.2) return;
      // el día y su círculo
      c.dia.forEach((n) => opacidad(n, S(u, 0, 0.4)));
      revelar(c.circulo, S(u, 0.25, 0.5, ease.inOut));
      opacidad(c.autor, S(u, 0.9, 0.4));
      // la tarjeta llega lanzada desde abajo a la derecha, gira y aterriza
      const kl = clamp01((u - 0.3) / 0.75);
      const kp = ease.out(kl);
      const kr = ease.back(kl);
      const desde = i % 2 ? -1 : 1;
      mover(c.card, {
        x: lerp(desde * 760, 0, kp),
        y: lerp(900, 0, kp),
        r: lerp(desde * 38, c.rot, kr),
        s: lerp(1.25, 1, kp),
        ox: 0,
        oy: c.alto / 2,
      });
      opacidad(c.card, kl > 0 ? 1 : 0);
      const v = Math.sin(Math.PI * kl);
      c.blur.setAttribute('stdDeviation', `${(14 * v).toFixed(1)} ${(18 * v).toFixed(1)}`);
      if (v > 0.05 && kl < 1) c.card.setAttribute('filter', `url(#${c.fid})`);
      else c.card.removeAttribute('filter');
      // la cinta
      c.cinta.forEach((ci, j) => opacidad(ci, S(u, 1.05 + j * 0.12, 0.3)));
      // la frase se escribe línea a línea
      c.lineasTxt.forEach((ln, j) => {
        const k = S(u, 1.2 + j * 0.42, 0.55, ease.linear);
        ln.clip.setAttribute('x', String(-ln.w / 2 - 300));
        ln.clip.setAttribute('width', String((ln.w + 600) * k));
      });
      // las barras de la nota de voz
      c.ondas.forEach((o, j) => {
        const k = S(u, 1.0 + j * 0.03, 0.4, ease.back);
        mover(o, {
            sy: k,
            oy: Number(o.getAttribute('y')) + Number(o.getAttribute('height')) / 2,
          });
      });
      // pegatinas: caen con un golpe de tinta
      c.pegatinas.forEach((pg, j) => {
        const k = S(u, enSemi(pz.a + 1.7) - pz.a + j * semi * 2, 0.45, ease.back);
        const px = Number(pg.g.getAttribute('data-x'));
        mover(pg.g, { ox: px, oy: 180, s: lerp(1.9, 1, k) });
        opacidad(pg.g, Math.min(1, k * 2.5));
        const kr2 = S(u, enSemi(pz.a + 1.7) - pz.a + j * semi * 2 + 0.2, 0.3);
        revelar(pg.rayos, kr2);
        opacidad(pg.rayos, 1 - S(u, enSemi(pz.a + 1.7) - pz.a + j * semi * 2 + 0.6, 0.4));
      });
      // notas: se despegan y se pegan
      c.notas.forEach((n, j) => {
        const k = S(u, 2.0 + j * 0.5, 0.55, ease.back);
        mover(n.g, {
          x: n.x,
          y: n.y + 30 * (1 - k),
          r: lerp(n.r + 14, n.r, k),
          s: 0.7 + 0.3 * k,
        });
        opacidad(n.g, Math.min(1, k * 2));
      });
      // lo propio de cada tipo
      c.anims.forEach((f) => f(u));
      // las cartas que ya pasaron se quedan, algo apagadas
      const sig = piezas[i + 1];
      opacidad(c.g, sig ? 1 - 0.35 * S(t, sig.a, 0.8) : 1);
    });
  });

  return {
    pintar: (t: number) => paints.forEach((p) => p(t)),
    etiqueta: () => {
      if (!cartas.length) return { x: CX, y: centroSeguro, z: 1 };
      const c = camAt(da + 0.1);
      const p = aPantalla(cartas[0].x + 20 + cartas[0].p.badge.length * 15, cartas[0].y + 32, c);
      return { x: p.x, y: p.y, z: c.z };
    },
  };
}

/**
 * Los subtítulos de la narradora dentro del propio dibujo (así salen igual al
 * exportar): la frase en curso, palabra a palabra; los nombres y las cifras,
 * en el color de acento; sin punto final.
 */
export function montarSubtitulos(o: {
  svg: Element;
  voces: { a: number; b: number; voz: { text: string } }[];
  d: DatosPelicula;
  tinta: (t: number) => string;
  acento: (t: number) => string;
}): (t: number) => void {
  const { svg, d } = o;
  const paints: ((t: number) => void)[] = [];
  // ═══════════════════ SUBTÍTULOS (dentro del dibujo) ═══════════════════
  {
    const g = el('g', {}, svg);
    const nombres = new Set(d.people.map((p) => norm(p.name.split(' ')[0])).filter(Boolean));
    let clave = '';
    let palabras: { ts: SVGTSpanElement; desde: number }[] = [];
    paints.push((t) => {
      const seg = o.voces.find((v) => t >= v.a && t < v.b + 0.4);
      if (!seg) {
        ver(g, false);
        return;
      }
      ver(g, true);
      const text = seg.voz.text;
      const k = Math.min(1, ((t - seg.a) / Math.max(0.1, seg.b - seg.a)) * 1.04);
      const at = text.length * k;
      // la frase en curso
      const frases = [...text.matchAll(/[^.?!…]+[.?!…»]*/g)].map((m) => ({
        s: m[0],
        i: m.index!,
      }));
      const cur = frases.find((f) => at <= f.i + f.s.length) ?? frases[frases.length - 1];
      if (!cur) return;
      const key = `${seg.a}|${cur.i}`;
      if (key !== clave) {
        clave = key;
        g.innerHTML = '';
        const limpia = cur.s.trim().replace(/\.$/, '');
        const f = ajustar(limpia, 640, [40, 36, 32], 3);
        const lh = f.size * 1.18;
        const y0 = 1185 - (f.lines.length - 1) * lh;
        palabras = [];
        let pos = cur.i + (cur.s.length - cur.s.trimStart().length);
        f.lines.forEach((ln, li) => {
          const tx = el(
            'text',
            {
              x: CX,
              y: y0 + li * lh,
              'font-size': f.size,
              'font-family': 'Caveat_600SemiBold, Caveat, cursive',
              'text-anchor': 'middle',
            },
            g,
          );
          ln.split(' ').forEach((w, wi, arr) => {
            const ts = el('tspan', {}, tx);
            ts.textContent = w + (wi < arr.length - 1 ? ' ' : '');
            const bare = norm(w.replace(/[^\p{L}\p{N}]/gu, ''));
            if (/\d/.test(w) || nombres.has(bare)) {
              ts.setAttribute('data-hi', '1');
              ts.setAttribute('font-family', 'Caveat_700Bold, Caveat, cursive');
            }
            const idx = text.indexOf(w.replace(/…$/, ''), pos);
            const desde = idx >= 0 ? idx : pos;
            pos = desde + w.length;
            palabras.push({ ts, desde });
          });
        });
      }
      // de noche, letra clara; de día, tinta (y el acento de cada momento)
      g.setAttribute('fill', o.tinta(t));
      const ac = o.acento(t);
      palabras.forEach((p) => {
        p.ts.setAttribute('fill-opacity', clamp01((at - p.desde) / 5).toFixed(3));
        if (p.ts.getAttribute('data-hi')) p.ts.setAttribute('fill', ac);
      });
      // la última frase de cada tramo se va fundiendo al acabar
      opacidad(g, 1 - S(t, seg.b + 0.05, 0.3));
    });
  }
  return (t: number) => paints.forEach((p) => p(t));
}
