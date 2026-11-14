import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

import { type Mood, type Sky, skyColors, type Travel } from '@/lib/film';

// Fuera de la web no hay lienzo: queda el color del cielo de esa hora.
export function Atmosphere({
  sky,
}: {
  sky: Sky;
  mood: Mood;
  travel?: Travel | null;
  paused?: boolean;
}) {
  const { top, bottom } = skyColors(sky);
  const css = (c: number[]) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  return <LinearGradient colors={[css(top), css(bottom)]} style={StyleSheet.absoluteFill} />;
}
