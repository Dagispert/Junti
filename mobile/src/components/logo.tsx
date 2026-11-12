import { Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path } from 'react-native-svg';

import { Brand } from '@/constants/brand';

const ARC = 'M16 42 Q 30 2, 50 30';
const ARC_LENGTH = 62;
const LAND_A = 'M14 30c6-6 13-5 17-1 3 3 1 7-3 8-5 1-6 6-10 6-4 0-8-4-7-8 0-2 1-4 3-5z';
const LAND_B = 'M38 44c3-4 9-5 13-2 3 2 3 7 0 9-4 3-10 4-13 1-2-2-2-5 0-8z';

/**
 * La marca: un pequeño planeta y el arco que une dos puntos lejanos, como en
 * el mapa de la app. «drawn» (0–1) anima el arco al dibujarse y los puntos.
 */
export function LogoMark({ size = 48, drawn = 1 }: { size?: number; drawn?: number }) {
  const start = Math.max(0, Math.min(1, drawn / 0.15));
  const end = Math.max(0, Math.min(1, (drawn - 0.8) / 0.2));
  const offset = ARC_LENGTH * (1 - Math.min(1, drawn / 0.85));
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <ClipPath id="junti-planeta">
          <Circle cx={32} cy={34} r={25} />
        </ClipPath>
      </Defs>
      <Circle cx={32} cy={34} r={25} fill={Brand.ocean} />
      <G clipPath="url(#junti-planeta)">
        <Path d={LAND_A} fill={Brand.meadow} />
        <Path d={LAND_B} fill={Brand.meadow} />
      </G>
      {[
        { color: '#FFFFFF', width: 7 },
        { color: Brand.sunset, width: 4 },
      ].map((stroke) => (
        <Path
          key={stroke.color}
          d={ARC}
          stroke={stroke.color}
          strokeWidth={stroke.width}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${ARC_LENGTH} ${ARC_LENGTH}`}
          strokeDashoffset={offset}
        />
      ))}
      <Circle
        cx={16}
        cy={42}
        r={5 * start}
        fill={Brand.sunset}
        stroke="#FFFFFF"
        strokeWidth={2 * start}
      />
      <Circle
        cx={50}
        cy={30}
        r={5 * end}
        fill={Brand.sunset}
        stroke="#FFFFFF"
        strokeWidth={2 * end}
      />
    </Svg>
  );
}

/** Marca + nombre. */
export function Logo({
  size = 40,
  drawn = 1,
  color = Brand.ink,
}: {
  size?: number;
  drawn?: number;
  color?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.22 }}>
      <LogoMark size={size * 1.15} drawn={drawn} />
      <Text
        style={{
          color,
          fontSize: size,
          lineHeight: size * 1.15,
          fontWeight: '600',
          letterSpacing: -size * 0.03,
        }}>
        Junti
      </Text>
    </View>
  );
}
