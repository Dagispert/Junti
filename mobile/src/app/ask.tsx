import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Button, Field, Notice, Screen, Tag, Title } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { errorText, useStore } from '@/data/store';
import type { QuestionKind } from '@/data/types';
import { Check, X } from 'lucide-react-native';

const COPY: Record<QuestionKind, { title: string; placeholder: string }> = {
  poll: { title: 'Una encuesta', placeholder: '¿Dónde quedamos este verano?' },
  quiz: { title: 'Un quiz', placeholder: '¿Quién de nosotros vivió en Berlín?' },
  open: {
    title: 'Una pregunta',
    placeholder: '¿Qué recuerdo tienes de nuestro primer viaje?',
  },
};

const DURATIONS = [
  { days: 1, label: 'Un día' },
  { days: 3, label: '3 días' },
  { days: 7, label: 'Una semana' },
  { days: 0, label: 'Sin fecha' },
];

/** Hacer una pregunta al grupo: encuesta, quiz o pregunta abierta. */
export default function Ask() {
  const { groupId, kind: rawKind } = useLocalSearchParams<{ groupId: string; kind: string }>();
  const kind: QuestionKind = rawKind === 'quiz' || rawKind === 'open' ? rawKind : 'poll';
  const theme = useTheme();
  const { group: groupById, user, askQuestion } = useStore();
  const group = groupById(groupId);
  const [title, setTitle] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [correct, setCorrect] = useState<number>();
  const [days, setDays] = useState(kind === 'open' ? 0 : 3);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  if (!group) return null;

  const copy = COPY[kind];
  const filled = options.map((o) => o.trim()).filter(Boolean);
  const names = group.memberIds.map((id) => user(id).name.split(' ')[0]);
  const ready =
    !!title.trim() &&
    (kind === 'open' ||
      (filled.length >= 2 &&
        filled.length === options.length &&
        (kind !== 'quiz' || correct !== undefined)));

  const save = async () => {
    setBusy(true);
    setNotice('');
    try {
      await askQuestion({
        groupId,
        kind,
        title: title.trim(),
        options: kind === 'open' ? undefined : filled,
        correct,
        days: days || undefined,
      });
      router.back();
    } catch (error) {
      setNotice(errorText(error));
      setBusy(false);
    }
  };

  const setOption = (i: number, value: string) =>
    setOptions((list) => list.map((o, k) => (k === i ? value : o)));

  return (
    <Screen
      header={
        <View style={styles.header}>
          <Button compact label="Cancelar" variant="quiet" onPress={() => router.back()} />
          <Button
            compact
            label={busy ? 'Enviando…' : 'Preguntar'}
            disabled={busy || !ready}
            onPress={save}
          />
        </View>
      }>
      <View style={{ gap: 12 }}>
        <Tag>Para {group.name}</Tag>
        <Title>{copy.title}</Title>
        {kind === 'quiz' && (
          <Text style={{ color: theme.textSecondary, fontSize: 15, lineHeight: 21 }}>
            Cada uno intenta adivinar y, al responder, ve la solución y lo que han dicho los demás.
            Sin puntos: solo para reírse un rato.
          </Text>
        )}
        {kind === 'open' && (
          <Text style={{ color: theme.textSecondary, fontSize: 15, lineHeight: 21 }}>
            Cada uno responde con sus palabras. Las respuestas de los demás se ven al responder.
          </Text>
        )}
      </View>

      <Field
        label="La pregunta"
        value={title}
        onChangeText={setTitle}
        placeholder={copy.placeholder}
        maxLength={200}
        multiline
      />

      {kind !== 'open' && (
        <View style={{ gap: 8 }}>
          <View style={styles.row}>
            <Text style={{ color: theme.textSecondary, fontSize: 13, flex: 1 }}>
              {kind === 'quiz' ? 'Respuestas (toca el círculo de la buena)' : 'Opciones'}
            </Text>
            {kind === 'quiz' && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setOptions(names.slice(0, 8));
                  setCorrect(undefined);
                }}>
                <Text style={{ color: theme.text, fontSize: 15, textDecorationLine: 'underline' }}>
                  Usar nuestros nombres
                </Text>
              </Pressable>
            )}
          </View>
          {options.map((option, i) => (
            <View key={i} style={[styles.option, { backgroundColor: theme.soft }]}>
              {kind === 'quiz' && (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityLabel={`Marcar la opción ${i + 1} como la buena`}
                  accessibilityState={{ checked: correct === i }}
                  onPress={() => setCorrect(i)}
                  style={[
                    styles.radio,
                    { borderColor: correct === i ? '#16A34A' : theme.textSecondary },
                    correct === i && { backgroundColor: '#16A34A' },
                  ]}>
                  {correct === i && <Icon icon={Check} size={16} color="#FFFFFF" />}
                </Pressable>
              )}
              <TextInput
                value={option}
                onChangeText={(v) => setOption(i, v)}
                placeholder={`Opción ${i + 1}`}
                placeholderTextColor={theme.textSecondary}
                maxLength={80}
                accessibilityLabel={`Opción ${i + 1}`}
                style={[styles.optionInput, { color: theme.text }]}
              />
              {options.length > 2 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Quitar la opción ${i + 1}`}
                  onPress={() => {
                    setOptions((list) => list.filter((_, k) => k !== i));
                    setCorrect((c) => (c === undefined || c === i ? undefined : c > i ? c - 1 : c));
                  }}
                  style={styles.remove}>
                  <Icon icon={X} />
                </Pressable>
              )}
            </View>
          ))}
          {options.length < 8 && (
            <Button
              compact
              variant="quiet"
              label="+ Añadir opción"
              onPress={() => setOptions((list) => [...list, ''])}
            />
          )}
        </View>
      )}

      <View style={{ gap: 8 }}>
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Se puede responder durante</Text>
        <View style={styles.chips}>
          {DURATIONS.map((d) => {
            const on = d.days === days;
            return (
              <Pressable
                key={d.days}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  optionInput: { flex: 1, fontSize: 17, paddingVertical: 16 },
  radio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: { color: '#fff', fontSize: 15, fontWeight: '600' },
  remove: { padding: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 40, paddingHorizontal: 16, borderRadius: 999, justifyContent: 'center' },
});
