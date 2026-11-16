// Piezas comunes de las pantallas de ajustes (los del grupo y los tuyos):
// títulos de sección, listas en tarjeta y filas que se abren con un toque.

import { ChevronDown, ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Radius, Spacing, useTheme } from '@/constants/theme';

import { Icon } from './icon';

export function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 2, marginTop: Spacing.three, paddingHorizontal: 4 }}>
      <Text style={{ color: theme.text, fontSize: 20, fontWeight: '500', letterSpacing: -0.3 }}>
        {title}
      </Text>
      {!!hint && (
        <Text style={{ color: theme.textSecondary, fontSize: 14, lineHeight: 19 }}>{hint}</Text>
      )}
    </View>
  );
}

/** La tarjeta que agrupa las filas de una sección. */
export function Lista({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <View style={[styles.list, { backgroundColor: theme.card }]}>{children}</View>;
}

/** Un apartado plegable: título y resumen; al tocarlo se abre debajo. */
export function Row({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={styles.rowWrap}>
      <Pressable
        accessibilityRole="button"
        aria-expanded={open}
        accessibilityLabel={title}
        onPress={onToggle}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
        <Text style={{ color: theme.text, fontSize: 16, flex: 1 }}>{title}</Text>
        {typeof summary === 'string' ? (
          <Text
            numberOfLines={1}
            style={{ color: theme.textSecondary, fontSize: 14, maxWidth: '50%' }}>
            {summary}
          </Text>
        ) : (
          summary
        )}
        <Icon icon={open ? ChevronDown : ChevronRight} size={16} />
      </Pressable>
      {open && (
        <Animated.View entering={FadeIn.duration(250)} style={styles.body}>
          {children}
        </Animated.View>
      )}
    </View>
  );
}

/** Una fila que lleva a otra pantalla o hace algo al tocarla. */
export function FilaEnlace({
  title,
  summary,
  icon,
  danger,
  onPress,
}: {
  title: string;
  summary?: string;
  icon?: LucideIcon;
  danger?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const color = danger ? '#D2483A' : theme.text;
  return (
    <View style={styles.rowWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
        {icon && <Icon icon={icon} size={18} color={color} />}
        <Text style={{ color, fontSize: 16, flex: 1 }}>{title}</Text>
        {!!summary && (
          <Text
            numberOfLines={1}
            style={{ color: theme.textSecondary, fontSize: 14, maxWidth: '50%' }}>
            {summary}
          </Text>
        )}
        {!danger && <Icon icon={ChevronRight} size={16} />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { borderRadius: Radius.inner, overflow: 'hidden' },
  rowWrap: { paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56 },
  body: { gap: 12, paddingBottom: 16 },
});
