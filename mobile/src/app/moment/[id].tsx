import { CommentLine } from '@/components/comment-line';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { MemoryVersions } from '@/components/memory-versions';
import { MomentEditor } from '@/components/moment-editor';
import { PhotoCarousel } from '@/components/photo-carousel';
import { VideoMoment, VoiceNote, Waveform } from '@/components/media-players';
import { Sticker, StickyNote } from '@/components/scrapbook';
import { SkyBadge } from '@/components/sky-badge';
import { Photo, Screen } from '@/components/ui';
import { Hand, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import { clockIn } from '@/lib/time';
import { ArrowLeft, Check, Pencil, Plus, Share } from 'lucide-react-native';
import { useExport } from '@/components/export-sheet';
import { canExport, renderMomentImage } from '@/lib/export-media';

/** Un momento a lo grande, como una foto pegada en un álbum. */
export default function MomentView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { moments, user, proposals, albums, setAlbumMoments, me } = useStore();
  const moment = moments.find((m) => m.id === id);
  const [editing, setEditing] = useState(false);
  const exporter = useExport();
  // Si se elimina desde aquí, se vuelve atrás.
  const seen = useRef(false);
  if (moment) seen.current = true;
  useEffect(() => {
    if (!moment && seen.current) router.back();
  }, [moment]);
  if (!moment) return null;
  const author = user(moment.authorId);
  const proposal = proposals.find((p) => p.id === moment.proposalId);
  const date = new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(moment.createdAt);
  const emojis = [...new Set(moment.reactions.map((r) => r.emoji))];

  return (
    <Screen
      header={
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            onPress={() => router.back()}
            style={[styles.round, { backgroundColor: theme.card }]}>
            <Icon icon={ArrowLeft} color={theme.text} />
          </Pressable>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={[styles.title, { color: theme.text }]}>{author.name}</Text>
            <View style={styles.meta}>
              <SkyBadge tz={moment.authorTz} at={moment.createdAt} size={14} />
              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                {clockIn(moment.authorTz, moment.createdAt)}
                {moment.place
                  ? ` · ${moment.place.name}`
                  : author.city
                    ? ` en ${author.city}`
                    : ''}{' '}
                · {date}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {canExport() && (moment.imageUri || moment.text) && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Exportar como foto"
                onPress={() =>
                  exporter.run(
                    'photo',
                    () =>
                      renderMomentImage({
                        image: moment.imageUri,
                        note: moment.text ?? proposal?.title,
                        stickers: emojis,
                        footer: [
                          author.name.split(' ')[0],
                          date,
                          moment.place?.name.split(',')[0] ?? author.city,
                        ]
                          .filter(Boolean)
                          .join(' · '),
                      }),
                    'junti-foto',
                    moment.text ?? 'Junti',
                  )
                }
                style={[styles.round, { backgroundColor: theme.card }]}>
                <Icon icon={Share} size={18} color={theme.text} />
              </Pressable>
            )}
            {moment.authorId === me && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Editar o eliminar"
                onPress={() => setEditing((e) => !e)}
                style={[styles.round, { backgroundColor: theme.card }]}>
                <Icon icon={Pencil} size={18} color={theme.text} />
              </Pressable>
            )}
          </View>
        </View>
      }>
      <Animated.View entering={ZoomIn.duration(360)} style={styles.frame}>
        {moment.gallery ? (
          <View style={[styles.photo, { overflow: 'hidden' }]}>
            <PhotoCarousel items={moment.gallery} />
          </View>
        ) : moment.videoUri ? (
          <View style={[styles.photo, { overflow: 'hidden' }]}>
            <VideoMoment moment={moment} style={StyleSheet.absoluteFill} />
          </View>
        ) : moment.voice && !moment.imageUri && !moment.text ? (
          <View
            style={[
              styles.photo,
              { backgroundColor: '#FFF4EC', alignItems: 'center', justifyContent: 'center' },
            ]}>
            <Waveform wave={moment.voice.waveform} height={160} />
          </View>
        ) : moment.photos ? (
          <View style={[styles.photo, { overflow: 'hidden' }]}>
            <PhotoCarousel photos={moment.photos} />
          </View>
        ) : (
          <Photo moment={moment} style={styles.photo} />
        )}
        {(moment.text || proposal) && moment.imageUri ? (
          <StickyNote rotate={5} width={150} delay={350} fixed style={styles.note}>
            {moment.text ?? proposal?.title}
          </StickyNote>
        ) : null}
        {emojis.slice(0, 3).map((e, i) => (
          <Sticker
            key={e}
            emoji={e}
            size={52}
            rotate={-10 + i * 12}
            delay={550 + i * 140}
            style={{ position: 'absolute', bottom: -18, right: 8 + i * 46 }}
          />
        ))}
      </Animated.View>

      {editing && (
        <View style={{ marginTop: 28 }}>
          <MomentEditor moment={moment} onClose={() => setEditing(false)} />
        </View>
      )}
      {moment.voice && (
        <View style={{ marginTop: 24 }}>
          <VoiceNote voice={moment.voice} />
        </View>
      )}
      {proposal && (
        <Text style={[styles.prompt, { color: theme.textSecondary }]}>
          Respondía a «{proposal.title}»
        </Text>
      )}
      {/* Lo más nuevo primero, como en la tarjeta. */}
      {moment.memory && (
        <View style={{ marginTop: 28 }}>
          <MemoryVersions moment={moment} />
        </View>
      )}
      {[...moment.comments].reverse().map((c) => (
        <CommentLine key={c.id} comment={c} size={17} />
      ))}

      {/* Guardarlo en un álbum del grupo. */}
      <View style={{ gap: 8, marginTop: 16 }}>
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>En los álbumes</Text>
        <View style={styles.albums}>
          {albums
            .filter((a) => a.groupId === moment.groupId)
            .map((a) => {
              const on = a.momentIds.includes(moment.id);
              return (
                <Pressable
                  key={a.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`Álbum ${a.title}`}
                  onPress={() =>
                    setAlbumMoments(a.id, on ? [] : [moment.id], on ? [moment.id] : []).catch(
                      () => {},
                    )
                  }
                  style={[styles.albumChip, { backgroundColor: on ? theme.accent : theme.card }]}>
                  {on && <Icon icon={Check} size={16} color={theme.onAccent} />}
                  <Text style={{ color: on ? theme.onAccent : theme.text, fontSize: 15 }}>
                    {a.title}
                  </Text>
                </Pressable>
              );
            })}
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push({ pathname: '/new-album', params: { groupId: moment.groupId } })
            }
            style={[styles.albumChip, { backgroundColor: theme.soft }]}>
            <Icon icon={Plus} size={16} color={theme.text} />
            <Text style={{ color: theme.text, fontSize: 15 }}>Nuevo álbum</Text>
          </Pressable>
        </View>
      </View>
      {exporter.overlay}
    </Screen>
  );
}

const styles = StyleSheet.create({
  albums: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  albumChip: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 6px 16px rgba(20,22,26,0.12)',
  },
  title: { fontSize: 24, fontWeight: '600', letterSpacing: -0.4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  frame: {
    marginTop: 32,
    marginHorizontal: 8,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 26,
    transform: [{ rotate: '-3deg' }],
    boxShadow: '0 22px 44px rgba(20,22,26,0.16)',
  },
  photo: { width: '100%', aspectRatio: 4 / 5, borderRadius: 18 },
  note: { position: 'absolute', top: -26, right: -10 },
  prompt: { fontSize: 15, textAlign: 'center', marginTop: 20 },
  comment: { fontFamily: Hand, fontSize: 24, lineHeight: 24, paddingHorizontal: 12 },
});
