import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Notice, Screen, Tag, Title } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { errorText, useStore } from '@/data/store';

/** Compartir un momento: foto y/o texto, en el grupo desde el que se abre. */
export default function Publish() {
  const { groupId, proposalId } = useLocalSearchParams<{
    groupId: string;
    proposalId?: string;
  }>();
  const theme = useTheme();
  const { group: groupById, proposals, addMoment } = useStore();
  const [busy, setBusy] = useState(false);
  const [imageUri, setImageUri] = useState<string>();
  const [text, setText] = useState('');
  const [notice, setNotice] = useState('');

  const group = groupById(groupId);
  const proposal = proposals.find((p) => p.id === proposalId);
  if (!group) return null;

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
      });
      router.back();
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
    </Screen>
  );
}

const styles = StyleSheet.create({
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
