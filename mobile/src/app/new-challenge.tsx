import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Field, Notice, Screen, Tag, Title } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { challengeLibrary } from '@/data/library';
import { errorText, useStore } from '@/data/store';

const DURATIONS = [
  { days: 3, label: '3 días' },
  { days: 7, label: 'Una semana' },
  { days: 14, label: 'Dos semanas' },
  { days: 30, label: 'Un mes' },
  { days: 0, label: 'Sin fecha' },
];

/** Proponer un reto al grupo: uno propio o una idea de la biblioteca. */
export default function NewChallenge() {
  // Puede llegar ya relleno (una idea de la narradora); se puede cambiar todo.
  const params = useLocalSearchParams<{
    groupId: string;
    title?: string;
    body?: string;
    days?: string;
  }>();
  const { groupId } = params;
  const theme = useTheme();
  const { group: groupById, proposals, addChallenge } = useStore();
  const group = groupById(groupId);
  const [title, setTitle] = useState(params.title ?? '');
  const [body, setBody] = useState(params.body ?? '');
  const [days, setDays] = useState(() => {
    const d = Number(params.days);
    if (!d) return 7;
    // la duración disponible más cercana
    return DURATIONS.filter((x) => x.days).reduce((a, b) =>
      Math.abs(b.days - d) < Math.abs(a.days - d) ? b : a,
    ).days;
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  if (!group) return null;

  const used = new Set(
    proposals.filter((p) => p.groupId === groupId && p.kind === 'challenge').map((p) => p.title),
  );
  const ideas = challengeLibrary.filter((i) => !used.has(i.title)).slice(0, 8);

  const save = async () => {
    setBusy(true);
    setNotice('');
    try {
      await addChallenge(groupId, title.trim(), body.trim(), days || undefined);
      router.back();
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
            label={busy ? 'Proponiendo…' : 'Proponer'}
            disabled={busy || !title.trim()}
            onPress={save}
          />
        </View>
      }>
      <View style={{ gap: 12 }}>
        <Tag>Para {group.name}</Tag>
        <Title>Un reto</Title>
      </View>
      <Field
        label="El reto"
        value={title}
        onChangeText={setTitle}
        placeholder="Por ejemplo: el cielo de cada uno"
        maxLength={140}
      />
      <Field
        label="Cómo se juega (opcional)"
        value={body}
        onChangeText={setBody}
        placeholder="Una foto del cielo desde donde estés, cada día"
        multiline
      />
      <View style={{ gap: 8 }}>
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Cuánto dura</Text>
        <View style={styles.chips}>
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

      {ideas.length > 0 && (
        <View style={{ gap: Spacing.two }}>
          <Tag>¿Sin ideas? Toca una</Tag>
          <View style={{ gap: 8 }}>
            {ideas.map((idea) => (
              <Pressable
                key={idea.title}
                accessibilityRole="button"
                onPress={() => {
                  setTitle(idea.title);
                  setBody(idea.body);
                }}
                style={[styles.idea, { backgroundColor: theme.card }]}>
                <Text style={{ color: theme.text, fontSize: 17, fontWeight: '500' }}>
                  {idea.title}
                </Text>
                <Text style={{ color: theme.textSecondary, fontSize: 15, lineHeight: 19 }}>
                  {idea.body}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 40, paddingHorizontal: 16, borderRadius: 999, justifyContent: 'center' },
  idea: { borderRadius: 20, padding: 16, gap: 2 },
});
