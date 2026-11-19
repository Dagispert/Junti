import { StyleSheet, View } from 'react-native';

import type { KaraokeGame } from '@/data/types';
import { useMontaje } from '@/lib/montaje';

/** El karaoke terminado: el vídeo con todas las voces, en bucle y sin sonido. */
export function MontajeEnBucle({ game, alto = 260 }: { game: KaraokeGame; alto?: number }) {
  const { video, poster } = useMontaje(game);
  if (!game.montaje) return null;
  return (
    <View style={[styles.marco, { height: alto, width: (alto * 9) / 16 }]}>
      {/* la portada; el vídeo, al tocar «Ver» (así no se descarga solo) */}
      {!!(poster || video) && (
        <img
          src={poster ?? undefined}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  marco: {
    alignSelf: 'center',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#111',
    boxShadow: '0 18px 40px rgba(20,22,26,0.25)',
  },
});
