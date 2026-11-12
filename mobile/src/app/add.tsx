import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { PressScale } from '@/components/motion';
import { Button, Screen, Tag, Title } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import {
  Camera,
  ChartColumn,
  CircleHelp,
  Flag,
  History,
  MessageCircle,
  type LucideIcon,
} from 'lucide-react-native';

type Option = {
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
  if (!group) return null;

  // Se sustituye esta pantalla para que «Cancelar» vuelva directo al grupo.
  const open = (pathname: '/publish' | '/new-challenge' | '/ask', params: Record<string, string>) =>
    router.replace({ pathname, params: { groupId, ...params } } as never);

  const main: Option = {
    icon: Camera,
    title: 'Un momento',
    hint: 'Foto, vídeo, voz o unas palabras de ahora',
    go: () => open('/publish', {}),
  };
  const options: Option[] = [
    {
      icon: History,
      title: 'Un recuerdo',
      hint: 'Una foto de antes, en su fecha',
      go: () => open('/publish', { memory: '1' }),
    },
    {
      icon: Flag,
      title: 'Un reto',
      hint: 'Algo que hacer todos',
      go: () => open('/new-challenge', {}),
    },
    {
      icon: ChartColumn,
      title: 'Una encuesta',
      hint: 'Votad entre varias opciones',
      go: () => open('/ask', { kind: 'poll' }),
    },
    {
      icon: CircleHelp,
      title: 'Un quiz',
      hint: '¿Quién de nosotros…? A adivinar',
      go: () => open('/ask', { kind: 'quiz' }),
    },
    {
      icon: MessageCircle,
      title: 'Una pregunta',
      hint: 'Cada uno responde con sus palabras',
      go: () => open('/ask', { kind: 'open' }),
    },
  ];

  const tile = (o: Option, i: number, wide = false) => (
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
            { backgroundColor: wide ? theme.accent : theme.soft },
            wide && styles.iconWide,
          ]}>
          <Icon icon={o.icon} size={24} color={wide ? theme.onAccent : theme.text} />
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
});
