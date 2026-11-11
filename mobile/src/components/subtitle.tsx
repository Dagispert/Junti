import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { speak, type Speaking } from '@/lib/speech';

/** Letras por segundo cuando no hay voz (o mientras no avisa de sus palabras). */
const PACE = 15;

/**
 * Subtítulo de la narradora: las letras aparecen al ritmo de su voz. Si no hay
 * voz (silenciada o no disponible), aparecen a ritmo de lectura. Avisa al
 * terminar para pasar a la siguiente foto.
 */
export function Subtitle({
  text,
  voice,
  paused,
  onDone,
  bottom = 28,
}: {
  text: string;
  voice: boolean;
  paused: boolean;
  onDone: () => void;
  bottom?: number;
}) {
  const [shown, setShown] = useState(0);
  const elapsed = useRef(0);
  const spoken = useRef(0); // hasta dónde ha dicho la voz
  const speaking = useRef<Speaking | null>(null);
  const voiced = useRef(false); // la voz está hablando de verdad
  const finished = useRef(false);
  const done = useRef(onDone);
  done.current = onDone;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const finish = (delay: number) => {
    if (finished.current) return;
    finished.current = true;
    setShown(text.length);
    timer.current = setTimeout(() => done.current(), delay);
  };
  useEffect(
    () => () => {
      finished.current = true;
      clearTimeout(timer.current);
    },
    [],
  );

  // La voz.
  useEffect(() => {
    voiced.current = false;
    if (!voice) {
      speaking.current = null;
      return;
    }
    const s = speak(text, {
      word: (end) => {
        voiced.current = true;
        spoken.current = Math.max(spoken.current, end);
      },
      end: () => finish(900),
      fail: () => {
        voiced.current = false;
        speaking.current = null;
      },
    });
    speaking.current = s;
    return () => s?.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, voice]);

  // Pausa al mantener pulsado.
  useEffect(() => {
    if (paused) speaking.current?.pause();
    else speaking.current?.resume();
  }, [paused]);

  // El reloj de las letras.
  useEffect(() => {
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      if (!pausedRef.current) elapsed.current += now - last;
      last = now;
      if (finished.current) return;
      const byTime = (elapsed.current / 1000) * PACE;
      const reveal = voiced.current
        ? // Con voz: lo que ha dicho, y un poco por delante para que fluya.
          Math.min(text.length, Math.max(spoken.current, Math.min(byTime, spoken.current + 6)))
        : byTime;
      setShown(Math.min(text.length, Math.floor(reveal)));
      const reading = (text.length / PACE) * 1000;
      const withVoice = voice && speaking.current;
      // Sin voz: termina tras leerlo con calma. Con voz: si la voz no avisa, por si acaso.
      if (!withVoice && elapsed.current > reading + 1600) finish(0);
      if (withVoice && elapsed.current > reading * 2 + 5000) finish(0);
    }, 50);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, voice]);

  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      pointerEvents="none"
      style={[styles.band, { bottom }]}>
      <Text style={styles.text} accessibilityLabel={text}>
        {text.slice(0, shown)}
        <Text style={styles.hidden}>{text.slice(shown)}</Text>
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  band: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: 'rgba(24,21,19,0.78)',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  text: {
    color: '#fff',
    fontSize: 19,
    lineHeight: 27,
    fontWeight: '500',
    textAlign: 'center',
  },
  hidden: { color: 'transparent' },
});
