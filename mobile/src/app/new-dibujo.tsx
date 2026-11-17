import { router, useLocalSearchParams } from 'expo-router';
import { Shuffle } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Button, Field, Notice, Screen, Tag, Title } from '@/components/ui';
import { Hand, Spacing, useTheme } from '@/constants/theme';
import { errorText, useStore } from '@/data/store';
import { FRASES_DIBUJO } from '@/lib/dibujo';

const DURATIONS = [
  { days: 3, label: '3 días' },
  { days: 7, label: 'Una semana' },
  { days: 14, label: 'Dos semanas' },
];

/** Empezar un dibujo a ciegas: la frase de partida (solo la verá quien dibuje primero). */
export default function NewDibujo() {
  const params = useLocalSearchParams<{ groupId: string; frase?: string; days?: string }>();
  const { groupId } = params;
  const theme = useTheme();
  const { group: groupById, addDibujo } = useStore();
  const group = groupById(groupId);
  const [frase, setFrase] = useState(params.frase ?? '');
  const [days, setDays] = useState(() => {
    const d = Number(params.days);
    return DURATIONS.some((x) => x.days === d) ? d : 7;
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  if (!group) return null;

  const alAzar = () => {
    const resto = FRASES_DIBUJO.filter((x) => x !== frase);
    setFrase(resto[Math.floor(Math.random() * resto.length)]);
  };

  const save = async () => {
    setBusy(true);
    setNotice('');
    try {
      const id = await addDibujo(groupId, frase.trim(), days);
      router.replace({ pathname: '/dibujo/[id]', params: { id } });
    } catch (error) {
      setNotice(errorText(error));
      setBusy(false);
    }
  };

  return (
    <Screen
      header={
        <View style={styles.header}>
          <Button compact label="Cancelar" variant="quiet" onPress={() => router.back()} />
          <Button
            compact
            label={busy ? 'Empezando…' : 'Empezar'}
            disabled={busy || frase.trim().length < 3}
            onPress={save}
          />
        </View>
      }>
      <View style={{ gap: 12 }}>
        <Tag>Para {group.name}</Tag>
        <Title>Dibujo a ciegas</Title>
        <Text style={{ color: theme.textSecondary, fontSize: 16, lineHeight: 22 }}>
          Escribe una frase. El siguiente la dibuja; el siguiente mira solo el dibujo y escribe qué
          cree que es; el siguiente dibuja eso… Cada uno ve únicamente el paso anterior. Al final se
          destapa todo y se ve cómo fue cambiando.
        </Text>
      </View>

      <Field
        label="La frase de partida (solo la verá quien dibuje primero)"
        value={frase}
        onChangeText={setFrase}
        placeholder="Un pulpo haciendo la compra"
        maxLength={160}
      />
      <View style={styles.fila}>
        <Pressable
          accessibilityRole="button"
          onPress={alAzar}
          style={[styles.chip, { backgroundColor: theme.card }]}>
          <Icon icon={Shuffle} size={16} color={theme.text} />
          <Text style={{ color: theme.text, fontSize: 15 }}>Una al azar</Text>
        </Pressable>
      </View>
      {!!frase.trim() && (
        <View style={[styles.papel, { backgroundColor: theme.card }]}>
          <Text style={{ fontFamily: Hand, fontSize: 28, lineHeight: 32, color: theme.text }}>
            {frase.trim()}
          </Text>
        </View>
      )}

      <View style={{ gap: 8 }}>
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Cuánto tiempo dura</Text>
        <View style={styles.fila}>
          {DURATIONS.map((d) => {
            const on = d.days === days;
            return (
              <Pressable
                key={d.days}
                accessibilityRole="radio"
                aria-checked={on}
                onPress={() => setDays(d.days)}
                style={[styles.chip, { backgroundColor: on ? theme.accent : theme.card }]}>
                <Text style={{ color: on ? theme.onAccent : theme.text, fontSize: 15 }}>
                  {d.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Notice>{notice}</Notice>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.two },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  papel: { borderRadius: 20, padding: 20, transform: [{ rotate: '-0.6deg' }] },
});
