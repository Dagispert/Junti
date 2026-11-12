import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Brand } from '@/constants/brand';
import { Hand, Radius } from '@/constants/theme';
import { EASE } from './motion';
import { LogoMark } from './logo';

type Tab = 'hoy' | 'mapa' | 'retos' | 'memoria';

type Step = {
  /** El elemento que se ilumina (su testID). Sin él, el bocadillo va en el centro. */
  target?: string;
  /** Pestaña en la que está. */
  tab?: Tab;
  title: string;
  text: string;
  /** Un ejemplo del caso ficticio, dentro del bocadillo. */
  example?: { photo?: number; who: string; where: string; text: string };
};

const base =
  typeof window !== 'undefined' && window.location?.pathname.startsWith('/Junti') ? '/Junti' : '';

// El caso ficticio: Lu vive en Buenos Aires, Tomi en Berlín y Martuki en Tokio.
const STEPS: Step[] = [
  {
    title: 'Te enseño Junti en un minuto',
    text: 'Imagina que en tu grupo están Lu, que vive en Buenos Aires; Tomi, en Berlín, y Martuki, en Tokio. Vamos a ver cómo seguís formando parte de la vida de los otros.',
  },
  {
    target: 'tour-mapa',
    tab: 'hoy',
    title: 'Vuestro planeta',
    text: 'Aquí veis dónde vive cada uno y qué hora es allí. Cuando Lu se despierta, en Valladolid ya estáis comiendo. Tócalo para abrir el mapa entero.',
  },
  {
    target: 'tour-plus',
    tab: 'hoy',
    title: 'Compartir algo',
    text: 'Con el «+» compartes un momento: una foto, un vídeo corto, una nota de voz o unas palabras. También un recuerdo antiguo, un reto o una pregunta para todos.',
    example: {
      photo: 1,
      who: 'Lu',
      where: 'Buenos Aires · 08:12',
      text: 'Los jacarandás ya están en flor',
    },
  },
  {
    target: 'tab-hoy',
    tab: 'hoy',
    title: 'Una propuesta al día',
    text: 'Cada día que toque llega una pregunta sencilla, a la hora que elija cada uno: «¿Qué ves por tu ventana?». Lo que compartáis aparece en «Hoy».',
    example: {
      photo: 2,
      who: 'Martuki',
      where: 'Tokio · 21:40',
      text: 'Saliendo de la oficina. Aquí ya es mañana',
    },
  },
  {
    target: 'tab-mapa',
    tab: 'mapa',
    title: 'El mapa de recuerdos',
    text: 'Si añadís el lugar a un momento, queda en el planeta. Con el tiempo veréis aquel viaje a Iguazú o la playa de cada verano.',
  },
  {
    target: 'tab-retos',
    tab: 'retos',
    title: 'Retos y preguntas',
    text: 'Proponed retos («El cielo de cada uno») o preguntas: una encuesta para elegir destino o un quiz de «¿quién de nosotros…?». Las respuestas se ven al responder.',
  },
  {
    target: 'tab-memoria',
    tab: 'memoria',
    title: 'Vuestra memoria',
    text: 'Cada semana, un resumen con vuestras fotos y vuestra música; álbumes y un carrete por mes. Si activáis la narradora, os lo cuenta en voz alta.',
    example: {
      photo: 3,
      who: 'Narradora',
      where: 'Resumen de la semana',
      text: 'Mientras Lu tomaba mate, Tomi se apuntaba a alemán… por cuarta vez',
    },
  },
  {
    target: 'tour-invitar',
    tab: 'hoy',
    title: 'Ahora te toca a ti',
    text: 'Invita a los tuyos con un enlace. Puedes volver a ver esta guía cuando quieras desde tu perfil, en «Ayuda».',
  },
];

type Rect = { x: number; y: number; w: number; h: number };

function measure(target?: string): Rect | null {
  if (!target || typeof document === 'undefined') return null;
  const el = document.querySelector(`[data-testid="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

/**
 * La guía: oscurece la app, ilumina una parte cada vez y la explica con un
 * caso ficticio. «Saltar» o terminar la cierra para siempre (se puede volver
 * a pedir desde «Ayuda»).
 */
export function GuidedTour({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const step = STEPS[index];

  // El hueco iluminado se mueve con suavidad de un sitio a otro.
  const hx = useSharedValue(width / 2);
  const hy = useSharedValue(height / 2);
  const hw = useSharedValue(0);
  const hh = useSharedValue(0);

  const place = useCallback(() => {
    const r = measure(step.target);
    setRect(r);
    const pad = 8;
    const to = r
      ? { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 }
      : { x: width / 2, y: height / 2, w: 0, h: 0 };
    const cfg = { duration: 420, easing: EASE };
    hx.value = withTiming(to.x, cfg);
    hy.value = withTiming(to.y, cfg);
    hw.value = withTiming(to.w, cfg);
    hh.value = withTiming(to.h, cfg);
  }, [step.target, width, height, hx, hy, hw, hh]);

  useEffect(() => {
    // Primero se va a la pestaña del paso; luego se mide lo que hay que iluminar.
    if (step.tab) {
      const path = step.tab === 'hoy' ? `/group/${groupId}` : `/group/${groupId}/${step.tab}`;
      router.navigate(path as never);
    }
    // Se mide dos veces: la pestaña puede tardar un momento en asentarse.
    const first = setTimeout(place, step.tab ? 500 : 50);
    const again = setTimeout(place, step.tab ? 1100 : 400);
    return () => {
      clearTimeout(first);
      clearTimeout(again);
    };
  }, [index, step.tab, groupId, place]);

  useEffect(() => {
    const onResize = () => place();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [place]);

  const shade = 'rgba(12,14,18,0.74)';
  const top = useAnimatedStyle(() => ({ height: Math.max(0, hy.value) }));
  const bottom = useAnimatedStyle(() => ({ top: hy.value + hh.value }));
  const left = useAnimatedStyle(() => ({
    top: hy.value,
    height: hh.value,
    width: Math.max(0, hx.value),
  }));
  const right = useAnimatedStyle(() => ({
    top: hy.value,
    height: hh.value,
    left: hx.value + hw.value,
  }));
  const ring = useAnimatedStyle(() => ({
    left: hx.value,
    top: hy.value,
    width: hw.value,
    height: hh.value,
    opacity: hw.value > 4 ? 1 : 0,
  }));

  // El bocadillo, arriba o abajo según dónde quede el hueco.
  const below = !rect || rect.y + rect.h / 2 < height / 2;
  const bubbleTop = rect
    ? below
      ? Math.min(rect.y + rect.h + 24, height - 300)
      : undefined
    : undefined;
  const bubbleBottom = rect && !below ? Math.max(24, height - rect.y + 24) : undefined;
  const last = index === STEPS.length - 1;

  const finish = () => onClose();
  const next = () => (last ? finish() : setIndex(index + 1));

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(250)}
      style={[StyleSheet.absoluteFill, { zIndex: 200 }]}>
      {/* La sombra, con un hueco donde está lo que se explica */}
      <Animated.View
        style={[styles.shade, { backgroundColor: shade, left: 0, right: 0, top: 0 }, top]}
      />
      <Animated.View
        style={[styles.shade, { backgroundColor: shade, left: 0, right: 0, bottom: 0 }, bottom]}
      />
      <Animated.View style={[styles.shade, { backgroundColor: shade, left: 0 }, left]} />
      <Animated.View style={[styles.shade, { backgroundColor: shade, right: 0 }, right]} />
      <Animated.View pointerEvents="none" style={[styles.ring, ring]} />

      <Animated.View
        key={index}
        entering={FadeInDown.duration(380).easing(EASE)}
        style={[
          styles.bubble,
          rect ? { top: bubbleTop, bottom: bubbleBottom } : { top: Math.max(80, height / 2 - 220) },
        ]}>
        <View style={styles.bubbleHead}>
          {index === 0 && <LogoMark size={36} />}
          <Text style={styles.count}>
            {index + 1} de {STEPS.length}
          </Text>
        </View>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.text}>{step.text}</Text>
        {step.example && (
          <View style={styles.example}>
            {step.example.photo !== undefined && (
              <Image
                source={{ uri: `${base}/bienvenida/${step.example.photo}.jpg` }}
                style={styles.exampleImg}
                contentFit="cover"
              />
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.exampleWho}>
                {step.example.who} <Text style={styles.exampleWhere}>· {step.example.where}</Text>
              </Text>
              <Text style={styles.exampleText}>{step.example.text}</Text>
            </View>
          </View>
        )}
        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, { backgroundColor: i === index ? Brand.sunset : '#D9DBDF' }]}
            />
          ))}
        </View>
        <View style={styles.actions}>
          {!last ? (
            <Pressable accessibilityRole="button" onPress={finish} hitSlop={8}>
              <Text style={styles.skip}>Saltar la guía</Text>
            </Pressable>
          ) : (
            <View />
          )}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {index > 0 && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setIndex(index - 1)}
                style={[styles.btn, styles.btnQuiet]}>
                <Text style={[styles.btnText, { color: Brand.ink }]}>Atrás</Text>
              </Pressable>
            )}
            <Pressable accessibilityRole="button" onPress={next} style={styles.btn}>
              <Text style={styles.btnText}>
                {index === 0 ? 'Empezar' : last ? 'Entendido' : 'Siguiente'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shade: { position: 'absolute' },
  ring: {
    position: 'absolute',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Brand.sunset,
    boxShadow: '0 0 0 6px rgba(255,138,61,0.25)',
  },
  bubble: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignSelf: 'center',
    maxWidth: 480,
    marginHorizontal: 'auto',
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.inner,
    padding: 20,
    gap: 8,
    boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
  },
  bubbleHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  count: { color: '#686C73', fontSize: 13, fontWeight: '500' },
  title: { color: Brand.ink, fontSize: 24, lineHeight: 30, fontWeight: '500' },
  text: { color: '#3C3F44', fontSize: 15, lineHeight: 22 },
  example: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F6F6F7',
    borderRadius: Radius.medium,
    padding: 8,
    marginTop: 4,
  },
  exampleImg: { width: 52, height: 64, borderRadius: 10 },
  exampleWho: { color: Brand.ink, fontSize: 15, fontWeight: '500' },
  exampleWhere: { color: '#686C73', fontWeight: '400' },
  exampleText: { fontFamily: Hand, color: Brand.ink, fontSize: 20, lineHeight: 22 },
  dots: { flexDirection: 'row', gap: 4, marginTop: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  skip: { color: '#686C73', fontSize: 15 },
  btn: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: Radius.medium,
    backgroundColor: Brand.ink,
    justifyContent: 'center',
  },
  btnQuiet: { backgroundColor: '#EDEDEF' },
  btnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '500' },
});
