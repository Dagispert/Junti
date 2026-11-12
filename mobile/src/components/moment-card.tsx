import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Radius, Spacing, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import type { Moment } from '@/data/types';
import { clockIn, relative } from '@/lib/time';

import { VideoMoment, VoiceNote } from './media-players';
import { SkyBadge } from './sky-badge';
import { Avatar, Card, Photo, Scrim } from './ui';

const QUICK_REACTIONS = ['❤️', '😂', '😮'];
/** Los comentarios no son un chat: se muestran pocos y el resto se pliega. */
const VISIBLE_COMMENTS = 2;

export function MomentCard({ moment }: { moment: Moment }) {
  const theme = useTheme();
  const { me, user, proposals, toggleReaction, addComment, deleteMoment, reportMoment } =
    useStore();
  const [draft, setDraft] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reported, setReported] = useState<'' | 'ask' | 'sent'>('');

  const author = user(moment.authorId);
  const proposal = proposals.find((p) => p.id === moment.proposalId);

  // Reacciones agrupadas por emoji; las rápidas siempre están disponibles.
  const emojis = [...new Set([...QUICK_REACTIONS, ...moment.reactions.map((r) => r.emoji)])];
  const comments = expanded ? moment.comments : moment.comments.slice(-VISIBLE_COMMENTS);
  const hidden = moment.comments.length - comments.length;
  // La hora local del autor forma parte del recuerdo.
  const placeName = moment.place?.name.split(',')[0];
  // Un recuerdo lleva su fecha; un momento, la hora local de quien lo compartió.
  const when = moment.memory
    ? `📼 ${new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(moment.createdAt)}`
    : clockIn(moment.authorTz, moment.createdAt);
  const where = `${when}${placeName ? ` · 📍 ${placeName}` : !moment.memory && author.city ? ` en ${author.city}` : ''}`;

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    addComment(moment.id, text).catch(() => setDraft(text));
  };

  return (
    <Card>
      {moment.imageUri || moment.videoUri ? (
        <View style={styles.photoWrap}>
          {moment.videoUri ? (
            <VideoMoment moment={moment} style={StyleSheet.absoluteFill} />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ver en grande"
              onPress={() => router.push({ pathname: '/moment/[id]', params: { id: moment.id } })}
              style={StyleSheet.absoluteFill}>
              <Photo moment={moment} style={StyleSheet.absoluteFill} />
            </Pressable>
          )}
          <Scrim edge="top" height="32%" />
          <Text pointerEvents="none" style={styles.overName}>
            {author.name}
          </Text>
          {/* El cielo que tenía cuando lo compartió. */}
          <View pointerEvents="none" style={styles.overMeta}>
            {!moment.memory && <SkyBadge tz={moment.authorTz} at={moment.createdAt} size={16} />}
            <Text style={styles.overMetaText}>{where}</Text>
          </View>
          {(!!moment.text || !!proposal) && (
            <>
              <Scrim edge="bottom" />
              <View pointerEvents="none" style={styles.caption}>
                {proposal && <Text style={styles.overProposal}>{proposal.title}</Text>}
                {!!moment.text && <Text style={styles.overText}>{moment.text}</Text>}
              </View>
            </>
          )}
        </View>
      ) : moment.text || proposal ? (
        <View style={[styles.textPanel, { backgroundColor: theme.soft }]}>
          {proposal && (
            <Text style={{ color: theme.textSecondary, fontSize: 14 }}>{proposal.title}</Text>
          )}
          <Text style={[styles.bigText, { color: theme.text }]}>{moment.text}</Text>
        </View>
      ) : null}
      {moment.voice && (
        <View style={{ paddingHorizontal: 4, paddingTop: moment.imageUri || moment.text ? 12 : 4 }}>
          <VoiceNote voice={moment.voice} />
        </View>
      )}

      <View style={styles.footer}>
        <Avatar userId={author.id} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontSize: 15, fontWeight: '500' }}>{author.name}</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
            {moment.imageUri ? '' : `${where} · `}
            {moment.memory
              ? `recuerdo añadido ${relative(moment.sharedAt)}`
              : relative(moment.createdAt)}
          </Text>
        </View>
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
                style={[styles.chip, { backgroundColor: mine ? theme.accent : theme.soft }]}>
                <Text style={{ fontSize: 15, opacity: count ? 1 : 0.5 }}>{emoji}</Text>
                {count > 0 && (
                  <Text
                    style={{ fontSize: 13, color: mine ? theme.onAccent : theme.textSecondary }}>
                    {count}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.thread}>
        {hidden > 0 && (
          <Pressable onPress={() => setExpanded(true)}>
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
              Ver {hidden} {hidden === 1 ? 'comentario anterior' : 'comentarios anteriores'}
            </Text>
          </Pressable>
        )}
        {comments.map((comment) => (
          <Text key={comment.id} style={[styles.comment, { color: theme.textSecondary }]}>
            <Text style={{ color: theme.text, fontWeight: '500' }}>
              {user(comment.userId).name}{' '}
            </Text>
            {comment.text}
          </Text>
        ))}
        <View style={styles.inputRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={send}
            placeholder="Añadir un comentario…"
            placeholderTextColor={theme.textSecondary}
            returnKeyType="send"
            style={[styles.input, { color: theme.text, backgroundColor: theme.soft }]}
          />
          {moment.authorId !== me && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Denunciar este momento"
              disabled={reported === 'sent'}
              onPress={() =>
                reported === 'ask'
                  ? reportMoment(moment.id)
                      .then(() => setReported('sent'))
                      .catch(() => setReported(''))
                  : setReported('ask')
              }>
              <Text style={{ fontSize: 13, color: reported ? theme.text : theme.textSecondary }}>
                {reported === 'sent'
                  ? 'Denunciado'
                  : reported === 'ask'
                    ? '¿Denunciar?'
                    : 'Denunciar'}
              </Text>
            </Pressable>
          )}
          {moment.authorId === me && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Eliminar este momento"
              onPress={() =>
                confirming ? deleteMoment(moment.id).catch(() => {}) : setConfirming(true)
              }>
              <Text style={{ fontSize: 13, color: confirming ? theme.text : theme.textSecondary }}>
                {confirming ? '¿Eliminar?' : 'Eliminar'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  photoWrap: { aspectRatio: 4 / 5, borderRadius: Radius.inner, overflow: 'hidden' },
  overName: {
    position: 'absolute',
    top: 22,
    left: 16,
    right: 16,
    textAlign: 'center',
    color: '#fff',
    fontSize: 28,
    fontWeight: '500',
    letterSpacing: -0.6,
  },
  overMeta: {
    position: 'absolute',
    top: 58,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  overMetaText: { color: 'rgba(255,255,255,0.88)', fontSize: 14 },
  caption: { position: 'absolute', left: 20, right: 20, bottom: 20, gap: 4 },
  overProposal: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  overText: { color: '#fff', fontSize: 18, lineHeight: 24, fontWeight: '500', letterSpacing: -0.2 },
  textPanel: { borderRadius: Radius.inner, padding: 24, paddingVertical: 32, gap: Spacing.two },
  bigText: { fontSize: 24, lineHeight: 31, fontWeight: '500', letterSpacing: -0.5 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingTop: 14,
  },
  reactions: { flexDirection: 'row', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
  },
  thread: { paddingHorizontal: 8, paddingTop: 12, paddingBottom: 6, gap: 8 },
  comment: { fontSize: 14, lineHeight: 20 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  input: { flex: 1, fontSize: 14, height: 40, borderRadius: Radius.pill, paddingHorizontal: 16 },
});
