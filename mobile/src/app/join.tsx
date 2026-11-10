import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Field, Lead, Notice, Screen, Title } from '@/components/ui';
import { errorText, useStore } from '@/data/store';

export default function Join() {
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
    <Screen
      header={
        <View style={{ alignItems: 'flex-start', paddingVertical: 8 }}>
          <Button compact label="Cancelar" variant="quiet" onPress={() => router.back()} />
        </View>
      }>
      <Title>Unirme a un grupo</Title>
      <Lead strong="Escribe el código">que te ha pasado alguien del grupo.</Lead>
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
