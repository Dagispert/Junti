import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';

import { localHour, skyPhase, type SkyPhase } from '@/lib/geo';

const SKIES: Record<SkyPhase, [string, string]> = {
  night: ['#0B1230', '#2A3466'],
  dawn: ['#FFB38A', '#8A86D4'],
  day: ['#4FB0EE', '#BDE3FA'],
  dusk: ['#F48C4E', '#5E4594'],
};

/**
 * Un trocito del cielo de alguien: el color y la posición del sol o la luna
 * según la hora que es (o era, si se pasa «at») donde vive esa persona.
 */
export function SkyBadge({ tz, size = 20, at }: { tz: string; size?: number; at?: number }) {
  const hour = localHour(tz, at);
  const phase = skyPhase(hour);
  // El astro recorre el círculo de izquierda a derecha a lo largo de su medio día.
  const span = phase === 'night' ? ((hour + 3) % 24) / 8 : (hour - 5) / 16;
  const x = Math.min(0.85, Math.max(0.15, span));
  const y = 0.62 - Math.sin(x * Math.PI) * 0.34;
  const orb = size * (phase === 'night' ? 0.3 : 0.34);

  return (
    <View
      accessibilityLabel={`Cielo a las ${Math.floor(hour)}:${String(Math.floor((hour % 1) * 60)).padStart(2, '0')}`}
      style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
      <LinearGradient colors={SKIES[phase]} style={{ flex: 1 }} />
      {phase === 'night' &&
        [
          [0.22, 0.3],
          [0.7, 0.22],
          [0.58, 0.68],
        ].map(([sx, sy], i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: sx * size,
              top: sy * size,
              width: Math.max(1, size * 0.06),
              height: Math.max(1, size * 0.06),
              borderRadius: size,
              backgroundColor: 'rgba(255,255,255,0.85)',
            }}
          />
        ))}
      <View
        style={{
          position: 'absolute',
          left: x * size - orb / 2,
          top: y * size - orb / 2,
          width: orb,
          height: orb,
          borderRadius: orb,
          backgroundColor: phase === 'night' ? '#F4F1E8' : phase === 'day' ? '#FFF6C9' : '#FFE0A8',
          boxShadow:
            phase === 'night' ? '0 0 6px rgba(244,241,232,0.7)' : '0 0 8px rgba(255,214,120,0.9)',
        }}
      />
    </View>
  );
}
