import { router, useLocalSearchParams } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SPRING_LEAD, SPRING_TRAIL } from '@/components/motion';

import { Nudges } from '@/components/nudges';
import { GuidedTour } from '@/components/tour';
import { Radius, useTheme } from '@/constants/theme';
import { markTourSeen, shouldShowTour, subscribeTour } from '@/lib/tour';

/** Nivel 1: el espacio de un grupo. Hoy · Mapa · Retos · Memoria · (+). */
export default function GroupLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // La guía de primer uso (o pedida desde «Ayuda»).
  const [touring, setTouring] = useState(false);
  useEffect(() => {
    const check = () => {
      if (shouldShowTour()) setTimeout(() => setTouring(true), 600);
    };
    check();
    return subscribeTour(check);
  }, []);

  // El indicador de la pestaña activa: una sola pieza que se estira al
  // cambiar (el borde que va delante tira con un muelle más rápido).
  const spots = useRef(new Map<string, { x: number; w: number }>());
  const left = useSharedValue(-1);
  const right = useSharedValue(-1);
  const active = useRef<string | null>(null);
  const place = (name: string) => {
    const spot = spots.current.get(name);
    if (!spot) return;
    const first = left.value < 0;
    const forward = spot.x > left.value;
    if (first) {
      left.value = spot.x;
      right.value = spot.x + spot.w;
    } else {
      left.value = withSpring(spot.x, forward ? SPRING_TRAIL : SPRING_LEAD);
      right.value = withSpring(spot.x + spot.w, forward ? SPRING_LEAD : SPRING_TRAIL);
    }
  };
  const indicator = useAnimatedStyle(() => ({
    opacity: left.value < 0 ? 0 : 1,
    left: left.value,
    width: Math.max(0, right.value - left.value),
  }));
  const tabs = {
    focus: (name: string) => {
      if (active.current === name) return;
      active.current = name;
      place(name);
    },
    layout: (name: string, x: number, w: number) => {
      spots.current.set(name, { x, w });
      if (active.current === name) place(name);
    },
  };

  return (
    <TabsMotion.Provider value={tabs}>
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
            <Animated.View
              pointerEvents="none"
              style={[styles.indicator, { backgroundColor: theme.soft }, indicator]}
            />
            <TabTrigger name="hoy" href={`/group/${id}`} asChild>
              <TabButton name="hoy" testID="tab-hoy">
                Hoy
              </TabButton>
            </TabTrigger>
            <TabTrigger name="mapa" href={`/group/${id}/mapa`} asChild>
              <TabButton name="mapa" testID="tab-mapa">
                Mapa
              </TabButton>
            </TabTrigger>
            <TabTrigger name="retos" href={`/group/${id}/retos`} asChild>
              <TabButton name="retos" testID="tab-retos">
                Retos
              </TabButton>
            </TabTrigger>
            <TabTrigger name="memoria" href={`/group/${id}/memoria`} asChild>
              <TabButton name="memoria" testID="tab-memoria">
                Memoria
              </TabButton>
            </TabTrigger>
            <Pressable
              testID="tour-plus"
              accessibilityRole="button"
              accessibilityLabel="Añadir"
              onPress={() => router.push({ pathname: '/add', params: { groupId: id } })}
              style={[styles.plus, { backgroundColor: theme.accent }]}>
              <Text style={[styles.plusText, { color: theme.onAccent }]}>+</Text>
            </Pressable>
          </View>
        </TabList>
        {/* De vez en cuando, la narradora propone activar lo que falta. */}
        <Nudges groupId={id} paused={touring} />
        {touring && (
          <GuidedTour
            groupId={id}
            onClose={() => {
              markTourSeen();
              setTouring(false);
            }}
          />
        )}
      </Tabs>
    </TabsMotion.Provider>
  );
}

const TabsMotion = createContext<{
  focus: (name: string) => void;
  layout: (name: string, x: number, w: number) => void;
} | null>(null);

function TabButton({
  children,
  isFocused,
  name,
  ...props
}: TabTriggerSlotProps & { name: string }) {
  const theme = useTheme();
  const motion = useContext(TabsMotion);
  useEffect(() => {
    if (isFocused) motion?.focus(name);
  }, [isFocused, motion, name]);
  return (
    <Pressable
      {...(props as PressableProps)}
      onLayout={(e) => motion?.layout(name, e.nativeEvent.layout.x, e.nativeEvent.layout.width)}
      style={styles.tab}>
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
    padding: 8,
    marginTop: 8,
    borderRadius: Radius.pill,
  },
  indicator: { position: 'absolute', top: 8, height: 48, borderRadius: Radius.pill },
  tab: { height: 48, paddingHorizontal: 12, borderRadius: Radius.pill, justifyContent: 'center' },
  plus: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginLeft: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: { fontSize: 28, lineHeight: 30, fontWeight: '300' },
});
