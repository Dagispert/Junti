import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, useTheme } from '@/constants/theme';
import { longDate } from '@/lib/calendar';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Elegir una fecha con flechas (día, mes y año), sin teclado. */
export function DatePick({
  value,
  onChange,
  label,
  hideYear,
}: {
  value: Date;
  onChange: (d: Date) => void;
  label: string;
  hideYear?: boolean;
}) {
  const theme = useTheme();
  const shift = (part: 'd' | 'm' | 'y', by: number) => {
    const d = new Date(value);
    if (part === 'd') d.setDate(d.getDate() + by);
    if (part === 'm') {
      const day = d.getDate();
      d.setDate(1);
      d.setMonth(d.getMonth() + by);
      d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    }
    if (part === 'y') d.setFullYear(d.getFullYear() + by);
    onChange(d);
  };
  const col = (part: 'd' | 'm' | 'y', text: string, name: string) => (
    <View style={styles.col}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name} siguiente`}
        onPress={() => shift(part, 1)}
        style={styles.step}>
        <Text style={[styles.stepText, { color: theme.textSecondary }]}>⌃</Text>
      </Pressable>
      <Text style={[styles.colValue, { color: theme.text }]}>{text}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name} anterior`}
        onPress={() => shift(part, -1)}
        style={styles.step}>
        <Text style={[styles.stepText, { color: theme.textSecondary }]}>⌄</Text>
      </Pressable>
    </View>
  );
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{label}</Text>
      <View style={[styles.picker, { backgroundColor: theme.soft }]}>
        {col('d', String(value.getDate()), 'Día')}
        {col('m', MONTHS[value.getMonth()], 'Mes')}
        {!hideYear && col('y', String(value.getFullYear()), 'Año')}
      </View>
      <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{longDate(value, !hideYear)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { flexDirection: 'row', borderRadius: Radius.medium, paddingVertical: 4 },
  col: { flex: 1, alignItems: 'center' },
  step: { width: '100%', height: 36, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 22 },
  colValue: { fontSize: 22, fontWeight: '600' },
});
