import { router } from 'expo-router';
import { Plus, Send, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Radius, Spacing, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import type { Moment } from '@/data/types';
import { type FamilyId } from '@/lib/families';
import { clockIn, relative } from '@/lib/time';

import { CommentLine } from './comment-line';
import { VersionsLine } from './memory-versions';
import { type Burst, EmojiBursts } from './emoji-burst';
import { EmojiPicker } from './emoji-picker';
import { FamilyCard, FamilyTag } from './family';
import { Icon } from './icon';
import { VideoMoment, VoiceNote } from './media-players';
import { PhotoCarousel } from './photo-carousel';
import { SkyBadge } from './sky-badge';
import { Avatar, Photo, Scrim } from './ui';

const QUICK_REACTIONS = ['❤️', '😂'];
/** Los comentarios no son un chat: se muestran pocos y el resto se pliega. */
// Como en Instagram: lo último arriba y solo unos pocos; el resto, a un toque.
const VISIBLE_COMMENTS = 4;

export function MomentCard({
  moment,
  embedded = false,
  photoRef,
}: {
  moment: Moment;
  /** Dentro de otro bloque (un reto): sin marco ni etiqueta propios. */
  embedded?: boolean;
  /** El contenedor de la foto (para animar su paso desde una miniatura). */
  photoRef?: (node: unknown) => void;
}) {
  const theme = useTheme();
  const { me, user, proposals, toggleReaction, addComment } = useStore();
  const [draft, setDraft] = useState('');
  const [expanded, setExpanded] = useState(false);
  // A quién se responde (el comentario raíz del hilo y el nombre de quien se contesta).
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [picking, setPicking] = useState(false);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [cardHeight, setCardHeight] = useState(0);
  const burstId = useRef(0);

  const author = user(moment.authorId);
  const { ref: revealRef, revealed } = useReveal(!!moment.memory);
  const proposal = proposals.find((p) => p.id === moment.proposalId);

  // Reacciones agrupadas por emoji; las rápidas siempre están disponibles.
  const emojis = [...new Set([...QUICK_REACTIONS, ...moment.reactions.map((r) => r.emoji)])];
  // Los comentarios raíz (lo último arriba) y, debajo de cada uno, sus respuestas en orden.
  const ids = new Set(moment.comments.map((c) => c.id));
  const roots = [...moment.comments].reverse().filter((c) => !c.replyTo || !ids.has(c.replyTo));
  const comments = expanded ? roots : roots.slice(0, VISIBLE_COMMENTS);
  const hidden = roots.length - comments.length;
  const repliesOf = (id: string) => moment.comments.filter((c) => c.replyTo === id);
  const startReply = (rootId: string, userId: string) => {
    setReplyTo({ id: rootId, name: userId === me ? 'ti' : user(userId).name.split(' ')[0] });
    input.current?.focus();
  };
  // La hora local del autor forma parte del recuerdo.
  const placeName = moment.place?.name.split(',')[0];
  // Un recuerdo lleva su fecha; un momento, la hora local de quien lo compartió.
  const when = moment.memory
    ? `${new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(moment.createdAt)}`
    : clockIn(moment.authorTz, moment.createdAt);
  const where = `${when}${placeName ? ` · ${placeName}` : !moment.memory && author.city ? ` en ${author.city}` : ''}`;

  /** Reaccionar: al ponerla, el emoji sale volando por encima de la publicación. */
  const react = (emoji: string) => {
    const mine = moment.reactions.some((r) => r.emoji === emoji && r.userId === me);
    if (!mine) setBursts((b) => [...b, { id: ++burstId.current, emoji }]);
    toggleReaction(moment.id, emoji).catch(() => {});
  };
  const pickOther = (emoji: string) => {
    if (moment.reactions.some((r) => r.emoji === emoji && r.userId === me)) return;
    react(emoji);
  };

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    const target = replyTo;
    setDraft('');
    setReplyTo(null);
    addComment(moment.id, text, target?.id).catch(() => {
      setDraft(text);
      setReplyTo(target);
    });
  };

  // La familia: un recuerdo, la respuesta a un reto o a la propuesta, o un momento.
  const family: FamilyId = moment.memory
    ? 'memory'
    : proposal?.kind === 'challenge'
      ? 'challenge'
      : proposal
        ? 'prompt'
        : 'moment';
  const memory = family === 'memory';

  return (
    <Frame embedded={embedded} family={family} style={memory && styles.album}>
      <View onLayout={(e) => setCardHeight(e.nativeEvent.layout.height)}>
        {!embedded && (
          <FamilyTag
            family={family}
            detail={memory ? memoryAge(moment.createdAt) : proposal?.title}
            style={{ marginBottom: 10, marginLeft: 2 }}
          />
        )}
        {moment.imageUri || moment.videoUri ? (
          <View
            ref={(node) => {
              revealRef.current = node;
              photoRef?.(node);
            }}
            style={[
              styles.photoWrap,
              // Un recuerdo es una foto de álbum: entra en sepia y se «revela» a color.
              memory && styles.albumPhoto,
              memory &&
                webStyle({
                  filter: revealed ? 'none' : 'sepia(0.85) saturate(0.6) contrast(0.92)',
                  transition: 'filter 1.8s cubic-bezier(.22,.8,.2,1)',
                }),
            ]}>
            {moment.gallery ? (
              <PhotoCarousel
                items={moment.gallery}
                dotsBottom={moment.text || proposal ? 96 : 16}
                onOpen={() => router.push({ pathname: '/moment/[id]', params: { id: moment.id } })}
              />
            ) : moment.videoUri ? (
              <VideoMoment moment={moment} style={StyleSheet.absoluteFill} />
            ) : moment.photos ? (
              <PhotoCarousel
                photos={moment.photos}
                dotsBottom={moment.text || proposal ? 96 : 16}
                onOpen={() => router.push({ pathname: '/moment/[id]', params: { id: moment.id } })}
              />
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
                  {!!moment.text && <Text style={styles.overText}>{moment.text}</Text>}
                </View>
              </>
            )}
          </View>
        ) : moment.text || proposal ? (
          <View style={[styles.textPanel, { backgroundColor: theme.soft }]}>
            {proposal && (
              <Text style={{ color: theme.textSecondary, fontSize: 15 }}>{proposal.title}</Text>
            )}
            <Text style={[styles.bigText, { color: theme.text }]}>{moment.text}</Text>
          </View>
        ) : null}
        {moment.voice && (
          <View
            style={{ paddingHorizontal: 4, paddingTop: moment.imageUri || moment.text ? 12 : 4 }}>
            <VoiceNote voice={moment.voice} />
          </View>
        )}

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Ver la ficha de ${author.name}`}
            onPress={() =>
              router.push({
                pathname: '/person/[id]',
                params: { id: author.id, groupId: moment.groupId },
              })
            }>
            <Avatar userId={author.id} size={36} />
          </Pressable>
          <View style={{ flexShrink: 1, minWidth: 64, maxWidth: 180 }}>
            <Text numberOfLines={1} style={{ color: theme.text, fontSize: 15, fontWeight: '500' }}>
              {author.name}
            </Text>
            <Text numberOfLines={2} style={{ color: theme.textSecondary, fontSize: 13 }}>
              {moment.imageUri ? '' : `${where} · `}
              {moment.memory
                ? `recuerdo añadido ${relative(moment.sharedAt)}`
                : relative(moment.createdAt)}
              {moment.edited ? ' · editado' : ''}
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
                  onPress={() => react(emoji)}
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reaccionar con otro emoji"
              onPress={() => setPicking(true)}
              style={[styles.chip, { backgroundColor: theme.soft }]}>
              <Icon icon={Plus} size={16} />
            </Pressable>
          </View>
        </View>

        <VersionsLine moment={moment} />

        <View style={styles.thread}>
          {comments.map((comment) => {
            const replies = repliesOf(comment.id);
            return (
              <View key={comment.id} style={{ gap: 6 }}>
                <CommentLine
                  comment={comment}
                  onReply={() => startReply(comment.id, comment.userId)}
                />
                {replies.length > 0 && (
                  <View style={[styles.replies, { borderLeftColor: theme.border }]}>
                    {replies.map((r) => (
                      <CommentLine
                        key={r.id}
                        comment={r}
                        size={14}
                        onReply={() => startReply(comment.id, r.userId)}
                      />
                    ))}
                  </View>
                )}
              </View>
            );
          })}
          {hidden > 0 && (
            <Pressable accessibilityRole="button" onPress={() => setExpanded(true)} hitSlop={6}>
              <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
                Ver {hidden === 1 ? 'el otro comentario' : `los otros ${hidden} comentarios`}
              </Text>
            </Pressable>
          )}
          {expanded && roots.length > VISIBLE_COMMENTS && (
            <Pressable accessibilityRole="button" onPress={() => setExpanded(false)} hitSlop={6}>
              <Text style={{ color: theme.textSecondary, fontSize: 14 }}>Ver menos</Text>
            </Pressable>
          )}
          {!!replyTo && (
            <View style={styles.replying}>
              <Text
                style={{ color: theme.textSecondary, fontSize: 13, flexShrink: 1 }}
                numberOfLines={1}>
                Respondiendo a {replyTo.name}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="No responder"
                onPress={() => setReplyTo(null)}
                hitSlop={8}>
                <Icon icon={X} size={14} color={theme.textSecondary} />
              </Pressable>
            </View>
          )}
          <View style={styles.inputRow}>
            <TextInput
              ref={input}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={send}
              placeholder={replyTo ? `Responder a ${replyTo.name}…` : 'Añadir un comentario…'}
              placeholderTextColor={theme.textSecondary}
              returnKeyType="send"
              style={[styles.input, { color: theme.text, backgroundColor: theme.soft }]}
            />
            {/* Enviar: un botón redondo con un avión de papel. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={replyTo ? 'Enviar la respuesta' : 'Enviar el comentario'}
              disabled={!draft.trim()}
              onPress={send}
              style={({ pressed }) => [
                styles.send,
                {
                  backgroundColor: theme.accent,
                  opacity: draft.trim() ? (pressed ? 0.8 : 1) : 0.35,
                },
              ]}>
              <Icon icon={Send} size={18} color={theme.onAccent} />
            </Pressable>
          </View>
        </View>
      </View>
      <EmojiBursts
        bursts={bursts}
        height={cardHeight}
        onDone={(id) => setBursts((b) => b.filter((x) => x.id !== id))}
      />
      <EmojiPicker visible={picking} onClose={() => setPicking(false)} onPick={pickOther} />
    </Frame>
  );
}

/** El marco de la tarjeta, o nada si va dentro de otro bloque. */
function Frame({
  embedded,
  family,
  style,
  children,
}: {
  embedded: boolean;
  family: FamilyId;
  style?: object | false;
  children: React.ReactNode;
}) {
  if (embedded) return <View>{children}</View>;
  return (
    <FamilyCard family={family} style={style || undefined}>
      {children}
    </FamilyCard>
  );
}

const webStyle = (o: Record<string, unknown>) => o as object;

/** «hace 14 años · julio de 2012» (o la fecha, si no hace ni un año). */
export function memoryAge(at: number): string {
  const d = new Date(at);
  const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  if (
    now.getMonth() < d.getMonth() ||
    (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())
  )
    years -= 1;
  const month = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(d);
  if (years < 1)
    return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' }).format(d);
  return `hace ${years} ${years === 1 ? 'año' : 'años'} · ${month}`;
}

/**
 * Se «revela» cuando se ve en pantalla (como una foto que sale del álbum).
 * Fuera de la web, revelada desde el principio.
 */
function useReveal(enabled: boolean) {
  const ref = useRef<any>(null);
  const [revealed, setRevealed] = useState(!enabled || Platform.OS !== 'web');
  useEffect(() => {
    if (revealed) return;
    const node = ref.current as Element | null;
    if (!node || typeof node.getBoundingClientRect !== 'function') return setRevealed(true);
    const check = () => {
      const r = node.getBoundingClientRect();
      const h = window.innerHeight;
      if (r.top < h * 0.72 && r.bottom > h * 0.2) setRevealed(true);
    };
    check();
    const id = setInterval(check, 400);
    return () => clearInterval(id);
  }, [revealed]);
  return { ref, revealed };
}

const styles = StyleSheet.create({
  photoWrap: { aspectRatio: 4 / 5, borderRadius: Radius.inner, overflow: 'hidden' },
  // El recuerdo, como una foto pegada en un álbum: borde blanco y algo inclinada.
  album: { paddingTop: 14 },
  albumPhoto: {
    borderRadius: 4,
    borderWidth: 8,
    borderBottomWidth: 26,
    borderColor: '#FFFFFF',
    boxShadow: '0 10px 24px rgba(60,40,10,0.18)',
    transform: [{ rotate: '-0.8deg' }],
  },
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
    gap: 8,
  },
  overMetaText: { color: 'rgba(255,255,255,0.88)', fontSize: 15 },
  caption: { position: 'absolute', left: 20, right: 20, bottom: 20, gap: 4 },
  overText: { color: '#fff', fontSize: 17, lineHeight: 24, fontWeight: '500' },
  textPanel: { borderRadius: Radius.inner, padding: 24, paddingVertical: 32, gap: Spacing.two },
  bigText: { fontSize: 24, lineHeight: 31, fontWeight: '500', letterSpacing: -0.5 },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingTop: 16,
  },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 34,
    minWidth: 34,
    justifyContent: 'center',
    paddingHorizontal: 9,
    borderRadius: Radius.pill,
  },
  thread: { paddingHorizontal: 8, paddingTop: 12, paddingBottom: 8, gap: 8 },
  replies: { marginLeft: 6, paddingLeft: 12, borderLeftWidth: 2, gap: 6 },
  replying: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  comment: { fontSize: 15, lineHeight: 20 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    height: 40,
    borderRadius: Radius.small,
    paddingHorizontal: 16,
  },
});
