import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Field, Lead, Notice, Screen, Tag, Title } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { errorText, useStore } from '@/data/store';

/** Crear un álbum del grupo; después se eligen sus momentos. */
export default function NewAlbum() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { group: groupById, createAlbum } = useStore();
  const group = groupById(groupId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  if (!group) return null;

  const save = async () => {
    setBusy(true);
    try {
      const id = await createAlbum(groupId, title.trim(), description.trim());
      router.replace({ pathname: '/album/[id]', params: { id, select: '1' } });
    } catch (error) {
      setNotice(errorText(error));
      setBusy(false);
    }
  };

  return (
    <Screen
      header={
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingVertical: Spacing.two,
          }}>
          <Button compact label="Cancelar" variant="quiet" onPress={() => router.back()} />
          <Button
            compact
            label={busy ? 'Creando…' : 'Crear'}
            disabled={busy || !title.trim()}
            onPress={save}
          />
        </View>
      }>
      <View style={{ gap: 12 }}>
        <Tag>Para {group.name}</Tag>
        <Title>Un álbum</Title>
        <Lead strong="Para juntar momentos que van juntos:">un viaje, un verano, una época.</Lead>
      </View>
      <Field
        label="Nombre"
        value={title}
        onChangeText={setTitle}
        placeholder="Viaje a Roma"
        maxLength={80}
      />
      <Field
        label="Descripción (opcional)"
        value={description}
        onChangeText={setDescription}
        placeholder="Aquella semana de agosto"
        maxLength={300}
        multiline
      />
      <Notice>{notice}</Notice>
    </Screen>
  );
}
