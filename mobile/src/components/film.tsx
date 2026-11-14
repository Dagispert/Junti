import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, type ReactNode, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Hand, HandBold } from '@/constants/theme';
import type { GalleryItem, Moment } from '@/data/types';
import type { SceneLook } from '@/lib/film';

import { InlineVideo, normalizeWave } from './media-players';
import { Sticker, StickyNote, Tape } from './scrapbook';
import { Avatar, Photo } from './ui';

// Las piezas del resumen narrado, pensado como una película: cada escena
// es un plano (portada, foto a toda pantalla, polaroid, collage, cita,
// cifras, final) con su coreografía de entrada y de salida, sobre el cielo
// de <Atmosphere>. Entradas que frenan, salidas que aceleran, y siempre tres
// capas: lo principal (la foto), lo secundario (notas, pegatinas, rótulos) y
// el ambiente (el cielo, la deriva lenta de la cámara).

/** Entrada: rápida al principio y aterriza suave. */
const ENTER = Easing.bezier(0.05, 0.7, 0.1, 1);
/** Entrada con un pequeño rebote, para lo que «cae» (papel, fotos). */
const BACK = Easing.bezier(0.175, 0.885, 0.32, 1.275);
/** Salida: arranca suave y se va deprisa. */
const EXIT = Easing.bezier(0.3, 0, 1, 1);
export const EXIT_MS = 260;

type Pose = { x?: number; y?: number; scale?: number; rotate?: number };

/** Los colores de la letra según el cielo (claro u oscuro). */
export const tone = (dark: boolean) => ({
  ink: dark ? '#F8F4EA' : '#23201D',
  soft: dark ? 'rgba(248,244,234,0.78)' : 'rgba(35,32,29,0.66)',
  accent: dark ? '#FFD27D' : '#C2477A',
  glow: dark ? 'rgba(6,10,30,0.6)' : 'rgba(255,255,255,0.8)',
});

/**
 * Algo que entra desde una postura (desplazado, girado, pequeño) hasta su
 * sitio y, cuando la escena termina («leaving»), sale hacia otra.
 */
export function Move({
  from = { y: 24 },
  exit,
  delay = 0,
  duration = 520,
  back = false,
  leaving = false,
  style,
  children,
}: {
  from?: Pose;
  exit?: Pose;
  delay?: number;
  duration?: number;
  back?: boolean;
  leaving?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? 1 : 0);
  const o = useSharedValue(0);
  useEffect(() => {
    if (!reduced)
      p.value = withDelay(delay, withTiming(1, { duration, easing: back ? BACK : ENTER }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (leaving) o.value = withTiming(1, { duration: reduced ? 0 : EXIT_MS, easing: EXIT });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving]);
  const fx = from.x ?? 0;
  const fy = from.y ?? 0;
  const fs = from.scale ?? 1;
  const fr = from.rotate ?? 0;
  const out = exit ?? { y: -18, scale: 0.97 };
  const ex = out.x ?? 0;
  const ey = out.y ?? 0;
  const es = out.scale ?? 1;
  const er = out.rotate ?? 0;
  const animated = useAnimatedStyle(() => {
    const k = p.value;
    const q = o.value;
    return {
      opacity: Math.max(0, Math.min(1, k * 2)) * (1 - q),
      transform: [
        { translateX: fx * (1 - k) + ex * q },
        { translateY: fy * (1 - k) + ey * q },
        { scale: (fs + (1 - fs) * k) * (1 + (es - 1) * q) },
        { rotate: `${fr * (1 - k) + er * q}deg` },
      ],
    };
  });
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/** La cámara se acerca despacio a la foto mientras dura la escena. */
function Drift({
  duration,
  dir = 1,
  children,
}: {
  duration: number;
  dir?: number;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    if (!reduced)
      v.value = withTiming(1, {
        duration: Math.max(5000, duration + 1500),
        easing: Easing.inOut(Easing.sin),
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const animated = useAnimatedStyle(() => ({
    transform: [
      { scale: 1.03 + 0.11 * v.value },
      { translateX: dir * 9 * v.value },
      { translateY: -5 * v.value },
    ],
  }));
  return <Animated.View style={[StyleSheet.absoluteFill, animated]}>{children}</Animated.View>;
}

/** Algo que flota muy poco, como colgado de un hilo. */
function Float({ children, amount = 4 }: { children: ReactNode; amount?: number }) {
  const reduced = useReducedMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    if (!reduced)
      v.value = withRepeat(
        withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const animated = useAnimatedStyle(() => ({
    transform: [
      { translateY: (v.value - 0.5) * 2 * amount },
      { rotate: `${(v.value - 0.5) * 0.9}deg` },
    ],
  }));
  return <Animated.View style={animated}>{children}</Animated.View>;
}

/** Dónde va cada cosa del plano, según la pantalla. */
export type FilmLayout = {
  width: number;
  height: number;
  /** Arriba del rótulo (bajo los botones). */
  slugTop: number;
  /** Arriba de la foto y su tamaño. */
  photoTop: number;
  photoW: number;
  photoH: number;
};

export function filmLayout(width: number, height: number, insetTop: number): FilmLayout {
  const slugTop = insetTop + 56;
  const photoTop = slugTop + 118;
  const photoW = Math.min(width - 44, 400);
  const photoH = Math.max(200, Math.min(photoW * 1.25, height - photoTop - 196));
  return { width, height, slugTop, photoTop, photoW, photoH };
}

/** El rótulo de la escena: cuándo, dónde y quién, como en una película. */
function Slug({
  look,
  userId,
  name,
  kicker,
  leaving,
  top,
}: {
  look: SceneLook;
  userId?: string;
  name?: string;
  kicker?: string;
  leaving: boolean;
  top: number;
}) {
  const t = tone(look.dark);
  const shadow = { textShadowColor: t.glow, textShadowRadius: 12 };
  const big = look.place ?? name ?? '';
  const far = look.travel
    ? `a ${look.travel.km} de ${look.travel.from}${
        look.travel.hours
          ? ` · ${Math.abs(look.travel.hours)} h ${look.travel.hours < 0 ? 'menos' : 'más'}`
          : ''
      }`
    : '';
  const by = [look.place ? name : '', far].filter(Boolean).join(' · ');
  return (
    <View pointerEvents="none" style={[styles.slug, { top }]}>
      {!!(kicker ?? look.when) && (
        <Move from={{ y: 10 }} duration={420} leaving={leaving}>
          <Text numberOfLines={1} style={[styles.kicker, { color: t.soft }, shadow]}>
            {(kicker ?? look.when)!.toUpperCase()}
          </Text>
        </Move>
      )}
      <Move from={{ y: 24, scale: 0.94 }} delay={90} duration={580} back leaving={leaving}>
        <Text
          numberOfLines={2}
          style={[
            styles.place,
            big.length > 11 && { fontSize: 38, lineHeight: 44 },
            big.length > 18 && { fontSize: 31, lineHeight: 36 },
            { color: t.ink },
            shadow,
          ]}>
          {big}
        </Text>
      </Move>
      {!!by && (
        <Move from={{ y: 12 }} delay={210} duration={460} leaving={leaving} style={styles.by}>
          {!!userId && <Avatar userId={userId} size={24} />}
          <Text numberOfLines={1} style={[styles.byText, { color: t.soft }, shadow]}>
            {by}
          </Text>
        </Move>
      )}
    </View>
  );
}

/** Lo visual de un momento: sus fotos (o las portadas de sus vídeos). */
const pictures = (moment: Moment): GalleryItem[] =>
  moment.gallery ??
  (moment.photos ?? (moment.imageUri ? [moment.imageUri] : [])).map((uri) => ({
    kind: 'photo' as const,
    uri,
  }));
const still = (item: GalleryItem) => (item.kind === 'photo' ? item.uri : item.poster);

/** Las reacciones más usadas, como pegatinas en la esquina. */
function Stickers({ moment, delay }: { moment: Moment; delay: number }) {
  const emojis = [...new Set(moment.reactions.map((r) => r.emoji))].slice(0, 3);
  return (
    <>
      {emojis.map((e, i) => (
        <Sticker
          key={e}
          emoji={e}
          size={50}
          rotate={-12 + i * 12}
          delay={delay + i * 130}
          style={{ position: 'absolute', bottom: -18, right: 10 + i * 44 }}
        />
      ))}
    </>
  );
}

/**
 * Un momento en pantalla, con el plano que le toca: foto grande con la cámara
 * acercándose, polaroid que cae, varias fotos repartidas como cartas, una
 * cita en papel o una nota de voz.
 */
export const MomentShot = memo(function MomentShot({
  moment,
  look,
  name,
  kicker,
  leaving,
  duration,
  layout,
  nth,
}: {
  moment: Moment;
  look: SceneLook;
  name: string;
  /** En vez de «martes · 09:10» (p. ej. «Lo que más os llegó»). */
  kicker?: string;
  leaving: boolean;
  duration: number;
  layout: FilmLayout;
  /** Para alternar inclinaciones y direcciones. */
  nth: number;
}) {
  // Con viaje, primero se ve el cielo y el avión; luego llega la foto.
  const delay = look.travel ? 1500 : 480;
  const side = nth % 2 ? 1 : -1;
  const { photoW: w, photoH: h } = layout;
  const video = moment.videoUri;
  const picture = (
    <>
      <Photo moment={moment} style={StyleSheet.absoluteFill} badge={false} animate={false} />
      {!!video && (
        <InlineVideo
          uri={video}
          clip={moment.videoClip}
          muted
          loop
          controls={false}
          style={StyleSheet.absoluteFill}
        />
      )}
    </>
  );
  const items = pictures(moment).filter(still).slice(0, 3);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Slug
        look={look}
        userId={moment.authorId}
        name={name}
        kicker={kicker}
        leaving={leaving}
        top={layout.slugTop}
      />
      <View style={[styles.stage, { top: layout.photoTop, height: h }]}>
        {look.shot === 'hero' && (
          <Move
            from={{ y: 46, scale: 1.08 }}
            exit={{ y: -34, scale: 0.95 }}
            delay={delay}
            duration={720}
            leaving={leaving}
            style={[styles.hero, { width: w, height: h }]}>
            <View style={styles.heroClip}>
              <Drift duration={duration} dir={side}>
                {picture}
              </Drift>
              {!!moment.text && (
                <>
                  <LinearGradient
                    colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)']}
                    style={styles.heroScrim}
                  />
                  <Text numberOfLines={3} style={styles.heroText}>
                    {moment.text}
                  </Text>
                </>
              )}
            </View>
            <Stickers moment={moment} delay={delay + 650} />
          </Move>
        )}

        {look.shot === 'polaroid' && (
          <Move
            from={{ y: 96, rotate: side * 9, scale: 0.9 }}
            exit={{ x: side * 70, y: -50, rotate: side * 10, scale: 0.96 }}
            back
            delay={delay}
            duration={660}
            leaving={leaving}>
            <Float>
              <View
                style={[
                  styles.polaroid,
                  { width: w * 0.94, transform: [{ rotate: `${side * -2}deg` }] },
                ]}>
                <View style={[styles.polaroidPhoto, { height: h - 74 }]}>
                  <Drift duration={duration} dir={side}>
                    {picture}
                  </Drift>
                </View>
                <Text numberOfLines={1} style={styles.polaroidCaption}>
                  {[look.place, look.when?.split(' · ')[0]].filter(Boolean).join(' · ')}
                </Text>
                <Tape style={styles.tape} rotate={side * 4} />
              </View>
            </Float>
            {!!moment.text && (
              <StickyNote
                rotate={side * -5}
                width={150}
                delay={delay + 430}
                fixed
                style={{ position: 'absolute', top: -20, [side > 0 ? 'left' : 'right']: -6 }}>
                {moment.text}
              </StickyNote>
            )}
            <Stickers moment={moment} delay={delay + 700} />
          </Move>
        )}

        {look.shot === 'collage' && (
          <View style={{ width: w, height: h }}>
            {items.map((item, i) => {
              const last = i === items.length - 1;
              const spot =
                items.length === 2
                  ? [
                      { left: 0, top: h * 0.03, r: -6 },
                      { left: w * 0.36, top: h * 0.27, r: 5 },
                    ][i]
                  : [
                      { left: 0, top: h * 0.02, r: -7 },
                      { left: w * 0.4, top: h * 0.1, r: 6 },
                      { left: w * 0.17, top: h * 0.36, r: -2 },
                    ][i];
              const size = Math.min(w * 0.62, h * 0.6);
              return (
                <Move
                  key={item.uri}
                  from={{ y: 170, rotate: (i % 2 ? 1 : -1) * 16, scale: 0.9 }}
                  exit={{ x: (i - 1) * 70, y: -44, rotate: (i - 1) * 8, scale: 0.95 }}
                  back
                  delay={delay + i * 150}
                  duration={640}
                  leaving={leaving}
                  style={{ position: 'absolute', left: spot.left, top: spot.top, zIndex: i }}>
                  <View
                    style={[
                      styles.polaroid,
                      styles.small,
                      { width: size, transform: [{ rotate: `${spot.r}deg` }] },
                    ]}>
                    <View style={{ width: '100%', aspectRatio: 1, overflow: 'hidden' }}>
                      <Image
                        source={{ uri: still(item) }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                      />
                    </View>
                    {last && !!moment.text && (
                      <Text numberOfLines={1} style={[styles.polaroidCaption, { fontSize: 19 }]}>
                        {moment.text}
                      </Text>
                    )}
                  </View>
                </Move>
              );
            })}
            {pictures(moment).length > 3 && (
              <Move
                from={{ scale: 0.5 }}
                back
                delay={delay + 620}
                leaving={leaving}
                style={styles.more}>
                <Text style={styles.moreText}>+{pictures(moment).length - 3}</Text>
              </Move>
            )}
          </View>
        )}

        {(look.shot === 'quote' || look.shot === 'voice') && (
          <Move
            from={{ y: -70, rotate: side * -6, scale: 0.94 }}
            exit={{ y: 40, rotate: side * 5, scale: 0.96 }}
            back
            delay={delay}
            duration={640}
            leaving={leaving}>
            <Float>
              <View
                style={[
                  styles.paper,
                  { width: w * 0.92, minHeight: Math.min(h * 0.62, 260) },
                  { transform: [{ rotate: `${side * 1.6}deg` }] },
                ]}>
                <Tape style={styles.tape} rotate={side * -5} />
                {moment.text ? (
                  <>
                    <Text style={styles.quoteMark}>“</Text>
                    <Text
                      style={[
                        styles.quote,
                        moment.text.length > 120 && { fontSize: 26, lineHeight: 28 },
                        moment.text.length > 240 && { fontSize: 21, lineHeight: 23 },
                      ]}
                      numberOfLines={9}>
                      {moment.text}
                    </Text>
                  </>
                ) : moment.voice ? (
                  <LiveWave wave={moment.voice.waveform} seconds={moment.voice.duration} />
                ) : null}
              </View>
            </Float>
            <Stickers moment={moment} delay={delay + 650} />
          </Move>
        )}
      </View>
    </View>
  );
});

/** La onda de una nota de voz, latiendo. */
function LiveWave({ wave, seconds }: { wave: number[]; seconds: number }) {
  const bars = normalizeWave(wave, 36);
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((x) => x + 1), 70);
    return () => clearInterval(id);
  }, []);
  const head = (t * 0.7) % (bars.length + 6);
  return (
    <View style={{ alignItems: 'center', gap: 12 }}>
      <View style={styles.wave}>
        {bars.map((v, i) => {
          const near = Math.max(0, 1 - Math.abs(i - head) / 4);
          return (
            <View
              key={i}
              style={{
                flex: 1,
                height: Math.max(6, (v / 100) * 110 * (1 + near * 0.35)),
                borderRadius: 4,
                backgroundColor: i < head ? '#C2477A' : '#E2703A',
                opacity: 0.4 + (v / 100) * 0.6,
              }}
            />
          );
        })}
      </View>
      <Text style={styles.waveLabel}>Nota de voz · {Math.round(seconds)} s</Text>
    </View>
  );
}

/** Palabras que entran una a una (títulos). */
function Words({
  text,
  delay = 0,
  leaving,
  style,
}: {
  text: string;
  delay?: number;
  leaving: boolean;
  style: object | object[];
}) {
  const words = text.split(/\s+/).filter(Boolean);
  // El escalonado entero cabe en medio segundo, por largo que sea el título.
  const step = Math.min(80, 460 / Math.max(1, words.length));
  return (
    <View style={styles.words}>
      {words.map((word, i) => (
        <Move
          key={`${word}-${i}`}
          from={{ y: 30, rotate: i % 2 ? 4 : -4, scale: 0.9 }}
          back
          delay={delay + i * step}
          duration={560}
          leaving={leaving}>
          <Text style={style}>{word}</Text>
        </Move>
      ))}
    </View>
  );
}

/** Unas fotos repartidas en abanico, que entran como cartas. */
function Fan({
  moments,
  size,
  delay = 0,
  leaving,
  gather = false,
}: {
  moments: Moment[];
  size: number;
  delay?: number;
  leaving: boolean;
  /** Llegan volando desde fuera de la pantalla (final), en vez de repartirse desde abajo. */
  gather?: boolean;
}) {
  const shown = moments.filter((m) => m.imageUri).slice(0, 5);
  const mid = (shown.length - 1) / 2;
  const card = size * 0.46;
  return (
    <View style={{ width: size, height: card * 1.5, alignSelf: 'center' }}>
      {shown.map((m, i) => {
        const d = i - mid;
        const from = gather
          ? {
              x: d * size * 1.4 || size,
              y: (i % 2 ? -1 : 1) * size * 1.3,
              rotate: d * 40,
              scale: 0.7,
            }
          : { y: 230, rotate: d * 22, scale: 0.86 };
        return (
          <Move
            key={m.id}
            from={from}
            exit={{ y: -30 - Math.abs(d) * 8, x: d * 40, rotate: d * 6, scale: 0.95 }}
            back
            delay={delay + i * 95}
            duration={gather ? 820 : 700}
            leaving={leaving}
            style={{
              position: 'absolute',
              left: size / 2 - card / 2 + d * card * 0.52,
              top: Math.abs(d) * 14,
              zIndex: 10 - Math.abs(d),
            }}>
            <View
              style={[
                styles.polaroid,
                styles.small,
                { width: card, transform: [{ rotate: `${d * 8}deg` }] },
              ]}>
              <View style={{ width: '100%', aspectRatio: 1, overflow: 'hidden' }}>
                <Image
                  source={{ uri: m.imageUri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
              </View>
            </View>
          </Move>
        );
      })}
    </View>
  );
}

/**
 * Un plano de título: las fotos en abanico y un texto grande que entra
 * palabra a palabra. Sirve de portada, de escena general y de final.
 */
export const TitleShot = memo(function TitleShot({
  look,
  picks,
  title,
  kicker,
  lines,
  leaving,
  layout,
  gather,
  children,
}: {
  look: SceneLook;
  picks: Moment[];
  title: string;
  kicker?: string;
  /** Líneas debajo del título (el rango de fechas, la canción, un aviso…). */
  lines?: { text: string; hand?: boolean; accent?: boolean }[];
  leaving: boolean;
  layout: FilmLayout;
  gather?: boolean;
  children?: ReactNode;
}) {
  const t = tone(look.dark);
  const shadow = { textShadowColor: t.glow, textShadowRadius: 14 };
  const size = Math.min(layout.width - 40, 360);
  const has = picks.some((m) => m.imageUri);
  return (
    <View style={[StyleSheet.absoluteFill, styles.titleShot]} pointerEvents="box-none">
      <View pointerEvents="none" style={{ alignItems: 'center', gap: 14 }}>
        {has && <Fan moments={picks} size={size} delay={120} leaving={leaving} gather={gather} />}
        {!!kicker && (
          <Move from={{ y: 12 }} delay={has ? 420 : 0} leaving={leaving}>
            <Text style={[styles.kicker, { color: t.soft }, shadow]}>{kicker.toUpperCase()}</Text>
          </Move>
        )}
        <Words
          key={title}
          text={title}
          delay={has ? 480 : 80}
          leaving={leaving}
          style={[styles.title, { color: t.ink }, shadow]}
        />
        {(lines ?? []).map((line, i) => (
          <Move
            key={line.text}
            from={{ y: 14 }}
            delay={(has ? 950 : 500) + i * 140}
            leaving={leaving}>
            <Text
              style={[
                line.hand ? styles.handLine : styles.subLine,
                { color: line.accent ? t.accent : t.soft },
                shadow,
              ]}>
              {line.text}
            </Text>
          </Move>
        ))}
      </View>
      {children}
    </View>
  );
});

/** Frases que van apareciendo una tras otra (el resumen sin narradora). */
export const LinesShot = memo(function LinesShot({
  look,
  lines,
  leaving,
}: {
  look: SceneLook;
  lines: string[];
  leaving: boolean;
}) {
  const t = tone(look.dark);
  return (
    <View style={[StyleSheet.absoluteFill, styles.titleShot]} pointerEvents="none">
      {lines.map((line, i) => (
        <Move key={i} from={{ y: 26 }} delay={300 + i * 1800} duration={700} leaving={leaving}>
          <Text
            style={[
              styles.storyLine,
              i === 0 && { fontSize: 30, lineHeight: 35 },
              { color: t.ink, textShadowColor: t.glow, textShadowRadius: 12 },
            ]}>
            {line}
          </Text>
        </Move>
      ))}
    </View>
  );
});

/** Un número que sube hasta su valor. */
function Count({ to, delay, style }: { to: number; delay: number; style: object | object[] }) {
  const reduced = useReducedMotion();
  const [n, setN] = useState(reduced ? to : 0);
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const k = Math.max(0, Math.min(1, (now - start) / 1000));
      setN(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, delay, reduced]);
  return <Text style={style}>{n}</Text>;
}

/** Las cifras del periodo: números grandes que suben, y quiénes estuvieron. */
export const NumbersShot = memo(function NumbersShot({
  look,
  kicker,
  stats,
  authors,
  first,
  cities,
  leaving,
  layout,
  children,
}: {
  look: SceneLook;
  kicker: string;
  stats: { n: number; label: string }[];
  authors: string[];
  first: (id: string) => string;
  cities: string[];
  leaving: boolean;
  layout: FilmLayout;
  /** El mapa del mundo con sus puntos, si lo hay. */
  children?: ReactNode;
}) {
  const t = tone(look.dark);
  const shadow = { textShadowColor: t.glow, textShadowRadius: 14 };
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.numbers, { paddingTop: layout.slugTop + 6 }]}>
      <Move from={{ y: 14 }} leaving={leaving}>
        <Text style={[styles.numbersKicker, { color: t.accent }, shadow]}>{kicker}</Text>
      </Move>
      <View style={styles.grid}>
        {stats.map((s, i) => (
          <Move
            key={s.label}
            from={{ y: 34, scale: 0.8 }}
            back
            delay={160 + i * 130}
            duration={620}
            leaving={leaving}
            style={styles.stat}>
            <Count
              to={s.n}
              delay={260 + i * 130}
              style={[styles.statN, { color: t.ink }, shadow]}
            />
            <Text style={[styles.statL, { color: t.soft }, shadow]}>{s.label}</Text>
          </Move>
        ))}
      </View>
      <View style={styles.people}>
        {authors.slice(0, 8).map((id, i) => (
          <Move
            key={id}
            from={{ scale: 0.3, y: 16 }}
            back
            delay={760 + i * 80}
            duration={520}
            leaving={leaving}
            style={{ alignItems: 'center', gap: 4 }}>
            <Avatar userId={id} size={50} />
            <Text style={[styles.person, { color: t.ink }, shadow]}>{first(id)}</Text>
          </Move>
        ))}
      </View>
      {!!children && (
        <Move
          from={{ y: 20, scale: 0.96 }}
          delay={1100}
          duration={700}
          leaving={leaving}
          style={{ width: '100%' }}>
          {children}
        </Move>
      )}
      {cities.length > 0 && (
        <Move from={{ y: 12 }} delay={1300} leaving={leaving}>
          <Text style={[styles.handLine, { color: t.soft }, shadow]}>
            Desde {cities.join(' · ')}
          </Text>
        </Move>
      )}
    </View>
  );
});

/** El último índice que cumple (como findLastIndex, que no está en iPhones algo antiguos). */
function lastIndex<T>(list: T[], ok: (x: T) => boolean): number {
  for (let i = list.length - 1; i >= 0; i--) if (ok(list[i])) return i;
  return -1;
}

/** Letras por segundo cuando no hay voz que marque el ritmo. */
const PACE = 15;

/**
 * Los subtítulos de la narradora: una frase cada vez, escrita a mano, con las
 * palabras apareciendo al ritmo de su voz y la que se está diciendo resaltada.
 * Sin voz («progress» sin definir), van a ritmo de lectura y avisan al acabar.
 */
export function Captions({
  text,
  progress,
  paused,
  onDone,
  dark,
  bottom,
}: {
  text: string;
  progress?: number;
  paused: boolean;
  onDone: () => void;
  dark: boolean;
  bottom: number;
}) {
  const t = tone(dark);
  const [timed, setTimed] = useState(0);
  const elapsed = useRef(0);
  const done = useRef(onDone);
  done.current = onDone;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const voiced = progress !== undefined;

  useEffect(() => {
    if (voiced) return;
    let last = Date.now();
    let finished = false;
    const id = setInterval(() => {
      const now = Date.now();
      if (!pausedRef.current) elapsed.current += now - last;
      last = now;
      setTimed(Math.min(text.length, Math.floor((elapsed.current / 1000) * PACE)));
      if (!finished && elapsed.current > (text.length / PACE) * 1000 + 1800) {
        finished = true;
        done.current();
      }
    }, 60);
    return () => clearInterval(id);
  }, [text, voiced]);

  // Con voz: un pelín por delante de lo dicho, para que se lea con fluidez.
  const at = voiced ? Math.min(1, progress * 1.06 + 0.02) * text.length : timed;

  // La frase que toca, y sus palabras.
  const sentences: { start: number; end: number }[] = [];
  for (const m of text.matchAll(/[^.?!…]+[.?!…»"]*/g)) {
    const lead = m[0].length - m[0].trimStart().length;
    if (m[0].trim()) sentences.push({ start: m.index! + lead, end: m.index! + m[0].length });
  }
  const index = Math.max(
    0,
    lastIndex(sentences, (s) => s.start <= Math.max(at, 1)),
  );
  const cur = sentences[index] ?? { start: 0, end: text.length };
  const sentence = text.slice(cur.start, cur.end).trim();
  const words: { text: string; start: number }[] = [];
  for (const m of sentence.matchAll(/\S+/g))
    words.push({ text: m[0], start: cur.start + m.index! });
  const active = lastIndex(words, (w) => w.start <= at);

  return (
    <View pointerEvents="none" style={[styles.captions, { bottom }]}>
      <Move key={index} from={{ y: 12 }} duration={300}>
        <Text
          accessibilityLabel={text}
          style={[styles.caption, { color: t.ink, textShadowColor: t.glow, textShadowRadius: 10 }]}>
          {words.map((w, i) => (
            <Text
              key={i}
              style={
                i < active
                  ? undefined
                  : i === active
                    ? { color: t.accent }
                    : { color: 'transparent', textShadowColor: 'transparent' }
              }>
              {w.text}
              {i < words.length - 1 ? ' ' : ''}
            </Text>
          ))}
        </Text>
      </Move>
    </View>
  );
}

const styles = StyleSheet.create({
  slug: { position: 'absolute', left: 16, right: 16, alignItems: 'center', gap: 2 },
  kicker: { fontSize: 13, fontWeight: '700', letterSpacing: 1.6, textAlign: 'center' },
  place: {
    fontFamily: HandBold,
    fontSize: 46,
    lineHeight: 54,
    textAlign: 'center',
    paddingHorizontal: 6,
  },
  by: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  byText: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  stage: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    borderRadius: 28,
    backgroundColor: '#15171C',
    boxShadow: '0 28px 60px rgba(8,12,36,0.38)',
  },
  heroClip: { flex: 1, borderRadius: 28, overflow: 'hidden' },
  heroScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '46%' },
  heroText: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 18,
    fontFamily: Hand,
    fontSize: 28,
    lineHeight: 30,
    color: '#FFFFFF',
  },
  polaroid: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    paddingBottom: 8,
    borderRadius: 4,
    boxShadow: '0 24px 50px rgba(8,12,36,0.32)',
  },
  small: { padding: 8, paddingBottom: 26 },
  polaroidPhoto: { width: '100%', overflow: 'hidden', borderRadius: 2, backgroundColor: '#E9E4DA' },
  polaroidCaption: {
    fontFamily: Hand,
    fontSize: 24,
    lineHeight: 30,
    color: '#3C3F44',
    textAlign: 'center',
    marginTop: 8,
  },
  tape: { position: 'absolute', top: -9, alignSelf: 'center' },
  more: {
    position: 'absolute',
    right: 6,
    bottom: 10,
    zIndex: 20,
    minWidth: 46,
    height: 46,
    borderRadius: 23,
    paddingHorizontal: 10,
    backgroundColor: '#23201D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  paper: {
    backgroundColor: '#FFFDF6',
    paddingHorizontal: 26,
    paddingVertical: 30,
    borderRadius: 4,
    justifyContent: 'center',
    boxShadow: '0 22px 46px rgba(8,12,36,0.3)',
  },
  quoteMark: {
    fontFamily: HandBold,
    fontSize: 70,
    lineHeight: 50,
    height: 34,
    color: '#C2477A',
  },
  quote: { fontFamily: Hand, fontSize: 34, lineHeight: 35, color: '#2A2724' },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 130, width: '100%' },
  waveLabel: { fontFamily: Hand, fontSize: 22, color: '#6B6F76' },
  titleShot: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 18 },
  words: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 12,
    rowGap: 0,
  },
  title: { fontFamily: HandBold, fontSize: 52, lineHeight: 56, textAlign: 'center' },
  subLine: { fontSize: 17, fontWeight: '500', textAlign: 'center' },
  handLine: { fontFamily: Hand, fontSize: 23, lineHeight: 27, textAlign: 'center' },
  storyLine: { fontFamily: Hand, fontSize: 25, lineHeight: 30, textAlign: 'center' },
  numbers: { alignItems: 'center', paddingHorizontal: 20, gap: 16 },
  numbersKicker: { fontFamily: HandBold, fontSize: 32, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', rowGap: 6 },
  stat: { width: '50%', maxWidth: 190, alignItems: 'center' },
  statN: { fontFamily: HandBold, fontSize: 68, lineHeight: 70 },
  statL: { fontSize: 15, fontWeight: '600', marginTop: -4 },
  people: { flexDirection: 'row', gap: 14, flexWrap: 'wrap', justifyContent: 'center' },
  person: { fontSize: 13, fontWeight: '600' },
  captions: { position: 'absolute', left: 20, right: 20, alignItems: 'center' },
  caption: {
    fontFamily: Hand,
    fontSize: 30,
    lineHeight: 35,
    textAlign: 'center',
    maxWidth: 560,
  },
});
