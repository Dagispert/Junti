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
  };
  const cartas: Carta[] = d.pieces.map((p, i) => {
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
    if (p.photo) {
      // la instantánea
      // con frase, el margen de abajo de la instantánea es más alto: ahí va
      // escrita, en un recuadro fijo del que nunca se sale
      const PIE = p.text ? 0.3 : 0.16;
      const hFoto = WC * (1 + PIE);
      foto = el('g', {}, card);
      foto.setAttribute('transform', `translate(0,${y0 + hFoto / 2})`);
      instantanea(foto, p.photo, WC, PIE);
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
    } else if (p.wave?.length) {
      // una nota de voz: barras que crecen
      altoTarjeta = 300;
      T.tinta(card, roundRect(-WC / 2, y0, WC, altoTarjeta, 18), {
        color: TINTA,
        width: 2.4,
        fill: '#FFFFFF',
      });
      const nb = 22;
      for (let k = 0; k < nb; k++) {
        const v = p.wave[Math.floor((k / nb) * p.wave.length)] ?? 30;
        const hb = 30 + (v / 100) * 170;
        const r = el(
          'rect',
          {
            x: -WC / 2 + 50 + k * 20.5,
            y: y0 + 150 - hb / 2,
            width: 10,
            height: hb,
            rx: 5,
            fill: k % 5 ? TINTA : A,
          },
          card,
        );
        ondas.push(r);
      }
      texto(card, 'nota de voz', { x: 0, y: y0 + 275, size: 30, color: GRIS });
    } else {
      // sin foto: el texto en una hoja rayada, del tamaño del texto
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
        mover(o, { sy: k, oy: 290 });
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
