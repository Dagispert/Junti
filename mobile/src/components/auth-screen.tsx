import { useState } from 'react';
import { Text, View } from 'react-native';

import { Spacing, useTheme } from '@/constants/theme';
import { errorText, useStore } from '@/data/store';

import type { Place } from '@/lib/geo';

import { CityPicker } from './city-picker';
import { type LegalKind, LegalView } from './legal-view';
import { Button, Field, Lead, Notice, Screen, Title } from './ui';

/** Entrar o crear cuenta con correo y contraseña. */
export function AuthScreen() {
  const { signIn, signUp, sendLoginLink } = useStore();
  const [mode, setMode] = useState<'in' | 'up' | 'link'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState<LegalKind | null>(null);
  const theme = useTheme();

  const submit = async () => {
    setNotice('');
    setBusy(true);
    try {
      if (mode === 'link') {
        await sendLoginLink(email.trim());
        setNotice(
          'Te hemos enviado un enlace. Ábrelo desde este dispositivo y entrarás directamente.',
        );
      } else if (mode === 'in') await signIn(email.trim(), password);
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

  if (reading) return <LegalView kind={reading} onClose={() => setReading(null)} />;

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
      {mode !== 'link' && (
        <Field
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          onSubmitEditing={submit}
        />
      )}
      <Notice>{notice}</Notice>
      <Button
        label={mode === 'in' ? 'Entrar' : mode === 'up' ? 'Crear cuenta' : 'Enviarme el enlace'}
        disabled={busy || !email.trim() || (mode !== 'link' && password.length < 6)}
        onPress={submit}
      />
      {mode !== 'in' && (
        <Text
          style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center' }}>
          Al crear tu cuenta aceptas las{' '}
          <Text
            accessibilityRole="link"
            style={{ color: theme.text, textDecorationLine: 'underline' }}
            onPress={() => setReading('condiciones')}>
            condiciones de uso
          </Text>{' '}
          y la{' '}
          <Text
            accessibilityRole="link"
            style={{ color: theme.text, textDecorationLine: 'underline' }}
            onPress={() => setReading('privacidad')}>
            política de privacidad
          </Text>
          . Hay que tener al menos 14 años.
        </Text>
      )}
      <Button
        variant="quiet"
        label={mode === 'in' ? 'No tengo cuenta todavía' : 'Ya tengo cuenta'}
        onPress={() => {
          setNotice('');
          setMode(mode === 'in' ? 'up' : 'in');
        }}
      />
      {mode !== 'link' && (
        <Button
          variant="quiet"
          label="Entrar sin contraseña"
          onPress={() => {
            setNotice('');
            setMode('link');
          }}
        />
      )}
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
