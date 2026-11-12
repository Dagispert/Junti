import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Hand, SerifItalic } from '@/constants/theme';

import { EASE } from './motion';

const base =
  typeof window !== 'undefined' && window.location?.pathname.startsWith('/Junti') ? '/Junti' : '';

type Shot = {
  src: string;
  caption?: string;
  /** Aparece cuando la narradora llega a estas palabras. */
  cue: string;
  /** Posición (fracción de la pantalla), giro y tamaño (fracción del ancho). */
  x: number;
  y: number;
  rot: number;
  size: number;
  /** Las caras se alejan cuando habla de chats que se pierden. */
  face?: boolean;
};

// Primero, la gente que quieres; luego, los días pequeños de cada uno, en
// sitios distintos del mundo; al final, todo se junta.
const SHOTS: Shot[] = [
  { src: 'cara-rey', cue: 'gente que quieres', x: 0.04, y: 0.07, rot: -7, size: 0.27, face: true },
  { src: 'cara-marta', cue: 'gente que quieres', x: 0.69, y: 0.05, rot: 6, size: 0.27, face: true },
  { src: 'cara-tomas', cue: 'vive lejos', x: 0.37, y: 0.15, rot: -2, size: 0.25, face: true },
  { src: 'cara-diego', cue: 'vive lejos', x: 0.74, y: 0.2, rot: 9, size: 0.22, face: true },
  { src: 'ramen', caption: 'Tokio', cue: 'días pequeños', x: 0.03, y: 0.6, rot: -8, size: 0.31 },
  {
    src: 'mate',
    caption: 'Buenos Aires',
    cue: 'pequeños de los demás',
    x: 0.64,
    y: 0.59,
    rot: 7,
    size: 0.31,
  },
  {
    src: 'domino',
    caption: 'La Habana',
    cue: 'de los demás',
    x: 0.34,
    y: 0.64,
    rot: -3,
    size: 0.3,
  },
  { src: 'aleman', caption: 'Berlín', cue: 'crear recuerdos', x: 0.06, y: 0.22, rot: 5, size: 0.3 },
  {
    src: 'rodilla',
    caption: 'agosto del 97',
    cue: 'la memoria',
    x: 0.6,
    y: 0.25,
    rot: -6,
    size: 0.3,
  },
];
const GATHER_CUE = 'estéis donde estéis';
const DIM_CUE = 'chats que se pierden';
const UNDIM_CUE = 'Junti no es';

/**
 * «Por qué existe Junti»: a pantalla completa, sin bocadillo. Las palabras se
 * encienden mientras la narradora habla y van cayendo polaroids del mundo; al
 * final se juntan todas, como el grupo.
 */
export function WhyJunti({ text, spoken }: { text: string; spoken: number }) {
  const { width, height } = useWindowDimensions();
  const at = Math.floor(text.length * Math.min(1, spoken));
  const reached = (cue: string) => {
    const i = text.indexOf(cue);
    return i >= 0 && at >= i;
  };
  const gathered = reached(GATHER_CUE);
  const dimmed = reached(DIM_CUE) && !reached(UNDIM_CUE);

  // La frase que se está diciendo, con sus palabras.
  const sentences = useMemo(() => {
    const out: { start: number; words: { w: string; at: number }[] }[] = [];
    const re = /[^.:]+[.:]?/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const words: { w: string; at: number }[] = [];
      const wr = /\S+/g;
      let w: RegExpExecArray | null;
      while ((w = wr.exec(m[0]))) words.push({ w: w[0], at: m.index + w.index });
      if (words.length) out.push({ start: words[0].at, words });
    }
    return out;
  }, [text]);
  const current = [...sentences].reverse().find((s) => s.start <= Math.max(at, 1)) ?? sentences[0];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={['#0B0F1A', '#141B2B', '#1E1828']} style={StyleSheet.absoluteFill} />
      {SHOTS.map((s, i) => (
        <Polaroid
          key={s.src}
          shot={s}
          index={i}
          width={width}
          height={height}
          shown={reached(s.cue)}
          gathered={gathered}
          dimmed={dimmed && !!s.face}
        />
      ))}
      <View style={[styles.textBand, { top: height * 0.42, minHeight: height * 0.2 }]}>
        <Text key={current?.start} style={[styles.words, { fontSize: width < 380 ? 27 : 31 }]}>
          {current?.words.map((w, i) => (
            <Text
              key={i}
              style={[
                styles.word,
                { opacity: w.at <= at ? 1 : 0.14 },
                // En la web, cada palabra se enciende con una transición suave.
                { transitionProperty: 'opacity', transitionDuration: '380ms' } as object,
              ]}>
              {w.w}{' '}
            </Text>
          ))}
        </Text>
      </View>
    </View>
  );
}

function Polaroid({
  shot,
  index,
  width,
  height,
  shown,
  gathered,
  dimmed,
}: {
  shot: Shot;
  index: number;
  width: number;
  height: number;
  shown: boolean;
  gathered: boolean;
  dimmed: boolean;
}) {
  const show = useSharedValue(0);
  const join = useSharedValue(0);
  const dim = useSharedValue(0);
  useEffect(() => {
    show.value = withTiming(shown ? 1 : 0, { duration: 750, easing: EASE });
  }, [shown, show]);
  useEffect(() => {
    join.value = withTiming(gathered ? 1 : 0, { duration: 1400, easing: EASE });
  }, [gathered, join]);
  useEffect(() => {
    dim.value = withTiming(dimmed ? 1 : 0, { duration: 900, easing: EASE });
  }, [dimmed, dim]);

  const w = width * shot.size;
  const x = width * shot.x;
  const y = height * shot.y;
  // Al juntarse: un abanico apretado arriba, en el centro.
  const n = SHOTS.length;
  const spread = (index - (n - 1) / 2) / ((n - 1) / 2); // -1 … 1
  const gx = width / 2 - w / 2 + spread * width * 0.2;
  const gy = height * 0.14 + Math.abs(spread) * 24;
  const grot = spread * 14;

  const style = useAnimatedStyle(() => {
    const s = show.value;
    const j = join.value;
    const d = dim.value;
    // Se separan (y se apagan) mientras habla de chats que se pierden.
    const drift = d * (shot.x < 0.5 ? -18 : 18);
    return {
      opacity: s * (1 - d * 0.6),
      transform: [
        { translateX: x + (gx - x) * j + drift },
        { translateY: y + (gy - y) * j - (1 - s) * 30 },
        { rotate: `${shot.rot + (1 - s) * 12 + (grot - shot.rot) * j}deg` },
        { scale: (1.25 - 0.25 * s) * (1 - 0.18 * j) },
      ],
    };
  });

  return (
    <Animated.View style={[styles.polaroid, { width: w }, style]}>
      <Image
        source={{ uri: `${base}/guia/fotos/${shot.src}.jpg` }}
        style={{ width: w - 12, height: w - 12 }}
        contentFit="cover"
      />
      <Text numberOfLines={1} style={[styles.caption, { fontSize: Math.max(13, w * 0.11) }]}>
        {shot.caption ?? ''}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  textBand: {
    position: 'absolute',
    left: 24,
    right: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  words: {
    fontFamily: SerifItalic,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 40,
    maxWidth: 520,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 18,
  },
  word: { color: '#FFFFFF' },
  polaroid: {
    position: 'absolute',
    left: 0,
    top: 0,
    backgroundColor: '#FBFAF6',
    padding: 6,
    paddingBottom: 4,
    borderRadius: 3,
    boxShadow: '0 14px 30px rgba(0,0,0,0.45)',
  },
  caption: { fontFamily: Hand, color: '#2A2A2A', textAlign: 'center', marginTop: 2 },
});
