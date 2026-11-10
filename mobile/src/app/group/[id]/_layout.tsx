import { router, useLocalSearchParams } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaxContentWidth, Spacing, useTheme } from '@/constants/theme';
import { getGroup } from '@/data/store';

/** Nivel 1: el espacio de un grupo. Hoy · Retos · (+) · Memoria. El Mapa llega en la Fase 2. */
export default function GroupLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const group = getGroup(id);

  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList asChild>
        <View
          // Un solo objeto de estilo: con asChild, en web un array llega tal cual al DOM y falla.
          style={{
            ...styles.bar,
            backgroundColor: theme.card,
            borderColor: theme.border,
            paddingBottom: insets.bottom + Spacing.two,
          }}>
          {/* Los TabTrigger deben ser hijos directos de este View para que Tabs los detecte. */}
          <TabTrigger name="hoy" href={`/group/${id}`} asChild>
            <TabButton>Hoy</TabButton>
          </TabTrigger>
          <TabTrigger name="retos" href={`/group/${id}/retos`} asChild>
            <TabButton>Retos</TabButton>
          </TabTrigger>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Compartir un momento"
            onPress={() => router.push({ pathname: '/publish', params: { groupId: id } })}
            style={[styles.plus, { backgroundColor: group?.color ?? theme.accent }]}>
            <Text style={styles.plusText}>+</Text>
          </Pressable>
          <TabTrigger name="memoria" href={`/group/${id}/memoria`} asChild>
            <TabButton>Memoria</TabButton>
          </TabTrigger>
        </View>
      </TabList>
    </Tabs>
  );
}

function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  const theme = useTheme();
  return (
    <Pressable {...(props as PressableProps)} style={styles.tab}>
      <Text
        style={{
          color: isFocused ? theme.text : theme.textSecondary,
          fontWeight: isFocused ? '700' : '500',
        }}>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tab: {
    flex: 1,
    maxWidth: MaxContentWidth / 3,
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  plus: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: { color: '#fff', fontSize: 30, lineHeight: 34, fontWeight: '400' },
});
