import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

import { Brand } from '@/constants/brand';
import { Hand, Radius } from '@/constants/theme';

import { Icon } from './icon';
import { LogoMark } from './logo';
import { EASE } from './motion';
import { WhyJunti } from './why-junti';

type Tab = 'hoy' | 'mapa' | 'retos' | 'memoria';
/** rect: rectángulo redondeado · circle: círculo · sphere: el contorno del planeta */
type Shape = 'rect' | 'circle' | 'sphere';

type Step = {
  /** El elemento que se señala (su testID). Sin él, el bocadillo va en el centro. */
  target?: string;
  shape?: Shape;
  tab?: Tab;
  title: string;
  /** Lo que dice la narradora (y se lee como subtítulo). */
  text: string;
  /** Su audio: /guia/<voice>.mp3. */
  voice: string;
  /** A pantalla completa, sin bocadillo (por qué existe Junti). */
  immersive?: boolean;
  /** Un ejemplo del caso ficticio, dentro del bocadillo. */
  example?: { photo?: number; who: string; where: string; text: string };
};

const base =
  typeof window !== 'undefined' && window.location?.pathname.startsWith('/Junti') ? '/Junti' : '';

// La narradora se presenta, cuenta por qué existe Junti y luego lo enseña
// con un caso ficticio: Rey en La Habana, Tomi en Berlín y Martuki en Tokio. Los audios se generaron una vez (voz de Gemini)
// y van con la app, en public/guia: no se generan en cada inicio.
const STEPS: Step[] = [
  {
    title: 'Hola, soy la narradora',
    voice: 'hola',
    text: 'Hola. Soy la narradora de Junti: la voz que cuenta vuestras historias.',
  },
  {
    title: 'Por qué existe Junti',
    voice: 'porque',
    immersive: true,
    text: 'Antes, te cuento por qué existo. Cuando la gente que quieres vive lejos, la vida se va quedando en chats que se pierden, y en redes hechas para enseñar, no para compartir. Y sin darnos cuenta, nos perdemos los días pequeños de los demás. Junti no es una red social más: aquí no hay likes, ni seguidores, ni nadie mirando. Es vuestro rincón para crear recuerdos sin estar juntos, y para ir guardando la memoria de todo lo que os une. Seáis amigos, familia o pareja: estéis donde estéis, seguís estando juntos.',
  },
  {
    title: 'Un grupo de ejemplo',
    voice: 'ejemplo',
    text: 'Ahora te enseño cómo funciona todo con un ejemplo. Imagina un grupo con Rey, que vive en La Habana; Tomi, en Berlín; y Martuki, en Tokio.',
  },
  {
    target: 'tour-mapa',
    shape: 'sphere',
    tab: 'hoy',
    voice: 'planeta',
    title: 'Vuestro planeta',
    text: 'Este es vuestro planeta. Aquí veis dónde vive cada uno y qué hora es allí. Cuando Rey se despierta en La Habana, en Valladolid ya estáis comiendo. Si lo tocas, se abre el mapa entero.',
  },
  {
    target: 'tour-plus',
    voice: 'compartir',
    shape: 'circle',
    tab: 'hoy',
    title: 'Compartir algo',
    text: 'Con este botón compartes algo: una foto, un vídeo corto, una nota de voz o unas palabras. Rey, por ejemplo, acaba de subir su partida de dominó en el portal. Desde aquí también podéis añadir un recuerdo antiguo, un reto o una pregunta.',
    example: {
      photo: 1,
      who: 'Rey',
      where: 'La Habana · 13:30',
      text: 'Dominó en el portal con los vecinos',
    },
  },
  {
    target: 'tab-hoy',
    voice: 'hoy',
    shape: 'rect',
    tab: 'hoy',
    title: 'Una propuesta al día',
    text: 'Los días que toque, os llegará una pregunta sencilla, a la hora que elija cada uno: ¿qué ves por tu ventana? Todo lo que compartáis aparece aquí, en Hoy.',
    example: {
      photo: 2,
      who: 'Martuki',
      where: 'Tokio · 21:40',
      text: 'Saliendo de la oficina. Aquí ya es mañana',
    },
  },
  {
    target: 'tab-mapa',
    voice: 'mapa',
    shape: 'rect',
    tab: 'mapa',
    title: 'El mapa de recuerdos',
    text: 'Si añadís el lugar a un momento, se queda en el planeta. Con el tiempo veréis ese viaje a Iguazú, o la playa de cada verano.',
  },
  {
    target: 'tab-retos',
    voice: 'retos',
    shape: 'rect',
    tab: 'retos',
    title: 'Retos y preguntas',
    text: 'Aquí van los retos y las preguntas: una encuesta para elegir destino, o un quiz de quién de nosotros. Las respuestas de los demás se ven al responder.',
  },
  {
    target: 'tour-calendario',
    voice: 'calendario',
    shape: 'rect',
    tab: 'hoy',
    title: 'Los días que faltan',
    text: 'Arriba tenéis el calendario del grupo: cumpleaños, aniversarios, viajes y, sobre todo, reencuentros. Si Rey viene a España en verano, lo apuntáis y en Hoy veréis la cuenta atrás. Os aviso una semana antes, la víspera y el mismo día. Porque estar lejos también es contar los días que faltan para veros.',
    example: {
      who: 'Rey vuelve a casa',
      where: 'Reencuentro · faltan 23 días',
      text: 'Del 2 al 16 de julio, en Valladolid',
    },
  },
  {
    target: 'tab-memoria',
    voice: 'memoria',
    shape: 'rect',
    tab: 'memoria',
    title: 'Vuestra memoria',
    text: 'Y esta es vuestra memoria: cada semana, un resumen con vuestras fotos y vuestra música; álbumes, y un carrete por cada mes.',
    example: {
      photo: 3,
      who: 'La narradora',
      where: 'Resumen de la semana',
      text: 'Mientras Rey jugaba al dominó, Tomi se apuntaba a alemán… por cuarta vez',
    },
  },
  {
    target: 'tab-memoria',
    voice: 'carrete',
    shape: 'rect',
    tab: 'memoria',
    title: 'Un carrete cada mes',
    text: 'Y cada mes se revela un carrete, como los de antes: una tira de película con las fotos de ese mes. Los emojis que más habéis usado se convierten en pegatinas. Dale al play y lo veréis como una pequeña película, con música; y si me habéis activado, os lo cuento yo.',
    example: {
      photo: 4,
      who: 'Carrete de octubre',
      where: '23 fotos',
      text: 'Los ❤️ y los 😂 del mes, convertidos en pegatinas',
    },
  },
  {
    target: 'tour-ajustes',
    voice: 'narradora',
    shape: 'rect',
    tab: 'hoy',
    title: 'Y aquí entro yo',
    text: 'Y aquí entro yo. Para que pueda contar vuestra historia en voz alta, quien administra el grupo tiene que activarme en los ajustes. Solo uso lo que compartís, y cada uno puede pedirme que no use lo suyo.',
  },
  {
    target: 'tour-invitar',
    voice: 'invitar',
    shape: 'rect',
    tab: 'hoy',
    title: 'Ahora te toca a ti',
    text: 'Ahora te toca a ti: invita a los tuyos con un enlace. Si quieres volver a escucharme, me encontrarás en tu perfil, en Ayuda. Hasta pronto.',
  },
];

/** Hueco que se deja sin oscurecer: x, y, ancho, alto y radio de las esquinas. */
type Hole = { x: number; y: number; w: number; h: number; r: number };

function findHole(step: Step): Hole | null {
  if (!step.target || typeof document === 'undefined') return null;
  const el = document.querySelector(`[data-testid="${step.target}"]`) as HTMLElement | null;
  if (!el) return null;
  const box = el.getBoundingClientRect();
  if (!box.width || !box.height) return null;
  if (step.shape === 'sphere') {
    // El planeta dice dónde se dibuja: se señala su contorno, no su caja.
    const globe = el.querySelector('.jglobe') as HTMLElement | null;
    const [cx, cy, r] = (globe?.dataset.sphere ?? '').split(' ').map(Number);
    if (globe && r > 0) {
      const g = globe.getBoundingClientRect();
      const rr = r * 1.06;
      return { x: g.left + cx - rr, y: g.top + cy - rr, w: rr * 2, h: rr * 2, r: rr };
    }
  }
  if (step.shape === 'circle') {
    const rr = Math.max(box.width, box.height) / 2 + 10;
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    return { x: cx - rr, y: cy - rr, w: rr * 2, h: rr * 2, r: rr };
  }
  const pad = 10;
  return {
    x: box.left - pad,
    y: box.top - pad,
    w: box.width + pad * 2,
    h: box.height + pad * 2,
    r: Math.min(24, (box.height + pad * 2) / 2),
  };
}

/** La máscara: opaca fuera, transparente en el hueco, con un borde que se difumina. */
function maskFor(hole: Hole | null, width: number, height: number): string {
  const soft = 18;
  const cut = hole
    ? `<rect x="${hole.x - soft / 2}" y="${hole.y - soft / 2}" width="${hole.w + soft}" height="${hole.h + soft}" rx="${hole.r + soft / 2}" fill="black" filter="url(#b)"/>`
    : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${soft / 2.2}"/></filter><mask id="m"><rect width="100%" height="100%" fill="white"/>${cut}</mask></defs><rect width="100%" height="100%" fill="black" mask="url(#m)"/></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/**
 * La guía: la narradora lo cuenta paso a paso. Todo queda oscuro y algo
 * desenfocado salvo lo que se explica, que se ve nítido. Cuando termina de
 * hablar, pasa sola al siguiente paso.
 */
export function GuidedTour({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [hole, setHole] = useState<Hole | null>(null);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [spoken, setSpoken] = useState(0); // 0–1: cuánto ha dicho la narradora de este paso
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  const veil = useRef<HTMLElement | null>(null);
  const shown = useRef<Hole | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  // ── El velo: oscuro y desenfocado, con el hueco animado ──
  const paint = useCallback(
    (h: Hole | null) => {
      const el = veil.current;
      if (!el?.style) return;
      const m = maskFor(h, width, height);
      el.style.setProperty('mask-image', m);
      el.style.setProperty('-webkit-mask-image', m);
    },
    [width, height],
  );

  useEffect(() => {
    const el = veil.current;
    if (!el?.style) return;
    el.style.setProperty('backdrop-filter', 'blur(5px) saturate(0.9)');
    el.style.setProperty('-webkit-backdrop-filter', 'blur(5px) saturate(0.9)');
    el.style.setProperty('mask-size', '100% 100%');
    el.style.setProperty('-webkit-mask-size', '100% 100%');
    paint(null);
  }, [paint]);

  const moveTo = useCallback(
    (to: Hole | null) => {
      const from = shown.current;
      const start = performance.now();
      const run = (now: number) => {
        const k = EASE(Math.min(1, (now - start) / 450));
        let h: Hole | null = to;
        if (to && from) {
          h = {
            x: lerp(from.x, to.x, k),
            y: lerp(from.y, to.y, k),
            w: lerp(from.w, to.w, k),
            h: lerp(from.h, to.h, k),
            r: lerp(from.r, to.r, k),
          };
        } else if (to) {
          // Aparece creciendo desde su centro.
          const s = 0.6 + 0.4 * k;
          h = {
            x: to.x + (to.w * (1 - s)) / 2,
            y: to.y + (to.h * (1 - s)) / 2,
            w: to.w * s,
            h: to.h * s,
            r: to.r * s,
          };
        }
        paint(h);
        if (k < 1) requestAnimationFrame(run);
        else shown.current = to;
      };
      requestAnimationFrame(run);
    },
    [paint],
  );

  const locate = useCallback(() => {
    const h = findHole(step);
    setHole(h);
    moveTo(h);
  }, [step, moveTo]);

  useEffect(() => {
    if (step.tab) {
      const path = step.tab === 'hoy' ? `/group/${groupId}` : `/group/${groupId}/${step.tab}`;
      router.navigate(path as never);
    }
    // Se mide dos veces: la pestaña puede tardar un momento en asentarse.
    const first = setTimeout(locate, step.tab ? 450 : 50);
    const again = setTimeout(() => {
      const h = findHole(step);
      const cur = shown.current;
      if (h && (!cur || Math.abs(h.x - cur.x) + Math.abs(h.y - cur.y) > 4)) {
        setHole(h);
        moveTo(h);
      }
    }, 1200);
    return () => {
      clearTimeout(first);
      clearTimeout(again);
    };
  }, [index, step, groupId, locate, moveTo]);

  useEffect(() => {
    const onResize = () => locate();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [locate]);

  // ── La voz ──
  const next = useCallback(() => (last ? onClose() : setIndex((i) => i + 1)), [last, onClose]);
  useEffect(() => {
    if (!audio.current) audio.current = new Audio();
    const a = audio.current;
    a.src = `${base}/guia/${step.voice}.mp3`;
    a.muted = muted;
    setSpoken(0);
    let advance: ReturnType<typeof setTimeout> | undefined;
    const onTime = () => setSpoken(a.duration ? a.currentTime / a.duration : 0);
    const onEnd = () => {
      setSpoken(1);
      // Al terminar de hablar, pasa sola (salvo en el último paso).
      if (!last) advance = setTimeout(next, 1200);
    };
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('ended', onEnd);
    if (!paused) {
      a.play()
        .then(() => setNeedsTap(false))
        .catch(() => setNeedsTap(true)); // el navegador pide un toque antes de sonar
    }
    return () => {
      a.pause();
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('ended', onEnd);
      clearTimeout(advance);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);
  useEffect(() => {
    if (audio.current) audio.current.muted = muted;
  }, [muted]);
  useEffect(() => () => audio.current?.pause(), []);

  const listen = () => {
    const a = audio.current;
    if (!a) return;
    setPaused(false);
    a.play()
      .then(() => setNeedsTap(false))
      .catch(() => {});
  };
  const togglePause = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) listen();
    else {
      a.pause();
      setPaused(true);
    }
  };

  // El bocadillo: debajo o encima del hueco, según dónde quede.
  const below = !hole || hole.y + hole.h / 2 < height / 2;
  const bubblePos = hole
    ? below
      ? { top: Math.min(hole.y + hole.h + 16, height - 340) }
      : { bottom: Math.max(16, height - hole.y + 16) }
    : { top: Math.max(64, height / 2 - 240) };

  // Subtítulo: las letras aparecen al ritmo de la voz (si suena).
  const visible =
    muted || needsTap
      ? step.text.length
      : Math.ceil(step.text.length * Math.min(1, spoken * 1.05 + 0.03));

  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      exiting={FadeOut.duration(300)}
      style={[StyleSheet.absoluteFill, { zIndex: 200 }]}>
      <View
        ref={veil as never}
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,12,16,0.62)' }]}
      />

      {step.immersive && (
        <Animated.View
          key={`escena-${index}`}
          entering={FadeIn.duration(700)}
          exiting={FadeOut.duration(400)}
          style={StyleSheet.absoluteFill}>
          <WhyJunti text={step.text} spoken={muted || needsTap ? 1 : spoken} />
        </Animated.View>
      )}

      <Animated.View
        key={index}
        entering={FadeInDown.duration(420).easing(EASE)}
        style={step.immersive ? [styles.bubble, styles.dock] : [styles.bubble, bubblePos]}>
        <View style={styles.head}>
          <View style={styles.speaker}>
            <LogoMark size={28} />
            <Text style={styles.count}>
              La narradora · {index + 1} de {STEPS.length}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={paused ? 'Seguir escuchando' : 'Pausar'}
              onPress={togglePause}
              style={styles.round}>
              <Icon icon={paused ? Play : Pause} size={16} color={Brand.ink} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={muted ? 'Activar la voz' : 'Silenciar la voz'}
              onPress={() => setMuted(!muted)}
              style={styles.round}>
              <Icon icon={muted ? VolumeX : Volume2} size={16} color={Brand.ink} />
            </Pressable>
          </View>
        </View>
        {!step.immersive && (
          <>
            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.text}>
              {step.text.slice(0, visible)}
              <Text style={{ color: 'transparent' }}>{step.text.slice(visible)}</Text>
            </Text>
          </>
        )}
        {needsTap && !muted && (
          <Pressable accessibilityRole="button" onPress={listen} style={styles.listen}>
            <Icon icon={Play} size={16} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '500' }}>
              Escuchar a la narradora
            </Text>
          </Pressable>
        )}
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
        <View style={styles.progress}>
          {STEPS.map((_, i) => (
            <View key={i} style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${i < index ? 100 : i > index ? 0 : Math.round(spoken * 100)}%` },
                ]}
              />
            </View>
          ))}
        </View>
        <View style={styles.actions}>
          {!last ? (
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
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
              <Text style={styles.btnText}>{last ? 'Entendido' : 'Siguiente'}</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    left: 16,
    right: 16,
    maxWidth: 480,
    marginHorizontal: 'auto',
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.inner,
    padding: 20,
    gap: 8,
    boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
  },
  // En la escena a pantalla completa: solo los mandos, abajo y oscuros.
  dock: {
    bottom: 16,
    backgroundColor: 'rgba(255,255,255,0.86)',
    boxShadow: '0 14px 40px rgba(20,40,60,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    paddingVertical: 14,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  speaker: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  count: { color: '#686C73', fontSize: 13, fontWeight: '500' },
  round: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EDEDEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: Brand.ink, fontSize: 24, lineHeight: 30, fontWeight: '500' },
  text: { color: '#3C3F44', fontSize: 15, lineHeight: 22 },
  listen: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: Radius.medium,
    backgroundColor: Brand.sunset,
  },
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
  progress: { flexDirection: 'row', gap: 4, marginTop: 4 },
  track: { flex: 1, height: 3, borderRadius: 2, backgroundColor: '#E4E5E8', overflow: 'hidden' },
  fill: { height: 3, backgroundColor: Brand.ink },
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
