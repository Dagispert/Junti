import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Hand } from '@/constants/theme';

import { GlobeMap } from './globe-map';
import type { GlobeMemory, GlobePerson } from './globe-map.types';
import { Logo } from './logo';

const base =
  typeof window !== 'undefined' && window.location?.pathname.startsWith('/Junti') ? '/Junti' : '';
const foto = (n: string) => `${base}/guia/fotos/${n}.jpg`;

// El grupo de ejemplo, en el planeta.
const PEOPLE: GlobePerson[] = [
  {
    id: 'tu',
    name: 'Tú',
    lat: 41.65,
    lng: -4.72,
    tz: 'Europe/Madrid',
    city: 'Valladolid',
    country: 'España',
    photo: foto('cara-diego'),
    color: '#5B7DB1',
    isMe: true,
  },
  {
    id: 'rey',
    name: 'Rey',
    lat: 23.13,
    lng: -82.38,
    tz: 'America/Havana',
    city: 'La Habana',
    country: 'Cuba',
    photo: foto('cara-rey'),
    color: '#B8648F',
  },
  {
    id: 'tomi',
    name: 'Tomi',
    lat: 52.52,
    lng: 13.4,
    tz: 'Europe/Berlin',
    city: 'Berlín',
    country: 'Alemania',
    photo: foto('cara-tomas'),
    color: '#4E8D7C',
  },
  {
    id: 'marta',
    name: 'Martuki',
    lat: 35.68,
    lng: 139.69,
    tz: 'Asia/Tokyo',
    city: 'Tokio',
    country: 'Japón',
    photo: foto('cara-marta'),
    color: '#C9A227',
  },
];
// Sus días pequeños, cada uno en su sitio.
const MEMORIES: GlobeMemory[] = [
  { id: 'm1', lat: 23.13, lng: -82.38, photo: foto('domino') },
  { id: 'm2', lat: 35.68, lng: 139.69, photo: foto('ramen') },
  { id: 'm3', lat: 52.52, lng: 13.4, photo: foto('aleman') },
  { id: 'm4', lat: -34.6, lng: -58.38, photo: foto('mate') },
];

/** Las partes de lo que cuenta la narradora: cada una cambia la escena. */
const BEATS = [
  { cue: '', id: 'intro' },
  { cue: 'Cuando la gente', id: 'people' },
  { cue: 'chats que se pierden', id: 'chats' },
  { cue: 'redes hechas', id: 'redes' },
  { cue: 'nos perdemos', id: 'missed' },
  { cue: 'Junti no es', id: 'clear' },
  { cue: 'crear recuerdos', id: 'memories' },
  { cue: 'guardando la memoria', id: 'album' },
  { cue: 'estéis donde estéis', id: 'together' },
] as const;
type Beat = (typeof BEATS)[number]['id'];

const CHATS = [
  { text: '¿Qué tal todo? Cuánto tiempo…', x: 0.06, y: 0.2, me: false },
  { text: 'Bien bien, a ver si hablamos 🙈', x: 0.42, y: 0.31, me: true },
  { text: 'Visto ✓✓', x: 0.1, y: 0.43, me: false },
  { text: 'Te debo una llamada', x: 0.48, y: 0.5, me: true },
];
const NOISE = [
  { text: '♥ 1.204', x: 0.62, y: 0.16 },
  { text: '+312 seguidores', x: 0.05, y: 0.33 },
  { text: '👁 Visto por 2.381', x: 0.5, y: 0.42 },
  { text: '🔥 Tendencia', x: 0.18, y: 0.54 },
];
const SHOTS = [
  { src: 'ramen', caption: 'Tokio', x: 0.66, y: 0.14, rot: 8 },
  { src: 'domino', caption: 'La Habana', x: 0.04, y: 0.17, rot: -9 },
  { src: 'aleman', caption: 'Berlín', x: 0.64, y: 0.45, rot: -6 },
  { src: 'mate', caption: 'Buenos Aires', x: 0.06, y: 0.47, rot: 7 },
];

// Animaciones propias de la escena (solo en la web, como la guía).
const CSS = `
@keyframes jw-float { 0%{transform:translateY(0)} 50%{transform:translateY(-10px)} 100%{transform:translateY(0)} }
@keyframes jw-drift { 0%{transform:translate(0,0) scale(1)} 50%{transform:translate(18px,-14px) scale(1.06)} 100%{transform:translate(0,0) scale(1)} }
@keyframes jw-pop { 0%{transform:scale(.6);opacity:0} 60%{transform:scale(1.06);opacity:1} 100%{transform:scale(1);opacity:1} }
`;
function useCss() {
  useEffect(() => {
    if (typeof document === 'undefined' || document.getElementById('jw-css')) return;
    const el = document.createElement('style');
    el.id = 'jw-css';
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);
}

const ease = 'cubic-bezier(.22,.8,.2,1)';
const web = (o: Record<string, unknown>) => o as object;

/**
 * «Por qué existe Junti», a pantalla completa sobre el planeta: la gente que
 * quieres, lejos; los chats que se pierden y las redes para enseñar (todo se
 * desenfoca); los días pequeños que te pierdes; y, con Junti, los recuerdos
 * que vuelven a enfocarse, se guardan y os unen. El texto va abajo, como
 * subtítulo.
 */
export function WhyJunti({ text, spoken }: { text: string; spoken: number }) {
  useCss();
  const { width, height } = useWindowDimensions();
  const at = Math.floor(text.length * Math.min(1, spoken));
  const beatIndex = BEATS.reduce((acc, b, i) => {
    const pos = b.cue ? text.indexOf(b.cue) : 0;
    return pos >= 0 && at >= pos ? i : acc;
  }, 0);
  const beat: Beat = BEATS[beatIndex].id;
  const after = (id: Beat) => beatIndex >= BEATS.findIndex((b) => b.id === id);
  const is = (...ids: Beat[]) => ids.includes(beat);

  // Mientras habla de lo que se pierde, el planeta viaja de una persona a otra.
  const [hop, setHop] = useState(0);
  useEffect(() => {
    if (!is('missed', 'memories')) return;
    const id = setInterval(() => setHop((h) => h + 1), 1700);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beat]);
  const focusId = is('missed', 'memories') ? (['marta', 'rey', 'tomi'] as const)[hop % 3] : null;

  // El subtítulo: la frase que se está diciendo.
  const sentence = useMemo(() => {
    const parts: { start: number; end: number }[] = [];
    const re = /[^.:]+[.:]?/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const lead = m[0].length - m[0].trimStart().length;
      parts.push({ start: m.index + lead, end: m.index + m[0].length });
    }
    return parts;
  }, [text]);
  const cur = [...sentence].reverse().find((s) => s.start <= Math.max(at, 1)) ?? sentence[0];
  const said = text.slice(cur.start, Math.max(cur.start, Math.min(at + 2, cur.end)));
  const rest = text.slice(cur.start + said.length, cur.end);

  const globeH = Math.min(height * 0.62, width * 1.25);
  const blur = is('chats', 'redes') ? 7 : is('missed') ? 2.5 : 0;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={['#FFFFFF', '#E7F5F8', '#D5ECF1']} style={StyleSheet.absoluteFill} />
      {/* Luces suaves que se mueven detrás */}
      <View
        style={[
          styles.glow,
          {
            width: width * 0.9,
            height: width * 0.9,
            left: -width * 0.3,
            top: height * 0.05,
            backgroundColor: '#FFD9B8',
          },
          web({
            animation: 'jw-drift 14s ease-in-out infinite',
            filter: 'blur(60px)',
            opacity: after('memories') ? 0.75 : 0.35,
            transition: `opacity 1.6s ${ease}`,
          }),
        ]}
      />
      <View
        style={[
          styles.glow,
          {
            width: width,
            height: width,
            right: -width * 0.4,
            top: height * 0.35,
            backgroundColor: '#BFE6EE',
          },
          web({
            animation: 'jw-drift 18s ease-in-out infinite reverse',
            filter: 'blur(70px)',
            opacity: 0.6,
          }),
        ]}
      />

      {/* El planeta: se desenfoca con el ruido y vuelve a enfocarse con Junti */}
      <View
        style={[
          { position: 'absolute', left: 0, right: 0, top: height * 0.06, height: globeH },
          web({
            filter: `blur(${blur}px) saturate(${blur ? 0.6 : 1})`,
            transform: `scale(${is('intro') ? 0.82 : is('together') ? 1.04 : blur ? 0.94 : 1})`,
            transition: `filter 1.2s ${ease}, transform 2.2s ${ease}`,
          }),
        ]}>
        <GlobeMap
          people={PEOPLE}
          height={globeH}
          interactive={false}
          transparent
          hidePeople={!after('people')}
          focusId={focusId}
          memories={after('missed') ? MEMORIES : []}
        />
      </View>

      {/* Los chats que se pierden */}
      {CHATS.map((c, i) => {
        const shown = is('chats', 'redes', 'missed');
        const gone = after('clear');
        return (
          <View
            key={c.text}
            style={[
              styles.bubble,
              c.me ? styles.bubbleMe : styles.bubbleThem,
              { left: width * c.x, top: height * c.y, maxWidth: width * 0.5 },
              web({
                opacity: shown ? (is('chats') ? 0.95 : 0.4) : 0,
                filter: `blur(${is('chats') ? 0 : is('redes') ? 2 : 5}px)`,
                transform: `translateY(${shown ? 0 : gone ? -60 : 30}px) scale(${gone ? 1.3 : shown ? 1 : 0.8})`,
                transition: `all ${gone ? 0.6 : 0.9}s ${ease} ${shown ? i * 0.35 : 0}s`,
              }),
            ]}>
            <Text style={[styles.bubbleText, c.me && { color: '#FFFFFF' }]}>{c.text}</Text>
          </View>
        );
      })}

      {/* Las redes hechas para enseñar */}
      {NOISE.map((n, i) => {
        const shown = is('redes', 'missed');
        return (
          <View
            key={n.text}
            style={[
              styles.noise,
              { left: width * n.x, top: height * n.y },
              web({
                opacity: shown ? (is('redes') ? 1 : 0.35) : 0,
                filter: `blur(${is('missed') ? 4 : 0}px)`,
                transform: `scale(${shown ? 1 : after('clear') ? 1.5 : 0.6}) rotate(${i % 2 ? 4 : -4}deg)`,
                transition: `all 0.8s ${ease} ${shown ? i * 0.25 : 0}s`,
              }),
            ]}>
            <Text style={styles.noiseText}>{n.text}</Text>
          </View>
        );
      })}

      {/* Los días pequeños: primero borrosos (te los pierdes); con Junti, nítidos; al final, guardados */}
      {SHOTS.map((s, i) => {
        const size = width * 0.3;
        const shown = after('missed');
        const sharp = after('memories');
        const stacked = after('album');
        const x = stacked ? width / 2 - size / 2 + (i - 1.5) * 18 : width * s.x;
        const y = stacked ? height * 0.42 + Math.abs(i - 1.5) * 6 : height * s.y;
        const rot = stacked ? (i - 1.5) * 7 : s.rot;
        return (
          <View
            key={s.src}
            style={[
              styles.polaroid,
              { width: size },
              web({
                left: 0,
                top: 0,
                opacity: shown ? (sharp ? 1 : 0.5) : 0,
                filter: `blur(${sharp ? 0 : 6}px)`,
                transform: `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${shown ? (stacked ? 0.8 : sharp ? 1 : 0.85) : 0.5})`,
                transition: `all 1.1s ${ease} ${shown && !stacked ? i * 0.2 : i * 0.08}s`,
                zIndex: 5,
              }),
            ]}>
            <Image
              source={{ uri: foto(s.src) }}
              style={{ width: size - 10, height: size - 10 }}
              contentFit="cover"
            />
            <Text style={styles.caption}>{s.caption}</Text>
          </View>
        );
      })}

      {/* Al final: juntos, y la marca */}
      <View
        style={[
          styles.brand,
          { top: height * 0.035 },
          web({
            opacity: is('together') ? 1 : 0,
            transform: `translateY(${is('together') ? 0 : -16}px)`,
            transition: `all 1.2s ${ease}`,
          }),
        ]}>
        <Logo size={34} drawn={is('together') ? 1 : 0} />
      </View>

      {/* Subtítulo, abajo */}
      <View style={[styles.subtitle, { bottom: 170 }]}>
        <Text style={styles.subtitleText}>
          {said}
          <Text style={{ color: 'transparent' }}>{rest}</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', borderRadius: 9999 },
  bubble: {
    position: 'absolute',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    boxShadow: '0 10px 30px rgba(20,40,60,0.18)',
  },
  bubbleThem: { backgroundColor: 'rgba(255,255,255,0.92)', borderBottomLeftRadius: 6 },
  bubbleMe: { backgroundColor: '#3E8FE8', borderBottomRightRadius: 6 },
  bubbleText: { color: '#1D1F22', fontSize: 15, lineHeight: 20 },
  noise: {
    position: 'absolute',
    paddingHorizontal: 14,
    height: 36,
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    boxShadow: '0 8px 24px rgba(20,40,60,0.15)',
  },
  noiseText: { color: '#C2385A', fontSize: 15, fontWeight: '600' },
  polaroid: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    padding: 5,
    paddingBottom: 2,
    borderRadius: 3,
    boxShadow: '0 16px 36px rgba(20,40,60,0.28)',
  },
  caption: { fontFamily: Hand, color: '#2A2A2A', textAlign: 'center', fontSize: 16, marginTop: 1 },
  brand: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  subtitle: { position: 'absolute', left: 24, right: 24, alignItems: 'center' },
  subtitleText: {
    fontFamily: Hand,
    color: '#1F2124',
    fontSize: 28,
    lineHeight: 33,
    textAlign: 'center',
    maxWidth: 520,
    textShadowColor: 'rgba(255,255,255,0.95)',
    textShadowRadius: 12,
  },
});
