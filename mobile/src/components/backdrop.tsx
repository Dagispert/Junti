import { StyleSheet, View } from 'react-native';

// Fondo plano (fuera de la web, sin transición).
export function Backdrop({ color }: { color: string; originY?: number }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color }]} />
  );
}
