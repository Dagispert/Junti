import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Radius, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import type { Comment } from '@/data/types';

/**
 * Un comentario. Quien lo escribió puede tocarlo para corregirlo o
 * eliminarlo; los demás solo lo leen.
 */
export function CommentLine({ comment, size = 15 }: { comment: Comment; size?: number }) {
  const theme = useTheme();
  const { me, user, editComment, deleteComment } = useStore();
  const mine = comment.userId === me;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      setDraft(null);
      setOpen(false);
      setConfirming(false);
    } catch {
      // se queda abierto para reintentar
    }
    setBusy(false);
  };

  const line = (
    <Text
      style={[styles.text, { color: theme.textSecondary, fontSize: size, lineHeight: size + 5 }]}>
      <Text style={{ color: theme.text, fontWeight: '500' }}>
        {user(comment.userId).name.split(' ')[0]}{' '}
      </Text>
      {comment.text}
      {comment.edited ? <Text style={{ fontSize: size - 3 }}> · editado</Text> : null}
    </Text>
  );

  if (!mine) return line;

  if (draft !== null) {
    return (
      <View style={{ gap: 6 }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          autoFocus
          multiline
          maxLength={1000}
          accessibilityLabel="Corregir el comentario"
          style={[styles.input, { color: theme.text, backgroundColor: theme.soft }]}
        />
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={() => setDraft(null)} hitSlop={6}>
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Cancelar</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy || !draft.trim() || draft.trim() === comment.text}
            onPress={() => run(() => editComment(comment.id, draft.trim()))}
            hitSlop={6}>
            <Text
              style={{
                color: theme.text,
                fontSize: 13,
                fontWeight: '600',
                opacity: busy || !draft.trim() || draft.trim() === comment.text ? 0.4 : 1,
              }}>
              Guardar
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: 4 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Toca para editar o eliminar tu comentario"
        onPress={() => {
          setOpen(!open);
          setConfirming(false);
        }}>
        {line}
      </Pressable>
      {open && (
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={() => setDraft(comment.text)} hitSlop={6}>
            <Text style={{ color: theme.text, fontSize: 13, fontWeight: '500' }}>Editar</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() =>
              confirming ? run(() => deleteComment(comment.id)) : setConfirming(true)
            }
            hitSlop={6}>
            <Text
              style={{
                color: confirming ? '#C2385A' : theme.text,
                fontSize: 13,
                fontWeight: '500',
              }}>
              {confirming ? '¿Eliminar?' : 'Eliminar'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  text: {},
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16 },
  input: {
    minHeight: 40,
    fontSize: 15,
    lineHeight: 20,
    borderRadius: Radius.small,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlignVertical: 'top',
  },
});
