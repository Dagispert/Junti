// ─────────────────────────────────────────────────────────────────────────────
// TIEMPO: curvas, tramos y el reproductor.
// Toda la película es una función pura del tiempo t: pintar(t) siempre da el
// mismo fotograma. Así se puede pausar, rebobinar y saltar a cualquier punto.
// ─────────────────────────────────────────────────────────────────────────────

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, k) => a + (b - a) * k;

/** Curvas de aceleración. */
export const CURVA = {
  lineal: (k) => k,
  sale: (k) => 1 - (1 - k) ** 3, // frena al llegar
  entra: (k) => k ** 3, // arranca despacio
  entraSale: (k) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2),
  suave: (k) => k * k * (3 - 2 * k),
  // se pasa un poco y vuelve: el «muelle» de los objetos al llegar
  rebote: (k) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2;
  },
  rebotin: (k) => {
    const c1 = 0.9, c3 = c1 + 1;
    return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2;
  },
};

/** Progreso 0…1 de un tramo [inicio, duración] en el instante t. */
export function tramo(t, [desde, dur], curva = CURVA.sale) {
  return curva(clamp((t - desde) / dur));
}

/** ¿Está t dentro del tramo? */
export const dentro = (t, [desde, dur]) => t >= desde && t <= desde + dur;

/** Oscilación amortiguada que empieza en t0 (balanceos, gomas, rebotes). */
export function amortiguado(t, t0, frecuencia = 2, freno = 4) {
  const d = t - t0;
  if (d < 0) return 0;
  return Math.exp(-freno * d) * Math.sin(2 * Math.PI * frecuencia * d);
}

/**
 * Pista de fotogramas clave: [[t, valor, curva?], …]. Los valores pueden ser
 * números u objetos de números (se interpolan campo a campo; los campos que
 * falten se heredan del fotograma anterior).
 */
export function pista(t, claves) {
  const llenas = [];
  let previo = {};
  for (const [tc, v, c] of claves) {
    const valor = typeof v === 'number' ? v : { ...previo, ...v };
    llenas.push([tc, valor, c]);
    if (typeof v !== 'number') previo = valor;
  }
  if (t <= llenas[0][0]) return llenas[0][1];
  for (let i = 1; i < llenas.length; i++) {
    const [t1, v1, c] = llenas[i];
    if (t <= t1) {
      const [t0, v0] = llenas[i - 1];
      const k = (CURVA[c] || CURVA.entraSale)(clamp((t - t0) / (t1 - t0)));
      if (typeof v1 === 'number') return lerp(v0, v1, k);
      const out = {};
      for (const key of Object.keys(v1)) out[key] = lerp(v0[key] ?? v1[key], v1[key], k);
      return out;
    }
  }
  return llenas[llenas.length - 1][1];
}

/**
 * El reproductor: lleva el reloj y llama a pintar(t) en cada fotograma.
 * Al pausar, también se pausan las animaciones CSS independientes.
 */
export class Reproductor {
  constructor({ duracion, pintar, raiz, alCambiar }) {
    this.duracion = duracion;
    this.pintar = pintar;
    this.raiz = raiz;
    this.alCambiar = alCambiar || (() => {});
    this.t = 0;
    this.velocidad = 1;
    this.enMarcha = false;
    this.repetir = true;
    this._ultimo = 0;
    this._bucle = this._bucle.bind(this);
  }
  play() {
    if (this.enMarcha) return;
    if (this.t >= this.duracion) this.t = 0;
    this.enMarcha = true;
    this.raiz.classList.remove('pausado');
    this._ultimo = performance.now();
    requestAnimationFrame(this._bucle);
    this.alCambiar(this);
  }
  pausa() {
    this.enMarcha = false;
    this.raiz.classList.add('pausado');
    this.alCambiar(this);
  }
  alternar() {
    this.enMarcha ? this.pausa() : this.play();
  }
  ir(t) {
    this.t = clamp(t, 0, this.duracion);
    this.pintar(this.t);
    this.alCambiar(this);
  }
  _bucle(ahora) {
    if (!this.enMarcha) return;
    // Un salto grande (pestaña en segundo plano) no debe saltarse escenas.
    const dt = Math.min(0.1, (ahora - this._ultimo) / 1000);
    this._ultimo = ahora;
    this.t += dt * this.velocidad;
    if (this.t >= this.duracion) {
      if (this.repetir) this.t = 0;
      else {
        this.t = this.duracion;
        this.pintar(this.t);
        return this.pausa();
      }
    }
    this.pintar(this.t);
    this.alCambiar(this);
    requestAnimationFrame(this._bucle);
  }
}
