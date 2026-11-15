import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
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
