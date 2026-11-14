import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Radius, useTheme } from '@/constants/theme';
import { errorText } from '@/data/store';

import { Notice } from './ui';

type Field = { label: string; value: string; max: number; multiline?: boolean; required?: boolean };

/**
 * «Editar · Eliminar» para lo que alguien ha publicado (un reto, una
 * pregunta…). Editar abre los campos ahí mismo; eliminar pide confirmación.
 */
export function OwnerActions({
  fields,
  onSave,
  onDelete,
  deleteNote,
  canEdit = true,
  cantEditNote,
}: {
  fields: Field[];
  onSave: (values: string[]) => Promise<void>;
  onDelete: () => Promise<void>;
  /** Qué pasa al eliminarlo (se dice al pedir confirmación). */
  deleteNote?: string;
  canEdit?: boolean;
  /** Por qué no se puede editar (si no se puede). */
  cantEditNote?: string;
}) {
  const theme = useTheme();
  const [editing, setEditing] = useState<string[] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    setNotice('');
    try {
      await job();
      setEditing(null);
      setConfirming(false);
    } catch (error) {
      setNotice(errorText(error));
    }
    setBusy(false);
  };

  if (editing) {
    const valid = fields.every((f, i) => !f.required || editing[i].trim());
    return (
      <View style={{ gap: 8, alignSelf: 'stretch' }}>
        {fields.map((f, i) => (
          <TextInput
            key={f.label}
            value={editing[i]}
            onChangeText={(t) => setEditing(editing.map((v, k) => (k === i ? t : v)))}
            placeholder={f.label}
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel={f.label}
            maxLength={f.max}
            multiline={f.multiline}
            style={[
              styles.input,
              f.multiline && { minHeight: 64 },
              { color: theme.text, backgroundColor: theme.soft },
            ]}
          />
        ))}
        <Notice>{notice}</Notice>
        <View style={styles.row}>
          <Pressable accessibilityRole="button" onPress={() => setEditing(null)} hitSlop={6}>
            <Text style={{ color: theme.textSecondary, fontSize: 15 }}>Cancelar</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy || !valid}
            onPress={() => run(() => onSave(editing.map((v) => v.trim())))}
            style={[
              styles.save,
              { backgroundColor: theme.accent, opacity: busy || !valid ? 0.5 : 1 },
            ]}>
            <Text style={{ color: theme.onAccent, fontSize: 15, fontWeight: '600' }}>
              {busy ? 'Guardando…' : 'Guardar'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: 4, alignSelf: 'stretch' }}>
      <View style={styles.row}>
        {canEdit && (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setConfirming(false);
              setEditing(fields.map((f) => f.value));
            }}
            hitSlop={6}>
            <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '500' }}>
              Editar
            </Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => (confirming ? run(onDelete) : setConfirming(true))}
          hitSlop={6}>
          <Text
            style={{
              color: confirming ? '#C2385A' : theme.textSecondary,
              fontSize: 13,
              fontWeight: '500',
            }}>
            {confirming ? '¿Seguro? Toca otra vez' : 'Eliminar'}
          </Text>
        </Pressable>
      </View>
      {confirming && !!deleteNote && (
        <Text style={{ color: theme.textSecondary, fontSize: 12, textAlign: 'right' }}>
          {deleteNote}
        </Text>
      )}
      {!canEdit && !!cantEditNote && confirming === false && (
        <Text style={{ color: theme.textSecondary, fontSize: 12, textAlign: 'right' }}>
          {cantEditNote}
        </Text>
      )}
      <Notice>{notice}</Notice>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 18 },
  input: {
    minHeight: 44,
    fontSize: 15,
    lineHeight: 20,
    borderRadius: Radius.small,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  save: { height: 40, paddingHorizontal: 18, borderRadius: Radius.pill, justifyContent: 'center' },
});
