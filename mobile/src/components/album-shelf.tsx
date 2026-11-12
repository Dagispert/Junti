import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';

import { Icon } from './icon';
import { Photo, Tag } from './ui';

/** Los álbumes del grupo, como una estantería que se desliza. */
export function AlbumShelf({ groupId }: { groupId: string }) {
  const theme = useTheme();
  const { albums, moments } = useStore();
  const mine = albums.filter((a) => a.groupId === groupId);

  return (
    <View style={{ gap: Spacing.two }}>
      <Tag>Álbumes</Tag>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}>
        {mine.map((album) => {
          const items = album.momentIds
            .map((id) => moments.find((m) => m.id === id))
            .filter((m) => !!m);
          const cover = items.find((m) => m.imageUri || m.videoUri) ?? items[0];
          return (
            <Pressable
              key={album.id}
              accessibilityRole="button"
              accessibilityLabel={`Álbum ${album.title}`}
              onPress={() => router.push({ pathname: '/album/[id]', params: { id: album.id } })}
              style={styles.album}>
              <View
                style={[styles.cover, { backgroundColor: theme.soft, boxShadow: theme.shadow }]}>
                {cover && <Photo moment={cover} style={StyleSheet.absoluteFill} badge={false} />}
              </View>
              <Text
                numberOfLines={1}
                style={{ color: theme.text, fontSize: 15, fontWeight: '500' }}>
                {album.title}
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                {items.length} {items.length === 1 ? 'momento' : 'momentos'}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nuevo álbum"
          onPress={() => router.push({ pathname: '/new-album', params: { groupId } })}
          style={styles.album}>
          <View style={[styles.cover, styles.add, { backgroundColor: theme.soft }]}>
            <Icon icon={Plus} size={24} color={theme.text} />
          </View>
          <Text style={{ color: theme.text, fontSize: 15, fontWeight: '500' }}>Nuevo álbum</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Un viaje, una época…</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: Spacing.three, paddingVertical: 4, paddingRight: Spacing.three },
  album: { width: 136, gap: 4 },
  cover: {
    width: 136,
    height: 168,
    borderRadius: Radius.medium,
    overflow: 'hidden',
    marginBottom: 4,
  },
  add: { alignItems: 'center', justifyContent: 'center' },
});
