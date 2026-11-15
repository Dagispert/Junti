import { router } from 'expo-router';
import { ArrowUpRight, Pause, Play } from 'lucide-react-native';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Hand, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import type { Song } from '@/data/types';
import { useFamily, useFamilyColorMode } from '@/lib/families';
import { spotifyLink, usePreview } from '@/lib/music';
import { relative } from '@/lib/time';

import { FamilyCard, FamilyTag } from './family';
import { Icon } from './icon';
import { RecordSleeve } from './soundtrack';
import { Avatar } from './ui';

/** Una canción nueva en la banda sonora, como una publicación más en «Hoy»: se puede escuchar ahí mismo. */
export function SongCard({ song }: { song: Song }) {
  const theme = useTheme();
  const { me, user } = useStore();
  const fam = useFamily('song');
  const color = useFamilyColorMode() === 'plain' ? theme.text : fam.color;
  const audio = usePreview(song.preview);
  const who =
    song.addedBy === me ? 'Has añadido' : `${user(song.addedBy).name.split(' ')[0]} ha añadido`;
  const progress = audio.duration ? Math.min(1, audio.position / audio.duration) : 0;
  const link = song.link || spotifyLink(song.title, song.artist);

  return (
    <FamilyCard family="song" style={{ padding: 16, gap: 12 }}>
      <View style={styles.head}>
        <FamilyTag family="song" detail={relative(song.createdAt)} />
      </View>
      <View style={styles.who}>
        <Avatar userId={song.addedBy} size={24} />
        <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
          {who} una canción a la banda sonora
        </Text>
      </View>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={audio.playing ? `Parar ${song.title}` : `Escuchar ${song.title}`}
          onPress={() => (audio.available ? audio.toggle() : Linking.openURL(link))}>
          {/* la carátula, y el disco que sale de ella (gira mientras suena) */}
          <RecordSleeve song={song} size={96} playing={audio.playing} />
          <View style={[styles.play, { backgroundColor: color }]}>
            <Icon icon={audio.playing ? Pause : Play} size={18} color="#FFFFFF" />
          </View>
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={2} style={[styles.title, { color: theme.text }]}>
            {song.title}
          </Text>
          <Text numberOfLines={1} style={{ color: theme.textSecondary, fontSize: 15 }}>
            {song.artist}
          </Text>
          {audio.available && (
            <View style={[styles.bar, { backgroundColor: theme.soft }]}>
              <View
                style={[styles.fill, { backgroundColor: color, width: `${progress * 100}%` }]}
              />
            </View>
          )}
        </View>
      </View>
      {!!song.note && <Text style={[styles.note, { color: theme.text }]}>«{song.note}»</Text>}
      <View style={styles.foot}>
        <Pressable
          accessibilityRole="link"
          onPress={() => Linking.openURL(link)}
          style={styles.link}>
          <Text style={{ color, fontSize: 14, fontWeight: '600' }}>Escucharla entera</Text>
          <Icon icon={ArrowUpRight} size={14} color={color} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({ pathname: '/group/[id]/memoria', params: { id: song.groupId } })
          }
          style={styles.link}>
          <Text style={{ color: theme.textSecondary, fontSize: 14 }}>Toda la banda sonora</Text>
        </Pressable>
      </View>
    </FamilyCard>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  who: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  play: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    width: 36,
    height: 36,
    borderRadius: 18,
    boxShadow: '0 4px 10px rgba(0,0,0,.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 19, fontWeight: '600', letterSpacing: -0.3 },
  bar: { height: 4, borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  note: { fontFamily: Hand, fontSize: 21, lineHeight: 24 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
});
