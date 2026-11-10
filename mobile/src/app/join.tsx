import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { Button, Field, Notice, Screen, Title } from '@/components/ui';
import { useTheme } from '@/constants/theme';
import { errorText, useStore } from '@/data/store';

export default function Join() {
  const theme = useTheme();
  const { joinGroup } = useStore();
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const id = await joinGroup(code);
      router.replace({ pathname: '/group/[id]', params: { id } });
    } catch (error) {
      setNotice(errorText(error));
      setBusy(false);
    }
  };

  return (
    <Screen header={<Button label="Cancelar" variant="quiet" onPress={() => router.back()} />}>
      <Title>Unirme a un grupo</Title>
      <Text style={{ color: theme.textSecondary, fontSize: 15, lineHeight: 22 }}>
        Escribe el código que te ha pasado alguien del grupo.
      </Text>
      <Field
        label="Código de invitación"
        value={code}
        onChangeText={setCode}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Notice>{notice}</Notice>
      <Button label="Unirme" disabled={busy || !code.trim()} onPress={submit} />
    </Screen>
  );
}
