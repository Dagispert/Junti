import { type ReactNode, useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

// La identidad de movimiento de Junti, en pocas constantes:
// - Una curva para casi todo: arranca rápido y aterriza suave (lo que entra).
// - Su contraria para lo que se va: arranca suave y se va deprisa.
// - Tres duraciones: rápida (respuesta al toque), normal (tarjetas), lenta (escenas).

/** La curva de siempre: salida suave, sin rebotes. */
export const EASE = Easing.out(Easing.cubic);
/** Para lo que entra y debe llamar la atención: frena más al final. */
export const EASE_IN_VIEW = Easing.bezier(0.05, 0.7, 0.1, 1);
/** Para lo que se va. */
export const EASE_OUT_VIEW = Easing.bezier(0.3, 0, 1, 1);
export const DURATION = { quick: 160, normal: 320, slow: 520 } as const;

/**
 * Aparecer «posándose»: sube un poco mientras aparece, con la curva de entrada.
 * (Antes era un Keyframe con escala, pero en la web sacaba la pieza del flujo de
 * la página y le quitaba su giro: el resto de la pantalla se le montaba encima.)
 * Si la pieza tiene su propio giro o transformación, pon la animación en un
 * envoltorio y el giro dentro.
 */
export function popIn(delay = 0, duration: number = DURATION.slow) {
  return FadeInDown.duration(duration).delay(delay).easing(EASE_IN_VIEW);
}

/** Entrada suave desde abajo, escalonada según su posición en la lista. */
export function Appear({
  index = 0,
  children,
  style,
}: {
  index?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View
      entering={FadeInDown.duration(DURATION.normal + 80)
        .delay(Math.min(index, 6) * 60)
        .easing(EASE_IN_VIEW)}
      style={style}>
      {children}
    </Animated.View>
  );
}

/** Pulsable que se hunde un poco al tocarlo. */
export function PressScale({
  children,
  style,
  ...rest
}: PressableProps & { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        scale.value = withTiming(0.97, { duration: 120, easing: EASE });
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withTiming(1, { duration: 220, easing: EASE_IN_VIEW });
        rest.onPressOut?.(e);
      }}>
      <Animated.View style={[animated, style]}>{children}</Animated.View>
    </Pressable>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Muelles y cambios de contenido (el lenguaje de las interfaces que se
// transforman: una sola forma que cambia de tamaño, radio y color con muelles
// de rebote mínimo, y su contenido que cambia con un desenfoque corto).
// ───────────────────────────────────────────────────────────────────────────

/** El muelle de siempre: llega rápido y apenas se pasa (un rebote mínimo). */
export const SPRING = { damping: 19, stiffness: 240, mass: 1 } as const;
/** El borde que va delante (indicadores que se estiran). */
export const SPRING_LEAD = { damping: 22, stiffness: 420, mass: 0.8 } as const;
/** El borde que va detrás. */
export const SPRING_TRAIL = { damping: 20, stiffness: 170, mass: 1 } as const;

const isWeb = Platform.OS === 'web';

/**
 * Un número que rueda cuando cambia: el viejo se va (hacia arriba si sube,
 * hacia abajo si baja) y el nuevo llega desde el otro lado, con un desenfoque
 * corto en la web.
 */
export function RollingNumber({
  value,
  style,
}: {
  value: number | string;
  style?: StyleProp<TextStyle>;
}) {
  const [shown, setShown] = useState({ cur: value, prev: value, dir: 1, n: 0 });
  const p = useSharedValue(1);
  useEffect(() => {
    if (value === shown.cur) return;
    const up = Number(value) >= Number(shown.cur) ? 1 : -1;
    setShown((s) => ({ cur: value, prev: s.cur, dir: up, n: s.n + 1 }));
    p.value = 0;
    p.value = withTiming(1, { duration: 300, easing: EASE_IN_VIEW });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const dir = shown.dir;
  const prevStyle = useAnimatedStyle(() => ({
    opacity: 1 - p.value,
    transform: [{ translateY: -dir * 10 * p.value }],
    ...(isWeb ? ({ filter: `blur(${(p.value * 3).toFixed(2)}px)` } as object) : {}),
  }));
  const curStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: dir * 10 * (1 - p.value) }],
    ...(isWeb ? ({ filter: `blur(${((1 - p.value) * 3).toFixed(2)}px)` } as object) : {}),
  }));
  return (
    <View>
      {shown.n > 0 && (
        <Animated.Text style={[style, prevStyle, { position: 'absolute', left: 0, top: 0 }]}>
          {shown.prev}
        </Animated.Text>
      )}
      <Animated.Text style={[style, curStyle]}>{shown.cur}</Animated.Text>
    </View>
  );
}

/** Un toque «con muelle»: se hunde y vuelve a su sitio pasándose un pelín. */
export function usePop() {
  const s = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const pop = () => {
    s.value = withSequence(withTiming(0.86, { duration: 90, easing: EASE }), withSpring(1, SPRING));
  };
  return { style, pop };
}
