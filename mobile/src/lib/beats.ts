// El pulso de una canción: cada cuánto cae un golpe (el tempo) y dónde cae el
// primero. Con eso la película mueve las cosas al ritmo de la música.
//
// Se calcula en el propio móvil: se decodifica el fragmento, se mira cuánto
// sube la energía de un instante al siguiente (los ataques: bombo, caja,
// acordes) y se busca la distancia que más se repite entre ellos.

export type Ritmo = {
  /** segundos entre golpes */
  periodo: number;
  /** dónde cae el primer golpe (segundos desde que empieza la canción) */
  desfase: number;
  bpm: number;
};

const cache = new Map<string, Promise<Ritmo | null>>();

export function analizarRitmo(url?: string): Promise<Ritmo | null> {
  if (!url || typeof window === 'undefined') return Promise.resolve(null);
  if (!cache.has(url))
    cache.set(
      url,
      calcular(url).catch(() => null),
    );
  return cache.get(url)!;
}

async function calcular(url: string): Promise<Ritmo | null> {
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  const data = await (await fetch(url)).arrayBuffer();
  const ctx = new Ctx();
  const audio = await new Promise<AudioBuffer>((ok, ko) => ctx.decodeAudioData(data, ok, ko));
  ctx.close().catch(() => {});

  // mono y como mucho 30 s
  const sr = audio.sampleRate;
  const n = Math.min(audio.length, sr * 30);
  const ch = audio.numberOfChannels;
  const hop = 512;
  const frames = Math.floor(n / hop);
  if (frames < 200) return null;
  const energy = new Float32Array(frames);
  for (let c = 0; c < ch; c++) {
    const d = audio.getChannelData(c);
    for (let f = 0; f < frames; f++) {
      let s = 0;
      for (let i = f * hop; i < (f + 1) * hop; i += 2) s += d[i] * d[i];
      energy[f] += s;
    }
  }
  // los ataques: cuánto sube (en escala logarítmica) respecto a lo anterior
  const onset = new Float32Array(frames);
  for (let f = 1; f < frames; f++) {
    const a = Math.log(1e-6 + energy[f]),
      b = Math.log(1e-6 + energy[f - 1]);
    onset[f] = Math.max(0, a - b);
  }
  // sin la media local (para quedarse solo con los picos)
  const w = 16;
  const clean = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let m = 0,
      k = 0;
    for (let j = Math.max(0, f - w); j < Math.min(frames, f + w); j++) {
      m += onset[j];
      k++;
    }
    clean[f] = Math.max(0, onset[f] - m / k);
  }
  // el tempo: la distancia (entre 70 y 180 golpes por minuto) que más se repite
  const fps = sr / hop;
  const minLag = Math.floor((fps * 60) / 180),
    maxLag = Math.ceil((fps * 60) / 70);
  let best = 0,
    bestLag = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let f = lag; f < frames; f++) s += clean[f] * clean[f - lag];
    // se prefieren los tempos de canción normales (≈ 90–140)
    const bpm = (fps * 60) / lag;
    const pref = Math.exp(-((Math.log2(bpm / 118) / 0.7) ** 2));
    s *= 0.6 + 0.4 * pref;
    if (s > best) {
      best = s;
      bestLag = lag;
    }
  }
  if (!bestLag) return null;
  // dónde cae el primer golpe: la fase donde más ataques coinciden
  let bestPhase = 0,
    bestSum = -1;
  for (let ph = 0; ph < bestLag; ph++) {
    let s = 0;
    for (let f = ph; f < frames; f += bestLag) s += clean[f];
    if (s > bestSum) {
      bestSum = s;
      bestPhase = ph;
    }
  }
  const periodo = bestLag / fps;
  return { periodo, desfase: bestPhase / fps, bpm: Math.round(60 / periodo) };
}
