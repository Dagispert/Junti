import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Notice, Screen, Tag, Title } from '@/components/ui';
import { Hand, Radius, Spacing, useTheme } from '@/constants/theme';
import { errorText, useStore } from '@/data/store';
import { searchSongs, type FoundSong } from '@/lib/music';

/** Añadir una canción a la banda sonora del grupo, y por qué importa. */
export default function AddSong() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const theme = useTheme();
  const { group, addSong } = useStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoundSong[]>([]);
  const [picked, setPicked] = useState<FoundSong>();
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'searching' | 'error'>('idle');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(timer.current);
    const controller = new AbortController();
    if (query.trim().length < 2) {
      setResults([]);
      setState('idle');
      return;
    }
    setState('searching');
    timer.current = setTimeout(() => {
      searchSongs(query, controller.signal)
        .then((r) => {
          setResults(r);
          setState('idle');
        })
        .catch((e) => (e as Error).name !== 'AbortError' && setState('error'));
    }, 320);
    return () => {
      clearTimeout(timer.current);
      controller.abort();
    };
  }, [query]);

  const save = async () => {
    if (!picked) return;
    setBusy(true);
    try {
      await addSong(groupId, { ...picked, note: note.trim() || undefined });
      router.back();
    } catch (e) {
      setNotice(errorText(e));
      setBusy(false);
    }
  };

  return (
    <Screen
      header={
        <View style={styles.header}>
          <Button compact label="Cancelar" variant="quiet" onPress={() => router.back()} />
          {picked && (
            <Button compact label={busy ? 'Añadiendo…' : 'Añadir'} disabled={busy} onPress={save} />
          )}
        </View>
      }>
      <View style={{ gap: 10 }}>
        <Tag>Para {group(groupId)?.name ?? 'el grupo'}</Tag>
        <Title>Una canción para recordar</Title>
      </View>

      {picked ? (
        <View style={{ gap: Spacing.three }}>
          <View style={[styles.row, styles.chosen, { backgroundColor: theme.card }]}>
            {picked.artwork && <Image source={{ uri: picked.artwork }} style={styles.art} />}
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>
                {picked.title}
              </Text>
              <Text style={{ color: theme.textSecondary }}>{picked.artist}</Text>
            </View>
            <Pressable onPress={() => setPicked(undefined)}>
              <Text style={{ color: theme.textSecondary }}>Cambiar</Text>
            </Pressable>
          </View>
          <Text style={{ fontFamily: Hand, fontSize: 24, color: theme.text }}>
            ¿Por qué es vuestra?
          </Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            maxLength={280}
            multiline
            placeholder="La del viaje a Lisboa, la que cantábamos en el coche…"
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.input,
              { color: theme.text, backgroundColor: theme.card, fontFamily: Hand, fontSize: 22 },
            ]}
          />
        </View>
      ) : (
        <View style={{ gap: Spacing.two }}>
          <TextInput
            autoFocus
            accessibilityLabel="Buscar canción"
            value={query}
            onChangeText={setQuery}
            placeholder="Canción o artista"
            placeholderTextColor={theme.textSecondary}
            style={[styles.search, { color: theme.text, backgroundColor: theme.card }]}
          />
          {state === 'searching' && <Text style={{ color: theme.textSecondary }}>Buscando…</Text>}
          {state === 'error' && (
            <Text style={{ color: theme.text }}>No se ha podido buscar. Revisa tu conexión.</Text>
          )}
          {results.map((r, i) => (
            <Pressable
              key={`${r.title}-${r.artist}-${i}`}
              accessibilityRole="button"
              onPress={() => setPicked(r)}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: pressed ? theme.soft : 'transparent' },
              ]}>
              {r.artwork ? (
                <Image source={{ uri: r.artwork }} style={styles.art} />
              ) : (
                <View style={[styles.art, { backgroundColor: theme.soft }]} />
              )}
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: theme.text, fontSize: 16 }}>
                  {r.title}
                </Text>
                <Text numberOfLines={1} style={{ color: theme.textSecondary, fontSize: 14 }}>
                  {r.artist}
                </Text>
              </View>
            </Pressable>
          ))}
          <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 18 }}>
            Guardamos la canción, su portada y un fragmento de 30 segundos del catálogo de iTunes,
            no el archivo de audio.
          </Text>
        </View>
      )}
      <Notice>{notice}</Notice>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.two },
  search: {
    fontSize: 16,
    height: 52,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 8,
    borderRadius: Radius.medium,
  },
  chosen: { padding: 12, boxShadow: '0 12px 30px rgba(20,22,26,0.1)' },
  art: { width: 52, height: 52, borderRadius: 8 },
  input: { minHeight: 110, borderRadius: Radius.inner, padding: 18, textAlignVertical: 'top' },
});
