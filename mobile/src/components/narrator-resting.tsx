import { Moon, Play, RotateCw } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Hand } from '@/constants/theme';

import { Icon } from './icon';

const INK = '#1D1F22';

/**
 * Aviso de que la narradora no está (no se ha podido conectar con ella o está
 * saturada) y lo que se puede hacer: ver la versión sencilla igualmente,
 * probar otra vez o volver más tarde.
 */
export function Resting({
  kind,
  onWatch,
  onRetry,
  onLater,
  accent = '#E5568E',
}: {
  kind: 'semana' | 'mes' | 'historia';
  /** El color del grupo (ya aclarado para fondo oscuro). */
  accent?: string;
  onWatch: () => void;
  onRetry: () => void;
  onLater: () => void;
}) {
  const what =
    kind === 'historia' ? 'vuestra historia' : kind === 'mes' ? 'vuestro mes' : 'vuestra semana';
  return (
    <View style={styles.card} accessibilityRole="alert">
      <View style={styles.icon}>
        <Icon icon={Moon} size={22} color="#F3F1E7" />
      </View>
      <Text style={styles.title}>La narradora está descansando</Text>
      <Text style={styles.body}>
        Ahora mismo no conseguimos hablar con ella. Puedes ver {what} igualmente, con una versión
        sencilla y sin su voz, o volver dentro de un rato para que te la cuente ella.
      </Text>
      <Pressable accessibilityRole="button" onPress={onWatch} style={styles.primary}>
        <Icon icon={Play} color={INK} size={18} />
        <Text style={styles.primaryText}>Ver la versión sencilla</Text>
      </Pressable>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" onPress={onRetry} hitSlop={8} style={styles.link}>
          <Icon icon={RotateCw} size={15} color={accent} />
          <Text style={[styles.linkText, { color: accent }]}>Probar otra vez</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onLater} hitSlop={8} style={styles.link}>
          <Text style={[styles.linkText, { color: '#A9A79C' }]}>Volver más tarde</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: 12, maxWidth: 360, marginTop: 6 },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(243,241,231,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#F3F1E7', fontFamily: Hand, fontSize: 30, textAlign: 'center' },
  body: { color: '#C9C7BC', fontSize: 15, lineHeight: 21, textAlign: 'center' },
  primary: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3F1E7',
    borderRadius: 26,
    height: 50,
    paddingHorizontal: 24,
  },
  primaryText: { color: INK, fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 22, marginTop: 2 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  linkText: { color: '#E5568E', fontSize: 15, fontWeight: '500' },
});
