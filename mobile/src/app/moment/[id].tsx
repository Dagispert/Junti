import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { PhotoCarousel } from '@/components/photo-carousel';
import { VideoMoment, VoiceNote, Waveform } from '@/components/media-players';
import { Sticker, StickyNote } from '@/components/scrapbook';
import { SkyBadge } from '@/components/sky-badge';
import { Photo, Screen } from '@/components/ui';
import { Hand, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import { clockIn } from '@/lib/time';
import { ArrowLeft } from 'lucide-react-native';

/** Un momento a lo grande, como una foto pegada en un álbum. */
export default function MomentView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { moments, user, proposals } = useStore();
  const moment = moments.find((m) => m.id === id);
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
          <View style={{ width: 44 }} />
        </View>
      }>
      <Animated.View entering={ZoomIn.duration(360)} style={styles.frame}>
        {moment.videoUri ? (
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
          <StickyNote rotate={5} width={150} delay={350} style={styles.note}>
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
      {moment.comments.map((c) => (
        <Text key={c.id} style={[styles.comment, { color: theme.text }]}>
          <Text style={{ color: theme.textSecondary }}>{user(c.userId).name.split(' ')[0]}: </Text>
          {c.text}
        </Text>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
