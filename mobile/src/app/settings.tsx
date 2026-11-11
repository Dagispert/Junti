import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image as RNImage, StyleSheet, View } from 'react-native';

import { AvatarCropper } from '@/components/avatar-cropper';
import { CityPicker } from '@/components/city-picker';
import { Avatar, Button, Card, Field, Lead, Notice, Screen, Tag, Title } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { errorText, useStore } from '@/data/store';
import type { Place } from '@/lib/geo';
import { disablePush, enablePush, pushState, type PushState } from '@/lib/push';

/** Ajustes personales: cómo me ven los demás, cerrar sesión y borrar la cuenta. */
export default function Settings() {
  const { me, user, saveProfile, setAvatar, signOut, deleteAccount } = useStore();
  const profile = user(me);
  const [name, setName] = useState(profile.name);
  const current: Place | null =
    profile.lat != null && profile.lng != null
      ? { name: profile.city, country: profile.country, lat: profile.lat, lng: profile.lng }
      : null;
  const [place, setPlace] = useState<Place | null>(current);
  const placeChanged = (place?.name ?? '') !== (current?.name ?? '') || place?.lat !== current?.lat;
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

  // La foto elegida pasa primero por el editor de encuadre; el sistema no lo ofrece en la web.
  const [cropping, setCropping] = useState<{ uri: string; width: number; height: number }>();

  const pickAvatar = async () => {
    setNotice('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      let { width, height } = asset;
      if (!width || !height) {
        ({ width, height } = await new Promise<{ width: number; height: number }>((ok, fail) =>
          RNImage.getSize(asset.uri, (w, h) => ok({ width: w, height: h }), fail),
        ));
      }
      setCropping({ uri: asset.uri, width, height });
    } catch {
      setNotice('No se ha podido abrir la foto. Prueba con otra.');
    }
  };

  if (cropping) {
    return (
      <Screen>
        <View style={{ paddingTop: Spacing.four }}>
          <AvatarCropper
            {...cropping}
            busy={busy}
            onCancel={() => setCropping(undefined)}
            onDone={(uri) =>
              run(async () => {
                await setAvatar(uri);
                setCropping(undefined);
              }, 'Foto actualizada.')
            }
          />
          <Notice>{notice}</Notice>
        </View>
      </Screen>
    );
  }

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
        <CityPicker value={place} onChange={setPlace} />
        {!current && !!profile.city && !placeChanged && (
          <Notice>
            Tenías puesta «{profile.city}». Búscala en la lista para aparecer en el mapa.
          </Notice>
        )}
        <Button
          label="Guardar"
          disabled={busy || !name.trim() || (name === profile.name && !placeChanged)}
          onPress={() =>
            run(() => saveProfile(name.trim(), placeChanged ? place : undefined), 'Guardado.')
          }
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
