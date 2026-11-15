// La película del resumen: una sola animación continua, en vertical, con las
// escenas de «Rumbo a ti» contando vuestra semana o vuestro mes:
//   reloj (las fechas) → persiana → ventanilla (la vista que elige la
//   narradora) → libreta y ruta (las conexiones del grupo) → calendario y
//   cámara (cada momento, con sus fotos y comentarios) → recuerdos (las
//   cifras) → final.
// Todo es una función del tiempo: pintar(t) siempre da el mismo fotograma.

import { cloud, damped, DIGITS, ease, ellipse, lerp, roundRect, span, squircle } from '@/lib/doodle-ink';

import { dibujarEscenario } from './escenarios';
import { ESCENARIOS, type DatosPelicula, type Plan, planificar } from './guion';
import { el, lineas, mover, opacidad, revelar, Taller, texto, uid, ver, voltearX, voltearY } from './tinta';

export const STAGE = { w: 720, h: 1280 };
const CX = 360, CY = 560, L = 420;
const X0 = CX - L / 2, Y0 = CY - L / 2;

/** Colores: de noche (hasta el flash de la cámara) y de día. */
const NOCHE = { bg: '#141518', ink: '#F3F1E7', accent: '#E5568E', foco: '#23252A' };
const DIA = { bg: '#F4F3EF', ink: '#1D1F22', accent: '#C2477A' };
const CRISTAL = { glass: '#FBFAF3', ink: '#1D1F22', accent: '#C2477A' };

const tile = (inset = 0, dx = 0, dy = 0) => squircle(CX + dx, CY + dy, L - 2 * inset, L - 2 * inset);
const S = (t: number, a: number, d: number, c = ease.out) => span(t, a, d, c);

/** «La Habana» → «#rumboalahabana». */
export const tag = (...w: string[]) => '#' + w.join('').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** Una cifra de rotulador grueso. */
function cifra(T: Taller, p: Element, ch: string, x: number, y: number, h: number, color: string, weight = 14) {
  const g = el('g', { transform: `translate(${x},${y}) scale(${h / 100})` }, p);
  if (DIGITS[ch]) T.tinta(g, DIGITS[ch], { color, width: weight, amp: 0.6, step: 3, close: false });
  return g;
}

/** Cifra de paletas: cada carácter tiene su mitad de arriba y de abajo. */
class Paleta {
  private halves = new Map<string, { top: SVGGElement; bot: SVGGElement; it: SVGGElement; ib: SVGGElement }>();
  private mid: number;
  constructor(
    T: Taller,
    parent: Element,
    defs: Element,
    chars: string[],
    x: number,
    y: number,
    h: number,
    color: string,
    paper: string,
  ) {
    this.mid = y + h / 2;
    const w = h * 0.62;
    const a = uid('pa'), b = uid('pb');
    el('rect', { x: x - 12, y: y - 16, width: w + 24, height: h / 2 + 16 }, el('clipPath', { id: a }, defs));
    el('rect', { x: x - 12, y: this.mid, width: w + 24, height: h / 2 + 16 }, el('clipPath', { id: b }, defs));
    const g = el('g', {}, parent);
    for (const ch of new Set(chars)) {
      const mk = (clip: string, top: boolean) => {
        const outer = el('g', { 'clip-path': `url(#${clip})` }, g);
        const inner = el('g', {}, outer);
        el('rect', { x: x - 10, y: top ? y - 14 : this.mid, width: w + 20, height: h / 2 + 14, fill: paper }, inner);
        cifra(T, inner, ch, x, y, h, color, 14);
        return [outer, inner] as const;
      };
      const [top, it] = mk(a, true);
      const [bot, ib] = mk(b, false);
      this.halves.set(ch, { top, bot, it, ib });
    }
    el('line', { x1: x - 8, x2: x + w + 8, y1: this.mid, y2: this.mid, stroke: paper, 'stroke-width': 3 }, g);
  }
  poner(from: string, to: string, k: number) {
    const sy = (n: SVGGElement, s: number) =>
      n.setAttribute('transform', `translate(0,${this.mid}) scale(1,${Math.max(0.001, s)}) translate(0,${-this.mid})`);
    for (const [, h] of this.halves) {
      ver(h.top, false);
      ver(h.bot, false);
      sy(h.it, 1);
      sy(h.ib, 1);
    }
    const A = this.halves.get(from), B = this.halves.get(to);
    if (!A || !B) return;
    if (from === to || k >= 1 || k <= 0) {
      const X = k >= 1 ? B : A;
      ver(X.top, true);
      ver(X.bot, true);
      return;
    }
    ver(B.top, true);
    ver(A.bot, true);
    const parent = A.top.parentNode!;
    if (k < 0.5) {
      parent.appendChild(A.top);
      ver(A.top, true);
      sy(A.it, 1 - 2 * k);
    } else {
      parent.appendChild(B.bot);
      ver(B.bot, true);
      sy(B.ib, 2 * k - 1);
    }
  }
}

const ASIENTO = [
  'M372,300 C380,290 392,286 402,290 L458,348 C464,356 463,388 456,392 L384,390 C372,389 366,380 366,370 Z',
  'M382,308 C388,301 396,299 402,303 L448,352 C452,358 452,376 448,380 L390,379 C382,378 378,373 378,366 Z',
  'M314,824 L314,404 C314,392 322,386 334,386 L448,386 C462,386 472,394 472,408 L472,824',
  'M328,824 L328,412 C328,404 334,400 342,400 L452,400 C458,400 460,404 460,410 L460,824',
  'M474,824 L477,636 C478,622 488,614 500,614 L572,614 C584,614 590,622 586,634 L562,824',
  'M490,824 L491,646 C491,635 498,628 508,628 L566,628',
];
/** Los asientos del dibujo original (ventana de 304 en 640,362), a nuestra escala. */
const ESCALA_ASIENTO = L / 304;
const asientoTransform = (mirror: boolean) =>
  `translate(${CX},${CY}) scale(${mirror ? -ESCALA_ASIENTO : ESCALA_ASIENTO},${ESCALA_ASIENTO}) translate(-640,-362)`;

export class Pelicula {
  readonly plan: Plan;
  private T = new Taller();
  private paint: ((t: number) => void)[] = [];

  constructor(
    private svg: SVGSVGElement,
    private d: DatosPelicula,
  ) {
    this.plan = planificar(d);
    this.build();
  }

  pintar(t: number) {
    for (const p of this.paint) p(t);
    this.T.hervir(t);
  }

  private build() {
    const { svg, d, plan: P, T } = this;
    svg.innerHTML = '';
    svg.setAttribute('viewBox', `0 0 ${STAGE.w} ${STAGE.h}`);
    const defs = el('defs', {}, svg);
    const dayAt = P.calendario[0] + 2.15;
    const isDay = (t: number) => t >= dayAt && t < P.final[0];

    // ── Fondo plano, que cambia con el flash ──
    const base = el('rect', { x: -2000, y: -2000, width: 5000, height: 5000, fill: NOCHE.bg }, svg);
    const cam = el('g', {}, svg);
    const destello = el('circle', { r: 1, fill: DIA.bg }, cam);

    // ── Capas (de atrás adelante) ──
    const capa = (name: string) => el('g', { 'data-escena': name }, cam);
    const lVent = capa('ventanilla');
    const lReloj = capa('reloj');
    const lPers = capa('persiana');
    const lCamara = capa('camara');
    const lCal = capa('calendario');
    const lPagina = capa('pagina');
    const lTapa = capa('tapa');
    const lRec = capa('recuerdos');
    const lRot = capa('rotulos');
    const lFin = el('g', {}, svg);

    // ────────────────────────────── RELOJ ──────────────────────────────
    {
      const [a, b] = P.reloj;
      const caja = T.tinta(lReloj, tile(), { color: NOCHE.ink, width: 2.4, fill: NOCHE.bg, amp: 1.2 });
      const days = d.clock;
      const nc = days[0]?.length ?? 2;
      const h = nc <= 2 ? 230 : 150, w = h * 0.62, gap = nc <= 2 ? 44 : 16;
      const total = nc * w + (nc - 1) * gap;
      const paletas = Array.from({ length: nc }, (_, i) =>
        new Paleta(T, lReloj, defs, days.map((x) => x[i]), CX - total / 2 + i * (w + gap), CY - h / 2, h, NOCHE.ink, NOCHE.bg),
      );
      const division = T.tinta(lReloj, nc === 2 ? `M${CX},${Y0 + 4} L${CX + 1},${Y0 + L - 4}` : `M${X0 + 6},${CY} L${X0 + L - 6},${CY + 1}`, { color: NOCHE.ink, width: nc === 2 ? 2.6 : 1.2, double: nc === 2, opacity: nc === 2 ? 1 : 0.4 });
      const mes = texto(lReloj, d.header, { x: CX, y: Y0 - 26, size: 34, color: NOCHE.accent });
      const piloto = el('circle', { cx: X0 + L + 26, cy: Y0 + L - 30, r: 7, fill: NOCHE.accent }, lReloj);
      const n = days.length;
      const step = Math.min(0.3, 1.5 / Math.max(1, n - 1));
      this.paint.push((t) => {
        ver(lReloj, t < P.persiana[0] + 0.7);
        revelar(caja, S(t, a, 0.45, ease.inOut));
        revelar(division, S(t, a + 0.15, 0.3));
        opacidad(mes, S(t, a + 0.3, 0.3));
        opacidad(piloto, S(t, a + 0.4, 0.1) * (Math.floor(t * 2.2) % 2 ? 0.3 : 1));
        // las paletas corren por los días del periodo
        const pos = Math.max(0, Math.min(n - 1, (t - (a + 0.6)) / step));
        const i = Math.min(n - 1, Math.floor(pos));
        const k = i >= n - 1 ? 0 : ease.in(pos - i);
        const from = days[i], to = days[Math.min(n - 1, i + 1)];
        paletas.forEach((pp, j) => pp.poner(from[j], to[j], k));
        void b;
      });
    }

    // ───────────────────────────── PERSIANA ─────────────────────────────
    {
      const [a] = P.persiana;
      const idF = uid('pf'), idR = uid('pr');
      el('path', { d: tile(4) }, el('clipPath', { id: idF }, defs));
      const rollo = el('rect', { x: X0 - 10, y: Y0, width: L + 20, height: 0 }, el('clipPath', { id: idR }, defs));
      const dentro = el('g', { 'clip-path': `url(#${idF})` }, lPers);
      const lamas = el('g', { 'clip-path': `url(#${idR})` }, dentro);
      el('rect', { x: X0, y: Y0, width: L, height: L, fill: NOCHE.ink }, lamas);
      let dd = '';
      for (let y = Y0 + 9; y < Y0 + L; y += 15.4) dd += `M${X0 - 4},${y.toFixed(1)} L${X0 + L + 4},${(y + 1).toFixed(1)} `;
      T.tinta(lamas, dd, { color: NOCHE.bg, width: 5.4, amp: 0.5, step: 12 });
      T.tinta(lamas, `M${CX},${Y0} L${CX + 1},${Y0 + L} M${CX - 44},${Y0} L${CX - 43},${Y0 + L}`, { color: NOCHE.bg, width: 6 });
      const barra = el('g', {}, dentro);
      el('rect', { x: X0, y: -10, width: L, height: 12, fill: NOCHE.ink }, barra);
      T.tinta(barra, `M${X0},-10 L${X0 + L},-9 M${X0},2 L${X0 + L},2.5`, { color: NOCHE.bg, width: 3.4 });
      const marco = T.tinta(lPers, tile(), { color: NOCHE.ink, width: 7, double: true, amp: 1.3 });
      const cordon = el('g', {}, lPers);
      const hilo = T.tinta(cordon, `M${X0 - 40},${Y0 - 16} L${X0 - 41},${Y0 + 200} L${X0 - 40},${Y0 + 400}`, { color: NOCHE.ink, width: 2 });
      const bola = el('circle', { cx: X0 - 40, cy: Y0 + 404, r: 6.4, fill: NOCHE.accent }, cordon);
      this.paint.push((t) => {
        ver(lPers, t >= a && t < P.persiana[1]);
        const baja = S(t, a + 0.1, 0.46, ease.inOut);
        const sube = S(t, a + 1.7, 0.46, ease.inOut);
        const reb = t > a + 0.56 ? damped(t, a + 0.56, 3, 7) * 0.025 : 0;
        const k = Math.min(1.03, Math.max(0, baja * (1 + reb) * (1 - sube)));
        rollo.setAttribute('height', (L * k).toFixed(1));
        barra.setAttribute('transform', `translate(0,${(Y0 + L * k).toFixed(1)})`);
        ver(barra, k > 0.01 && k < 1);
        opacidad(marco, S(t, a + 0.1, 0.3) * (1 - S(t, a + 1.9, 0.3)));
        const kc = S(t, a + 0.12, 0.36);
        revelar(hilo, kc);
        opacidad(bola, kc > 0.95 ? 1 : 0);
        const tiron = Math.sin(Math.PI * S(t, a + 1.5, 0.2, ease.linear)) * 26;
        const giro = damped(t, a + 0.35, 1.2, 1.6) * 7 + damped(t, a + 1.7, 1.4, 2.5) * 5;
        mover(cordon, { ox: X0 - 40, oy: Y0 - 16, r: giro, sy: 1 + tiron / 400 });
        opacidad(cordon, 1 - S(t, a + 1.95, 0.3));
      });
    }

    // ──────────────────────────── VENTANILLA ────────────────────────────
    {
      const [a, b] = P.ventanilla;
      const veh = ESCENARIOS.find((e) => e.id === d.scenario)?.vehiculo ?? 'tren';
      const foco = el('circle', { cx: CX, cy: CY + 120, r: 470, fill: NOCHE.foco }, lVent);
      const asientos = el('g', {}, lVent);
      const trazos: Element[] = [];
      if (veh === 'tren' || veh === 'avion')
        for (const mirror of [false, true]) {
          const g = el('g', { transform: asientoTransform(mirror) }, asientos);
          for (const p of ASIENTO) trazos.push(T.tinta(g, p, { color: NOCHE.ink, width: 1.3, amp: 1, opacity: 0.8 }));
        }
      if (veh === 'barco') {
        // la pared de madera del camarote
        for (let i = -3; i <= 3; i++) trazos.push(T.tinta(asientos, `M-100,${CY + i * 90} L820,${CY + i * 90 + 3}`, { color: NOCHE.ink, width: 1.2, opacity: 0.45 }));
      }
      if (veh === 'casa') {
        trazos.push(T.tinta(asientos, `M${X0 - 60},${Y0 - 40} C${X0 - 10},${CY} ${X0 - 30},${CY + 200} ${X0 - 80},${Y0 + L + 120}`, { color: NOCHE.ink, width: 2 }));
        trazos.push(T.tinta(asientos, `M${X0 + L + 60},${Y0 - 40} C${X0 + L + 10},${CY} ${X0 + L + 30},${CY + 200} ${X0 + L + 80},${Y0 + L + 120}`, { color: NOCHE.ink, width: 2 }));
        trazos.push(T.tinta(asientos, `M${X0 - 90},${Y0 + L + 40} L${X0 + L + 90},${Y0 + L + 42}`, { color: NOCHE.ink, width: 3 }));
      }
      // la forma de la ventana según el vehículo
      const forma = (inset: number) =>
        veh === 'barco'
          ? ellipse(CX, CY, L / 2 - inset, L / 2 - inset)
          : veh === 'avion'
            ? squircle(CX, CY, L - 2 * inset - 40, L - 2 * inset, 2.8)
            : tile(inset);
      const ventana = el('g', {}, lVent);
      T.tinta(ventana, forma(0), { color: NOCHE.ink, width: 2.2, fill: NOCHE.ink, amp: 1.2 });
      T.tinta(ventana, forma(12), { color: CRISTAL.ink, width: 2, fill: CRISTAL.glass, amp: 1 });
      const idC = uid('cr');
      el('path', { d: forma(14) }, el('clipPath', { id: idC }, defs));
      const cristal = el('g', { 'clip-path': `url(#${idC})` }, ventana);
      const vista = el('g', { transform: `translate(${CX - 190},${CY - 190})` }, cristal);
      el('rect', { x: -20, y: -20, width: 420, height: 420, fill: CRISTAL.glass }, vista);
      const mueve = dibujarEscenario(d.scenario, T, vista, CRISTAL);
      if (veh === 'barco')
        for (let i = 0; i < 12; i++) {
          const ang = (i / 12) * Math.PI * 2;
          el('circle', { cx: CX + Math.cos(ang) * (L / 2 - 6), cy: CY + Math.sin(ang) * (L / 2 - 6), r: 4, fill: NOCHE.bg }, ventana);
        }
      if (veh === 'casa') T.tinta(ventana, `M${CX},${Y0 + 12} L${CX},${Y0 + L - 12} M${X0 + 12},${CY} L${X0 + L - 12},${CY}`, { color: NOCHE.ink, width: 7 });
      T.tinta(ventana, forma(14), { color: CRISTAL.ink, width: 1.2, amp: 1.2 });
      const vaso = el('g', {}, lVent);
      if (veh === 'tren' || veh === 'avion') {
        T.tinta(lVent, roundRect(CX - 128, Y0 + L + 30, 256, 20, 8), { color: NOCHE.ink, width: 2 });
        T.tinta(vaso, `M${CX - 80},${Y0 + L - 16} L${CX - 48},${Y0 + L - 16} L${CX - 52},${Y0 + L + 30} L${CX - 76},${Y0 + L + 30} Z`, { color: NOCHE.accent, width: 1.4, fill: NOCHE.accent });
      }
      const apagado = T.tinta(lVent, tile(), { width: 0, fill: NOCHE.bg });
      this.paint.push((t) => {
        ver(lVent, t >= a - 0.4 && t < b + 0.2);
        if (t < a - 0.4 || t > b + 0.2) return;
        const sale = S(t, b - 0.8, 0.6, ease.inOut);
        const kf = S(t, a + 0.2, 0.8) * (1 - sale);
        mover(foco, { ox: CX, oy: CY + 120, s: Math.max(0.001, kf) });
        trazos.forEach((n, i) => revelar(n, S(t, a + 0.5 + i * 0.05, 0.6, ease.inOut)));
        mover(asientos, { x: -160 * sale });
        opacidad(asientos, 1 - sale * 1.4);
        const kv = S(t, a + 1.0, 0.4, ease.in);
        mover(vaso, { y: -50 * (1 - kv) + damped(t, a + 1.4, 4, 9) * -4 });
        opacidad(vaso, kv * 3 * (1 - sale));
        mueve(t);
        opacidad(apagado, sale);
        opacidad(ventana, 1 - S(t, b - 0.6, 0.3));
      });
    }

    // ─────────────────────── LIBRETA: TAPA Y PÁGINA ───────────────────────
    const [la, lb] = P.libreta;
    {
      // la tapa
      const tapa = el('g', {}, lTapa);
      const relleno = T.tinta(tapa, tile(), { width: 0, fill: NOCHE.bg });
      const borde = T.tinta(tapa, tile(), { color: NOCHE.ink, width: 2.2, amp: 1.3 });
      const nombre = texto(tapa, d.group.toUpperCase().slice(0, 22), { x: CX, y: Y0 + L - 34, size: 18, hand: false, weight: 600, spacing: 4, color: NOCHE.ink });
      const goma = el('path', { fill: 'none', stroke: NOCHE.ink, 'stroke-width': 9, 'stroke-linecap': 'round' }, lTapa);
      const tension = el('path', { fill: 'none', stroke: NOCHE.accent, 'stroke-width': 2, 'stroke-linecap': 'round' }, lTapa);
      this.paint.push((t) => {
        ver(lTapa, t >= la && t < la + 3.4);
        if (t < la || t > la + 3.4) return;
        revelar(borde, S(t, la, 0.55, ease.inOut));
        opacidad(relleno, S(t, la + 0.3, 0.25));
        opacidad(nombre, S(t, la + 0.6, 0.4));
        const ke = S(t, la + 1.0, 0.42), ks = S(t, la + 1.6, 0.24, ease.in);
        const vib = damped(t, la + 1.42, 5, 6);
        const x = 900 - (900 - (X0 + L - 4)) * ke + 300 * ks;
        const comba = 60 * (1 - ke) + 40 * vib + 44 * ks;
        const on = ke > 0 && ks < 1;
        ver(goma, on);
        ver(tension, on);
        if (on) {
          goma.setAttribute('d', `M${x.toFixed(1)},${Y0 - 6} Q${(x + comba).toFixed(1)},${CY} ${x.toFixed(1)},${Y0 + L + 6}`);
          const lg = 40 * (1 - ke * 0.6) + 26 * ks + 14 * Math.abs(vib);
          tension.setAttribute('d', `M${x + 6},${Y0 - 6} l${lg},0 M${x + 6},${Y0 + L + 6} l${lg},0`);
        }
        const ka = S(t, la + 1.85, 0.62, ease.inOut), kt = S(t, la + 2.45, 0.42, ease.in);
        voltearX(tapa, Math.PI * ka * 0.97, X0, CY);
        if (kt > 0) tapa.setAttribute('transform', `translate(${(-300 * kt).toFixed(1)},0) ${tapa.getAttribute('transform')}`);
        opacidad(tapa, 1 - kt);
      });
    }
    {
      // la página: las conexiones del grupo
      const hoja = el('g', {}, lPagina);
      const cinta = el('path', { d: `M${X0 + 18},${Y0 + L - 50} l16,0 l0,130 l-8,-10 l-8,10 Z`, fill: NOCHE.accent }, lPagina);
      lPagina.insertBefore(cinta, hoja);
      const delante = el('g', {}, hoja);
      T.tinta(delante, tile(0, 9, 7), { color: NOCHE.ink, width: 1.4, fill: '#E6E3D6' });
      T.tinta(delante, tile(0, 4, 3), { color: '#CFCBB8', width: 1.2, fill: NOCHE.ink });
      T.tinta(delante, tile(), { color: NOCHE.ink, width: 1.8, fill: NOCHE.ink, double: true });
      let r = '';
      for (let y = Y0 + 70; y < Y0 + L - 20; y += 40) r += `M${X0 + 30},${y} L${X0 + L - 30},${y + 0.5} `;
      T.tinta(delante, r, { color: '#CFCBB8', width: 2, step: 10 });
      texto(delante, d.range, { x: X0 + 34, y: Y0 + 54, size: 30, color: DIA.ink, anchor: 'start' });
      // los puntos del mapa (las casas de cada uno, o los lugares de la historia),
      // proyectados en la página
      const M = d.mapa.points;
      const placed = M.filter((p) => p.lat != null && p.lng != null);
      const pts = (() => {
        const area = { x: X0 + 70, y: Y0 + 110, w: L - 140, h: L - 190 };
        if (placed.length < 2)
          return M.slice(0, 6).map((p, i, all) => {
            const ang = (i / Math.max(1, all.length)) * Math.PI * 2 - Math.PI / 2;
            return { p, x: CX + Math.cos(ang) * 110, y: CY + 20 + Math.sin(ang) * 90 };
          });
        const xs = placed.map((p) => p.lng!), ys = placed.map((p) => -p.lat!);
        const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
        const sc = Math.min(area.w / Math.max(1e-6, x1 - x0), area.h / Math.max(1e-6, y1 - y0));
        const ox = area.x + (area.w - (x1 - x0) * sc) / 2, oy = area.y + (area.h - (y1 - y0) * sc) / 2;
        return placed.map((p) => ({ p, x: ox + (p.lng! - x0) * sc, y: oy + (-p.lat! - y0) * sc }));
      })();
      if (!d.mapa.chronological) pts.sort((A, B) => A.x - B.x);
      // juntar los que caen en el mismo sitio
      const groups: { x: number; y: number; names: string[]; city?: string; lat?: number; lng?: number }[] = [];
      for (const q of pts) {
        const g = groups.find((G) => Math.hypot(G.x - q.x, G.y - q.y) < 30);
        if (g && !d.mapa.chronological) g.names.push(q.p.title);
        else if (!g) groups.push({ x: q.x, y: q.y, names: [q.p.title], city: q.p.subtitle, lat: q.p.lat, lng: q.p.lng });
      }
      const ruta = el('g', {}, delante);
      const tramos = groups.slice(1).map((g, i) => {
        const p0 = groups[i];
        const mx = (p0.x + g.x) / 2, my = Math.min(p0.y, g.y) - 40 - Math.abs(g.x - p0.x) * 0.15;
        return `M${p0.x},${p0.y} Q${mx},${my} ${g.x},${g.y}`;
      });
      const idM = uid('rm');
      const mask = el('mask', { id: idM, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: STAGE.w, height: STAGE.h }, defs);
      const guias = tramos.map((dd) => el('path', { d: dd, fill: 'none', stroke: '#fff', 'stroke-width': 12, 'stroke-linecap': 'round', pathLength: 1 }, mask));
      const rg = el('g', { mask: `url(#${idM})` }, ruta);
      tramos.forEach((dd) => T.tinta(rg, dd, { color: '#3A3A36', width: 2.6, dash: '9 8', cap: 'butt', amp: 0.6 }));
      const puntos = groups.map((g) => {
        const n = el('g', {}, delante);
        el('circle', { cx: g.x, cy: g.y, r: 8, fill: NOCHE.accent }, n);
        texto(n, g.names.join(', ').slice(0, 26), { x: g.x, y: g.y + 32, size: 26, color: DIA.ink });
        if (g.city) texto(n, g.city, { x: g.x, y: g.y + 56, size: 20, color: '#6B6A62' });
        return n;
      });
      const kms = groups.slice(1).map((g, i) => {
        const p0 = groups[i];
        const km = Math.round(haversine(p0, g));
        return texto(delante, km > 30 ? `${km.toLocaleString('es-ES')} km` : '', { x: (p0.x + g.x) / 2, y: Math.min(p0.y, g.y) - 60 - Math.abs(g.x - p0.x) * 0.08, size: 24, color: DIA.accent });
      });
      const dorso = el('g', {}, hoja);
      T.tinta(dorso, tile(), { color: NOCHE.ink, width: 2, fill: NOCHE.bg });
      // la pluma
      const hiloPluma = el('path', { fill: 'none', stroke: NOCHE.ink, 'stroke-width': 2 }, lPagina);
      const pluma = el('g', {}, lPagina);
      const po = { color: NOCHE.ink, width: 2, amp: 0.4, step: 4 };
      T.tinta(pluma, 'M0,0 L18,-6 L18,6 Z', { ...po, fill: NOCHE.ink });
      T.tinta(pluma, 'M18,-9 L132,-10 L132,10 L18,9 Z', { ...po, fill: NOCHE.bg });
      T.tinta(pluma, 'M132,-10 L144,-10 L144,10 L132,10 Z', { ...po, fill: NOCHE.accent });
      mover(pluma, {});
      const medidor = el('path', {}, defs);
      const t0 = la + 3.0, t1 = lb - 1.5;
      const per = tramos.length ? (t1 - t0) / tramos.length : 0;
      this.paint.push((t) => {
        ver(lPagina, t >= la + 0.3 && t < lb + 0.6);
        if (t < la + 0.3 || t > lb + 0.6) return;
        const kc = S(t, la + 0.4, 0.3);
        mover(cinta, { y: -120 * (1 - kc) });
        opacidad(cinta, kc * 3);
        puntos.forEach((n, i) => {
          const k = S(t, la + 2.8 + i * 0.25, 0.35, ease.linear);
          opacidad(n, k * 3);
          mover(n, { ox: groups[i].x, oy: groups[i].y, s: 0.4 + 0.6 * ease.back(k) });
        });
        guias.forEach((gp, i) => {
          const k = S(t, t0 + i * per, per * 0.9, ease.inOut);
          gp.style.strokeDasharray = '1 2';
          gp.style.strokeDashoffset = String(1 - k);
          opacidad(kms[i], S(t, t0 + (i + 0.85) * per, 0.3));
        });
        // la punta de la pluma sigue el tramo que se dibuja
        let px = CX - 260, py = CY + 420, rot = 140;
        const ke = S(t, t0 - 0.6, 0.6), ks = S(t, t1, 0.6, ease.in);
        if (tramos.length && t >= t0 && t < t1) {
          const i = Math.min(tramos.length - 1, Math.floor((t - t0) / per));
          const k = ease.inOut(Math.min(1, ((t - t0) - i * per) / (per * 0.9)));
          medidor.setAttribute('d', tramos[i]);
          const Lm = medidor.getTotalLength();
          const q = medidor.getPointAtLength(Lm * k);
          px = q.x;
          py = q.y;
        } else if (t < t0) {
          const g0 = groups[0] ?? { x: CX, y: CY };
          px = lerp(CX - 260, g0.x, ke);
          py = lerp(CY + 420, g0.y, ke);
          rot = 150 - 10 * (1 - ke);
        } else {
          const gl = groups[groups.length - 1] ?? { x: CX, y: CY };
          px = lerp(gl.x, CX + 300, ks);
          py = lerp(gl.y, CY + 520, ks);
          rot = 140 - 60 * ks;
        }
        const on = ke > 0 && ks < 1;
        ver(pluma, on);
        ver(hiloPluma, on);
        if (on) {
          mover(pluma, { x: px, y: py, r: rot, s: 1.2 });
          const ang = (rot * Math.PI) / 180;
          const cx2 = px + Math.cos(ang) * 173, cy2 = py + Math.sin(ang) * 173;
          hiloPluma.setAttribute('d', `M${CX - 200},-60 Q${(CX - 200 + cx2) / 2 - 40},${(cy2 - 60) / 2 + 60} ${cx2.toFixed(1)},${cy2.toFixed(1)}`);
        }
        // al final, la hoja se levanta y descubre el calendario
        const kv = S(t, lb - 0.5, 0.45, ease.inOut);
        const frente = voltearY(hoja, Math.PI * kv, Y0, CX);
        ver(delante, frente);
        ver(dorso, !frente);
        opacidad(cinta, kc * 3 * (1 - kv * 2));
        opacidad(hoja, 1 - S(t, lb + 0.1, 0.3));
      });
    }

    // ─────────────────── CALENDARIO, CÁMARA Y MOMENTOS ───────────────────
    {
      const [ca, cb] = P.calendario;
      // el calendario (día a día)
      const cal = el('g', {}, lCal);
      T.tinta(cal, tile(0, 0, 22), { color: NOCHE.ink, width: 1.6, fill: NOCHE.bg });
      T.tinta(cal, tile(0, 0, 11), { color: NOCHE.ink, width: 1.4, fill: NOCHE.bg });
      T.tinta(cal, tile(), { color: NOCHE.ink, width: 2.4, fill: NOCHE.bg });
      const idT = uid('ct');
      el('path', { d: tile(2) }, el('clipPath', { id: idT }, defs));
      const cab = el('g', { 'clip-path': `url(#${idT})` }, cal);
      el('rect', { x: X0, y: Y0, width: L, height: 64, fill: NOCHE.accent }, cab);
      texto(cal, d.header.toUpperCase(), { x: CX, y: Y0 + 46, size: 40, color: NOCHE.bg });
      const dias = [...new Set(d.pieces.map((p) => p.badge))];
      if (!dias.length) dias.push(d.clock[0]);
      const twoDigits = dias;
      const nb = Math.max(...dias.map((x) => x.length));
      const h = nb <= 2 ? 200 : 120, w = h * 0.62, gap = nb <= 2 ? 28 : 12;
      const tot = nb * w + (nb - 1) * gap;
      const pal = Array.from({ length: nb }, (_, i) =>
        new Paleta(T, cal, defs, dias.map((x) => x.padStart(nb, ' ')[i]), CX - tot / 2 + i * (w + gap), CY - h / 2 + 34, h, NOCHE.ink, NOCHE.bg),
      );
      const flipTo = (a: string, b: string, k: number) => {
        const A = a.padStart(nb, ' '), B = b.padStart(nb, ' ');
        pal.forEach((p, i) => p.poner(A[i], B[i], k));
      };
      // la cámara instantánea
      const camara = el('g', {}, lCamara);
      const idK = uid('ck');
      el('path', { d: tile(1) }, el('clipPath', { id: idK }, defs));
      T.tinta(camara, tile(), { width: 0, fill: NOCHE.ink });
      const banda = el('g', { 'clip-path': `url(#${idK})` }, camara);
      T.tinta(banda, `M${X0 - 20},${Y0 + 90} L${X0 + L + 20},${Y0 + 91} L${X0 + L + 20},${Y0 + 300} L${X0 - 20},${Y0 + 299} Z`, { color: DIA.ink, width: 2, fill: DIA.ink });
      T.tinta(camara, `M${X0 + 40},${Y0 + 345} L${X0 + L - 40},${Y0 + 346}`, { color: DIA.ink, width: 12 });
      const visor = el('rect', { x: X0 + 82, y: Y0 + 26, width: 84, height: 46, rx: 6, fill: '#FFFFFF', opacity: 0 }, camara);
      T.tinta(camara, roundRect(X0 + 80, Y0 + 24, 88, 50, 7), { color: DIA.ink, width: 2.4 });
      T.tinta(camara, ellipse(CX, Y0 + 195, 72), { color: NOCHE.ink, width: 2, fill: NOCHE.ink });
      T.tinta(camara, ellipse(CX, Y0 + 195, 58), { color: DIA.ink, width: 2, fill: DIA.ink });
      T.tinta(camara, ellipse(CX, Y0 + 195, 46), { color: DIA.ink, width: 3, fill: NOCHE.ink });
      T.tinta(camara, `M${CX - 28},${Y0 + 182} C${CX - 24},${Y0 + 168} ${CX - 12},${Y0 + 160} ${CX + 2},${Y0 + 158}`, { color: DIA.ink, width: 2 });
      el('circle', { cx: X0 + L - 70, cy: Y0 + 252, r: 22, fill: DIA.accent }, camara);
      const bordeCam = T.tinta(camara, tile(), { color: NOCHE.ink, width: 2.4 });
      const bordeCamDia = T.tinta(camara, tile(), { color: DIA.ink, width: 2.6 });
      // la ranura de la cámara (la cámara está 60 px más abajo que el mosaico)
      const RANURA = Y0 + 352 + 60;

      // los momentos: un marco (la ventana con cortinas) para cada uno
      const idS = uid('sl');
      el('rect', { x: -500, y: RANURA, width: 2000, height: 1200 }, el('clipPath', { id: idS }, defs));
      const marcos = d.pieces.map((p) => {
        const g = el('g', {}, lCamara);
        const mov = el('g', {}, g);
        const card = el('g', {}, mov);
        marco(T, card, defs, p.photo, p.text, p.wave);
        const notas = p.comments.slice(0, 2).map((c, j) => {
          const n = el('g', {}, g);
          const x = j % 2 ? CX + 70 : CX - 270, y = Y0 + L + 40 + j * 70;
          T.tinta(n, roundRect(x, y, 200, 110, 10), { color: DIA.ink, width: 2, fill: j % 2 ? '#FFF6B8' : '#FFFFFF' });
          const ls = lineas(`${c.who}: ${c.text}`, 18, 3);
          ls.forEach((ln, k) => texto(n, ln, { x: x + 14, y: y + 34 + k * 26, size: 24, color: DIA.ink, anchor: 'start' }));
          return { n, x: x + 100, y: y + 55, r: j % 2 ? 4 : -5 };
        });
        const pega = el('g', {}, g);
        if (p.reactions.length) {
          el('circle', { cx: X0 + L - 10, cy: Y0 + 14, r: 34, fill: '#FFFFFF', stroke: DIA.ink, 'stroke-width': 2 }, pega);
          texto(pega, [...new Set(p.reactions)].slice(0, 2).join(''), { x: X0 + L - 10, y: Y0 + 26, size: 30, hand: false });
          if (p.reactions.length > 2) texto(pega, `${p.reactions.length}`, { x: X0 + L + 30, y: Y0 - 14, size: 26, color: DIA.accent });
        }
        const pie = el('g', {}, g);
        texto(pie, [p.author, p.when, p.place].filter(Boolean).join(' · '), { x: CX, y: Y0 - 30, size: 30, color: DIA.ink });
        const tension = el('path', { fill: 'none', stroke: DIA.accent, 'stroke-width': 2 }, g);
        return { p, g, mov, card, notas, pega, pie, tension };
      });
      const tCal = { sube: ca + 0.9, flash: ca + 1.95 };
      this.paint.push((t) => {
        const on = t >= ca - 0.2 && t < cb + 1.6;
        ver(lCal, on);
        ver(lCamara, on);
        if (!on) return;
        // el calendario sube y se hace pequeño: es el contador de días
        const ku = S(t, tCal.sube, 0.7, ease.inOut);
        mover(cal, { ox: CX, oy: Y0, s: lerp(1, 0.36, ku), y: lerp(0, -Y0 + 30, ku) });
        opacidad(cal, 1 - S(t, cb - 0.2, 0.4));
        // qué día enseña
        let di = 0, k = 0;
        P.piezas.forEach((pz, i) => {
          if (t >= pz.a) {
            const prev = i ? dias.indexOf(d.pieces[i - 1].badge) : 0;
            const cur = dias.indexOf(d.pieces[i].badge);
            if (cur !== prev) {
              const kk = S(t, pz.a, 0.35, ease.in);
              di = kk >= 1 ? cur : prev;
              k = kk >= 1 ? 0 : kk;
              if (kk < 1) flipTo(twoDigits[prev], twoDigits[cur], kk);
            } else di = cur;
          }
        });
        if (k === 0) flipTo(twoDigits[di], twoDigits[di], 0);
        // la cámara aparece debajo
        const kcam = S(t, tCal.sube + 0.2, 0.5, ease.linear);
        mover(camara, { ox: CX, oy: CY, s: 0.6 + 0.4 * ease.back(kcam), y: 60 });
        opacidad(camara, kcam * 3 * (1 - S(t, cb - 0.1, 0.4)));
        visor.setAttribute('opacity', String(Math.sin(Math.PI * S(t, tCal.flash - 0.15, 0.2, ease.linear))));
        ver(bordeCam, !isDay(t));
        ver(bordeCamDia, isDay(t));
        // cada momento: sale por la ranura, salta, se despliega; al final se va
        marcos.forEach((m, i) => {
          const pz = P.piezas[i];
          const vis = t >= pz.a && t < pz.b + 0.1;
          ver(m.g, vis);
          if (!vis) return;
          const ke = S(t, pz.a, 0.6);
          const ksu = S(t, pz.a + 0.6, 0.24, ease.in);
          const kd = S(t, pz.a + 0.84, 0.36, (x) => 1 + 1.9 * (x - 1) ** 3 + 0.9 * (x - 1) ** 2);
          const kx = S(t, pz.b - 0.45, 0.45, ease.in);
          const enRanura = t < pz.a + 0.6;
          m.mov.setAttribute('clip-path', enRanura ? `url(#${idS})` : '');
          const fuera = RANURA - Y0 - L; // con este desplazamiento, el borde de abajo está en la ranura
          if (enRanura) mover(m.card, { y: lerp(fuera, fuera + 200, ke) });
          else if (t < pz.a + 0.84) mover(m.card, { y: lerp(fuera + 200, 60, ksu), ox: CX, oy: Y0, sy: lerp(1, 0.1, ksu) });
          else mover(m.card, { y: 60, ox: CX, oy: Y0, sy: lerp(0.1, 1, kd) });
          mover(m.mov, { x: -520 * kx, r: -14 * kx, ox: CX, oy: CY });
          opacidad(m.mov, 1 - kx);
          m.tension.setAttribute('d', enRanura && ke > 0 ? `M${X0 + 10},${RANURA + 6} l0,${200 * ke} M${X0 + L - 10},${RANURA + 6} l0,${200 * ke}` : '');
          m.notas.forEach((n, j) => {
            const kn = S(t, pz.a + 1.5 + j * 0.6, 0.4, ease.linear);
            mover(n.n, { ox: n.x, oy: n.y, s: 0.5 + 0.5 * ease.back(kn), r: n.r, y: 60 });
            opacidad(n.n, kn * 3 * (1 - kx));
          });
          const kp = S(t, pz.a + 1.2, 0.35, ease.linear);
          mover(m.pega, { ox: X0 + L - 10, oy: Y0 + 14, s: 0.4 + 0.6 * ease.back(kp), y: 60 });
          opacidad(m.pega, kp * 3 * (1 - kx));
          opacidad(m.pie, S(t, pz.a + 1.0, 0.4) * (1 - kx));
          mover(m.pie, { y: 60 - 10 * (1 - S(t, pz.a + 1.0, 0.4)) });
        });
      });
    }

    // ───────────────────────────── RECUERDOS ─────────────────────────────
    {
      const [ra, rb] = P.recuerdos;
      const G = L + 28;
      const cells: { cx: number; cy: number; g: SVGGElement; dist: number }[] = [];
      const celda = (i: number, j: number, draw: (g: SVGGElement, x: number, y: number) => void) => {
        const cx = CX + i * G, cy = CY + j * G;
        const g = el('g', {}, lRec);
        T.tinta(g, squircle(cx, cy, L, L), { color: DIA.ink, width: 3, fill: '#FFFFFF' });
        draw(g, cx, cy);
        cells.push({ cx, cy, g, dist: Math.hypot(i, j) });
      };
      const loved = d.pieces.find((p) => p.id === d.lovedId) ?? d.pieces.find((p) => p.photo) ?? d.pieces[0];
      // el centro: lo que más os llegó
      celda(0, 0, (g) => {
        if (loved) {
          const c = el('g', {}, g);
          marco(T, c, defs, loved.photo, loved.text, loved.wave);
        }
      });
      const numero = (g: SVGGElement, x: number, y: number, n: number, label: string, color = DIA.ink) => {
        const s = String(n);
        const h = 150, step = h * 0.76;
        const w0 = s.length * step - h * 0.16;
        [...s].forEach((ch, k) => cifra(T, g, ch, x - w0 / 2 + k * step, y - 120, h, color, 15));
        texto(g, label, { x, y: y + 110, size: 44, color: DIA.ink });
      };
      const [n0, n1, n2, n3] = d.stats.numbers;
      celda(-1, -1, (g, x, y) => numero(g, x, y, n0.n, n0.label));
      celda(1, -1, (g, x, y) => numero(g, x, y, n1.n, n1.label));
      let corazon: Element | null = null;
      celda(-1, 0, (g, x, y) => {
        corazon = T.tinta(g, `M${x},${y - 20} C${x - 50},${y - 70} ${x - 110},${y - 40} ${x - 100},${y - 90} C${x - 92},${y - 130} ${x - 30},${y - 130} ${x},${y - 92} C${x + 30},${y - 130} ${x + 92},${y - 130} ${x + 100},${y - 90} C${x + 110},${y - 40} ${x + 50},${y - 70} ${x},${y - 20} Z`, { color: DIA.ink, width: 3, fill: DIA.accent });
        numero(g, x, y + 60, n2.n, n2.label);
      });
      celda(1, 0, (g, x, y) => {
        T.tinta(g, `M${x - 90},${y - 140} L${x + 90},${y - 140} L${x + 90},${y - 50} L${x - 20},${y - 50} L${x - 50},${y - 20} L${x - 50},${y - 50} L${x - 90},${y - 50} Z`, { color: DIA.ink, width: 3 });
        numero(g, x, y + 60, n3.n, n3.label);
      });
      celda(0, -1, (g, x, y) => {
        const v = d.stats.perDay, max = Math.max(1, ...v), n = v.length;
        const slot = 330 / n, bw = Math.min(34, slot * 0.6), base = y + 90;
        T.tinta(g, `M${x - 175},${base} L${x + 175},${base + 1}`, { color: DIA.ink, width: 2.4 });
        const top = v.indexOf(max);
        v.forEach((val, i) => {
          const cx = x - 165 + slot * i + slot / 2, hh = Math.max(val ? 8 : 2, (val / max) * 200);
          if (i === top) el('rect', { x: cx - bw / 2, y: base - hh, width: bw, height: hh, fill: DIA.accent }, g);
          T.tinta(g, `M${cx - bw / 2},${base} L${cx - bw / 2},${base - hh} L${cx + bw / 2},${base - hh} L${cx + bw / 2},${base}`, { color: DIA.ink, width: 2.4, amp: 0.5 });
          texto(g, d.stats.labels[i], { x: cx, y: base + 36, size: n > 6 ? 26 : 22, color: DIA.ink });
        });
        texto(g, d.stats.chartTitle, { x, y: y - 150, size: 36, color: '#6B6A62' });
      });
      celda(-1, 1, (g, x, y) => {
        T.tinta(g, `M${x - 140},${y - 60} Q${x},${y - 150} ${x + 140},${y - 60}`, { color: DIA.ink, width: 3, dash: '12 10', cap: 'butt' });
        el('circle', { cx: x - 140, cy: y - 60, r: 9, fill: DIA.accent }, g);
        el('circle', { cx: x + 140, cy: y - 60, r: 9, fill: DIA.accent }, g);
        texto(g, d.stats.maxKm > 30 ? `${Math.round(d.stats.maxKm).toLocaleString('es-ES')} km` : 'muy cerca', { x, y: y + 40, size: 64, color: DIA.ink });
        texto(g, 'entre vosotros', { x, y: y + 100, size: 40, color: '#6B6A62' });
      });
      celda(0, 1, (g, x, y) => {
        const ps = d.people.slice(0, 6);
        ps.forEach((p, i) => {
          const px = x + (i - (ps.length - 1) / 2) * 62, py = y - 30 + (i % 2) * 20;
          T.tinta(g, ellipse(px, py, 28), { color: DIA.ink, width: 2.4, fill: i % 2 ? '#FFF6B8' : '#FBE3EC' });
          texto(g, p.name.slice(0, 1).toUpperCase(), { x: px, y: py + 12, size: 34, color: DIA.ink });
        });
        texto(g, ps.map((p) => p.name).join(' · ').slice(0, 32), { x, y: y + 80, size: 32, color: DIA.ink });
      });
      celda(1, 1, (g, x, y) => {
        const cs = d.stats.cities.slice(0, 4);
        cs.forEach((c, i) => texto(g, c, { x, y: y - 80 + i * 52, size: 40, color: DIA.ink }));
        texto(g, 'desde', { x, y: y - 140, size: 30, color: '#6B6A62' });
      });
      // más fotos alrededor
      const otras = d.pieces.filter((p) => p !== loved && p.photo).slice(0, 6);
      [[-1, -2], [0, -2], [1, -2], [-1, 2], [0, 2], [1, 2]].forEach(([i, j], k) =>
        celda(i, j, (g) => {
          const o = otras[k];
          if (o) {
            const c = el('g', { transform: `translate(${i * G},${j * G})` }, g);
            marco(T, c, defs, o.photo, o.text, o.wave);
          } else {
            // sin foto: un dibujito (corazón, estrella, sol, nota, nube, sobre)
            const x = CX + i * G, y = CY + j * G;
            const dibujos = [
              `M${x},${y + 60} C${x - 70},${y + 10} ${x - 90},${y - 40} ${x - 60},${y - 70} C${x - 40},${y - 90} ${x - 10},${y - 80} ${x},${y - 50} C${x + 10},${y - 80} ${x + 40},${y - 90} ${x + 60},${y - 70} C${x + 90},${y - 40} ${x + 70},${y + 10} ${x},${y + 60} Z`,
              `M${x},${y - 90} L${x + 24},${y - 28} L${x + 90},${y - 28} L${x + 36},${y + 12} L${x + 56},${y + 80} L${x},${y + 40} L${x - 56},${y + 80} L${x - 36},${y + 12} L${x - 90},${y - 28} L${x - 24},${y - 28} Z`,
              ellipse(x, y, 60),
              `M${x - 30},${y + 50} m-26,0 a26,20 0 1,0 52,0 a26,20 0 1,0 -52,0 M${x - 4},${y + 50} L${x - 4},${y - 80} C${x + 30},${y - 60} ${x + 50},${y - 40} ${x + 40},${y - 10}`,
              cloud(x - 100, y + 40, 200),
              `M${x - 100},${y - 60} L${x + 100},${y - 60} L${x + 100},${y + 70} L${x - 100},${y + 70} Z M${x - 100},${y - 60} L${x},${y + 10} L${x + 100},${y - 60}`,
            ];
            T.tinta(g, dibujos[k % dibujos.length], { color: k % 2 ? DIA.accent : DIA.ink, width: 3.4, fill: k % 3 === 0 ? '#FBE3EC' : 'none' });
          }
        }),
      );
      // el cursor rosa que da un corazón
      const cursor = el('g', {}, lRec);
      const onda = el('circle', { r: 10, fill: 'none', stroke: DIA.accent, 'stroke-width': 4 }, cursor);
      T.tinta(cursor, 'M0,0 L0,46 L12,35 L22,56 L31,51 L22,32 L38,32 Z', { color: '#8A1F4A', width: 2, fill: DIA.accent });
      this.paint.push((t) => {
        ver(lRec, t >= ra && t < rb + 0.1);
        if (t < ra || t > rb + 0.1) return;
        cells.forEach((c) => {
          const k = S(t, ra + 0.15 + c.dist * 0.28, 0.5, ease.linear);
          opacidad(c.g, c.dist === 0 ? 1 : k * 3);
          mover(c.g, { ox: c.cx, oy: c.cy, s: c.dist === 0 ? 1 : 0.5 + 0.5 * ease.back(k) });
        });
        const tq = ra + 3.2;
        const cxp = CX - G, cyp = CY - 60;
        const kc = S(t, ra + 2.2, 0.9, ease.inOut);
        const toque = Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (t - tq) / 0.2))));
        mover(cursor, { x: lerp(CX + 500, cxp, kc), y: lerp(CY + 900, cyp, kc), s: 1 - 0.2 * toque });
        ver(cursor, t > ra + 2.2);
        const ko = Math.min(1, Math.max(0, (t - tq) / 0.5));
        onda.setAttribute('r', String(10 + 50 * ko));
        onda.style.opacity = String(t >= tq ? 1 - ko : 0);
        if (corazon) mover(corazon, { ox: CX - G, oy: CY - 70, s: 1 + damped(t, tq, 3, 5) * 0.2 });
      });
    }

    // ─────────────────────────────── FINAL ───────────────────────────────
    {
      const [fa] = P.final;
      el('rect', { x: -2000, y: -2000, width: 5000, height: 5000, fill: '#0E0F11' }, lFin);
      const logo = texto(lFin, 'junti', { x: CX, y: CY - 20, size: 120, hand: false, weight: 700, color: '#F3F1E7' });
      const sub = texto(lFin, d.range, { x: CX, y: CY + 50, size: 40, color: '#A9A79C' });
      const pregunta = texto(lFin, d.closing, { x: CX, y: CY + 140, size: 44, color: NOCHE.accent });
      const raya = T.tinta(lFin, `M${CX - 120},${CY + 10} C${CX - 40},${CY + 22} ${CX + 40},${CY + 4} ${CX + 120},${CY + 14}`, { color: NOCHE.accent, width: 4 });
      this.paint.push((t) => {
        ver(lFin, t >= fa);
        if (t < fa) return;
        opacidad(logo, S(t, fa + 0.2, 0.5));
        mover(logo, { ox: CX, oy: CY - 40, s: 0.9 + 0.1 * S(t, fa + 0.2, 0.6) });
        revelar(raya, S(t, fa + 0.6, 0.5, ease.inOut));
        opacidad(sub, S(t, fa + 0.8, 0.4));
        opacidad(pregunta, S(t, fa + 1.4, 0.5));
      });
    }

    // ───────────────────────────── RÓTULOS ─────────────────────────────
    {
      const R = [
        { t: P.reloj[0] + 0.3, s: d.tags.reloj, hasta: P.persiana[0] + 0.6 },
        { t: P.ventanilla[0] + 1.2, s: d.tags.ventanilla, hasta: P.ventanilla[1] - 0.6 },
        { t: P.libreta[0] + 0.8, s: d.tags.libreta, hasta: P.libreta[1] - 0.4 },
      ];
      const nodos = R.map((r) => {
        const id = uid('rt');
        const rect = el('rect', { x: 0, y: Y0 + L + 60, width: 0, height: 70 }, el('clipPath', { id }, defs));
        const n = texto(lRot, r.s, { x: CX, y: Y0 + L + 110, size: 40, color: NOCHE.ink });
        n.setAttribute('clip-path', `url(#${id})`);
        return { n, rect };
      });
      this.paint.push((t) =>
        R.forEach((r, i) => {
          const { n, rect } = nodos[i];
          const on = t >= r.t && t < r.hasta + 0.3;
          ver(n, on);
          if (!on) return;
          const k = S(t, r.t, 0.6, ease.inOut);
          rect.setAttribute('x', '0');
          rect.setAttribute('width', String(STAGE.w * k));
          opacidad(n, 1 - S(t, r.hasta, 0.3));
        }),
      );
    }

    // ───────────────────── CÁMARA GLOBAL Y FONDO ─────────────────────
    {
      const [va, vb] = P.ventanilla;
      const [ra, rb] = P.recuerdos;
      const keys: [number, { s: number; x: number; y: number }][] = [
        [0, { s: 1, x: 0, y: 0 }],
        [va, { s: 1.06, x: 0, y: 0 }],
        [va + 1.1, { s: 0.86, x: 0, y: 60 }],
        [vb - 0.8, { s: 0.88, x: 0, y: 60 }],
        [vb, { s: 1, x: 0, y: 0 }],
        [ra, { s: 1, x: 0, y: 0 }],
        [ra + 1.4, { s: 0.5, x: 0, y: 0 }],
        [rb, { s: 0.55, x: -40, y: 20 }],
      ];
      const flashT = P.calendario[0] + 1.95;
      this.paint.push((t) => {
        let k = keys[keys.length - 1][1];
        for (let i = 1; i < keys.length; i++)
          if (t <= keys[i][0]) {
            const [t0, a] = keys[i - 1], [t1, b] = keys[i];
            const e = ease.inOut(Math.min(1, Math.max(0, (t - t0) / Math.max(0.001, t1 - t0))));
            k = { s: lerp(a.s, b.s, e), x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e) };
            break;
          }
        const s = k.s * (1 + 0.004 * Math.sin(t * 1.3));
        cam.setAttribute('transform', `translate(${CX},${CY}) scale(${s.toFixed(4)}) translate(${(-CX - k.x).toFixed(2)},${(-CY - k.y).toFixed(2)})`);
        base.setAttribute('fill', isDay(t) ? DIA.bg : NOCHE.bg);
        const kf = S(t, flashT, 0.24, ease.in);
        ver(destello, kf > 0 && kf < 1);
        destello.setAttribute('cx', String(X0 + 124));
        destello.setAttribute('cy', String(Y0 + 109 + 60));
        destello.setAttribute('r', String(10 + kf * 2200));
        // el texto de los rótulos: crema de noche, tinta de día
        lRot.setAttribute('fill', isDay(t) ? DIA.ink : NOCHE.ink);
      });
    }
  }
}

/** El marco de un momento: la ventana con cortinas del dibujo del faro. */
function marco(T: Taller, g: Element, defs: Element, photo?: string, text?: string, wave?: number[]) {
  T.tinta(g, tile(), { color: DIA.ink, width: 3, fill: '#FFFFFF' });
  const id = uid('mc');
  el('path', { d: tile(16) }, el('clipPath', { id }, defs));
  const dentro = el('g', { 'clip-path': `url(#${id})` }, g);
  if (photo) {
    el('image', { href: photo, x: X0 + 16, y: Y0 + 16, width: L - 32, height: L - 32, preserveAspectRatio: 'xMidYMid slice' }, dentro);
    if (text) {
      el('rect', { x: X0, y: Y0 + L - 110, width: L, height: 110, fill: 'rgba(0,0,0,0.42)' }, dentro);
      lineas(text, 28, 2).forEach((ln, i) => texto(dentro, ln, { x: CX, y: Y0 + L - 66 + i * 34, size: 32, color: '#FFFFFF' }));
    }
  } else if (wave?.length) {
    el('rect', { x: X0, y: Y0, width: L, height: L, fill: '#FBFAF3' }, dentro);
    const n = 24;
    for (let i = 0; i < n; i++) {
      const v = wave[Math.floor((i / n) * wave.length)] ?? 30;
      const h = 20 + (v / 100) * 200;
      el('rect', { x: X0 + 50 + i * 13.4, y: CY - h / 2, width: 8, height: h, rx: 4, fill: i % 5 ? DIA.ink : DIA.accent }, dentro);
    }
    texto(dentro, 'nota de voz', { x: CX, y: Y0 + L - 50, size: 34, color: '#6B6A62' });
  } else {
    el('rect', { x: X0, y: Y0, width: L, height: L, fill: '#FBFAF3' }, dentro);
    let r = '';
    for (let y = Y0 + 80; y < Y0 + L - 20; y += 44) r += `M${X0 + 30},${y} L${X0 + L - 30},${y + 0.5} `;
    T.tinta(dentro, r, { color: '#DAD6C4', width: 2, step: 10 });
    texto(dentro, '“', { x: X0 + 50, y: Y0 + 100, size: 110, color: DIA.accent });
    lineas(text ?? '', 20, 7).forEach((ln, i) => texto(dentro, ln, { x: X0 + 46, y: Y0 + 116 + i * 44, size: 38, color: DIA.ink, anchor: 'start' }));
  }
  // las cortinas (enmarcan sin tapar casi nada)
  T.tinta(dentro, `M${X0 + 70},${Y0 + 16} C${X0 + 40},${Y0 + 40} ${X0 + 30},${Y0 + 80} ${X0 + 28},${Y0 + 140} L${X0 + 26},${Y0 + L} L${X0},${Y0 + L} L${X0},${Y0} Z`, { color: DIA.ink, width: 2, fill: '#FFFFFF' });
  T.tinta(dentro, `M${X0 + L - 60},${Y0 + 16} C${X0 + L - 62},${Y0 + 120} ${X0 + L - 50},${Y0 + 220} ${X0 + L - 20},${Y0 + 290} C${X0 + L - 10},${Y0 + 320} ${X0 + L},${Y0 + 340} ${X0 + L},${Y0 + 360} L${X0 + L},${Y0} Z`, { color: DIA.ink, width: 2, fill: '#FFFFFF' });
  T.tinta(dentro, `M${X0 + L - 44},${Y0 + 20} C${X0 + L - 44},${Y0 + 120} ${X0 + L - 30},${Y0 + 200} ${X0 + L - 12},${Y0 + 250}`, { color: DIA.ink, width: 1.4 });
  T.tinta(g, tile(16), { color: DIA.ink, width: 1.4 });
}

function haversine(a: { lat?: number; lng?: number }, b: { lat?: number; lng?: number }) {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return 0;
  const R = 6371, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
