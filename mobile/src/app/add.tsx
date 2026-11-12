import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { PressScale } from '@/components/motion';
import { Button, Screen, Tag, Title } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';

type Option = {
  icon: string;
  title: string;
  hint: string;
  color: string;
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
    icon: '📸',
    title: 'Un momento',
    hint: 'Foto, vídeo, voz o unas palabras de ahora',
    color: '#FDE7D4',
    go: () => open('/publish', {}),
  };
  const options: Option[] = [
    {
      icon: '📼',
      title: 'Un recuerdo',
      hint: 'Una foto de antes, en su fecha',
      color: '#E7E1F7',
      go: () => open('/publish', { memory: '1' }),
    },
    {
      icon: '🏁',
      title: 'Un reto',
      hint: 'Algo que hacer todos',
      color: '#DDF0E4',
      go: () => open('/new-challenge', {}),
    },
    {
      icon: '📊',
      title: 'Una encuesta',
      hint: 'Votad entre varias opciones',
      color: '#DCEBFA',
      go: () => open('/ask', { kind: 'poll' }),
    },
    {
      icon: '🤔',
      title: 'Un quiz',
      hint: '¿Quién de nosotros…? A adivinar',
      color: '#FCF0C8',
      go: () => open('/ask', { kind: 'quiz' }),
    },
    {
      icon: '💬',
      title: 'Una pregunta',
      hint: 'Cada uno responde con sus palabras',
      color: '#F8DDE6',
      go: () => open('/ask', { kind: 'open' }),
    },
  ];

  const tile = (o: Option, i: number, wide = false) => (
    <Animated.View
      key={o.title}
      entering={FadeInDown.delay(60 * i)
        .springify()
        .damping(18)}
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
        <View style={[styles.icon, { backgroundColor: o.color }, wide && styles.iconWide]}>
          <Text style={{ fontSize: wide ? 34 : 28 }}>{o.icon}</Text>
        </View>
        <View style={wide ? { flex: 1, gap: 2 } : { gap: 2 }}>
          <Text style={[styles.title, { color: theme.text }, wide && { fontSize: 22 }]}>
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
      <View style={{ gap: 10 }}>
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
  tile: { borderRadius: 26, padding: 18, gap: 14, minHeight: 150 },
  wide: { flexDirection: 'row', alignItems: 'center', minHeight: 0, padding: 20, gap: 16 },
  icon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  iconWide: { width: 64, height: 64, borderRadius: 20 },
  title: { fontSize: 18, fontWeight: '600', letterSpacing: -0.3 },
  hint: { fontSize: 14, lineHeight: 19 },
});
