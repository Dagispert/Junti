import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { Hand, useTheme } from '@/constants/theme';
import type { Moment } from '@/data/types';

import { Photo } from './ui';

// Piezas de álbum de recortes: polaroids, cinta adhesiva, pegatinas y notas.

const rot = (seed: string, range = 7) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 1000) / 1000 - 0.5) * 2 * range;
};

/** Foto con marco de polaroid. Al tocarla se abre en grande. */
export function Polaroid({
  moment,
  width = 120,
  rotate,
  caption,
  style,
}: {
  moment: Moment;
  width?: number;
  rotate?: number;
  caption?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const r = rotate ?? rot(moment.id);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={moment.text ?? 'Ver el momento'}
      onPress={() => router.push({ pathname: '/moment/[id]', params: { id: moment.id } })}
      style={[
        styles.polaroid,
        {
          width,
          padding: width * 0.06,
          paddingBottom: width * 0.2,
          transform: [{ rotate: `${r}deg` }],
        },
        style,
      ]}>
      <Photo moment={moment} style={{ width: '100%', aspectRatio: 1 }} />
      {!!caption && (
        <Text
          numberOfLines={1}
          style={[styles.polaroidCaption, { fontSize: Math.max(13, width * 0.12) }]}>
          {caption}
        </Text>
      )}
    </Pressable>
  );
}

/** Un montón de polaroids que caen y se quedan desordenadas. */
export function PolaroidPile({ moments, size = 300 }: { moments: Moment[]; size?: number }) {
  const shown = moments.slice(0, 7);
  const w = size * 0.42;
  return (
    <View style={{ width: size, height: size * 0.82, alignSelf: 'center' }}>
      {shown.map((m, i) => {
        const angle = (i / Math.max(1, shown.length)) * Math.PI * 2;
        const spread = i === shown.length - 1 ? 0 : 0.22;
        const left = size / 2 - w / 2 + Math.cos(angle) * size * spread;
        const top = size * 0.36 - w * 0.6 + Math.sin(angle) * size * spread * 0.7;
        return (
          <Animated.View
            key={m.id}
            entering={ZoomIn.delay(150 + i * 110).duration(360)}
            style={{ position: 'absolute', left, top, zIndex: i }}>
            <Polaroid moment={m} width={w} rotate={rot(m.id, 14)} />
          </Animated.View>
        );
      })}
    </View>
  );
}

/** Trozo de cinta adhesiva (washi) para «pegar» cosas. */
export function Tape({
  color = 'rgba(247, 214, 120, 0.75)',
  rotate = -6,
  style,
}: {
  color?: string;
  rotate?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      pointerEvents="none"
      style={[
        {
          width: 64,
          height: 18,
          backgroundColor: color,
          transform: [{ rotate: `${rotate}deg` }],
          opacity: 0.9,
        },
        style,
      ]}
    />
  );
}

/** Pegatina: un emoji con borde blanco grueso y sombra, que aparece con un rebote. */
export function Sticker({
  emoji,
  size = 44,
  rotate = 0,
  delay = 0,
  style,
}: {
  emoji: string;
  size?: number;
  rotate?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View
      pointerEvents="none"
      entering={ZoomIn.delay(delay).duration(360)}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 6px 14px rgba(20,22,26,0.18)',
          transform: [{ rotate: `${rotate}deg` }],
        },
        style,
      ]}>
      <Text style={{ fontSize: size * 0.58 }}>{emoji}</Text>
    </Animated.View>
  );
}

/** Nota adhesiva escrita a mano, con su clip. */
export function StickyNote({
  children,
  color = '#BFE3EE',
  rotate = 4,
  width = 120,
  delay = 0,
  style,
}: {
  children: ReactNode;
  color?: string;
  rotate?: number;
  width?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View
      pointerEvents="none"
      entering={FadeInDown.delay(delay).duration(360)}
      style={[
        {
          width,
          minHeight: width * 0.7,
          backgroundColor: color,
          padding: 12,
          paddingTop: 20,
          borderRadius: 4,
          boxShadow: '0 8px 16px rgba(20,22,26,0.15)',
          transform: [{ rotate: `${rotate}deg` }],
          justifyContent: 'center',
        },
        style,
      ]}>
      <View style={styles.clip} />
      <Text style={styles.noteText}>{children}</Text>
    </Animated.View>
  );
}

/** Texto manuscrito suelto, como una anotación al margen. */
export function Scribble({
  children,
  size = 20,
  color,
  rotate = -3,
  style,
}: {
  children: ReactNode;
  size?: number;
  color?: string;
  rotate?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View pointerEvents="none" style={[{ transform: [{ rotate: `${rotate}deg` }] }, style]}>
      <Text
        style={{
          fontFamily: Hand,
          fontSize: size,
          lineHeight: size * 1.05,
          color: color ?? theme.textSecondary,
        }}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  polaroid: {
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
    boxShadow: '0 10px 22px rgba(20,22,26,0.18)',
  },
  polaroidCaption: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 4,
    fontFamily: Hand,
    color: '#3C3F44',
    textAlign: 'center',
  },
  clip: {
    position: 'absolute',
    top: -10,
    right: 18,
    width: 12,
    height: 26,
    borderWidth: 2,
    borderColor: '#9AA3AA',
    borderRadius: 6,
  },
  noteText: {
    fontFamily: Hand,
    fontSize: 24,
    lineHeight: 23,
    color: '#3D5C66',
    textAlign: 'center',
  },
});
