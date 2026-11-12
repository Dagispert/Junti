import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { CityPicker } from '@/components/city-picker';
import { Button, Field, Lead, Notice, Screen, Tag, Title } from '@/components/ui';
import { errorText, useStore } from '@/data/store';
import type { Place } from '@/lib/geo';

export default function NewGroup() {
  const { createGroup, saveOrigin, setRoots } = useStore();
  const [place, setPlace] = useState<Place | null>(null);
  const [year, setYear] = useState('');
  const [story, setStory] = useState('');
  const [roots, setRootsText] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const id = await createGroup(name.trim(), description.trim());
      // Dónde empezó todo: si lo han contado, se guarda como el primer comienzo.
      if (place)
        await saveOrigin(id, {
          place: place.name,
          lat: place.lat,
          lng: place.lng,
          year:
            Number(year) >= 1900 && Number(year) <= new Date().getFullYear()
              ? Number(year)
              : undefined,
          story: story.trim() || undefined,
          memberIds: [],
        }).catch(() => {});
      if (roots.trim()) await setRoots(id, roots).catch(() => {});
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
      <Title>Nuevo grupo</Title>
      <Lead strong="Un espacio privado.">Solo entra quien tenga vuestro código de invitación.</Lead>
      <Field
        label="Nombre del grupo"
        value={name}
        onChangeText={setName}
        placeholder="Los de siempre"
      />
      <Field label="Descripción (opcional)" value={description} onChangeText={setDescription} />

      <Tag>Dónde empezó todo</Tag>
      <Lead strong="Vuestro punto de partida.">
        Dónde os conocisteis. Si no todos os conocisteis igual, luego podréis añadir más comienzos
        en los ajustes del grupo.
      </Lead>
      <CityPicker
        label="Dónde os conocisteis (opcional)"
        empty="Elige la ciudad o el pueblo"
        hint="La ciudad. El sitio concreto, en la historia."
        clear="Quitar el lugar"
        value={place}
        onChange={setPlace}
      />
      {place && (
        <>
          <Field
            label="Año (opcional)"
            value={year}
            onChangeText={(v) => setYear(v.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            placeholder="2008"
          />
          <Field
            label="Cómo fue (opcional)"
            value={story}
            onChangeText={setStory}
            maxLength={280}
            multiline
            placeholder="En el colegio, en 3.º B. Nos sentaron juntos el primer día…"
            style={{ minHeight: 88, paddingTop: 12, textAlignVertical: 'top' }}
          />
        </>
      )}
      <Field
        label="De dónde sois (opcional)"
        value={roots}
        onChangeText={setRootsText}
        maxLength={80}
        placeholder="Todos somos de Valladolid"
      />
      <Notice>{notice}</Notice>
      <Button label="Crear grupo" disabled={busy || !name.trim()} onPress={submit} />
    </Screen>
  );
}
