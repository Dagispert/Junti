import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

export type Burst = { id: number; emoji: string };

const PARTICLES = 9;
const DURATION = 1500;

/**
 * Al reaccionar, el emoji sale del botón y sube flotando por encima de la
 * publicación: varias copias, cada una con su deriva, giro y tamaño.
 * Se dibuja encima de la tarjeta y no captura toques.
 */
export function EmojiBursts({
  bursts,
  height,
  onDone,
}: {
  bursts: Burst[];
  /** Alto de la tarjeta: hasta dónde pueden subir. */
  height: number;
  onDone: (id: number) => void;
}) {
  if (!height) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {bursts.map((b) => (
        <BurstGroup key={b.id} burst={b} height={height} onDone={onDone} />
      ))}
    </View>
  );
}

function BurstGroup({
  burst,
  height,
  onDone,
}: {
  burst: Burst;
  height: number;
  onDone: (id: number) => void;
}) {
  // Cada partícula con su propio azar, fijado al nacer el estallido.
  const parts = useMemo(
    () =>
      Array.from({ length: PARTICLES }, (_, i) => ({
        x: 6 + Math.random() * 70, // % desde la izquierda
        drift: (Math.random() - 0.5) * 90,
        rise: height * (0.45 + Math.random() * 0.45),
        size: 22 + Math.random() * 22,
        spin: (Math.random() - 0.5) * 70,
        delay: i * 70 + Math.random() * 60,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [burst.id],
  );
  return (
    <>
      {parts.map((p, i) => (
        <Particle
          key={i}
          emoji={burst.emoji}
          {...p}
          last={i === parts.length - 1}
          onDone={() => onDone(burst.id)}
        />
      ))}
    </>
  );
}

function Particle({
  emoji,
  x,
  drift,
  rise,
  size,
  spin,
  delay,
  last,
  onDone,
}: {
  emoji: string;
  x: number;
  drift: number;
  rise: number;
  size: number;
  spin: number;
  delay: number;
  last: boolean;
  onDone: () => void;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      delay,
      withTiming(1, { duration: DURATION, easing: Easing.out(Easing.cubic) }, (done) => {
        if (done && last) runOnJS(onDone)();
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => {
    const p = t.value;
    // Sube, se mece de lado a lado y se desvanece al final.
    const sway = Math.sin(p * Math.PI * 2.2) * 10;
    const scale = p < 0.18 ? 0.3 + (p / 0.18) * 0.95 : 1.25 - (p - 0.18) * 0.45;
    return {
      opacity: p === 0 ? 0 : p < 0.65 ? 1 : 1 - (p - 0.65) / 0.35,
      transform: [
        { translateX: drift * p + sway },
        { translateY: -rise * p },
        { rotate: `${spin * p}deg` },
        { scale },
      ],
    };
  });
  return (
    <Animated.View style={[styles.particle, { left: `${x}%` }, style]}>
      <Text style={{ fontSize: size }}>{emoji}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  particle: { position: 'absolute', bottom: 40 },
});
