import { Platform } from 'react-native';

// La voz de la narradora: la síntesis de voz del propio dispositivo. Gratis,
// instantánea y sin enviar nada a nadie. (En la app nativa llegará después.)

type Synth = typeof window.speechSynthesis;
const synth: Synth | null =
  Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window
    ? window.speechSynthesis
    : null;

export const speechSupported = !!synth;

let chosen: SpeechSynthesisVoice | null = null;

/** La mejor voz en español disponible: de España si hay, y de las «naturales» si hay. */
function voice(): SpeechSynthesisVoice | null {
  if (!synth) return null;
  if (chosen) return chosen;
  const all = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith('es'));
  if (!all.length) return null;
  const score = (v: SpeechSynthesisVoice) =>
    (/^es[-_]es/i.test(v.lang) ? 4 : 0) +
    (/natural|neural|premium|enhanced|mejorad/i.test(v.name) ? 5 : 0) +
    (/google|microsoft/i.test(v.name) ? 2 : 0) +
    (/m[oó]nica|luc[ií]a|elvira|marisol|paulina|helena|elena/i.test(v.name) ? 1 : 0) +
    (v.localService ? 0 : 1);
  chosen = [...all].sort((a, b) => score(b) - score(a))[0];
  return chosen;
}
if (synth) synth.addEventListener?.('voiceschanged', () => (chosen = null));

/**
 * En iPhone, la voz solo puede empezar tras un toque. Llamarlo dentro de un
 * toque (por ejemplo, al abrir el resumen) deja la voz lista para después.
 */
export function unlockSpeech() {
  if (!synth) return;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    synth.speak(u);
  } catch {
    // sin voz: quedan los subtítulos
  }
}

export type Speaking = { cancel: () => void; pause: () => void; resume: () => void };

/** Dice un texto. Avisa de cada palabra (para los subtítulos) y de cuándo termina. */
export function speak(
  text: string,
  on: { word?: (end: number) => void; end?: () => void; fail?: () => void },
): Speaking | null {
  if (!synth) return null;
  let cancelled = false;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = voice();
  if (v) u.voice = v;
  u.lang = v?.lang ?? 'es-ES';
  u.rate = 1;
  u.pitch = 1;
  u.onboundary = (e) => {
    if (cancelled || (e.name && e.name !== 'word')) return;
    const rest = text.slice(e.charIndex);
    const len = e.charLength || rest.search(/\s|$/);
    on.word?.(e.charIndex + Math.max(1, len));
  };
  u.onend = () => !cancelled && on.end?.();
  u.onerror = (e) => {
    if (!cancelled && e.error !== 'interrupted' && e.error !== 'canceled') on.fail?.();
  };
  // Chrome a veces ignora un «speak» justo después de «cancel».
  setTimeout(() => !cancelled && synth.speak(u), 60);
  return {
    cancel: () => {
      cancelled = true;
      synth.cancel();
    },
    pause: () => synth.pause(),
    resume: () => synth.resume(),
  };
}

export function stopSpeech() {
  synth?.cancel();
}
