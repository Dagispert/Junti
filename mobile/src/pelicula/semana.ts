// «La mesa de la semana»: el resumen semanal (o mensual) como una mesa de
// recortes que se va llenando, todo dibujado a mano:
//
//   1. Apertura   — el nombre del grupo y las fechas se escriben con pluma
//                   mientras las fotos de la semana se abren en abanico.
//   2. Vosotros   — cada persona, un círculo de tinta; una línea punteada las
//                   une y cuenta los kilómetros.
//   3. Los días   — cada momento llega lanzado a la mesa como una instantánea:
//                   aterriza, se pega con cinta, se escribe su frase, caen las
//                   pegatinas de las reacciones y las notas de los comentarios.
//                   La cámara viaja de una a otra y las anteriores se quedan.
//   4. La mesa    — la cámara se aleja y se ve la semana entera.
//   5. Números    — sube una hoja de cuaderno: cifras que cuentan, barras
//                   que crecen, al compás de la música.
//   6. El sobre   — las fotos vuelan dentro de un sobre, la solapa se cierra,
//                   cae el sello y «junti» se escribe letra a letra.
//
// Los subtítulos de la narradora van dentro del propio dibujo (así salen
// igual al exportar), palabra a palabra. Todo es una función del tiempo.

import { accentDay, DEFAULT_ACCENT } from '@/lib/accent';
import { ease, ellipse, lerp, roundRect, span } from '@/lib/doodle-ink';

import { durVoz, type DatosPelicula, type Pieza, type Plan, type Voz } from './guion';
import { el, lineas, mover, opacidad, revelar, Taller, texto, uid, ver } from './tinta';

const W = 720,
  H = 1280,
  CX = 360;
/** Zona segura: arriba la isla del móvil; abajo, los subtítulos. */
const ARRIBA = 130,
  ABAJO = 1050;
const PAPEL = '#F4F1EA',
  TINTA = '#1D1F22',
  GRIS = '#6B6A62';
const S = (t: number, a: number, d: number, c = ease.out) => span(t, a, d, c);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** El texto entero en un ancho: de mayor a menor tamaño; si no cabe, con «…». */
function ajustar(text: string, ancho: number, tamaños: number[], maxLineas: number) {
  for (const size of tamaños) {
    const ls = lineas(text, Math.max(8, Math.floor(ancho / (size * 0.46))), 99);
    if (ls.length <= maxLineas) return { size, lines: ls };
  }
  const size = tamaños[tamaños.length - 1];
  return { size, lines: lineas(text, Math.max(8, Math.floor(ancho / (size * 0.46))), maxLineas) };
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

type Tramo = [number, number];

export class Semana {
  plan: Plan;
  /** Esta película pone ella misma los subtítulos. */
  readonly subtitulos = true;
  private T = new Taller();
  private paint: ((t: number) => void)[] = [];
  private A: string;
  private escenas!: {
    apertura: Tramo;
    vosotros: Tramo;
    dias: Tramo;
    piezas: { a: number; b: number }[];
    mesa: Tramo;
    numeros: Tramo;
    sobre: Tramo;
  };

  constructor(
    private svg: SVGSVGElement,
    private d: DatosPelicula,
  ) {
    this.A = accentDay(d.accent ?? DEFAULT_ACCENT);
    this.plan = this.planificar();
    this.build();
  }

  pintar(t: number) {
    for (const p of this.paint) p(t);
    this.T.hervir(t);
  }

  // ───────────────────────────── EL GUION ─────────────────────────────
  private planificar(): Plan {
    const d = this.d;
    const V = d.voices;
    const voces: Plan['voces'] = [];
    // la voz no se para: cada frase empieza donde acaba la anterior (o después)
    let tv = 0;
    const say = (a: number, v?: Voz) => {
      if (!v) return a;
      const s = Math.max(a, tv);
      voces.push({ a: s, b: s + durVoz(v), voz: v });
      tv = s + durVoz(v);
      return tv;
    };
    say(0.7, V.greeting);
    const apertura: Tramo = [0, Math.max(4.6, tv + 0.4)];
    say(apertura[1] + 0.2, V.intro);
    say(tv, V.route);
    const vosotros: Tramo = [apertura[1], Math.max(apertura[1] + 4.2, tv + 0.3)];
    let t = vosotros[1];
    const piezas = d.pieces.map((p) => {
      const a = t;
      const fin = say(a + 0.6, V.pieces[p.id]);
      const b = Math.max(a + 3.8, fin + 0.35);
      t = b;
      return { a, b };
    });
    const dias: Tramo = [vosotros[1], t];
    // la mesa entera: un respiro sin voz, con la música
    const mesa: Tramo = [t, t + 3.2];
    say(mesa[1] + 0.3, V.stats);
    const numeros: Tramo = [mesa[1], Math.max(mesa[1] + 5.6, tv + 0.4)];
    say(numeros[1] + 0.5, V.end);
    const sobre: Tramo = [numeros[1], Math.max(numeros[1] + 7.2, tv + 1.4)];
    this.escenas = { apertura, vosotros, dias, piezas, mesa, numeros, sobre };
    const nada: Tramo = [-10, -10];
    return {
      reloj: nada,
      persiana: nada,
      ventanilla: nada,
      libreta: nada,
      calendario: nada,
      piezas: d.pieces.map((p, i) => ({ id: p.id, ...piezas[i] })),
      recuerdos: mesa,
      final: sobre,
      total: sobre[1] + 0.3,
      voces,
    };
  }

  // ───────────────────────────── EL DIBUJO ─────────────────────────────
  private build() {
    const { svg, d, T, A } = this;
    const E = this.escenas;
    svg.innerHTML = '';
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const defs = el('defs', {}, svg);
    // semicorcheas de la música (o un ritmo tranquilo si no hay canción)
    const R = d.ritmo;
    const semi = R ? R.periodo / 4 : 0.13;
    const enSemi = (t0: number) =>
      R ? R.desfase + Math.ceil((t0 - R.desfase) / semi - 1e-6) * semi : t0;

    // el papel, con un poco de grano
    el('rect', { x: -50, y: -50, width: W + 100, height: H + 100, fill: PAPEL }, svg);
    const grano = uid('gr');
    const pat = el(
      'pattern',
      { id: grano, width: 9, height: 9, patternUnits: 'userSpaceOnUse' },
      defs,
    );
    el('circle', { cx: 2, cy: 3, r: 0.7, fill: '#000', opacity: 0.05 }, pat);
    el('circle', { cx: 6.5, cy: 7, r: 0.6, fill: '#000', opacity: 0.04 }, pat);
    el('rect', { x: 0, y: 0, width: W, height: H, fill: `url(#${grano})` }, svg);

    const fotos = d.pieces.filter((p) => p.photo).map((p) => p.photo!);
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

    // ── capas: el mundo (con cámara) y lo de delante (sin cámara) ──
    const mundo = el('g', {}, svg);
    const delante = el('g', {}, svg);

    // ═════════════════════════ 1. APERTURA ═════════════════════════
    {
      const [a, b] = E.apertura;
      const g = el('g', {}, delante);
      // el abanico de fotos que se abre detrás del título
      const abanico = fotos.slice(0, 9).map((f, i, all) => {
        const n = all.length;
        const ang = (-0.5 + (n > 1 ? i / (n - 1) : 0.5)) * 1.7 - Math.PI / 2;
        const p = instantanea(g, f, 190);
        return {
          p,
          ang,
          r: 300 + (i % 3) * 36,
          rot: (ang + Math.PI / 2) * 40 + ((i * 37) % 9) - 4,
        };
      });
      const kicker = texto(g, d.group.toUpperCase(), {
        x: CX,
        y: 560,
        size: 26,
        hand: false,
        weight: 700,
        color: A,
        spacing: 5,
      });
      // el título se escribe de izquierda a derecha y la pluma va delante
      const idT = uid('tt');
      const tapa = el(
        'rect',
        { x: 0, y: 560, width: 0, height: 130 },
        el('clipPath', { id: idT }, defs),
      );
      const tit = ajustar(d.range, 640, [74, 64, 54], 1);
      const titulo = texto(g, tit.lines[0], { x: CX, y: 650, size: tit.size, color: TINTA });
      titulo.setAttribute('clip-path', `url(#${idT})`);
      const subr = T.tinta(g, `M${CX - 230},678 C${CX - 80},690 ${CX + 80},668 ${CX + 230},682`, {
        color: A,
        width: 5,
      });
      const pluma = el('g', {}, g);
      T.tinta(pluma, 'M0,0 L-14,-60 L-4,-150 L14,-150 L18,-60 Z', {
        color: TINTA,
        width: 2,
        fill: '#FFFFFF',
      });
      T.tinta(pluma, 'M0,0 L-6,-24 L8,-24 Z', { color: TINTA, width: 1.6, fill: TINTA });
      // garabatos que se dibujan alrededor, uno por semicorchea
      const garabatos = [
        `M${CX - 280},470 l10,-26 l10,26 l-26,-16 l32,0 z`,
        `M${CX + 250},450 c-20,-30 -60,0 -26,30 c34,-30 -6,-60 -26,-30`,
        `M${CX + 270},760 q20,-20 40,0 q20,20 40,0`,
        `M${CX - 300},770 c0,-24 30,-24 30,0 c0,24 -30,24 -30,0`,
      ].map((p, i) => T.tinta(g, p, { color: i % 2 ? A : TINTA, width: 3 }));
      this.paint.push((t) => {
        ver(g, t < b + 0.6);
        if (t > b + 0.6) return;
        const out = S(t, b - 0.3, 0.7, ease.in);
        opacidad(g, 1 - out);
        abanico.forEach((f, i) => {
          const k = S(t, enSemi(0.3) + i * semi, 0.9, ease.back);
          const deriva = 1 + 0.05 * Math.max(0, t - 1);
          mover(f.p, {
            x: CX + Math.cos(f.ang) * f.r * k * deriva,
            y: 640 + Math.sin(f.ang) * f.r * k * deriva * 1.05 - 80 * out,
            s: 0.4 + 0.6 * k,
            r: f.rot * k,
          });
          opacidad(f.p, Math.min(1, k * 1.5) * 0.95);
        });
        opacidad(kicker, S(t, 0.5, 0.5));
        const kw = S(t, 0.9, 1.3, ease.inOut);
        tapa.setAttribute('width', String(W * kw));
        ver(pluma, kw > 0 && kw < 1);
        mover(pluma, { x: W * kw * 0.86 + 50, y: 650 + 6 * Math.sin(t * 22), r: 28 });
        revelar(subr, S(t, 2.1, 0.5, ease.inOut));
        garabatos.forEach((p, i) => revelar(p, S(t, enSemi(2.3) + i * semi * 2, 0.4)));
      });
    }

    // ═════════════════════════ 2. VOSOTROS ═════════════════════════
    {
      const [a, b] = E.vosotros;
      const g = el('g', {}, delante);
      const gente = d.people.slice(0, 6);
      const n = Math.max(1, gente.length);
      // repartidos en un arco
      const pos = gente.map((_, i) => {
        if (n === 1) return { x: CX, y: 600 };
        const k = i / (n - 1);
        return { x: lerp(170, 550, k), y: 600 + Math.sin(k * Math.PI) * -140 + (i % 2) * 60 };
      });
      const camino = pos.map((p, i) => (i ? `L${p.x},${p.y}` : `M${p.x},${p.y}`)).join(' ');
      const linea = n > 1 ? T.tinta(g, camino, { color: A, width: 3, dash: '2 12' }) : null;
      const caras = gente.map((p, i) => {
        const c = el('g', {}, g);
        const R0 = 78;
        T.tinta(c, ellipse(0, 0, R0), {
          color: TINTA,
          width: 3,
          fill: i % 2 ? '#FBE3EC' : '#FFFFFF',
        });
        texto(c, (p.name[0] ?? '?').toUpperCase(), { x: 0, y: 22, size: 70, color: TINTA });
        texto(c, p.name.split(' ')[0], { x: 0, y: R0 + 46, size: 38, color: TINTA });
        if (p.city) texto(c, p.city, { x: 0, y: R0 + 80, size: 26, color: GRIS });
        return c;
      });
      const km = d.stats.maxKm
        ? texto(g, `${Math.round(d.stats.maxKm).toLocaleString('es-ES')} km`, {
            x: CX,
            y: 330,
            size: 64,
            color: A,
          })
        : null;
      const lema = texto(g, d.stats.maxKm > 60 ? 'y aun así, juntos' : 'cerquita, juntos', {
        x: CX,
        y: 390,
        size: 34,
        color: GRIS,
      });
      this.paint.push((t) => {
        ver(g, t > a - 0.2 && t < b + 0.8);
        if (t < a - 0.2 || t > b + 0.8) return;
        const ki = S(t, a - 0.2, 0.5);
        const ko = S(t, b - 0.2, 0.6, ease.in);
        opacidad(g, ki * (1 - ko));
        mover(g, {
          ox: CX,
          oy: 640,
          s: 1 + 0.04 * clamp01((t - a) / (b - a)) - 0.15 * ko,
          y: -120 * ko,
        });
        caras.forEach((c, i) => {
          const k = S(t, enSemi(a + 0.2) + i * semi * 2, 0.7, ease.back);
          mover(c, { x: pos[i].x, y: pos[i].y, s: 0.3 + 0.7 * k, r: (1 - k) * (i % 2 ? 20 : -20) });
          opacidad(c, Math.min(1, k * 2));
        });
        if (linea) revelar(linea, S(t, a + 0.9, 1.4, ease.inOut));
        if (km) {
          opacidad(km, S(t, a + 1.6, 0.4));
          mover(km, { ox: CX, oy: 310, s: 0.7 + 0.3 * S(t, a + 1.6, 0.6, ease.back) });
        }
        opacidad(lema, S(t, a + 2.0, 0.5));
      });
    }

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
        const hFoto = WC * 1.16;
        foto = el('g', {}, card);
        foto.setAttribute('transform', `translate(0,${y0 + hFoto / 2})`);
        const ins = instantanea(foto, p.photo, WC);
        void ins;
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
      // la frase de la foto, escrita debajo (crece con el texto)
      if (p.photo && p.text) {
        const f = ajustar(p.text, WC - 30, [38, 34, 30], 5);
        f.lines.forEach((ln, k) => {
          const id = uid('ln');
          const yy = y0 + f.size + k * f.size * 1.18;
          const clip = el(
            'rect',
            { x: -WC / 2, y: yy - f.size, width: 0, height: f.size * 1.4 },
            el('clipPath', { id }, defs),
          );
          const n = texto(g, ln, { x: 0, y: yy, size: f.size, color: TINTA });
          n.setAttribute('clip-path', `url(#${id})`);
          lineasTxt.push({ n, clip, w: WC });
        });
        y0 += f.lines.length * f.size * 1.18 + 26;
      }
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

    this.paint.push((t) => {
      const [da] = E.dias;
      const [, mb] = E.mesa;
      const on = t > da - 0.6 && t < mb + 0.9;
      ver(mundo, on);
      if (!on || !cartas.length) return;
      // ── cámara ──
      let cam = encuadre(cartas[0]);
      let giro = 0;
      E.piezas.forEach((pz, i) => {
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
      // la mesa entera
      const km = S(t, E.mesa[0], 1.8, ease.inOut);
      if (km > 0) {
        const last = encuadre(cartas[cartas.length - 1]);
        cam = {
          x: lerp(last.x, todo.x, km),
          y: lerp(last.y, todo.y, km),
          z: lerp(last.z, todo.z, km),
        };
      }
      // deriva lenta (la cámara nunca está quieta)
      const deriva = 1 + 0.025 * Math.sin((t - da) * 0.35);
      const salida = S(t, mb - 0.2, 0.8, ease.in);
      mundo.setAttribute(
        'transform',
        `translate(${CX},${centroSeguro - 260 * salida}) rotate(${giro.toFixed(2)}) scale(${(cam.z * deriva * (1 - 0.2 * salida)).toFixed(4)}) translate(${(-cam.x).toFixed(1)},${(-cam.y).toFixed(1)})`,
      );
      opacidad(mundo, S(t, da - 0.6, 0.6) * (1 - salida));
      // ── cada carta ──
      cartas.forEach((c, i) => {
        const pz = E.piezas[i];
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
        const sig = E.piezas[i + 1];
        opacidad(c.g, sig ? 1 - 0.35 * S(t, sig.a, 0.8) + 0.35 * S(t, E.mesa[0], 0.8) : 1);
      });
    });

    // la cinta de la mesa: «vuestra semana», escrita sobre la vista general
    {
      const g = el('g', {}, delante);
      const cintaM = T.tinta(g, roundRect(CX - 250, 150, 500, 96, 10), {
        color: TINTA,
        width: 2.4,
        fill: '#FFFFFF',
      });
      const txt = texto(g, `${d.kind === 'month' ? 'vuestro mes' : 'vuestra semana'}`, {
        x: CX,
        y: 215,
        size: 60,
        color: TINTA,
      });
      this.paint.push((t) => {
        const [ma, mb] = E.mesa;
        const k = S(t, ma + 1.2, 0.6, ease.back);
        const out = S(t, mb - 0.2, 0.5, ease.in);
        ver(g, t > ma + 1.1 && t < mb + 0.6);
        mover(g, { ox: CX, oy: 200, s: 0.6 + 0.4 * k, r: lerp(-8, -2, k), y: -60 * out });
        opacidad(g, Math.min(1, k * 2) * (1 - out));
        revelar(cintaM, S(t, ma + 1.2, 0.5));
        void txt;
      });
    }

    // ═════════════════════════ 5. NÚMEROS ═════════════════════════
    {
      const [na, nb] = E.numeros;
      const hoja = el('g', {}, delante);
      // la hoja de cuaderno, con su borde de arriba rasgado
      let rasgado = `M-20,120 `;
      for (let x = -20; x <= W + 20; x += 24) rasgado += `L${x},${120 + ((x * 7) % 13) - 6} `;
      rasgado += `L${W + 20},${H + 40} L-20,${H + 40} Z`;
      T.tinta(hoja, rasgado, { color: TINTA, width: 2, fill: '#FFFDF6' });
      for (let y = 230; y < H; y += 54)
        el('line', { x1: 0, y1: y, x2: W, y2: y, stroke: '#D9E3EE', 'stroke-width': 2 }, hoja);
      el('line', { x1: 86, y1: 130, x2: 86, y2: H, stroke: '#F2B8C6', 'stroke-width': 2 }, hoja);
      const titulo = texto(
        hoja,
        d.kind === 'month' ? 'el mes en números' : 'la semana en números',
        {
          x: CX,
          y: 220,
          size: 56,
          color: TINTA,
        },
      );
      const iconos = [
        'M-22,-14 L22,-14 L22,18 L-22,18 Z M-8,-14 L-4,-24 L8,-24 L12,-14 M0,2 m-9,0 a9,9 0 1,0 18,0 a9,9 0 1,0 -18,0',
        'M0,-22 L6,-6 L23,-6 L9,4 L14,21 L0,11 L-14,21 L-9,4 L-23,-6 L-6,-6 Z',
        'M0,18 C-30,-2 -24,-26 -8,-22 C-2,-20 0,-14 0,-12 C0,-14 2,-20 8,-22 C24,-26 30,-2 0,18 Z',
        'M-24,-16 L24,-16 L24,12 L-4,12 L-14,22 L-12,12 L-24,12 Z',
      ];
      const cifras = d.stats.numbers.slice(0, 4).map((x, i) => {
        const cx = i % 2 ? 520 : 200,
          cy = 360 + Math.floor(i / 2) * 210;
        const g = el('g', {}, hoja);
        const ic = T.tinta(g, iconos[i % 4], {
          color: A,
          width: 3,
          fill: i === 2 ? '#FBE3EC' : 'none',
        });
        ic.setAttribute('transform', `translate(${cx - 110},${cy - 30})`);
        const num = texto(g, '0', { x: cx + 10, y: cy + 14, size: 104, color: TINTA });
        texto(g, x.label, { x: cx + 10, y: cy + 64, size: 34, color: GRIS });
        return { g, num, n: x.n, ic };
      });
      // las barras de cada día
      const per = d.stats.perDay.slice(0, 31);
      const maxv = Math.max(1, ...per);
      const bw = Math.min(56, 520 / Math.max(1, per.length));
      const bx0 = CX - (per.length * bw) / 2;
      const barras = per.map((v, i) => {
        const hgt = 20 + (v / maxv) * 170;
        const x = bx0 + i * bw + bw * 0.15;
        const b = T.tinta(hoja, roundRect(x, 960 - hgt, bw * 0.7, hgt, 6), {
          color: TINTA,
          width: 2,
          fill: v === maxv ? A : '#FFFFFF',
        });
        return { b, x: x + bw * 0.35 };
      });
      const etiquetas =
        per.length <= 8
          ? d.stats.labels
              .slice(0, per.length)
              .map((l, i) => texto(hoja, l, { x: barras[i].x, y: 1000, size: 28, color: GRIS }))
          : [];
      const suelo = T.tinta(hoja, `M${bx0 - 10},962 L${bx0 + per.length * bw + 10},963`, {
        color: TINTA,
        width: 2.4,
      });
      this.paint.push((t) => {
        const on = t > na - 0.2 && t < nb + 1.0;
        ver(hoja, on);
        if (!on) return;
        const ks = S(t, na, 0.8, ease.out);
        const ko = S(t, nb - 0.2, 0.8, ease.in);
        mover(hoja, { y: lerp(H, 0, ks) + H * ko, r: lerp(4, 0, ks) - 3 * ko, ox: CX, oy: H });
        opacidad(titulo, S(t, na + 0.6, 0.4));
        cifras.forEach((c, i) => {
          const t0 = enSemi(na + 0.8) + i * semi * 3;
          const k = S(t, t0, 0.5, ease.back);
          mover(c.g, {
            ox: i % 2 ? 520 : 200,
            oy: 360 + Math.floor(i / 2) * 210,
            s: 0.5 + 0.5 * k,
          });
          opacidad(c.g, Math.min(1, k * 2));
          // la cifra cuenta hacia arriba
          const kc = S(t, t0, 1.1, ease.out);
          c.num.textContent = String(Math.round(c.n * kc));
          revelar(c.ic, S(t, t0 + 0.1, 0.5));
        });
        revelar(suelo, S(t, na + 1.6, 0.4));
        barras.forEach((b, i) => {
          const k = S(t, enSemi(na + 1.8) + i * semi, 0.45, ease.back);
          mover(b.b, { sy: Math.max(0.001, k), ox: b.x, oy: 962 });
          opacidad(b.b, k > 0 ? 1 : 0);
        });
        etiquetas.forEach((e, i) => opacidad(e, S(t, enSemi(na + 1.8) + i * semi + 0.2, 0.3)));
      });
    }

    // ═════════════════════════ 6. EL SOBRE ═════════════════════════
    {
      const [sa] = E.sobre;
      const g = el('g', {}, delante);
      const EW = 470,
        EH = 300,
        ex = CX - EW / 2,
        ey = 470;
      // detrás: el fondo del sobre (con la solapa abierta hacia arriba)
      const solapa = el('g', {}, g);
      T.tinta(solapa, `M${ex},${ey} L${CX},${ey + 190} L${ex + EW},${ey} Z`, {
        color: TINTA,
        width: 2.4,
        fill: '#F3E3C4',
      });
      T.tinta(g, roundRect(ex, ey, EW, EH, 10), { color: TINTA, width: 2.4, fill: '#EAD5AE' });
      // las fotos que entran
      const dentro = el('g', {}, g);
      const vuelan = (fotos.length ? fotos : []).slice(0, 10).map((f, i) => {
        const p = instantanea(dentro, f, 150);
        const ang = (i / Math.max(1, Math.min(10, fotos.length))) * Math.PI * 2 + 0.4;
        return { p, ang };
      });
      // delante: el bolsillo del sobre (tapa las fotos al entrar)
      T.tinta(
        g,
        `M${ex},${ey + 40} L${CX},${ey + 180} L${ex + EW},${ey + 40} L${ex + EW},${ey + EH} L${ex},${ey + EH} Z`,
        {
          color: TINTA,
          width: 2.4,
          fill: '#F0DDB8',
        },
      );
      // el sello
      const sello = el('g', {}, g);
      el('circle', { cx: CX, cy: ey + 150, r: 52, fill: A }, sello);
      T.tinta(sello, ellipse(CX, ey + 150, 42), { color: '#FFFFFF', width: 2, opacity: 0.7 });
      texto(sello, 'j', {
        x: CX,
        y: ey + 172,
        size: 64,
        color: '#FFFFFF',
        hand: false,
        weight: 700,
      });
      const onda = el(
        'circle',
        { cx: CX, cy: ey + 150, r: 52, fill: 'none', stroke: A, 'stroke-width': 4 },
        g,
      );
      // «junti», letra a letra
      const nombre = el(
        'text',
        {
          x: CX,
          y: 930,
          'font-size': 120,
          'font-family': 'system-ui, -apple-system, sans-serif',
          'font-weight': 700,
          fill: TINTA,
          'text-anchor': 'middle',
        },
        g,
      );
      const letras = 'junti'.split('').map((ch) => {
        const ts = el('tspan', {}, nombre);
        ts.textContent = ch;
        return ts;
      });
      const raya = T.tinta(g, `M${CX - 130},955 C${CX - 40},968 ${CX + 40},948 ${CX + 130},960`, {
        color: A,
        width: 5,
      });
      const rango = texto(g, d.range, { x: CX, y: 1005, size: 38, color: GRIS });
      const adios = texto(g, d.closing, { x: CX, y: 395, size: 46, color: A });
      this.paint.push((t) => {
        const on = t > sa - 0.3;
        ver(g, on);
        if (!on) return;
        const ke = S(t, sa, 0.8, ease.back);
        mover(g, { ox: CX, oy: ey + 150, s: 0.6 + 0.4 * ke });
        opacidad(g, Math.min(1, ke * 2));
        // las fotos vuelan desde fuera hasta dentro, una por semicorchea
        vuelan.forEach((v, i) => {
          const t0 = enSemi(sa + 0.7) + i * semi * 2;
          const k = S(t, t0, 0.8, ease.inOut);
          const r0 = 640;
          const x = lerp(CX + Math.cos(v.ang) * r0, CX, k);
          const y =
            lerp(ey + 150 + Math.sin(v.ang) * r0, ey + 120 + 40 * k, k) -
            Math.sin(Math.PI * k) * 160;
          mover(v.p, { x, y, s: lerp(1, 0.75, k), r: (1 - k) * 40 * (i % 2 ? 1 : -1) });
          opacidad(v.p, k > 0 ? 1 : 0);
        });
        // la solapa se cierra (se voltea sobre su borde de arriba)
        const tc = enSemi(sa + 0.9) + vuelan.length * semi * 2 + 0.5;
        const kf = S(t, tc, 0.5, ease.inOut);
        mover(solapa, { sy: lerp(-1, 1, kf), oy: ey });
        // cae el sello
        const kse = S(t, tc + 0.45, 0.4, ease.back);
        mover(sello, { ox: CX, oy: ey + 150, s: lerp(1.8, 1, kse) });
        opacidad(sello, Math.min(1, kse * 3));
        const ko = clamp01((t - tc - 0.6) / 0.6);
        onda.setAttribute('r', String(52 + 70 * ko));
        opacidad(onda, t > tc + 0.6 ? 1 - ko : 0);
        // el nombre
        letras.forEach((ts, i) =>
          ts.setAttribute('fill-opacity', S(t, tc + 0.9 + i * 0.11, 0.32).toFixed(3)),
        );
        revelar(raya, S(t, tc + 1.55, 0.5, ease.inOut));
        opacidad(rango, S(t, tc + 1.75, 0.4));
        opacidad(adios, S(t, tc + 2.1, 0.5));
        mover(adios, { y: 12 * (1 - S(t, tc + 2.1, 0.5)) });
      });
    }

    // ═══════════════════ SUBTÍTULOS (dentro del dibujo) ═══════════════════
    {
      const g = el('g', {}, svg);
      const nombres = new Set(d.people.map((p) => norm(p.name.split(' ')[0])).filter(Boolean));
      let clave = '';
      let palabras: { ts: SVGTSpanElement; desde: number }[] = [];
      this.paint.push((t) => {
        const seg = this.plan.voces.find((v) => t >= v.a && t < v.b + 0.4);
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
          const f = ajustar(limpia, 650, [50, 44, 40], 3);
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
                fill: TINTA,
                'text-anchor': 'middle',
              },
              g,
            );
            ln.split(' ').forEach((w, wi, arr) => {
              const ts = el('tspan', {}, tx);
              ts.textContent = w + (wi < arr.length - 1 ? ' ' : '');
              const bare = norm(w.replace(/[^\p{L}\p{N}]/gu, ''));
              if (/\d/.test(w) || nombres.has(bare)) {
                ts.setAttribute('fill', A);
                ts.setAttribute('font-family', 'Caveat_700Bold, Caveat, cursive');
              }
              const idx = text.indexOf(w.replace(/…$/, ''), pos);
              const desde = idx >= 0 ? idx : pos;
              pos = desde + w.length;
              palabras.push({ ts, desde });
            });
          });
        }
        palabras.forEach((p) =>
          p.ts.setAttribute('fill-opacity', clamp01((at - p.desde) / 5).toFixed(3)),
        );
        // la última frase de cada tramo se va fundiendo al acabar
        opacidad(g, 1 - S(t, seg.b + 0.05, 0.3));
      });
    }
    void H;
  }
}
