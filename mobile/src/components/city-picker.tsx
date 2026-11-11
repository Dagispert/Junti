import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Radius, Spacing, useTheme } from '@/constants/theme';
import { searchPlaces, type Place } from '@/lib/geo';

/**
 * Buscador de ciudad. Se elige de una lista (no texto libre) para poder situar a
 * cada persona en el mapa. Guardamos solo la ciudad, nunca una ubicación exacta.
 */
export function CityPicker({
  value,
  onChange,
}: {
  /** null = sin ciudad. */
  value: Place | null;
  onChange: (place: Place | null) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [state, setState] = useState<'idle' | 'searching' | 'error'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!open) return;
    clearTimeout(timer.current);
    const controller = new AbortController();
    if (query.trim().length < 2) {
      setResults([]);
      setState('idle');
      return;
    }
    setState('searching');
    timer.current = setTimeout(() => {
      searchPlaces(query, controller.signal)
        .then((found) => {
          setResults(found);
          setState('idle');
        })
        .catch((error) => {
          if ((error as Error).name !== 'AbortError') setState('error');
        });
    }, 280);
    return () => {
      clearTimeout(timer.current);
      controller.abort();
    };
  }, [query, open]);

  const describe = (p: Place) => [p.region, p.country].filter(Boolean).join(', ');

  if (!open) {
    return (
      <View style={{ gap: 6 }}>
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Ciudad</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Elegir ciudad"
          onPress={() => {
            setQuery('');
            setOpen(true);
          }}
          style={[styles.field, { backgroundColor: theme.soft }]}>
          <Text style={{ color: value ? theme.text : theme.textSecondary, fontSize: 16, flex: 1 }}>
            {value ? value.name : 'Elige dónde vives'}
          </Text>
          {value && describe(value) ? (
            <Text
              numberOfLines={1}
              style={{ color: theme.textSecondary, fontSize: 13, maxWidth: '50%' }}>
              {describe(value)}
            </Text>
          ) : null}
        </Pressable>
        <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 18 }}>
          Te sitúa en el mapa de tus grupos. Solo la ciudad, nunca tu ubicación exacta.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Ciudad</Text>
      <TextInput
        autoFocus
        accessibilityLabel="Buscar ciudad"
        value={query}
        onChangeText={setQuery}
        placeholder="Escribe tu ciudad o pueblo"
        placeholderTextColor={theme.textSecondary}
        autoCorrect={false}
        style={[styles.field, { color: theme.text, backgroundColor: theme.soft }]}
      />
      {state === 'searching' && (
        <Text style={[styles.hint, { color: theme.textSecondary }]}>Buscando…</Text>
      )}
      {state === 'error' && (
        <Text style={[styles.hint, { color: theme.text }]}>
          No se ha podido buscar. Revisa tu conexión.
        </Text>
      )}
      {state === 'idle' && query.trim().length >= 2 && results.length === 0 && (
        <Text style={[styles.hint, { color: theme.textSecondary }]}>No encontramos ese lugar.</Text>
      )}
      {results.map((p, i) => (
        <Pressable
          key={`${p.lat},${p.lng},${i}`}
          accessibilityRole="button"
          onPress={() => {
            onChange(p);
            setOpen(false);
          }}
          style={({ pressed }) => [
            styles.result,
            { backgroundColor: pressed ? theme.soft : 'transparent' },
          ]}>
          <Text style={{ color: theme.text, fontSize: 16 }}>{p.name}</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{describe(p)}</Text>
        </Pressable>
      ))}
      <View style={styles.row}>
        {value && (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              onChange(null);
              setOpen(false);
            }}>
            <Text style={{ color: theme.textSecondary, fontSize: 14 }}>No mostrar mi ciudad</Text>
          </Pressable>
        )}
        <Pressable accessibilityRole="button" onPress={() => setOpen(false)}>
          <Text style={{ color: theme.textSecondary, fontSize: 14 }}>Cancelar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 52,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    fontSize: 16,
  },
  hint: { fontSize: 14, paddingHorizontal: 4 },
  result: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: Radius.small, gap: 2 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 4,
  },
});
