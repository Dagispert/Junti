import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { PressScale } from '@/components/motion';
import { Button, Screen, Tag, Title } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import { type FamilyId, useFamily, useFamilyColorMode } from '@/lib/families';
import {
  BookOpen,
  Camera,
  ChevronDown,
  Gamepad2,
  ChartColumn,
  CircleHelp,
  Flag,
  History,
  Import,
  MessageCircle,
  Mic,
  type LucideIcon,
} from 'lucide-react-native';

type Option = {
  family: FamilyId;
  icon: LucideIcon;
  title: string;
  hint: string;
  go: () => void;
};

/** El «+» del grupo: qué añadir. Un momento, un recuerdo, un reto o una pregunta. */
export default function AddScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const theme = useTheme();
  const group = useStore().group(groupId);
  const mode = useFamilyColorMode();
  // «Minijuegos» se despliega con todos los que hay
  const [juegos, setJuegos] = useState(false);
  if (!group) return null;

  // Se sustituye esta pantalla para que «Cancelar» vuelva directo al grupo.
  const open = (
    pathname: '/publish' | '/new-challenge' | '/new-karaoke' | '/new-cuento' | '/ask' | '/importar',
    params: Record<string, string>,
  ) => router.replace({ pathname, params: { groupId, ...params } } as never);

  const main: Option = {
    family: 'moment',
    icon: Camera,
    title: 'Un momento',
    hint: 'Foto, vídeo, voz o unas palabras de ahora',
    go: () => open('/publish', {}),
  };
  const options: Option[] = [
    {
      family: 'memory',
      icon: History,
      title: 'Un recuerdo',
      hint: 'Una foto de antes, en su fecha',
      go: () => open('/publish', { memory: '1' }),
    },
    {
      family: 'memory',
      icon: Import,
      title: 'Desde WhatsApp',
      hint: 'Las fotos de un chat, a vuestra historia',
      go: () => open('/importar', {}),
    },
    {
      family: 'challenge',
      icon: Flag,
      title: 'Un reto',
      hint: 'Algo que hacer todos',
      go: () => open('/new-challenge', {}),
    },
    {
      family: 'challenge',
      icon: Gamepad2,
      title: 'Minijuegos',
      hint: 'Karaoke, el cuento a trozos…',
      go: () => setJuegos((v) => !v),
    },
    {
      family: 'poll',
      icon: ChartColumn,
      title: 'Una encuesta',
      hint: 'Votad entre varias opciones',
      go: () => open('/ask', { kind: 'poll' }),
    },
    {
      family: 'quiz',
      icon: CircleHelp,
      title: 'Un quiz',
      hint: '¿Quién de nosotros…? A adivinar',
      go: () => open('/ask', { kind: 'quiz' }),
    },
    {
      family: 'open',
      icon: MessageCircle,
      title: 'Una pregunta',
      hint: 'Cada uno responde con sus palabras',
      go: () => open('/ask', { kind: 'open' }),
    },
  ];

  // Los minijuegos (se irán sumando más).
  const minijuegos: Option[] = [
    {
      family: 'challenge',
      icon: Mic,
      title: 'Karaoke',
      hint: 'Cantad todos la misma canción y sale un vídeo con todas las voces',
      go: () => open('/new-karaoke', {}),
    },
    {
      family: 'challenge',
      icon: BookOpen,
      title: 'El cuento a trozos',
      hint: 'Cada uno graba cómo sigue, oyendo solo el trozo anterior',
      go: () => open('/new-cuento', {}),
    },
  ];

  const tile = (o: Option, i: number, wide = false) => (
    <Tile key={o.title} o={o} i={i} wide={wide} />
  );
  function Tile({ o, i, wide }: { o: Option; i: number; wide: boolean }) {
    const f = useFamily(o.family);
    // Con color, cada familia lleva el suyo desde aquí (el momento, neutro).
    const colored = mode !== 'plain' && o.family !== 'moment';
    return (
      <Animated.View
        key={o.title}
        entering={FadeInDown.delay(60 * i).duration(360)}
        style={wide ? { width: '100%' } : styles.half}>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={o.title}
          onPress={o.go}
          style={[
            styles.tile,
            wide && styles.wide,
            { backgroundColor: theme.card, boxShadow: theme.shadow },
          ]}>
          <View
            style={[
              styles.icon,
              { backgroundColor: wide ? theme.accent : colored ? f.tint : theme.soft },
              wide && styles.iconWide,
            ]}>
            <Icon
              icon={o.icon}
              size={24}
              color={wide ? theme.onAccent : colored ? f.color : theme.text}
            />
          </View>
          <View style={wide ? { flex: 1, gap: 2 } : { gap: 2 }}>
            <Text style={[styles.title, { color: theme.text }, wide && { fontSize: 24 }]}>
              {o.title}
            </Text>
            <Text style={[styles.hint, { color: theme.textSecondary }]}>{o.hint}</Text>
          </View>
        </PressScale>
      </Animated.View>
    );
  }

  return (
    <Screen
      header={
        <View style={styles.header}>
          <Button compact label="Cerrar" variant="quiet" onPress={() => router.back()} />
        </View>
      }>
      <View style={{ gap: 12 }}>
        <Tag>Para {group.name}</Tag>
        <Title>¿Qué quieres añadir?</Title>
      </View>
      {tile(main, 0, true)}
      <View style={styles.grid}>{options.map((o, i) => tile(o, i + 1))}</View>
      {juegos && (
        <Animated.View
          entering={FadeInDown.duration(300)}
          style={[styles.juegos, { backgroundColor: theme.card, boxShadow: theme.shadow }]}>
          <View style={styles.juegosCab}>
            <Icon icon={Gamepad2} size={18} color={theme.textSecondary} />
            <Text style={{ color: theme.text, fontSize: 17, fontWeight: '600', flex: 1 }}>
              Minijuegos
            </Text>
            <PressScale
              accessibilityRole="button"
              accessibilityLabel="Plegar"
              onPress={() => setJuegos(false)}>
              <Icon icon={ChevronDown} size={18} color={theme.textSecondary} />
            </PressScale>
          </View>
          {minijuegos.map((o, i) => (
            <Animated.View key={o.title} entering={FadeInDown.delay(60 * i).duration(300)}>
              <PressScale
                accessibilityRole="button"
                accessibilityLabel={o.title}
                onPress={o.go}
                style={[styles.juego, { backgroundColor: theme.soft }]}>
                <View style={[styles.icon, { backgroundColor: theme.card }]}>
                  <Icon icon={o.icon} size={22} color={theme.text} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.title, { color: theme.text }]}>{o.title}</Text>
                  <Text style={[styles.hint, { color: theme.textSecondary }]}>{o.hint}</Text>
                </View>
              </PressScale>
            </Animated.View>
          ))}
        </Animated.View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'flex-start', paddingVertical: Spacing.two },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  half: { width: '48%', flexGrow: 1 },
  tile: { borderRadius: 26, padding: 20, gap: 16, minHeight: 150 },
  wide: { flexDirection: 'row', alignItems: 'center', minHeight: 0, padding: 20, gap: 16 },
  icon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  iconWide: { width: 64, height: 64, borderRadius: 20 },
  title: { fontSize: 17, fontWeight: '600' },
  hint: { fontSize: 15, lineHeight: 19 },
  juegos: { borderRadius: 26, padding: 14, gap: 10 },
  juegosCab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 6,
    paddingTop: 4,
  },
  juego: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 20, padding: 12 },
});
