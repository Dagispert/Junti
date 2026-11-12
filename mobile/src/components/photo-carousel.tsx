import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

/**
 * Varias fotos de un momento: se pasan deslizando, con puntos que dicen en
 * cuál estás. Tocar una abre «onOpen».
 */
export function PhotoCarousel({
  photos,
  onOpen,
  dotsBottom = 12,
}: {
  photos: string[];
  onOpen?: () => void;
  dotsBottom?: number;
}) {
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
          {photos.map((uri, i) => (
            <Pressable
              key={uri}
              accessibilityRole="button"
              accessibilityLabel={`Foto ${i + 1} de ${photos.length}`}
              onPress={onOpen}
              style={{ width, height: '100%' }}>
              <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            </Pressable>
          ))}
        </ScrollView>
      )}
      <View pointerEvents="none" style={[styles.dots, { bottom: dotsBottom }]}>
        {photos.map((uri, i) => (
          <View
            key={uri}
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
});
