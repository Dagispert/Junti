import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useStore } from '@/data/store';

import type { GalleryItem, Moment } from '@/data/types';

import { VideoMoment } from './media-players';

/**
 * Varias fotos (y vídeos) de un momento: se pasan deslizando, con puntos que
 * dicen en cuál estás. Tocar una foto abre «onOpen»; tocar un vídeo le da sonido.
 */
export function PhotoCarousel({
  photos,
  items: given,
  onOpen,
  dotsBottom = 12,
}: {
  photos?: string[];
  items?: GalleryItem[];
  onOpen?: () => void;
  dotsBottom?: number;
}) {
  const { user } = useStore();
  const items: GalleryItem[] = given ?? (photos ?? []).map((uri) => ({ kind: 'photo', uri }));
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  return (
    <View style={StyleSheet.absoluteFill} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={32}
          onScroll={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          style={StyleSheet.absoluteFill}>
          {items.map((item, i) =>
            item.kind === 'video' ? (
              <View
                key={item.uri}
                accessibilityLabel={`Vídeo ${i + 1} de ${items.length}`}
                style={{ width, height: '100%' }}>
                <VideoMoment
                  moment={
                    {
                      videoUri: item.uri,
                      imageUri: item.poster,
                      videoClip: item.clip,
                      videoDuration: item.duration,
                    } as Moment
                  }
                  style={StyleSheet.absoluteFill}
                />
              </View>
            ) : (
              <Pressable
                key={item.uri}
                accessibilityRole="button"
                accessibilityLabel={`Foto ${i + 1} de ${items.length}`}
                onPress={onOpen}
                style={{ width, height: '100%' }}>
                <Image
                  source={{ uri: item.uri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
              </Pressable>
            ),
          )}
        </ScrollView>
      )}
      {/* Lo que añadió otra persona en su versión del recuerdo. */}
      {!!items[index]?.by && (
        <View pointerEvents="none" style={styles.by}>
          <Text style={styles.byText}>Añadida por {user(items[index].by!).name.split(' ')[0]}</Text>
        </View>
      )}
      <View pointerEvents="none" style={[styles.dots, { bottom: dotsBottom }]}>
        {items.map((item, i) => (
          <View
            key={item.uri}
            style={[
              styles.dot,
              { backgroundColor: i === index ? '#FFFFFF' : 'rgba(255,255,255,0.5)' },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  by: {
    position: 'absolute',
    top: 56,
    left: 12,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    backgroundColor: 'rgba(20,22,26,0.55)',
  },
  byText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
});
