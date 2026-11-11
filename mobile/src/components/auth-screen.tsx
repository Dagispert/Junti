import { useState } from 'react';
import { View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { errorText, useStore } from '@/data/store';

import type { Place } from '@/lib/geo';

import { CityPicker } from './city-picker';
import { Button, Field, Lead, Notice, Screen, Title } from './ui';

/** Entrar o crear cuenta con correo y contraseña. */
export function AuthScreen() {
  const { signIn, signUp } = useStore();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setNotice('');
    setBusy(true);
    try {
      if (mode === 'in') await signIn(email.trim(), password);
      else if (!(await signUp(email.trim(), password))) {
        setNotice(
          'Te hemos enviado un correo. Ábrelo, confirma tu cuenta y vuelve aquí para entrar.',
        );
        setMode('in');
      }
    } catch (error) {
      setNotice(errorText(error));
    }
    setBusy(false);
  };

  return (
    <Screen>
      <View style={{ paddingTop: 72, gap: Spacing.three }}>
        <Title style={{ fontSize: 48, lineHeight: 54 }}>Junti</Title>
        <Lead strong="Un espacio privado">
          para seguir formando parte de la vida de quienes quieres.
        </Lead>
      </View>
      <Field
        label="Correo"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <Field
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        onSubmitEditing={submit}
      />
      <Notice>{notice}</Notice>
      <Button
        label={mode === 'in' ? 'Entrar' : 'Crear cuenta'}
        disabled={busy || !email.trim() || password.length < 6}
        onPress={submit}
      />
      <Button
        variant="quiet"
        label={mode === 'in' ? 'No tengo cuenta todavía' : 'Ya tengo cuenta'}
        onPress={() => {
          setNotice('');
          setMode(mode === 'in' ? 'up' : 'in');
        }}
      />
    </Screen>
  );
}

/** Primer paso tras crear la cuenta: cómo te verán los demás. */
export function ProfileSetup() {
  const { saveProfile, signOut } = useStore();
  const [name, setName] = useState('');
  const [place, setPlace] = useState<Place | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await saveProfile(name.trim(), place);
    } catch (error) {
      setNotice(errorText(error));
    }
    setBusy(false);
  };

  return (
    <Screen>
      <View style={{ paddingTop: 72, gap: Spacing.three }}>
        <Title>¿Cómo te llamas?</Title>
        <Lead strong="Así te verán las personas de tus grupos.">Nadie más.</Lead>
      </View>
      <Field label="Nombre" value={name} onChangeText={setName} autoComplete="name" />
      <CityPicker value={place} onChange={setPlace} />
      <Notice>{notice}</Notice>
      <Button label="Continuar" disabled={busy || !name.trim()} onPress={submit} />
      <Button variant="quiet" label="Salir" onPress={signOut} />
    </Screen>
  );
}
