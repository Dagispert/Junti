// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN: colores, tiempos, cámara y rótulos.
// Todo lo que se ajusta sin tocar el dibujo ni las escenas vive aquí.
// Los tiempos son segundos absolutos desde el inicio de la película.
// ─────────────────────────────────────────────────────────────────────────────

/** Paleta medida sobre la referencia (fotogramas a 1280×720). */
export const COLOR = {
  negro: '#000000', // fondo de noche: negro puro
  crema: '#FDFDD4', // papel / tinta clara
  cremaSombra: '#F1F0C6', // papel a la sombra (persiana enrollada, bordes)
  cremaVineta: '#E2E0AE', // borde del viñeteado de día
  rosa: '#E3065F', // el único acento: magenta de rotulador
  rosaOscuro: '#A8044A', // aros del vaso, sombra del rosa
  oliva: '#25261E', // el foco de luz de la cabina
  tinta: '#0B0B09', // tinta negra sobre papel
  gris: '#3A3A33', // trazos discontinuos de la ruta
  rayas: '#CFCDA2', // renglones de la libreta
  esquirlaNoche: '#262622', // esquirlas flotantes de fondo (noche)
  esquirlaDia: '#E9E7BC', // esquirlas flotantes de fondo (día)
};

/** Escenario: lienzo de la referencia. */
export const ESCENARIO = {
  ancho: 1280,
  alto: 720,
  hervorFps: 8, // cuántas veces por segundo «tiembla» la línea (line boil)
};

/** El mosaico central: el cuadrado redondeado que une todas las escenas. */
export const MOSAICO = { cx: 640, cy: 362, lado: 304, n: 4.6 };

export const DURACION = 21.6;

/** Cuándo se ve cada escena (con solapes: las transiciones son compartidas). */
export const ESCENAS = {
  ventanilla: { desde: 2.5, hasta: 6.95 },
  reloj: { desde: 0, hasta: 1.7 },
  persiana: { desde: 0.95, hasta: 3.15 },
  camara: { desde: 13.75, hasta: 21.0 },
  calendario: { desde: 12.4, hasta: 14.3 },
  mapa: { desde: 6.9, hasta: 12.95 },
  libreta: { desde: 6.3, hasta: 9.5 },
  rejilla: { desde: 17.1, hasta: 21.0 },
};
/** Orden de apilado (de atrás adelante). */
export const ORDEN = ['ventanilla', 'reloj', 'persiana', 'camara', 'calendario', 'mapa', 'libreta', 'rejilla'];

/**
 * Los «golpes» de cada escena: [inicio, duración]. Afinar el ritmo es tocar
 * solo estos números.
 */
export const T = {
  reloj: {
    trazo: [0.0, 0.4], // el contorno se dibuja
    cifras: [0.1, 0.3], // las cifras aparecen
    voltea: [0.42, 0.34], // 58 → 59
  },
  persiana: {
    marco: [1.0, 0.3], // el borde engorda: es el marco de la persiana
    baja: [1.0, 0.46], // la persiana se desenrolla sobre el reloj
    cordon: [1.02, 0.36], // cae el cordón… y se balancea
    tiron: [2.4, 0.2], // alguien tira del cordón
    sube: [2.58, 0.46], // y la persiana sube
  },
  ventanilla: {
    iris: [2.62, 0.7], // se abre el foco de luz
    asientos: [2.85, 0.75],
    bandeja: [3.05, 0.35],
    vaso: [3.35, 0.4],
    luz: [5.0, 0.95], // un haz de sol barre el asiento
    prisa: [5.05, 0.8], // las nubes pasan deprisa
    salida: [6.25, 0.6],
  },
  libreta: {
    contorno: [6.35, 0.55],
    cinta: [6.95, 0.32],
    letras: [7.25, 0.4],
    gomaEntra: [7.45, 0.42],
    gomaSale: [8.15, 0.24],
    abre: [8.42, 0.62],
    tapaSale: [9.02, 0.42],
  },
  mapa: {
    plumaEntra: [9.45, 0.6],
    punto: [10.02, 0.2],
    dibuja: [10.1, 1.25],
    equis: [11.38, 0.26],
    plumaSale: [11.7, 0.6],
    volteo: [12.45, 0.42],
  },
  calendario: {
    monton: [12.55, 0.4],
    volteo1: [13.0, 0.3],
    volteo2: [13.38, 0.3],
    salida: [13.78, 0.4],
  },
  camara: {
    visor: [14.28, 0.14], // el visor se enciende
    expulsa: [15.0, 0.66], // sale la foto por la ranura
    sube: [15.68, 0.26], // la foto salta…
    despliega: [15.94, 0.36], // …y se despliega encima de la cámara
  },
  rejilla: {
    mosaicos: [17.2, 0.95], // aparecen los demás mosaicos (por distancia)
    escribe: [18.55, 1.7], // el mensaje se escribe solo
    temperatura: [19.2, 0.3],
    cursor: [18.15, 2.4],
    toques: [18.9, 19.62, 20.34], // pin, corazón, fecha
  },
};

/** El cambio de noche a día: el flash de la cámara inunda la pantalla. */
export const CAMBIO_FONDO = { t: 14.4, dur: 0.24, origen: [727, 310] };
/** Corte final a negro. */
export const FIN = 21.0;

/**
 * La cámara: fotogramas clave [t, {x, y, s}]. x/y = punto al que mira
 * (desplazamiento sobre el centro), s = zoom. El tercer valor es la curva.
 */
export const CAMARA = [
  [0, { x: 0, y: 0, s: 1 }],
  [2.6, { x: 0, y: 0, s: 1.04 }, 'lineal'],
  [3.7, { x: 0, y: 18, s: 0.92 }, 'sale'], // se aleja: la ventanilla está en un avión
  [6.25, { x: 0, y: 18, s: 0.95 }, 'lineal'],
  [6.95, { x: 0, y: 0, s: 1.0 }, 'entraSale'],
  [12.2, { x: 0, y: 0, s: 1.03 }, 'lineal'],
  [12.6, { x: 0, y: -22, s: 0.98 }, 'entraSale'], // deja ver las hojas pasadas
  [13.8, { x: 0, y: -22, s: 0.99 }, 'lineal'],
  [14.3, { x: 0, y: 0, s: 1.0 }, 'entraSale'],
  [17.15, { x: 0, y: 0, s: 1.04 }, 'lineal'],
  [17.9, { x: 0, y: 0, s: 0.97 }, 'sale'], // se aleja para descubrir la rejilla
  [18.9, { x: 40, y: 10, s: 0.99 }, 'entraSale'],
  [19.6, { x: 70, y: 0, s: 1.0 }, 'entraSale'],
  [20.4, { x: -90, y: 0, s: 1.03 }, 'entraSale'],
  [21.0, { x: -100, y: 0, s: 1.05 }, 'lineal'],
];

/** Los rótulos bajo el mosaico (el hashtag de cada recuerdo). */
export const ROTULOS = [
  { t: 0.12, texto: '#horadeirse' },
  { t: 1.2, texto: '#cincominutosmás' },
  { t: 3.2, texto: '#rumboati' },
  { t: 7.05, texto: '#nuestrodiario' },
  { t: 9.9, texto: '#larutahastati' },
  { t: 12.7, texto: '#cuentaatrás' },
  { t: 15.85, texto: '#porfinjuntos' },
  { t: 17.45, texto: '' },
];
