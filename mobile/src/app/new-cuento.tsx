import { router, useLocalSearchParams } from 'expo-router';
import { Shuffle, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Button, Field, Notice, Screen, Tag, Title } from '@/components/ui';
import { Hand, Spacing, useTheme } from '@/constants/theme';
import { errorText, useStore } from '@/data/store';
import { INICIOS_CUENTO, pedirInicioCuento } from '@/lib/ideas-retos';

const DURATIONS = [
  { days: 3, label: '3 días' },
  { days: 7, label: 'Una semana' },
  { days: 14, label: 'Dos semanas' },
];

/** Empezar un cuento a trozos: la primera frase (tuya o de la narradora). */
export default function NewCuento() {
  const params = useLocalSearchParams<{ groupId: string; inicio?: string; days?: string }>();
  const { groupId } = params;
  const theme = useTheme();
  const { group: groupById, addCuento } = useStore();
  const group = groupById(groupId);
  const [inicio, setInicio] = useState(params.inicio ?? '');
  const [days, setDays] = useState(() => {
    const d = Number(params.days);
    return DURATIONS.some((x) => x.days === d) ? d : 7;
  });
  const [busy, setBusy] = useState(false);
  const [pensando, setPensando] = useState(false);
  const [notice, setNotice] = useState('');
  if (!group) return null;

  const otroAlAzar = () => {
    const resto = INICIOS_CUENTO.filter((x) => x !== inicio);
    setInicio(resto[Math.floor(Math.random() * resto.length)]);
  };

  const narradora = async () => {
    setNotice('');
    setPensando(true);
    try {
      const r = await pedirInicioCuento(groupId);
      if (r.inicio) setInicio(r.inicio);
      else if (r.reason === 'off') {
        setNotice('La narradora está desactivada en este grupo: te dejo un comienzo al azar.');
        otroAlAzar();
      } else {
        setNotice('Ahora mismo no se le ocurre nada: te dejo un comienzo al azar.');
        otroAlAzar();
      }
    } catch {
      otroAlAzar();
    }
    setPensando(false);
  };

  const save = async () => {
    setBusy(true);
    setNotice('');
    try {
      const id = await addCuento(groupId, inicio.trim(), days);
      router.replace({ pathname: '/cuento/[id]', params: { id } });
    } catch (error) {
      setNotice(errorText(error));
      setBusy(false);
    }
  };

  return (
    <Screen
      header={
        <View style={styles.header}>
          <Button compact label="Cancelar" variant="quiet" onPress={() => router.back()} />
          <Button
            compact
            label={busy ? 'Empezando…' : 'Empezar el cuento'}
            disabled={busy || inicio.trim().length < 8}
            onPress={save}
          />
        </View>
      }>
      <View style={{ gap: 12 }}>
        <Tag>Para {group.name}</Tag>
        <Title>El cuento a trozos</Title>
        <Text style={{ color: theme.textSecondary, fontSize: 16, lineHeight: 22 }}>
          Empieza con una frase y cada uno graba, por turnos, cómo sigue. Solo se oye el trozo
          anterior: el cuento entero no se escucha hasta el final.
        </Text>
      </View>

      <Field
        label="Cómo empieza"
        value={inicio}
        onChangeText={setInicio}
        placeholder="Érase una vez, en un grupo de amigos repartidos por el mundo…"
        maxLength={220}
        multiline
      />
      <View style={styles.fila}>
        <Pressable
          accessibilityRole="button"
          disabled={pensando}
          onPress={narradora}
          style={[styles.chip, { backgroundColor: theme.accent }]}>
          <Icon icon={Sparkles} size={16} color={theme.onAccent} />
          <Text style={{ color: theme.onAccent, fontSize: 15, fontWeight: '600' }}>
            {pensando ? 'La narradora está pensando…' : 'Que empiece la narradora'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={otroAlAzar}
          style={[styles.chip, { backgroundColor: theme.card }]}>
          <Icon icon={Shuffle} size={16} color={theme.text} />
          <Text style={{ color: theme.text, fontSize: 15 }}>Uno al azar</Text>
        </Pressable>
      </View>
      {!!inicio.trim() && (
        <View style={[styles.papel, { backgroundColor: theme.card }]}>
          <Text style={{ fontFamily: Hand, fontSize: 26, lineHeight: 30, color: theme.text }}>
            {inicio.trim()}
          </Text>
        </View>
      )}

      <View style={{ gap: 8 }}>
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
          Cuánto tiempo hay para seguirlo
        </Text>
        <View style={styles.fila}>
          {DURATIONS.map((d) => {
            const on = d.days === days;
            return (
              <Pressable
                key={d.days}
                accessibilityRole="radio"
                aria-checked={on}
                onPress={() => setDays(d.days)}
                style={[styles.chip, { backgroundColor: on ? theme.accent : theme.card }]}>
                <Text style={{ color: on ? theme.onAccent : theme.text, fontSize: 15 }}>
                  {d.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Notice>{notice}</Notice>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.two },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  papel: { borderRadius: 20, padding: 20, transform: [{ rotate: '-0.6deg' }] },
});
