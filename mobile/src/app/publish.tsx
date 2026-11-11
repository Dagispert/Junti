import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { SendCinematic } from '@/components/cinematics';
import { CityPicker } from '@/components/city-picker';
import { InlineVideo, VoiceNote } from '@/components/media-players';
import { useGroupPeople } from '@/components/connection-card';
import { Button, Card, Notice, Screen, Tag, Title } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { errorText, useStore } from '@/data/store';
import type { Place } from '@/lib/geo';
import { secondsOf, videoPoster } from '@/lib/media';
import { mmss } from '@/lib/music';
import { useVoiceRecorder } from '@/lib/recorder';

const MAX_VIDEO = 30;

/** Compartir un momento: foto y/o texto, en el grupo desde el que se abre. */
export default function Publish() {
  const { groupId, proposalId } = useLocalSearchParams<{
    groupId: string;
    proposalId?: string;
  }>();
  const theme = useTheme();
  const { group: groupById, proposals, addMoment, me, user } = useStore();
  const meUser = user(me);
  const home: Place | null =
    meUser.lat != null && meUser.lng != null
      ? { name: meUser.city, country: meUser.country, lat: meUser.lat, lng: meUser.lng }
      : null;
  const [busy, setBusy] = useState(false);
  // Foto o vídeo (con su portada) y, opcionalmente, una nota de voz.
  const [media, setMedia] = useState<{
    uri: string;
    kind: 'photo' | 'video';
    mime?: string;
    duration?: number;
    poster?: string;
  }>();
  const [preparing, setPreparing] = useState(false);
  const voice = useVoiceRecorder();
  const [text, setText] = useState('');
  const [notice, setNotice] = useState('');
  const [place, setPlace] = useState<Place | null>(null);
  const [picking, setPicking] = useState(false);

  const group = groupById(groupId);
  const proposal = proposals.find((p) => p.id === proposalId);
  const people = useGroupPeople(group);
  const [sent, setSent] = useState(false);
  const leave = useCallback(() => router.back(), []);
  if (!group) return null;

  if (sent) {
    return (
      <View style={{ flex: 1, backgroundColor: '#070A14' }}>
        <SendCinematic people={people} groupName={group.name} onDone={leave} />
      </View>
    );
  }

  const pick = async (source: 'camera' | 'library', want: 'photo' | 'video' | 'any') => {
    setNotice('');
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setNotice(
            'Sin permiso para usar la cámara. Puedes activarlo en los ajustes del teléfono.',
          );
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes:
          want === 'photo' ? ['images'] : want === 'video' ? ['videos'] : ['images', 'videos'],
        quality: 0.8,
        videoMaxDuration: MAX_VIDEO,
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
      };
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset.type !== 'video') {
        setMedia({ uri: asset.uri, kind: 'photo', mime: 'image/jpeg' });
        return;
      }
      const duration = secondsOf(asset.duration);
      if (duration && duration > MAX_VIDEO + 1) {
        setNotice(
          `Ese vídeo dura ${Math.round(duration)} segundos y el máximo son ${MAX_VIDEO}. Recórtalo en tu galería y vuelve a elegirlo.`,
        );
        return;
      }
      if (asset.fileSize && asset.fileSize > 50 * 1024 * 1024) {
        setNotice('Ese vídeo pesa más de 50 MB. Prueba con uno más corto o con menos calidad.');
        return;
      }
      setPreparing(true);
      const poster = await videoPoster(asset.uri);
      setMedia({
        uri: asset.uri,
        kind: 'video',
        mime: asset.mimeType ?? 'video/mp4',
        duration,
        poster,
      });
      setPreparing(false);
    } catch {
      setPreparing(false);
      setNotice('No se ha podido abrir la cámara o la galería en este dispositivo.');
    }
  };

  const publish = async () => {
    setNotice('');
    setBusy(true);
    try {
      await addMoment({
        groupId,
        proposalId: proposal?.id,
        media,
        voice: voice.result,
        text: text.trim() || undefined,
        place: place ?? undefined,
      });
      setSent(true);
    } catch (error) {
      setNotice(errorText(error));
      setBusy(false);
    }
  };

  return (
    <Screen
      header={
        <View style={styles.header}>
          <Button compact label="Cancelar" variant="quiet" onPress={() => router.back()} />
          <Button
            compact
            label={busy ? 'Publicando…' : 'Publicar'}
            disabled={
              busy ||
              preparing ||
              voice.state === 'recording' ||
              (!media && !text.trim() && !voice.result)
            }
            onPress={publish}
          />
        </View>
      }>
      <View style={{ gap: 10 }}>
        {/* El destino siempre a la vista antes de publicar. */}
        <Tag>Para {group.name}</Tag>
        <Title>{proposal ? proposal.title : 'Comparte un momento'}</Title>
      </View>

      <Card>
        {media?.kind === 'video' ? (
          <View style={[styles.preview, { overflow: 'hidden', backgroundColor: '#000' }]}>
            <InlineVideo
              uri={media.uri}
              muted
              loop
              controls={false}
              style={StyleSheet.absoluteFill}
            />
            {!!media.duration && (
              <Text style={styles.videoTag}>▶ {Math.round(media.duration)} s</Text>
            )}
          </View>
        ) : media ? (
          <Image source={{ uri: media.uri }} style={styles.preview} contentFit="cover" />
        ) : (
          <View style={[styles.preview, styles.empty, { backgroundColor: theme.soft }]}>
            <Text style={{ color: theme.textSecondary, fontSize: 15 }}>
              {preparing ? 'Preparando el vídeo…' : 'Sin foto ni vídeo todavía'}
            </Text>
          </View>
        )}
        <View style={styles.sources}>
          <Button compact label="Foto" variant="quiet" onPress={() => pick('camera', 'photo')} />
          <Button compact label="Vídeo" variant="quiet" onPress={() => pick('camera', 'video')} />
          <Button compact label="Galería" variant="quiet" onPress={() => pick('library', 'any')} />
          {media && (
            <Button compact label="Quitar" variant="quiet" onPress={() => setMedia(undefined)} />
          )}
        </View>
      </Card>
      <Notice>{notice}</Notice>

      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Unas palabras, si te apetece…"
        placeholderTextColor={theme.textSecondary}
        multiline
        style={[styles.input, { color: theme.text, backgroundColor: theme.card }]}
      />

      {/* Nota de voz */}
      {voice.supported &&
        (voice.state === 'recording' ? (
          <View style={[styles.recording, { backgroundColor: theme.card }]}>
            <View style={styles.redDot} />
            <View style={styles.liveBars}>
              {Array.from(
                { length: 48 },
                (_, i) => voice.levels[i - (48 - voice.levels.length)] ?? 0,
              ).map((v, i) => (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: Math.max(3, (v / 100) * 30),
                    borderRadius: 2,
                    backgroundColor: '#E2703A',
                  }}
                />
              ))}
            </View>
            <Text style={{ color: theme.text, fontVariant: ['tabular-nums'], fontSize: 14 }}>
              {mmss(voice.seconds)} / 2:00
            </Text>
            <Button compact label="Parar" onPress={voice.stop} />
          </View>
        ) : voice.result ? (
          <View style={{ gap: 6 }}>
            <VoiceNote voice={voice.result} />
            <Button compact variant="quiet" label="Quitar la nota de voz" onPress={voice.reset} />
          </View>
        ) : (
          <View style={styles.placeRow}>
            <Pressable
              accessibilityRole="button"
              onPress={voice.start}
              style={[styles.placeChip, { backgroundColor: theme.card }]}>
              <Text style={{ color: theme.text, fontSize: 15 }}>🎙 Grabar nota de voz</Text>
            </Pressable>
          </View>
        ))}
      {!!voice.error && <Notice>{voice.error}</Notice>}

      {/* Lugar: solo si se quiere, y a nivel de ciudad. */}
      {picking ? (
        <CityPicker
          value={place}
          onChange={(p) => {
            setPlace(p);
            setPicking(false);
          }}
          label="¿Dónde estás?"
          clear="Sin lugar"
          startOpen
          onClose={() => setPicking(false)}
        />
      ) : place ? (
        <View style={styles.placeRow}>
          <View style={[styles.placeChip, { backgroundColor: theme.card }]}>
            <Text style={{ color: theme.text, fontSize: 15 }}>
              📍 {place.name}
              {place.country ? `, ${place.country}` : ''}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quitar el lugar"
            onPress={() => setPlace(null)}>
            <Text style={{ color: theme.textSecondary, fontSize: 14 }}>Quitar</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.placeRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setPicking(true)}
            style={[styles.placeChip, { backgroundColor: theme.card }]}>
            <Text style={{ color: theme.text, fontSize: 15 }}>📍 Añadir lugar</Text>
          </Pressable>
          {home && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setPlace(home)}
              style={[styles.placeChip, { backgroundColor: theme.soft }]}>
              <Text style={{ color: theme.textSecondary, fontSize: 15 }}>En {home.name}</Text>
            </Pressable>
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  videoTag: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  recording: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 999,
    boxShadow: '0 10px 24px rgba(20,22,26,0.1)',
  },
  redDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E5484D' },
  liveBars: { flex: 1, height: 30, flexDirection: 'row', alignItems: 'center', gap: 2 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  placeChip: { height: 42, paddingHorizontal: 16, borderRadius: 999, justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.two },
  preview: { width: '100%', aspectRatio: 4 / 5, borderRadius: Radius.inner },
  empty: { alignItems: 'center', justifyContent: 'center' },
  sources: { flexDirection: 'row', justifyContent: 'center', paddingTop: 6 },
  input: {
    minHeight: 110,
    fontSize: 17,
    lineHeight: 24,
    borderRadius: Radius.inner,
    padding: 20,
    textAlignVertical: 'top',
  },
});
