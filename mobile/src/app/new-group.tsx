import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { Button, Field, Notice, Screen, Title } from '@/components/ui';
import { useTheme } from '@/constants/theme';
import { errorText, useStore } from '@/data/store';

export default function NewGroup() {
  const theme = useTheme();
  const { createGroup } = useStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const id = await createGroup(name.trim(), description.trim());
      router.replace({ pathname: '/group/[id]', params: { id } });
    } catch (error) {
      setNotice(errorText(error));
      setBusy(false);
    }
  };

  return (
    <Screen header={<Button label="Cancelar" variant="quiet" onPress={() => router.back()} />}>
      <Title>Nuevo grupo</Title>
      <Text style={{ color: theme.textSecondary, fontSize: 15, lineHeight: 22 }}>
        Un espacio privado. Solo entra quien tenga vuestro código de invitación.
      </Text>
      <Field
        label="Nombre del grupo"
        value={name}
        onChangeText={setName}
        placeholder="Los de siempre"
      />
      <Field label="Descripción (opcional)" value={description} onChangeText={setDescription} />
      <Notice>{notice}</Notice>
      <Button label="Crear grupo" disabled={busy || !name.trim()} onPress={submit} />
    </Screen>
  );
}
