import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  Easing,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/** La única curva de la app: salida suave, sin rebotes. */
export const EASE = Easing.out(Easing.cubic);

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
      entering={FadeInDown.duration(360)
        .delay(Math.min(index, 6) * 80)
        .duration(360)}
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
        scale.value = withTiming(0.98, { duration: 120, easing: EASE });
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withTiming(1, { duration: 180, easing: EASE });
        rest.onPressOut?.(e);
      }}>
      <Animated.View style={[animated, style]}>{children}</Animated.View>
    </Pressable>
  );
}
