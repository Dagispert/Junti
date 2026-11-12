import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

// Una frase grabada de la narradora (archivos en public/). Suena sola al
// cambiar de frase; si el navegador no deja sonar sin un toque, se avisa con
// «needsTap». Silenciarla se recuerda en este dispositivo.

const web = Platform.OS === 'web' && typeof window !== 'undefined';
const base = web && window.location.pathname.startsWith('/Junti') ? '/Junti' : '';
const MUTE_KEY = 'junti-voz-silenciada';

const readMuted = () => {
  try {
    return web && localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
};

export function useVoiceClip(path: string | null) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [needsTap, setNeedsTap] = useState(false);
  const [muted, setMutedState] = useState(readMuted);

  useEffect(() => {
    if (!web || !path) return;
    if (!audio.current) audio.current = new Audio();
    const a = audio.current;
    a.src = `${base}/${path}`;
    a.muted = readMuted();
    setProgress(0);
    const onTime = () => setProgress(a.duration ? a.currentTime / a.duration : 0);
    const onEnd = () => setProgress(1);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('ended', onEnd);
    a.play()
      .then(() => setNeedsTap(false))
      .catch(() => setNeedsTap(true));
    return () => {
      a.pause();
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('ended', onEnd);
    };
  }, [path]);

  useEffect(() => () => audio.current?.pause(), []);

  const setMuted = useCallback((m: boolean) => {
    setMutedState(m);
    if (audio.current) audio.current.muted = m;
    try {
      localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    } catch {
      // sin almacenamiento: solo para esta vez
    }
  }, []);

  const play = useCallback(() => {
    const a = audio.current;
    if (!a) return;
    if (a.ended) a.currentTime = 0;
    a.play()
      .then(() => setNeedsTap(false))
      .catch(() => {});
  }, []);

  return { progress, needsTap, muted, setMuted, play };
}
