import { useEffect, useRef, useState } from 'react';

export type VoiceResult = { uri: string; mime: string; duration: number; waveform: number[] };

const MAX_SECONDS = 120;
const BARS = 48;

/** Reduce una serie de niveles a «n» barras (0–100). */
function downsample(levels: number[], n: number): number[] {
  if (!levels.length) return [];
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const from = Math.floor((i / n) * levels.length);
    const to = Math.max(from + 1, Math.floor(((i + 1) / n) * levels.length));
    const slice = levels.slice(from, to);
    out.push(Math.round(Math.max(...slice)));
  }
  return out;
}

/** Grabar una nota de voz con el micrófono del navegador (hasta 2 minutos). */
export function useVoiceRecorder() {
  const supported =
    typeof window !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined';
  const [state, setState] = useState<'idle' | 'recording' | 'done'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [result, setResult] = useState<VoiceResult>();
  const [error, setError] = useState('');
  const rec = useRef<{
    recorder: MediaRecorder;
    stream: MediaStream;
    ctx: AudioContext;
    timer: number;
    started: number;
  } | null>(null);
  const all = useRef<number[]>([]);

  const cleanup = () => {
    const r = rec.current;
    if (!r) return;
    clearInterval(r.timer);
    r.stream.getTracks().forEach((t) => t.stop());
    r.ctx.close().catch(() => {});
    rec.current = null;
  };
  useEffect(() => cleanup, []);

  const stop = () => {
    const r = rec.current;
    if (r && r.recorder.state !== 'inactive') r.recorder.stop();
  };

  const start = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime =
        ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'].find((m) =>
          MediaRecorder.isTypeSupported(m),
        ) ?? '';
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      // Nivel del sonido en vivo, para las barras y la forma de onda guardada.
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      all.current = [];
      const started = Date.now();
      const timer = window.setInterval(() => {
        analyser.getByteTimeDomainData(buf);
        let peak = 0;
        for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
        const level = Math.min(100, (peak / 128) * 160);
        all.current.push(level);
        setLevels(all.current.slice(-BARS));
        const s = (Date.now() - started) / 1000;
        setSeconds(s);
        if (s >= MAX_SECONDS) stop();
      }, 100);
      recorder.onstop = () => {
        const duration = (Date.now() - started) / 1000;
        const type = recorder.mimeType || mime || 'audio/webm';
        const blob = new Blob(chunks, { type });
        setResult({
          uri: URL.createObjectURL(blob),
          mime: type.split(';')[0],
          duration,
          waveform: downsample(all.current, BARS),
        });
        setState('done');
        cleanup();
      };
      rec.current = { recorder, stream, ctx, timer, started };
      recorder.start(250);
      setSeconds(0);
      setState('recording');
    } catch {
      cleanup();
      setError('No hay permiso para usar el micrófono. Puedes darlo en los ajustes del navegador.');
    }
  };

  const reset = () => {
    if (result) URL.revokeObjectURL(result.uri);
    setResult(undefined);
    setLevels([]);
    setSeconds(0);
    setState('idle');
  };

  return { supported, state, seconds, levels, result, error, start, stop, reset };
}
