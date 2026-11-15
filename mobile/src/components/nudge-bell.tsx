import { Bell, BellRing } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';

import { Icon } from './icon';

/**
 * La campanita: en lo que pide la participación de los demás (retos,
 * propuestas, encuestas, quiz y preguntas), avisa a quienes aún no han
 * participado. Solo sale si queda alguien por participar (sin contarte a ti).
 */
export function NudgeBell({
  targetId,
  groupId,
  done,
  owner,
  label,
}: {
  targetId: string;
  groupId: string;
  /** quién ha participado ya */
  done: string[];
  /** quién lo creó (no se le avisa) */
  owner?: string | null;
  /** «el reto», «la encuesta»… (para el lector de pantalla) */
  label: string;
}) {
  const theme = useTheme();
  const { me, group, user, nudge } = useStore();
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [note, setNote] = useState('');
  const swing = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${swing.value}deg` }] }));

  const pending = (group(groupId)?.memberIds ?? []).filter(
    (id) => id !== me && id !== owner && !done.includes(id),
  );
  if (!pending.length && state !== 'sent') return null;

  const ring = () => {
    // suena: se balancea a un lado y a otro, cada vez menos
    swing.value = withSequence(
      ...[18, -16, 12, -9, 6, -3, 0].map((d) =>
        withTiming(d, { duration: 70, easing: Easing.inOut(Easing.quad) }),
      ),
    );
  };

  const press = async () => {
    if (state !== 'idle') return;
    ring();
    setState('busy');
    try {
      const n = await nudge(targetId);
      const names = pending.map((id) => user(id).name.split(' ')[0]);
      const list =
        names.length > 1
          ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
          : names[0];
      setNote(n > 0 ? `Avisado: ${list}` : 'Ya han participado todos');
      setState('sent');
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'No se ha podido avisar');
      setState('sent');
    }
    setTimeout(() => setNote(''), 3200);
  };

  return (
    <View style={styles.wrap}>
      {!!note && (
        <View style={[styles.note, { backgroundColor: theme.text }]}>
          <Text
            numberOfLines={2}
            style={{ color: theme.background, fontSize: 12, fontWeight: '500' }}>
            {note}
          </Text>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          state === 'sent' ? 'Ya has avisado' : `Recordar ${label} a quien aún no ha participado`
        }
        disabled={state !== 'idle'}
        hitSlop={8}
        onPress={press}
        style={[styles.bell, { backgroundColor: theme.soft }]}>
        <Animated.View style={[style, { transformOrigin: 'top center' }]}>
          <Icon
            icon={state === 'sent' ? BellRing : Bell}
            size={16}
            color={state === 'sent' ? theme.textSecondary : theme.text}
          />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', alignItems: 'flex-end' },
  bell: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {
    position: 'absolute',
    right: 0,
    bottom: 38,
    maxWidth: 220,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    zIndex: 10,
  },
});
