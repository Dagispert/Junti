import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Image as RNImage, Pressable, StyleSheet, Text, View } from 'react-native';

import { AvatarCropper } from '@/components/avatar-cropper';
import { CityPicker } from '@/components/city-picker';
import { DatePick } from '@/components/date-pick';
import { Icon } from '@/components/icon';
import { Avatar, Button, Card, Field, Lead, Notice, Screen, Tag, Title } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { errorText, useStore } from '@/data/store';
import type { Place } from '@/lib/geo';
import { disablePush, enablePush, pushState, type PushState } from '@/lib/push';

/** Ajustes personales: cómo me ven los demás, cerrar sesión y borrar la cuenta. */
export default function Settings() {
  const theme = useTheme();
  const { me, user, saveProfile, saveAbout, setAvatar, signOut, deleteAccount } = useStore();
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
  // Sobre ti
  const about = profile.about;
  const [nickname, setNickname] = useState(about.nickname ?? '');
  const [gender, setGender] = useState(about.voiceGender);
  const [hasBirthday, setHasBirthday] = useState(!!about.birthMonth);
  const [birthday, setBirthday] = useState(
    () => new Date(about.birthYear ?? 2000, (about.birthMonth ?? 1) - 1, about.birthDay ?? 1),
  );
  const [shareYear, setShareYear] = useState(!!about.birthYear);
  const [hometown, setHometown] = useState(about.hometown ?? '');
  const [bio, setBio] = useState(about.bio ?? '');
  const [interests, setInterests] = useState<string[]>(about.interests ?? []);
  const [interest, setInterest] = useState('');
  const addInterest = () => {
    const v = interest.trim().slice(0, 30);
    if (v && !interests.includes(v) && interests.length < 8) setInterests([...interests, v]);
    setInterest('');
  };
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
              }, 'Foto actualizada')
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
            run(() => saveProfile(name.trim(), placeChanged ? place : undefined), 'Guardado')
          }
        />
      </Card>
      <Notice>{notice}</Notice>

      <View style={{ gap: Spacing.two }}>
        <View style={styles.aboutHead}>
          <Tag>Sobre ti</Tag>
          <Button
            compact
            variant="quiet"
            label="Ver mi ficha"
            onPress={() => router.push({ pathname: '/person/[id]', params: { id: me } })}
          />
        </View>
        <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 19 }}>
          Todo es opcional. Solo lo ven las personas de tus grupos, y la narradora lo usa para
          contar vuestras historias con más cariño.
        </Text>
        <Card style={styles.card}>
          <Field
            label="Apodo"
            value={nickname}
            onChangeText={setNickname}
            placeholder="Como te llaman los tuyos"
            maxLength={40}
          />

          <View style={{ gap: 8 }}>
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Cuando hablen de ti</Text>
            <View style={styles.chips}>
              {(
                [
                  ['f', 'En femenino'],
                  ['m', 'En masculino'],
                  ['n', 'Sin género'],
                ] as const
              ).map(([value, label]) => {
                const on = gender === value;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    onPress={() => setGender(on ? undefined : value)}
                    style={[styles.chip, { backgroundColor: on ? theme.accent : theme.soft }]}>
                    <Text style={{ color: on ? theme.onAccent : theme.text, fontSize: 15 }}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: hasBirthday }}
              onPress={() => setHasBirthday(!hasBirthday)}
              style={styles.checkRow}>
              <View
                style={[
                  styles.box,
                  { borderColor: hasBirthday ? theme.accent : theme.textSecondary },
                  hasBirthday && { backgroundColor: theme.accent },
                ]}
              />
              <Text style={{ color: theme.text, fontSize: 17 }}>Mi cumpleaños</Text>
            </Pressable>
            {hasBirthday && (
              <>
                <DatePick
                  value={birthday}
                  onChange={setBirthday}
                  label="Día y mes"
                  hideYear={!shareYear}
                />
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: shareYear }}
                  onPress={() => setShareYear(!shareYear)}
                  style={styles.checkRow}>
                  <View
                    style={[
                      styles.box,
                      { borderColor: shareYear ? theme.accent : theme.textSecondary },
                      shareYear && { backgroundColor: theme.accent },
                    ]}
                  />
                  <Text style={{ color: theme.text, fontSize: 15 }}>
                    Compartir también el año (para saber cuántos cumples)
                  </Text>
                </Pressable>
              </>
            )}
          </View>

          <Field
            label="De dónde eres"
            value={hometown}
            onChangeText={setHometown}
            placeholder="Valladolid, Cádiz, Bogotá…"
            maxLength={80}
          />
          <Field
            label="Una frase sobre ti"
            value={bio}
            onChangeText={setBio}
            placeholder="Bióloga en Lisboa y fan del café"
            maxLength={160}
            multiline
          />

          <View style={{ gap: 8 }}>
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
              Lo que te gusta (hasta 8)
            </Text>
            {interests.length > 0 && (
              <View style={styles.chips}>
                {interests.map((i) => (
                  <Pressable
                    key={i}
                    accessibilityRole="button"
                    accessibilityLabel={`Quitar ${i}`}
                    onPress={() => setInterests(interests.filter((x) => x !== i))}
                    style={[styles.chip, { backgroundColor: theme.soft }]}>
                    <Text style={{ color: theme.text, fontSize: 15 }}>{i}</Text>
                    <Icon icon={X} size={14} />
                  </Pressable>
                ))}
              </View>
            )}
            {interests.length < 8 && (
              <Field
                label="Añadir"
                value={interest}
                onChangeText={setInterest}
                onSubmitEditing={addInterest}
                onBlur={addInterest}
                placeholder="surf, cocinar, fotografía…"
                maxLength={30}
                returnKeyType="done"
              />
            )}
          </View>

          <Button
            label="Guardar"
            disabled={busy}
            onPress={() =>
              run(
                () =>
                  saveAbout({
                    nickname: nickname.trim(),
                    voiceGender: gender,
                    birthMonth: hasBirthday ? birthday.getMonth() + 1 : undefined,
                    birthDay: hasBirthday ? birthday.getDate() : undefined,
                    birthYear: hasBirthday && shareYear ? birthday.getFullYear() : undefined,
                    hometown: hometown.trim(),
                    bio: bio.trim(),
                    interests,
                  }),
                'Guardado',
              )
            }
          />
        </Card>
      </View>

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

      <View style={{ gap: Spacing.two }}>
        <Tag>Privacidad</Tag>
        <Button
          label="Política de privacidad"
          variant="quiet"
          onPress={() => router.push({ pathname: '/legal', params: { doc: 'privacidad' } })}
        />
        <Button
          label="Condiciones de uso"
          variant="quiet"
          onPress={() => router.push({ pathname: '/legal', params: { doc: 'condiciones' } })}
        />
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
  aboutHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 32 },
  box: { width: 20, height: 20, borderRadius: 6, borderWidth: 2 },
  confirm: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
