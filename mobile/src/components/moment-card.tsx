import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Radius, Spacing, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import type { Moment } from '@/data/types';
import { clockIn, relative } from '@/lib/time';

import { Avatar, Card, Photo } from './ui';

const QUICK_REACTIONS = ['❤️', '😂', '😮'];
/** Los comentarios no son un chat: se muestran pocos y el resto se pliega. */
const VISIBLE_COMMENTS = 2;

export function MomentCard({ moment }: { moment: Moment }) {
  const theme = useTheme();
  const { me, user, proposals, toggleReaction, addComment, deleteMoment } = useStore();
  const [draft, setDraft] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const author = user(moment.authorId);
  const proposal = proposals.find((p) => p.id === moment.proposalId);

  // Reacciones agrupadas por emoji; las rápidas siempre están disponibles.
  const emojis = [...new Set([...QUICK_REACTIONS, ...moment.reactions.map((r) => r.emoji)])];
  const comments = expanded ? moment.comments : moment.comments.slice(-VISIBLE_COMMENTS);
  const hidden = moment.comments.length - comments.length;

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    addComment(moment.id, text).catch(() => setDraft(text));
  };

  return (
    <Card>
      <View style={styles.header}>
        <Avatar userId={author.id} size={36} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: theme.text }]}>{author.name}</Text>
          {/* La hora local del autor forma parte del recuerdo. */}
          <Text style={[styles.meta, { color: theme.textSecondary }]}>
            {clockIn(moment.authorTz, moment.createdAt)}
            {author.city ? ` en ${author.city}` : ''} · {relative(moment.createdAt)}
          </Text>
        </View>
        {moment.authorId === me && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Eliminar este momento"
            onPress={() =>
              confirming ? deleteMoment(moment.id).catch(() => {}) : setConfirming(true)
            }>
            <Text style={[styles.meta, { color: confirming ? theme.accent : theme.textSecondary }]}>
              {confirming ? '¿Eliminar?' : 'Eliminar'}
            </Text>
          </Pressable>
        )}
      </View>

      {!!moment.imageUri && <Photo moment={moment} style={styles.photo} />}

      <View style={styles.body}>
        {proposal && (
          <Text style={[styles.meta, { color: theme.textSecondary }]}>
            {proposal.kind === 'challenge' ? 'Reto' : 'Propuesta'} · {proposal.title}
          </Text>
        )}
        {!!moment.text && <Text style={[styles.text, { color: theme.text }]}>{moment.text}</Text>}

        <View style={styles.reactions}>
          {emojis.map((emoji) => {
            const count = moment.reactions.filter((r) => r.emoji === emoji).length;
            const mine = moment.reactions.some((r) => r.emoji === emoji && r.userId === me);
            return (
              <Pressable
                key={emoji}
                accessibilityRole="button"
                accessibilityLabel={`Reaccionar con ${emoji}`}
                onPress={() => toggleReaction(moment.id, emoji).catch(() => {})}
                style={[styles.chip, { borderColor: mine ? theme.accent : theme.border }]}>
                <Text style={{ fontSize: 15, opacity: count ? 1 : 0.45 }}>{emoji}</Text>
                {count > 0 && (
                  <Text style={[styles.meta, { color: theme.textSecondary }]}>{count}</Text>
                )}
              </Pressable>
            );
          })}
        </View>

        {hidden > 0 && (
          <Pressable onPress={() => setExpanded(true)}>
            <Text style={[styles.meta, { color: theme.textSecondary }]}>
              Ver {hidden} {hidden === 1 ? 'comentario anterior' : 'comentarios anteriores'}
            </Text>
          </Pressable>
        )}
        {comments.map((comment) => (
          <Text key={comment.id} style={[styles.comment, { color: theme.text }]}>
            <Text style={{ fontWeight: '700' }}>{user(comment.userId).name} </Text>
            {comment.text}
          </Text>
        ))}

        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={send}
          placeholder="Añadir un comentario…"
          placeholderTextColor={theme.textSecondary}
          returnKeyType="send"
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  name: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 13, lineHeight: 18 },
  photo: { width: '100%', aspectRatio: 4 / 3 },
  body: { padding: Spacing.three, gap: Spacing.two },
  text: { fontSize: 16, lineHeight: 23 },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
    paddingHorizontal: 10,
    borderRadius: Radius.large,
    borderWidth: 1,
  },
  comment: { fontSize: 14, lineHeight: 20 },
  input: {
    fontSize: 14,
    borderWidth: 1,
    borderRadius: Radius.large,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
});
