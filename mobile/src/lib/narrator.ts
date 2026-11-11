import { Platform } from 'react-native';

// El reproductor de la voz de la narradora: uno solo para toda la app, para
// poder «desbloquearlo» con un toque (en iPhone el audio solo puede empezar
// tras un toque) y que luego hable cuando le toque.

let element: HTMLAudioElement | null = null;

export function narratorAudio(): HTMLAudioElement | null {
  if (Platform.OS !== 'web' || typeof Audio === 'undefined') return null;
  if (!element) {
    element = new Audio();
    element.preload = 'auto';
  }
  return element;
}

/** Un instante de silencio en WAV, para desbloquear el reproductor. */
function silence(): string {
  const bytes = new Uint8Array(44 + 800);
  const v = new DataView(bytes.buffer);
  const text = (at: number, s: string) =>
    [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  v.setUint32(4, 36 + 800, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true);
  v.setUint32(28, 16000, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  text(36, 'data');
  v.setUint32(40, 800, true);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return `data:audio/wav;base64,${btoa(binary)}`;
}

/** Llamarlo dentro de un toque (al abrir el resumen): deja la voz lista para hablar. */
export function primeNarrator() {
  const a = narratorAudio();
  if (!a || (a.src && !a.src.startsWith('data:'))) return;
  try {
    a.src = silence();
    a.play()
      .then(() => a.pause())
      .catch(() => {});
  } catch {
    // sin voz: quedan los subtítulos
  }
}

export function stopNarrator() {
  const a = narratorAudio();
  if (a) {
    a.pause();
    a.removeAttribute('src');
    a.load();
  }
}
