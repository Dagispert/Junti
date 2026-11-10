import { useState } from 'react';
import { Text, View } from 'react-native';

import { Spacing, useTheme } from '@/constants/theme';
import { errorText, useStore } from '@/data/store';

import { Button, Field, Notice, Screen, Title } from './ui';

/** Entrar o crear cuenta con correo y contraseña. */
export function AuthScreen() {
  const theme = useTheme();
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
      <View style={{ paddingTop: Spacing.five, gap: Spacing.two }}>
        <Title>Junti</Title>
        <Text style={{ color: theme.textSecondary, fontSize: 16, lineHeight: 23 }}>
          Un espacio privado para seguir formando parte de la vida de quienes quieres.
        </Text>
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
  const theme = useTheme();
  const { saveProfile, signOut } = useStore();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await saveProfile(name.trim(), city.trim());
    } catch (error) {
      setNotice(errorText(error));
    }
    setBusy(false);
  };

  return (
    <Screen>
      <View style={{ paddingTop: Spacing.five, gap: Spacing.two }}>
        <Title>¿Cómo te llamas?</Title>
        <Text style={{ color: theme.textSecondary, fontSize: 16, lineHeight: 23 }}>
          Así te verán las personas de tus grupos. Nadie más.
        </Text>
      </View>
      <Field label="Nombre" value={name} onChangeText={setName} autoComplete="name" />
      <Field
        label="Ciudad (opcional)"
        value={city}
        onChangeText={setCity}
        placeholder="Para que sepan desde dónde compartes"
      />
      <Notice>{notice}</Notice>
      <Button label="Continuar" disabled={busy || !name.trim()} onPress={submit} />
      <Button variant="quiet" label="Salir" onPress={signOut} />
    </Screen>
  );
}
