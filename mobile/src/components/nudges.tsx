import { router } from 'expo-router';
import { Volume2, VolumeX, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, SerifItalic, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import { buildStory, type Gap } from '@/lib/story';
import { enablePush, pushState } from '@/lib/push';
import { useVoiceClip } from '@/lib/voice-clip';

import { Icon } from './icon';
import { LogoMark } from './logo';
import { EASE } from './motion';

// Burbujas de la narradora: de vez en cuando, si falta algo que hace la app
// mejor (los avisos, tu ciudad, tu foto…), aparece una burbuja flotante y ella
// cuenta por qué merece la pena, con un botón para hacerlo sin pasar por los
// ajustes. Como mucho una cada 20 minutos; «Ahora no» la aparca unos días.

type Nudge = {
  id: 'instalar' | 'avisos' | 'ciudad' | 'foto' | 'cumple' | 'narradora' | 'hueco';
  title: string;
  text: string;
  action: string;
};

const NUDGES: Record<Nudge['id'], Nudge> = {
  instalar: {
    id: 'instalar',
    title: 'Junti en tu pantalla de inicio',
    text: 'Añade Junti a tu pantalla de inicio. Se abrirá como una app de verdad y, en el iPhone, es la única forma de que te lleguen los avisos.',
    action: 'Cómo se hace',
  },
  avisos: {
    id: 'avisos',
    title: '¿Te aviso?',
    text: '¿Te aviso cuando alguien comparta algo? Sin avisos, los momentos se quedan esperando y te los pierdes. Solo te escribo para lo importante, y respeto tus horas de descanso.',
    action: 'Activar avisos',
  },
  ciudad: {
    id: 'ciudad',
    title: '¿Dónde vives?',
    text: 'Aún no sé dónde vives. Dímelo y aparecerás en el planeta: los demás sabrán qué hora es para ti antes de escribirte.',
    action: 'Elegir mi ciudad',
  },
  foto: {
    id: 'foto',
    title: 'Tu foto',
    text: 'Ponte una foto de perfil. Así te reconocen en el mapa y en cada recuerdo, y no eres solo una inicial.',
    action: 'Poner mi foto',
  },
  cumple: {
    id: 'cumple',
    title: 'Tu cumpleaños',
    text: '¿Cuándo es tu cumpleaños? Así nadie se olvida de felicitarte, y yo lo cuento en la historia del grupo.',
    action: 'Añadirlo',
  },
  hueco: {
    id: 'hueco',
    title: 'Un hueco en vuestra historia',
    text: 'Hay unos años de vuestra historia de los que no sé nada. ¿Me contáis qué pasó? Con un recuerdo, lo añado a vuestra historia.',
    action: 'Añadir un recuerdo',
  },
  narradora: {
    id: 'narradora',
    title: 'Actívame',
    text: 'Todavía no me habéis activado. Si me activas, cada semana os cuento vuestra historia en voz alta, con vuestras fotos y vuestra música.',
    action: 'Activar la narradora',
  },
};

const web = Platform.OS === 'web' && typeof window !== 'undefined';
const FIRST_DELAY = 25_000; // un rato después de entrar, no nada más llegar
const GAP = 20 * 60_000; // como mucho una burbuja cada 20 minutos
const SNOOZE = 4 * 86_400_000; // «Ahora no»: unos días
const DONE = 60 * 86_400_000;

const read = (k: string) => {
  try {
    return Number(localStorage.getItem(k) ?? 0);
  } catch {
    return 0;
  }
};
const write = (k: string, v: number) => {
  try {
    localStorage.setItem(k, String(v));
  } catch {
    // sin almacenamiento: solo para esta vez
  }
};
const LAST = 'junti-burbuja-ultima';
const until = (id: string) => `junti-burbuja-${id}`;

export function Nudges({ groupId, paused }: { groupId: string; paused: boolean }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { me, user, group, setNarrative, moments } = useStore();
  // El hueco de la historia del que se habla (para el texto y el año del recuerdo).
  const [gap, setGap] = useState<Gap | null>(null);
  const [nudge, setNudge] = useState<Nudge | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'howto'>('idle');
  const voice = useVoiceClip(nudge ? `voz/avisos/${nudge.id}.mp3` : null);
  // Lo último del almacén, sin reiniciar la espera cada vez que se actualiza.
  const latest = useRef({ me, user, group, moments });
  latest.current = { me, user, group, moments };

  // Qué falta, en orden de importancia.
  useEffect(() => {
    if (!web || paused || nudge) return;
    const id = setTimeout(async () => {
      const now = Date.now();
      if (now - read(LAST) < GAP) return;
      const { me: self, user: who, group: find, moments: all } = latest.current;
      const profile = who(self);
      const g = find(groupId);
      const push = await pushState().catch(() => 'unsupported' as const);
      const missing: Nudge['id'][] = [];
      if (push === 'needs-install') missing.push('instalar');
      if (push === 'off') missing.push('avisos');
      if (!profile.city) missing.push('ciudad');
      if (!profile.avatarUri) missing.push('foto');
      if (!profile.about.birthMonth) missing.push('cumple');
      if (g?.isAdmin && !g.narrativeEnabled) missing.push('narradora');
      // Años de la historia del grupo sin ningún recuerdo.
      const story = g
        ? buildStory(
            g.origins,
            all.filter((m) => m.groupId === groupId),
          )
        : null;
      const hole = story?.gaps[0] ?? null;
      if (hole) missing.push('hueco');
      setGap(hole);
      const next = missing.find((m) => read(until(m)) < now);
      if (!next) return;
      write(LAST, now);
      setState('idle');
      setNudge(NUDGES[next]);
    }, FIRST_DELAY);
    return () => clearTimeout(id);
  }, [paused, nudge, groupId]);

  if (!nudge || paused) return null;

  const close = (snooze: number) => {
    write(until(nudge.id), Date.now() + snooze);
    setNudge(null);
  };

  const act = async () => {
    switch (nudge.id) {
      case 'avisos':
        setState('busy');
        try {
          await enablePush();
          setState('done');
          write(until(nudge.id), Date.now() + DONE);
          setTimeout(() => setNudge(null), 1800);
        } catch {
          setState('idle');
        }
        return;
      case 'instalar':
        setState('howto');
        return;
      case 'hueco':
        close(SNOOZE);
        router.push({
          pathname: '/publish',
          params: {
            groupId,
            memory: '1',
            ...(gap ? { year: String(Math.round((gap.from + gap.to) / 2)) } : {}),
          },
        });
        return;
      case 'narradora':
        setState('busy');
        await setNarrative(groupId, true, group(groupId)?.narrativeStyle ?? 'emotivo').catch(
          () => {},
        );
        setState('done');
        write(until(nudge.id), Date.now() + DONE);
        setTimeout(() => setNudge(null), 1800);
        return;
      default:
        close(SNOOZE);
        router.push('/settings');
    }
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(520).easing(EASE)}
      exiting={FadeOutDown.duration(250)}
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: insets.bottom + 92 }]}>
      <View
        accessibilityRole="alert"
        style={[styles.bubble, { backgroundColor: theme.card, boxShadow: theme.shadow }]}>
        <View style={styles.head}>
          <LogoMark size={26} />
          <Text style={[styles.title, { color: theme.text }]}>{nudge.title}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={voice.muted ? 'Activar la voz' : 'Silenciar la voz'}
            onPress={() => voice.setMuted(!voice.muted)}
            hitSlop={8}
            style={[styles.round, { backgroundColor: theme.soft }]}>
            <Icon icon={voice.muted ? VolumeX : Volume2} size={14} color={theme.text} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            onPress={() => close(SNOOZE)}
            hitSlop={8}
            style={[styles.round, { backgroundColor: theme.soft }]}>
            <Icon icon={X} size={14} color={theme.text} />
          </Pressable>
        </View>
        <Text style={[styles.text, { color: theme.textSecondary }]}>
          {state === 'howto'
            ? 'En Safari, toca el botón de compartir (el cuadrado con la flecha) y elige «Añadir a pantalla de inicio». Luego abre Junti desde ese icono.'
            : state === 'done'
              ? 'Hecho. Gracias.'
              : nudge.id === 'hueco' && gap
                ? `No sé nada de ${gap.from === gap.to ? gap.from : `${gap.from} a ${gap.to}`}. ¿Qué pasó esos años? Contádmelo con un recuerdo y lo añado a vuestra historia.`
                : nudge.text}
        </Text>
        {state !== 'done' && state !== 'howto' && (
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={() => close(SNOOZE)} hitSlop={6}>
              <Text style={{ color: theme.textSecondary, fontSize: 14 }}>Ahora no</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={state === 'busy'}
              onPress={act}
              style={[
                styles.cta,
                { backgroundColor: theme.accent, opacity: state === 'busy' ? 0.5 : 1 },
              ]}>
              <Text style={{ color: theme.onAccent, fontSize: 14, fontWeight: '600' }}>
                {state === 'busy' ? 'Un momento…' : nudge.action}
              </Text>
            </Pressable>
          </View>
        )}
        {state === 'howto' && (
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => close(DONE)}
              style={[styles.cta, { backgroundColor: theme.accent }]}>
              <Text style={{ color: theme.onAccent, fontSize: 14, fontWeight: '600' }}>
                Entendido
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 150 },
  bubble: { width: '100%', maxWidth: 440, borderRadius: Radius.inner, padding: 16, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontSize: 17, fontWeight: '600' },
  round: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontFamily: SerifItalic, fontSize: 16, lineHeight: 23 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 16 },
  cta: { height: 40, paddingHorizontal: 16, borderRadius: Radius.pill, justifyContent: 'center' },
});
