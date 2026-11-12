import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, Field, Lead, Notice, Screen, Title } from '@/components/ui';
import { errorText, useStore } from '@/data/store';
import { takeInvite } from '@/lib/invite';

export default function Join() {
  const { joinGroup } = useStore();
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(params.code ?? '');
  // Si se llegó por enlace, la invitación ya está aquí: no hace falta guardarla.
  useEffect(() => {
    if (params.code) takeInvite();
  }, [params.code]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const id = await joinGroup(code.trim());
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
          <Button
            compact
            label="Cancelar"
            variant="quiet"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
        </View>
      }>
      <Title>Unirme a un grupo</Title>
      {params.code ? (
        <Lead strong="Te han invitado a un grupo de Junti.">Toca «Unirme» para entrar.</Lead>
      ) : (
        <Lead strong="Escribe el código">que te ha pasado alguien del grupo.</Lead>
      )}
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
