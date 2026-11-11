import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, Field, Lead, Notice, Screen, Tag, Title } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { errorText, useStore } from '@/data/store';
import { disablePush, enablePush, pushState, type PushState } from '@/lib/push';

/** Ajustes personales: cómo me ven los demás, cerrar sesión y borrar la cuenta. */
export default function Settings() {
  const { me, user, saveProfile, setAvatar, signOut, deleteAccount } = useStore();
  const profile = user(me);
  const [name, setName] = useState(profile.name);
  const [city, setCity] = useState(profile.city);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [push, setPush] = useState<PushState>();
  useEffect(() => {
    pushState().then(setPush);
  }, []);

  const run = async (action: () => Promise<void>, done = '') => {
    setNotice('');
    setBusy(true);
    try {
      await action();
      setNotice(done);
    } catch (error) {
      setNotice(errorText(error));
    }
    setBusy(false);
  };

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) await run(() => setAvatar(result.assets[0].uri), 'Foto actualizada.');
  };

  return (
    <Screen
      header={
        <View style={styles.header}>
          <Button compact label="Cerrar" variant="quiet" onPress={() => router.back()} />
        </View>
      }>
      <Title>Tu perfil</Title>

      <Card style={styles.card}>
        <View style={styles.avatarRow}>
          <Avatar userId={me} size={72} />
          <Button
            compact
            variant="quiet"
            label="Cambiar foto"
            disabled={busy}
            onPress={pickAvatar}
          />
        </View>
        <Field label="Nombre" value={name} onChangeText={setName} />
        <Field
          label="Ciudad (opcional)"
          value={city}
          onChangeText={setCity}
          placeholder="Solo la ven las personas de tus grupos"
        />
        <Button
          label="Guardar"
          disabled={busy || !name.trim() || (name === profile.name && city === profile.city)}
          onPress={() => run(() => saveProfile(name.trim(), city.trim()), 'Guardado.')}
        />
      </Card>
      <Notice>{notice}</Notice>

      <View style={{ gap: Spacing.two }}>
        <Tag>Avisos</Tag>
        {push === 'on' && (
          <>
            <Lead strong="Este dispositivo recibe la propuesta del día">
              de tus grupos, a la hora que elijas en los ajustes de cada grupo.
            </Lead>
            <Button
              label="Desactivar avisos aquí"
              variant="quiet"
              disabled={busy}
              onPress={() => run(async () => (await disablePush(), setPush(await pushState())))}
            />
          </>
        )}
        {push === 'off' && (
          <>
            <Lead strong="Recibe la propuesta del día">
              a tu hora, aunque no tengas la app abierta. Nada más: ni rachas ni recordatorios
              insistentes.
            </Lead>
            <Button
              label="Activar avisos en este dispositivo"
              disabled={busy}
              onPress={() => run(async () => (await enablePush(), setPush(await pushState())))}
            />
          </>
        )}
        {push === 'needs-install' && (
          <Lead strong="Para recibir avisos en el iPhone,">
            añade Junti a la pantalla de inicio: en Safari, pulsa Compartir y luego «Añadir a
            pantalla de inicio». Ábrela desde ese icono y vuelve aquí.
          </Lead>
        )}
        {push === 'denied' && (
          <Lead strong="Los avisos están bloqueados">
            para Junti en este navegador. Puedes permitirlos en los ajustes del navegador o del
            teléfono.
          </Lead>
        )}
        {push === 'unsupported' && (
          <Lead strong="Este navegador no admite avisos.">
            Prueba desde el móvil, con la app añadida a la pantalla de inicio.
          </Lead>
        )}
      </View>

      <Button label="Cerrar sesión" variant="quiet" onPress={signOut} />

      <View style={{ gap: Spacing.two }}>
        <Tag>Zona delicada</Tag>
        <Lead strong="Borrar tu cuenta elimina tu perfil,">
          tus momentos, tus fotos, tus comentarios y tus reacciones en todos los grupos. No se puede
          deshacer.
        </Lead>
        {confirming ? (
          <View style={styles.confirm}>
            <Button label="Sí, borrar todo" disabled={busy} onPress={() => run(deleteAccount)} />
            <Button label="Cancelar" variant="quiet" onPress={() => setConfirming(false)} />
          </View>
        ) : (
          <Button label="Borrar mi cuenta" variant="quiet" onPress={() => setConfirming(true)} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'flex-start', paddingVertical: Spacing.two },
  card: { padding: 20, gap: Spacing.three },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  confirm: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
