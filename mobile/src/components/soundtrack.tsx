import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';

import { Hand, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import type { Song } from '@/data/types';
import { mmss, spotifyLink, usePreview } from '@/lib/music';
import { ArrowUpRight, Music } from 'lucide-react-native';
import { Icon } from './icon';

const COVER = 128;
/** El carrusel: tamaño de las portadas y distancia entre una y otra. */
const FLOW = 150;
const FLOW_STEP = 112;

/** La curva de las transiciones: rápida al salir y posándose con un rebote mínimo. */
const SPRINGY = 'cubic-bezier(.22,1.12,.36,1)';
const OUT = 'cubic-bezier(.4,0,1,1)';
const isWeb = Platform.OS === 'web';
const el = (n: unknown) => n as HTMLElement | null;
const anim = (node: Element | null | undefined) =>
  node && typeof (node as HTMLElement).animate === 'function' ? (node as HTMLElement) : null;

/**
 * La banda sonora del grupo: las portadas en un carrusel 3D; al elegir una,
 * la portada vuela hasta el reproductor (la tarjeta encoge con ella), el disco
 * sale de la funda y suena. Al volver, el disco entra y la portada vuela de
 * vuelta a su sitio en el carrusel.
 */
export function Soundtrack({ groupId }: { groupId: string }) {
  const theme = useTheme();
  const { songs } = useStore();
  const list = songs.filter((s) => s.groupId === groupId);
  const [open, setOpen] = useState<string | null>(null);
  const [focus, setFocus] = useState(0);
  const [inner, setInner] = useState(0);
  const song = list.find((s) => s.id === open);
  const card = useRef<HTMLElement | null>(null);
  const flight = useRef<{ height: number; from: DOMRect | null; id: string } | null>(null);

  const go = (id: string | null, from: DOMRect | null, songId: string) => {
    if (isWeb && card.current)
      flight.current = { height: card.current.getBoundingClientRect().height, from, id: songId };
    if (!id) {
      setFocus(
        Math.max(
          0,
          list.findIndex((s) => s.id === songId),
        ),
      );
      if (card.current) setInner(card.current.getBoundingClientRect().width - 40);
    }
    setOpen(id);
  };

  // FLIP: la tarjeta pasa de su alto de antes al nuevo, y la portada vuela de
  // donde estaba a donde está ahora (el reproductor o su sitio en el carrusel).
  useLayoutEffect(() => {
    const f = flight.current;
    flight.current = null;
    const box = anim(card.current);
    if (!f || !box) return;
    const h1 = box.getBoundingClientRect().height;
    if (Math.abs(h1 - f.height) > 1) {
      box.style.overflow = 'hidden';
      const a = box.animate([{ height: `${f.height}px` }, { height: `${h1}px` }], {
        duration: 620,
        easing: SPRINGY,
      });
      a.onfinish = a.oncancel = () => {
        box.style.overflow = '';
      };
    }
    const target = anim(box.querySelector(open ? '[data-record]' : `[data-flow="${f.id}"]`));
    if (f.from && target) {
      const to = target.getBoundingClientRect();
      // el reproductor mide el disco + la funda: la portada es su parte cuadrada
      const side = open ? to.height : to.width;
      const sx = f.from.width / side;
      target.animate(
        [
          {
            transformOrigin: 'top left',
            transform: `translate(${f.from.left - to.left}px, ${f.from.top - to.top}px) scale(${sx})`,
          },
          {
            transformOrigin: 'top left',
            transform: open ? 'none' : getComputedStyle(target).transform,
          },
        ],
        { duration: 640, easing: SPRINGY },
      );
    }
    // lo demás aparece escalonado, sin prisa
    box.querySelectorAll('[data-rise]').forEach((n, i) =>
      (n as HTMLElement).animate?.(
        [
          { opacity: 0, transform: 'translateY(10px)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 420, delay: 160 + i * 60, easing: SPRINGY, fill: 'backwards' },
      ),
    );
    if (!open)
      box.querySelectorAll('[data-flow]').forEach((n) => {
        if ((n as HTMLElement).dataset.flow === f.id) return;
        const side =
          n.getBoundingClientRect().left < (target?.getBoundingClientRect().left ?? 0) ? -1 : 1;
        (n as HTMLElement).animate?.(
          [
            {
              opacity: 0,
              transform: `translateX(${side * 36}px) ${getComputedStyle(n).transform === 'none' ? '' : getComputedStyle(n).transform}`,
            },
            { opacity: getComputedStyle(n).opacity, transform: getComputedStyle(n).transform },
          ],
          { duration: 520, delay: 120, easing: SPRINGY, fill: 'backwards' },
        );
      });
  }, [open]);

  return (
    <View
      ref={(n) => void (card.current = el(n))}
      style={[styles.card, { backgroundColor: theme.card }]}>
      {song ? (
        <Player
          song={song}
          list={list}
          onBack={(from) => go(null, from, song.id)}
          onSwitch={setOpen}
        />
      ) : (
        <>
          <View style={styles.head} {...rise}>
            <Text style={[styles.title, { color: theme.text }]}>Nuestra banda sonora</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/add-song', params: { groupId } })}
              style={[styles.pill, { backgroundColor: theme.soft }]}>
              <Text style={[styles.pillText, { color: theme.textSecondary }]}>＋ Añadir</Text>
            </Pressable>
          </View>
          {list.length === 0 ? (
            <Text style={[styles.empty, { color: theme.textSecondary }]}>
              Las canciones que os recuerdan a algo: la del viaje, la de aquel verano, la que
              siempre cantáis. Añade la primera.
            </Text>
          ) : (
            <CoverFlow
              list={list}
              initial={focus}
              width0={inner}
              onOpen={(id, from) => go(id, from, id)}
            />
          )}
          {list.length > 1 && (
            <Text style={[styles.hint, { color: theme.textSecondary }]} {...rise}>
              Desliza para ver todas; toca la del centro para escucharla.
            </Text>
          )}
        </>
      )}
    </View>
  );
}

/** Marca lo que entra escalonado en las transiciones. */
const rise = { dataSet: { rise: '1' } } as object;

/**
 * Las portadas en un carrusel 3D: se deslizan en horizontal y la del centro
 * queda de frente; las de los lados giran hacia ella. Tocar la del centro la
 * abre; tocar otra la trae al centro.
 */
function CoverFlow({
  list,
  initial,
  width0,
  onOpen,
}: {
  list: Song[];
  initial: number;
  /** el ancho ya conocido (al volver), para colocarlo antes de pintar */
  width0: number;
  onOpen: (id: string, from: DOMRect | null) => void;
}) {
  const theme = useTheme();
  const scroller = useRef<{ scrollTo: (o: { x: number; animated?: boolean }) => void } | null>(
    null,
  );
  const [width, setWidth] = useState(width0);
  const step = FLOW_STEP;
  const [x, setX] = useState(initial * step);
  const placed = useRef(false);
  const covers = useRef(new Map<string, HTMLElement>());
  // Al volver del reproductor, el carrusel ya está en la canción que sonaba.
  useLayoutEffect(() => {
    if (placed.current || !width) return;
    placed.current = true;
    if (initial) scroller.current?.scrollTo({ x: initial * step, animated: false });
  }, [width, initial, step]);
  const choose = (s: Song) => {
    const node = covers.current.get(s.id);
    const from = node?.getBoundingClientRect() ?? null;
    // las de los lados se apartan; la del centro se hunde un poco antes de volar
    covers.current.forEach((n, id) => {
      if (id === s.id) {
        n.animate?.([{ transform: getComputedStyle(n).transform }, { transform: 'scale(.96)' }], {
          duration: 120,
          easing: OUT,
          fill: 'forwards',
        });
        return;
      }
      const side = n.getBoundingClientRect().left < (from?.left ?? 0) ? -1 : 1;
      n.animate?.(
        [
          { opacity: getComputedStyle(n).opacity, transform: getComputedStyle(n).transform },
          { opacity: 0, transform: `translateX(${side * 40}px) scale(.8)` },
        ],
        { duration: 160, easing: OUT, fill: 'forwards' },
      );
    });
    if (isWeb) setTimeout(() => onOpen(s.id, from), 130);
    else onOpen(s.id, null);
  };
  const pad = Math.max(0, (width - step) / 2);
  const current = Math.max(0, Math.min(list.length - 1, Math.round(x / step)));
  const song = list[current];
  return (
    <View style={{ gap: 10 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <ScrollView
        ref={scroller as never}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={(e) => setX(e.nativeEvent.contentOffset.x)}
        style={{ marginHorizontal: -20 }}
        contentContainerStyle={{
          paddingHorizontal: pad + 20,
          height: FLOW + 24,
          alignItems: 'center',
        }}>
        {list.map((s, i) => {
          const d = Math.max(-3, Math.min(3, (x - i * step) / step));
          const a = Math.min(1, Math.abs(d));
          return (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityLabel={`${s.title}, de ${s.artist}`}
              onPress={() =>
                i === current
                  ? choose(s)
                  : scroller.current?.scrollTo({ x: i * step, animated: true })
              }
              style={{
                width: step,
                height: FLOW,
                alignItems: 'center',
                zIndex: 100 - Math.round(Math.abs(d) * 10),
              }}>
              <View
                ref={(n) => {
                  const h = el(n);
                  if (h) covers.current.set(s.id, h);
                  else covers.current.delete(s.id);
                }}
                {...({ dataSet: { flow: s.id } } as object)}
                style={{
                  width: FLOW,
                  height: FLOW,
                  borderRadius: 12,
                  boxShadow: `0 ${14 - a * 6}px ${26 - a * 8}px rgba(20,22,26,${0.32 - a * 0.1})`,
                  opacity: 1 - Math.max(0, Math.abs(d) - 1.6) * 0.5,
                  transform: [
                    { perspective: 700 },
                    { translateX: -Math.sign(d) * a * 0 + d * 18 },
                    { rotateY: `${Math.sign(d) * a * 52}deg` },
                    { scale: 1 - a * 0.16 },
                  ],
                }}>
                <Artwork song={s} size={FLOW} />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      {song && (
        <View style={{ alignItems: 'center', gap: 2 }} {...rise}>
          <Text numberOfLines={1} style={{ color: theme.text, fontSize: 17, fontWeight: '600' }}>
            {song.title}
          </Text>
          <Text numberOfLines={1} style={{ color: theme.textSecondary, fontSize: 14 }}>
            {song.artist}
          </Text>
        </View>
      )}
      {list.length > 1 && (
        <View style={styles.dots} {...rise}>
          {list.map((s, i) => (
            <View
              key={s.id}
              style={[styles.dot, { backgroundColor: i === current ? theme.text : theme.soft }]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

export function Artwork({ song, size }: { song: Song; size: number }) {
  return song.artwork ? (
    <Image
      source={{ uri: song.artwork }}
      style={{ width: size, height: size, borderRadius: 10 }}
      contentFit="cover"
    />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        backgroundColor: '#2B2E33',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Icon icon={Music} size={Math.round(size * 0.3)} color="#8B9096" />
    </View>
  );
}

/**
 * La funda con su disco: al aparecer, el disco sale de la carátula hacia la
 * derecha; mientras suena, gira. Se usa en el reproductor y en «Hoy».
 */
export function RecordSleeve({
  song,
  size,
  playing,
  delay = 0,
  out = true,
}: {
  song: Song;
  size: number;
  playing: boolean;
  /** espera antes de sacar el disco (p. ej., a que aterrice la portada) */
  delay?: number;
  /** false: el disco vuelve a entrar en la funda */
  out?: boolean;
}) {
  const slide = useSharedValue(0);
  const spin = useSharedValue(0);
  useEffect(() => {
    if (out) {
      slide.value = 0;
      // sale con un muelle: rápido, y se posa con un rebote mínimo
      slide.value = withDelay(delay, withSpring(1, { damping: 15, stiffness: 120, mass: 0.9 }));
    } else {
      slide.value = withTiming(0, { duration: 230, easing: Easing.in(Easing.cubic) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.id, out]);
  useEffect(() => {
    if (playing) {
      spin.value = withRepeat(
        withTiming(spin.value + 360, { duration: 2400, easing: Easing.linear }),
        -1,
        false,
      );
    } else cancelAnimation(spin);
  }, [playing, spin]);
  const vinyl = useAnimatedStyle(() => ({
    transform: [{ translateX: slide.value * size * 0.42 }, { rotate: `${spin.value}deg` }],
  }));
  return (
    <View
      style={{ width: size * 1.45, height: size }}
      {...({ dataSet: { record: '1' } } as object)}>
      <Animated.View
        style={[styles.vinyl, { width: size, height: size, borderRadius: size / 2 }, vinyl]}>
        {[0.92, 0.78, 0.64].map((k) => (
          <View
            key={k}
            style={[styles.groove, { width: size * k, height: size * k, borderRadius: size }]}
          />
        ))}
        <View
          style={[
            styles.labelDisc,
            { width: size * 0.36, height: size * 0.36, borderRadius: size },
          ]}>
          {song.artwork ? (
            <Image
              source={{ uri: song.artwork }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          ) : null}
          <View style={styles.spindle} />
        </View>
      </Animated.View>
      <View style={styles.sleeve}>
        <Artwork song={song} size={size} />
      </View>
    </View>
  );
}

function Player({
  song,
  list,
  onBack,
  onSwitch,
}: {
  song: Song;
  list: Song[];
  onBack: (from: DOMRect | null) => void;
  onSwitch: (id: string) => void;
}) {
  const theme = useTheme();
  const { user, me, removeSong } = useStore();
  const audio = usePreview(song.preview);
  const record = useRef<HTMLElement | null>(null);
  const [closing, setClosing] = useState(false);
  // La primera vez, el disco espera a que aterrice la portada; al cambiar de canción, sale ya.
  const first = useRef(true);
  useEffect(() => {
    const id = setTimeout(() => (first.current = false), 50);
    return () => clearTimeout(id);
  }, []);
  // Volver: primero el disco entra en la funda; luego la portada vuela al carrusel.
  const back = () => {
    if (closing) return;
    if (audio.playing) audio.toggle();
    setClosing(true);
    setTimeout(
      () => {
        const r = record.current?.getBoundingClientRect();
        onBack(r ? new DOMRect(r.left, r.top, r.height, r.height) : null);
      },
      isWeb ? 240 : 0,
    );
  };
  const i = list.findIndex((s) => s.id === song.id);
  const go = (d: number) => onSwitch(list[(i + d + list.length) % list.length].id);

  return (
    <View style={{ gap: 20 }}>
      <View style={styles.head} {...rise}>
        <Pressable
          accessibilityRole="button"
          onPress={back}
          style={[styles.pill, { backgroundColor: theme.soft }]}>
          <Text style={[styles.pillText, { color: theme.textSecondary }]}>Volver</Text>
        </Pressable>
        <Pressable
          accessibilityRole="link"
          onPress={() => Linking.openURL(spotifyLink(song.title, song.artist))}
          style={[styles.pill, { backgroundColor: theme.soft }]}>
          <Text style={[styles.pillText, { color: theme.textSecondary }]}>Ver en Spotify</Text>
          <Icon icon={ArrowUpRight} size={16} />
        </Pressable>
      </View>
      <View style={styles.playerRow}>
        <View ref={(n) => void (record.current = el(n))}>
          <RecordSleeve
            song={song}
            size={COVER}
            playing={audio.playing}
            delay={first.current && isWeb ? 470 : 0}
            out={!closing}
          />
        </View>
        <View style={{ flex: 1, alignItems: 'center', gap: 8 }} {...rise}>
          <Text numberOfLines={1} style={{ color: theme.textSecondary, fontSize: 13 }}>
            {song.artist}
          </Text>
          <Text
            numberOfLines={2}
            style={{ color: theme.text, fontSize: 17, fontWeight: '600', textAlign: 'center' }}>
            {song.title}
          </Text>
          <View style={[styles.time, { backgroundColor: theme.soft }]}>
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
              {mmss(audio.position)} / {mmss(audio.duration)}
            </Text>
          </View>
          <View style={[styles.controls, { backgroundColor: theme.soft }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Anterior"
              onPress={() => go(-1)}
              style={styles.ctrl}>
              <Text style={[styles.ctrlText, { color: theme.textSecondary }]}>⏮</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={audio.playing ? 'Pausa' : 'Reproducir'}
              onPress={() =>
                audio.available ? audio.toggle() : song.link && Linking.openURL(song.link)
              }
              style={styles.ctrl}>
              <Text style={[styles.ctrlText, { color: theme.text, fontSize: 20 }]}>
                {audio.playing ? '⏸' : '▶'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Siguiente"
              onPress={() => go(1)}
              style={styles.ctrl}>
              <Text style={[styles.ctrlText, { color: theme.textSecondary }]}>⏭</Text>
            </Pressable>
          </View>
        </View>
      </View>
      {!!song.note && (
        <Text style={[styles.note, { color: theme.text }]} {...rise}>
          «{song.note}»{' '}
          <Text style={{ color: theme.textSecondary }}>
            — {user(song.addedBy).name.split(' ')[0]}
          </Text>
        </Text>
      )}
      {song.addedBy === me && (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            removeSong(song.id)
              .then(() => onBack(null))
              .catch(() => {})
          }>
          <Text style={{ color: theme.textSecondary, fontSize: 13, textAlign: 'center' }}>
            Quitar de la banda sonora
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 32,
    padding: 20,
    gap: 16,
    boxShadow: '0 18px 40px rgba(20,22,26,0.10)',
    overflow: 'visible',
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 24, fontWeight: '500', letterSpacing: -0.4 },
  pill: { height: 36, paddingHorizontal: 16, borderRadius: 999, justifyContent: 'center' },
  pillText: { fontSize: 15, fontWeight: '500' },
  empty: { fontSize: 15, lineHeight: 21 },
  hint: { fontSize: 13, textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vinyl: {
    position: 'absolute',
    left: 0,
    top: 0,
    backgroundColor: '#141518',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 18px rgba(0,0,0,0.3)',
  },
  groove: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  labelDisc: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2703A',
  },
  spindle: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F6F1EA' },
  sleeve: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: 10,
    boxShadow: '0 12px 22px rgba(20,22,26,0.3)',
  },
  time: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  controls: { flexDirection: 'row', borderRadius: 999, paddingHorizontal: 8, marginTop: 4 },
  ctrl: { width: 44, height: 40, alignItems: 'center', justifyContent: 'center' },
  ctrlText: { fontSize: 17 },
  note: { fontFamily: Hand, fontSize: 24, lineHeight: 24, textAlign: 'center' },
});
