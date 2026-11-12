import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Hand } from '@/constants/theme';

/** Letras por segundo cuando no hay voz que marque el ritmo. */
const PACE = 15;

/**
 * Subtítulo de la narradora, escrito a mano y sin recuadro. Las letras
 * aparecen al ritmo de su voz («progress», de 0 a 1). Sin voz, aparecen a
 * ritmo de lectura y avisa al terminar para pasar a la siguiente foto.
 */
export function Subtitle({
  text,
  progress,
  paused,
  onDone,
  bottom = 28,
}: {
  text: string;
  /** Lo que lleva dicho la voz (0–1). Sin voz, se omite. */
  progress?: number;
  paused: boolean;
  onDone: () => void;
  bottom?: number;
}) {
  const [timed, setTimed] = useState(0);
  const elapsed = useRef(0);
  const done = useRef(onDone);
  done.current = onDone;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const voiced = progress !== undefined;

  // Sin voz: el reloj de lectura.
  useEffect(() => {
    if (voiced) return;
    let last = Date.now();
    let finished = false;
    const id = setInterval(() => {
      const now = Date.now();
      if (!pausedRef.current) elapsed.current += now - last;
      last = now;
      setTimed(Math.min(text.length, Math.floor((elapsed.current / 1000) * PACE)));
      if (!finished && elapsed.current > (text.length / PACE) * 1000 + 1800) {
        finished = true;
        done.current();
      }
    }, 50);
    return () => clearInterval(id);
  }, [text, voiced]);

  // Con voz: un pelín por delante de lo dicho, para que se lea con fluidez.
  const shown = voiced
    ? Math.min(text.length, Math.ceil(Math.min(1, progress * 1.08 + 0.02) * text.length))
    : timed;

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
  band: { position: 'absolute', left: 22, right: 22 },
  text: {
    fontFamily: Hand,
    color: '#2A2724',
    fontSize: 28,
    lineHeight: 33,
    textAlign: 'center',
  },
  hidden: { color: 'transparent' },
});
