// Leer la voz en Opus (lo que graba Chrome en Android y en el ordenador) en
// cualquier navegador, también en el iPhone, que no sabe decodificarla por sí
// mismo: se sacan los paquetes de Opus del vídeo (MP4 o WebM) y se decodifican
// con WebCodecs o, si no lo hay, con un decodificador en WebAssembly.

/** recorte: lo que el formato dice que sobra al principio (en segundos) */
type Paquetes = { frames: Uint8Array[]; canales: number; recorte: number };
/** lo que el códec Opus añade al empezar (si el archivo no dice otra cosa) */
const PRESKIP = 312 / 48000;

/* ───── WebM (EBML): lo justo para sacar los bloques de la pista de Opus ───── */

function vint(b: Uint8Array, p: number, quitarMarca: boolean) {
  const primero = b[p];
  let largo = 1;
  while (largo <= 8 && !(primero & (0x80 >> (largo - 1)))) largo++;
  if (largo > 8) return null;
  let v = quitarMarca ? primero & (0xff >> largo) : primero;
  let todoUnos = v === (0xff >> largo);
  for (let i = 1; i < largo; i++) {
    v = v * 256 + b[p + i];
    if (b[p + i] !== 0xff) todoUnos = false;
  }
  return { v, largo, desconocido: quitarMarca && todoUnos };
}

const CONTENEDORES = new Set([
  0x18538067, // Segment
  0x1f43b675, // Cluster
  0x1654ae6b, // Tracks
  0xae, // TrackEntry
  0xe1, // Audio
  0xa0, // BlockGroup
]);

function paquetesWebm(b: Uint8Array): Paquetes {
  let p = 0;
  let pistaActual = 0;
  let pistaOpus = -1;
  let canales = 1;
  let recorte = PRESKIP;
  const frames: Uint8Array[] = [];
  while (p < b.length - 2) {
    const id = vint(b, p, false);
    if (!id) break;
    const tam = vint(b, p + id.largo, true);
    if (!tam) break;
    const ini = p + id.largo + tam.largo;
    if (CONTENEDORES.has(id.v)) {
      p = ini; // se entra (aunque no se sepa su tamaño)
      continue;
    }
    const fin = tam.desconocido ? b.length : Math.min(b.length, ini + tam.v);
    if (id.v === 0xd7) {
      // TrackNumber
      let n = 0;
      for (let i = ini; i < fin; i++) n = n * 256 + b[i];
      pistaActual = n;
    } else if (id.v === 0x86) {
      // CodecID
      if (new TextDecoder().decode(b.subarray(ini, fin)) === 'A_OPUS') pistaOpus = pistaActual;
    } else if (id.v === 0x56aa) {
      // CodecDelay (en nanosegundos)
      let n = 0;
      for (let i = ini; i < fin; i++) n = n * 256 + b[i];
      recorte = n / 1e9;
    } else if (id.v === 0x9f) {
      canales = b[ini] || 1;
    } else if (id.v === 0xa3 || id.v === 0xa1) {
      // SimpleBlock / Block: pista, 2 bytes de tiempo, 1 de banderas y el paquete
      const pista = vint(b, ini, true);
      if (pista && pista.v === pistaOpus) {
        const banderas = b[ini + pista.largo + 2];
        if (!(banderas & 0x06)) frames.push(b.slice(ini + pista.largo + 3, fin));
      }
    }
    p = fin;
  }
  return { frames, canales, recorte };
}

/* ───── MP4 (también el fragmentado de Chrome), con mp4box ───── */

async function paquetesMp4(bytes: ArrayBuffer): Promise<Paquetes> {
  const MP4Box = await import('mp4box');
  return new Promise((ok, mal) => {
    const f = MP4Box.createFile();
    const frames: Uint8Array[] = [];
    let canales = 1;
    let recorte = PRESKIP;
    let total = Infinity;
    f.onError = (e: unknown) => mal(new Error(`mp4: ${String(e)}`));
    f.onReady = (info) => {
      const pista = info.audioTracks?.[0];
      if (!pista) return mal(new Error('mp4 sin sonido'));
      canales = pista.audio?.channel_count || 1;
      // la lista de edición dice desde dónde se oye de verdad
      const ed0 = (pista as { edits?: { media_time: number }[] }).edits?.[0];
      if (ed0 && ed0.media_time > 0 && pista.timescale) recorte = ed0.media_time / pista.timescale;
      total = pista.nb_samples || Infinity;
      f.setExtractionOptions(pista.id, null, { nbSamples: 1000 });
      f.start();
    };
    f.onSamples = (_id, _user, muestras) => {
      for (const m of muestras) if (m.data) frames.push(new Uint8Array(m.data));
    };
    const buf = bytes.slice(0) as ArrayBuffer & { fileStart: number };
    buf.fileStart = 0;
    f.appendBuffer(buf as never);
    f.flush();
    // mp4box entrega todo al leer el búfer; si la cuenta no cuadra, vale lo que haya
    if (frames.length || total === 0) ok({ frames, canales, recorte });
    else
      setTimeout(
        () =>
          frames.length ? ok({ frames, canales, recorte }) : mal(new Error('mp4 sin paquetes')),
        50,
      );
  });
}

/* ───── Decodificar ───── */

async function conWebCodecs(p: Paquetes): Promise<Float32Array[] | null> {
  const AD = (globalThis as { AudioDecoder?: typeof AudioDecoder }).AudioDecoder;
  if (!AD) return null;
  const config = { codec: 'opus', sampleRate: 48000, numberOfChannels: p.canales };
  try {
    if (!(await AD.isConfigSupported(config)).supported) return null;
  } catch {
    return null;
  }
  const trozos: Float32Array[][] = [];
  let fallo: unknown = null;
  const dec = new AD({
    output: (d) => {
      const planos: Float32Array[] = [];
      for (let c = 0; c < d.numberOfChannels; c++) {
        const a = new Float32Array(d.numberOfFrames);
        d.copyTo(a, { planeIndex: c, format: 'f32-planar' });
        planos.push(a);
      }
      trozos.push(planos);
      d.close();
    },
    error: (e) => (fallo = e),
  });
  dec.configure(config);
  let t = 0;
  for (const f of p.frames) {
    dec.decode(new EncodedAudioChunk({ type: 'key', timestamp: t, data: f }));
    t += 20000;
  }
  await dec.flush();
  dec.close();
  if (fallo || !trozos.length) return null;
  return unir(trozos, p.canales);
}

async function conWasm(p: Paquetes): Promise<Float32Array[]> {
  const { OpusDecoder } = await import('opus-decoder');
  const dec = new OpusDecoder({ channels: Math.min(2, p.canales) as 1 | 2 });
  await dec.ready;
  const trozos: Float32Array[][] = [];
  for (const f of p.frames) {
    try {
      const r = dec.decodeFrame(f);
      if (r.samplesDecoded) trozos.push(r.channelData);
    } catch {
      // un paquete roto: se salta
    }
  }
  dec.free();
  return unir(trozos, Math.min(2, p.canales));
}

function unir(trozos: Float32Array[][], canales: number): Float32Array[] {
  const largo = trozos.reduce((s, t) => s + t[0].length, 0);
  return Array.from({ length: canales }, (_, c) => {
    const out = new Float32Array(largo);
    let o = 0;
    for (const t of trozos) {
      out.set(t[Math.min(c, t.length - 1)], o);
      o += t[0].length;
    }
    return out;
  });
}

/** La voz en Opus de un vídeo (MP4 o WebM), lista para Web Audio. */
export async function decodificarOpus(
  bytes: ArrayBuffer,
  ctx: BaseAudioContext,
  forzarWasm = false,
): Promise<AudioBuffer> {
  const b = new Uint8Array(bytes);
  const webm = b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3;
  const p = webm ? paquetesWebm(b) : await paquetesMp4(bytes);
  // lo que el códec dice que sobra al principio (pre-skip): en MP4, en «dOps»
  // (big-endian); en WebM, en la cabecera «OpusHead» (little-endian)
  const busca = (t: string) => {
    const c = [...t].map((x) => x.charCodeAt(0));
    for (let i = 0; i < Math.min(b.length, 256 * 1024) - c.length; i++)
      if (c.every((x, j) => b[i + j] === x)) return i;
    return -1;
  };
  const dops = webm ? -1 : busca('dOps');
  const head = webm ? busca('OpusHead') : -1;
  if (dops >= 0) p.recorte = ((b[dops + 6] << 8) | b[dops + 7]) / 48000;
  else if (head >= 0) p.recorte = (b[head + 10] | (b[head + 11] << 8)) / 48000;
  if (!p.frames.length) throw new Error('sin paquetes de Opus');
  const datos = (!forzarWasm && (await conWebCodecs(p))) || (await conWasm(p));
  const quitar = Math.min(Math.round(p.recorte * 48000), datos[0].length - 1);
  const buf = ctx.createBuffer(datos.length, datos[0].length - quitar, 48000);
  datos.forEach((d, c) => buf.copyToChannel(d.subarray(quitar) as Float32Array<ArrayBuffer>, c));
  return buf;
}
