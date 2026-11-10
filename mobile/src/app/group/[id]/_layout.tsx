import { router, useLocalSearchParams } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, useTheme } from '@/constants/theme';

/** Nivel 1: el espacio de un grupo. Hoy · Retos · (+) · Memoria. El Mapa llega en la Fase 2. */
export default function GroupLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs style={{ flex: 1, backgroundColor: theme.background }}>
      <TabSlot style={{ flex: 1 }} />
      <TabList asChild>
        {/* Barra flotante. Un solo objeto de estilo (con asChild, en web un array llega tal cual
            al DOM y falla) y los TabTrigger como hijos directos para que Tabs los detecte. */}
        <View
          style={{
            ...styles.bar,
            backgroundColor: theme.card,
            boxShadow: theme.shadow,
            marginBottom: insets.bottom + 12,
          }}>
          <TabTrigger name="hoy" href={`/group/${id}`} asChild>
            <TabButton>Hoy</TabButton>
          </TabTrigger>
          <TabTrigger name="retos" href={`/group/${id}/retos`} asChild>
            <TabButton>Retos</TabButton>
          </TabTrigger>
          <TabTrigger name="memoria" href={`/group/${id}/memoria`} asChild>
            <TabButton>Memoria</TabButton>
          </TabTrigger>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Compartir un momento"
            onPress={() => router.push({ pathname: '/publish', params: { groupId: id } })}
            style={[styles.plus, { backgroundColor: theme.accent }]}>
            <Text style={[styles.plusText, { color: theme.onAccent }]}>+</Text>
          </Pressable>
        </View>
      </TabList>
    </Tabs>
  );
}

function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  const theme = useTheme();
  return (
    <Pressable
      {...(props as PressableProps)}
      style={[styles.tab, isFocused && { backgroundColor: theme.soft }]}>
      <Text
        style={{
          color: isFocused ? theme.text : theme.textSecondary,
          fontWeight: '500',
          fontSize: 15,
        }}>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 6,
    marginTop: 8,
    borderRadius: Radius.pill,
  },
  tab: { height: 48, paddingHorizontal: 18, borderRadius: Radius.pill, justifyContent: 'center' },
  plus: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginLeft: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: { fontSize: 26, lineHeight: 30, fontWeight: '300' },
});
