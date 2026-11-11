import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { SendCinematic } from '@/components/cinematics';
import { CityPicker } from '@/components/city-picker';
import { useGroupPeople } from '@/components/connection-card';
import { Button, Card, Notice, Screen, Tag, Title } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { errorText, useStore } from '@/data/store';
import type { Place } from '@/lib/geo';

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
  const [imageUri, setImageUri] = useState<string>();
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

  const pick = async (source: 'camera' | 'library') => {
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
        mediaTypes: ['images'],
        quality: 0.8,
      };
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled) setImageUri(result.assets[0].uri);
    } catch {
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
        imageUri,
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
            disabled={busy || (!imageUri && !text.trim())}
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
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.preview} contentFit="cover" />
        ) : (
          <View style={[styles.preview, styles.empty, { backgroundColor: theme.soft }]}>
            <Text style={{ color: theme.textSecondary, fontSize: 15 }}>Sin foto todavía</Text>
          </View>
        )}
        <View style={styles.sources}>
          <Button compact label="Hacer una foto" variant="quiet" onPress={() => pick('camera')} />
          <Button
            compact
            label="Elegir de la galería"
            variant="quiet"
            onPress={() => pick('library')}
          />
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
