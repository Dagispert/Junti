// El cuento a trozos, entero: la narradora lee el comienzo, suenan los trozos
// seguidos (sin huecos ni silencios en los extremos) y ella pone el final.
// Lo usan la pantalla del cuento y su tarjeta en «Hoy».

import { tieneOpus } from './karaoke';
import { useEffect, useRef, useState } from 'react';

import type { Moment } from '@/data/types';
import { cierreDelCuento, vozDelCuento } from '@/lib/ideas-retos';

/**
 * Dónde empieza y acaba la voz de verdad en un audio (en segundos): sin los
 * silencios de los extremos ni la ráfaga de ruido («walkie-talkie») que la
 * voz de la IA a veces deja al final. Se buscan los bloques de sonido (los
 * huecos de menos de 0,1 s se unen) y se quitan del final los bloques cortos
 * que llegan tras un silencio o que tienen pinta de ruido (cruzan el cero
 * muchísimo más que una voz).
 */
export function tramoDeVoz(muestra: (i: number) => number, n: number, rate: number) {
  const ventana = Math.max(1, Math.round(rate * 0.02));
  const E: number[] = [];
  const Z: number[] = [];
  for (let i = 0; i + ventana <= n; i += ventana) {
    let e = 0;
    let z = 0;
    let antes = muestra(i);
    for (let k = 0; k < ventana; k++) {
      const x = muestra(i + k);
      e += x * x;
      if (k && x < 0 !== antes < 0) z++;
      antes = x;
    }
    E.push(Math.sqrt(e / ventana));
    Z.push(z / ventana);
  }
  const N = E.length;
  if (!N) return { desde: 0, hasta: n / rate };
  // la escala, sin que una ráfaga fuerte la marque
  const orden = [...E].sort((a, b) => a - b);
  const u = Math.max(0.008, orden[Math.floor(N * 0.9)] * 0.15);
  const junta = Math.round(0.1 / 0.02);
  const bloques: [number, number][] = [];
  for (let i = 0; i < N; ) {
    if (E[i] <= u) {
      i++;
      continue;
    }
    let b = i;
    for (;;) {
      let sigue = false;
      for (let k = b + 1; k < Math.min(N, b + 1 + junta); k++)
        if (E[k] > u) {
          b = k;
          sigue = true;
          break;
        }
      if (!sigue) break;
    }
    bloques.push([i, b]);
    i = b + 1;
  }
  if (!bloques.length) return { desde: 0, hasta: n / rate };
  const ruido = ([a, b]: [number, number]) => {
    let s = 0;
    let c = 0;
    for (let k = a; k <= b; k++)
      if (E[k] > u) {
        s += Z[k];
        c++;
      }
    return c ? s / c : 0;
  };
  while (bloques.length > 1) {
    const [a, b] = bloques[bloques.length - 1];
    const pb = bloques[bloques.length - 2][1];
    const largo = ((b - a + 1) * ventana) / rate;
    const hueco = ((a - pb - 1) * ventana) / rate;
    if ((largo < 0.35 && hueco >= 0.15) || ruido(bloques[bloques.length - 1]) > 0.25) bloques.pop();
    else break;
  }
  const desde = Math.max(0, ((bloques[0][0] - 2) * ventana) / rate);
  const hasta = Math.min(n / rate, ((bloques[bloques.length - 1][1] + 1) * ventana) / rate + 0.15);
  return { desde, hasta: Math.max(hasta, desde + 0.2) };
}

function recorte(buf: AudioBuffer) {
  const d = buf.getChannelData(0);
  return tramoDeVoz((i) => d[i], d.length, buf.sampleRate);
}

/** Suena un audio y espera a que acabe (o falle). */
const sonar = (src: string, guardar: (a: HTMLAudioElement) => void) =>
  new Promise<void>((ok) => {
    const a = new Audio(src);
    guardar(a);
    a.onended = () => ok();
    a.onerror = () => ok();
    a.play().catch(() => ok());
  });

/** Lee un texto con la voz del móvil (si no hay voz de la narradora). */
const leer = (texto: string) =>
  new Promise<void>((ok) => {
    if (typeof speechSynthesis === 'undefined') return ok();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'es-ES';
    u.onend = () => ok();
    u.onerror = () => ok();
    speechSynthesis.speak(u);
    setTimeout(ok, 20000);
  });


/**
 * Reproduce el cuento entero. «sonando»: -1 la narradora (comienzo), 0..n-1
 * el trozo de cada uno, n el final de la narradora; null, nada.
 */
export function useCuentoEntero({
  groupId,
  proposalId,
  inicio,
  trozos,
  vozInicio: vozDada,
  cargarCierre = true,
}: {
  groupId: string;
  proposalId: string;
  inicio: string;
  trozos: Moment[];
  vozInicio?: string | null;
  /** pedir el final al abrir (la pantalla) o solo al darle a escuchar (la tarjeta) */
  cargarCierre?: boolean;
}) {
  const [sonando, setSonando] = useState<number | null>(null);
  // el final de la narradora
  const [cierre, setCierre] = useState<{ texto: string; audio?: string | null } | null>(null);
  const [escribiendo, setEscribiendo] = useState(cargarCierre);
  const pedirCierre = async () => {
    if (!trozos.length) return null;
    const r = await cierreDelCuento(groupId, proposalId);
    const c = r.cierre ? { texto: r.cierre, audio: r.audio } : null;
    if (c) setCierre(c);
    return c;
  };
  useEffect(() => {
    if (!cargarCierre) return;
    pedirCierre().finally(() => setEscribiendo(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposalId]);
  const audio = useRef<HTMLAudioElement | null>(null);
  const vivo = useRef(true);
  useEffect(
    () => () => {
      vivo.current = false;
      audio.current?.pause();
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    },
    [],
  );

  // Todo el cuento seguido, sin huecos: se descargan y se preparan todos los
  // audios antes de empezar, se les quita el silencio de los extremos y se
  // encadenan con una pausa mínima (con Web Audio, en un solo reloj).
  const ctx = useRef<AudioContext | null>(null);
  const fuentes = useRef<AudioBufferSourceNode[]>([]);
  const relojes = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [preparando, setPreparando] = useState(false);

  const parar = () => {
    vivo.current = false;
    audio.current?.pause();
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    fuentes.current.forEach((f) => {
      try {
        f.stop();
      } catch {
        // ya parada
      }
    });
    fuentes.current = [];
    relojes.current.forEach(clearTimeout);
    relojes.current = [];
    setSonando(null);
  };
  useEffect(
    () => () => {
      ctx.current?.close().catch(() => {});
    },
    [],
  );

  const escuchar = async () => {
    vivo.current = true;
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const c = (ctx.current ??= new Ctx());
    await c.resume().catch(() => {});
    // un sonido vacío dentro del toque: así el iPhone deja sonar lo demás
    const b0 = c.createBufferSource();
    b0.buffer = c.createBuffer(1, 1, 22050);
    b0.connect(c.destination);
    b0.start();
    setPreparando(true);
    // la voz del comienzo y el final de la narradora, si aún no estaban
    const [vozInicio, fin] = await Promise.all([
      vozDada ?? vozDelCuento(groupId, proposalId),
      cierre ? cierre : pedirCierre().catch(() => null),
    ]);
    const cargar = async (src?: string | null) => {
      if (!src) return null;
      try {
        const ab = await (await fetch(src)).arrayBuffer();
        try {
          return await c.decodeAudioData(ab.slice(0));
        } catch {
          // una nota grabada en Android (Opus) que este móvil no sabe leer
          if (!tieneOpus(ab)) return null;
          const { decodificarOpus } = await import('./opus');
          return await decodificarOpus(ab, c);
        }
      } catch {
        return null;
      }
    };
    const [primero, ...resto] = await Promise.all([
      cargar(vozInicio),
      ...trozos.map((t) => cargar(t.voice!.uri)),
      cargar(fin?.audio),
    ]);
    const final = resto.pop() ?? null;
    setPreparando(false);
    if (!vivo.current) return;

    // sin voz de la narradora para el comienzo: lo lee el móvil primero
    if (!primero) {
      setSonando(-1);
      await leer(inicio);
      if (!vivo.current) return;
    }
    const piezas: { buf: AudioBuffer | null; i: number }[] = [
      ...(primero ? [{ buf: primero, i: -1 }] : []),
      ...resto.map((buf, i) => ({ buf, i })),
      ...(final ? [{ buf: final, i: trozos.length }] : []),
    ];
    let t = c.currentTime + 0.15;
    for (const p of piezas) {
      if (!p.buf) continue;
      const { desde, hasta } = recorte(p.buf);
      const src = c.createBufferSource();
      src.buffer = p.buf;
      const g = c.createGain();
      // fundidos cortos: sin chasquidos ni colas de ruido
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(1, t + 0.02);
      g.gain.setValueAtTime(1, t + Math.max(0.03, hasta - desde - 0.08));
      g.gain.linearRampToValueAtTime(0, t + (hasta - desde));
      src.connect(g).connect(c.destination);
      src.start(t, desde, hasta - desde);
      fuentes.current.push(src);
      const cuando = (t - c.currentTime) * 1000;
      relojes.current.push(setTimeout(() => vivo.current && setSonando(p.i), Math.max(0, cuando)));
      t += hasta - desde + 0.18;
    }
    relojes.current.push(
      setTimeout(
        () => {
          if (!vivo.current) return;
          // sin voz para el final: lo lee el móvil al terminar
          if (fin && !final) {
            setSonando(trozos.length);
            leer(fin.texto).then(() => vivo.current && setSonando(null));
          } else setSonando(null);
        },
        Math.max(0, (t - c.currentTime) * 1000),
      ),
    );
  };

  return { sonando, preparando, cierre, escribiendo, escuchar, parar };
}
