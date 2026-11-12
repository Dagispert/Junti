import { X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Radius, useTheme } from '@/constants/theme';

import { Icon } from './icon';

type Group = { name: string; emojis: [string, string][] };

const base =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  window.location.pathname.startsWith('/Junti')
    ? '/Junti'
    : '';

// La lista de emojis (con sus nombres en español) se descarga solo la primera
// vez que alguien abre el selector, y se queda en memoria.
let cache: Promise<Group[]> | null = null;
const loadEmojis = () =>
  (cache ??= fetch(`${base}/emoji/es.json`)
    .then((r) => r.json() as Promise<Group[]>)
    .catch((e) => {
      cache = null;
      throw e;
    }));

const RECENT_KEY = 'junti-emojis-recientes';
const readRecent = (): string[] => {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(RECENT_KEY) ?? '[]');
  } catch {
    return [];
  }
};
const saveRecent = (emoji: string) => {
  try {
    const list = [emoji, ...readRecent().filter((e) => e !== emoji)].slice(0, 24);
    globalThis.localStorage?.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // sin almacenamiento: no pasa nada
  }
};

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Elegir cualquier emoji: recientes, por grupos y con buscador en español. */
export function EmojiPicker({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (emoji: string) => void;
}) {
  const theme = useTheme();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState(-1); // -1 = recientes
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) return;
    setRecent(readRecent());
    setQuery('');
    setFailed(false);
    loadEmojis()
      .then((g) => {
        setGroups(g);
        setTab((t) => (t === -1 && !readRecent().length ? 0 : t));
      })
      .catch(() => setFailed(true));
  }, [visible]);

  const shown = useMemo(() => {
    if (!groups) return [];
    const q = fold(query.trim());
    if (q) {
      const words = q.split(/\s+/);
      const all = groups.flatMap((g) => g.emojis);
      return all
        .filter(([, names]) => {
          const n = fold(names);
          return words.every((w) => n.includes(w));
        })
        .slice(0, 160)
        .map(([e]) => e);
    }
    if (tab === -1) return recent;
    return groups[tab]?.emojis.map(([e]) => e) ?? [];
  }, [groups, query, tab, recent]);

  const pick = (emoji: string) => {
    saveRecent(emoji);
    onPick(emoji);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cerrar"
        onPress={onClose}
        style={styles.backdrop}
      />
      <View style={[styles.sheet, { backgroundColor: theme.card, boxShadow: theme.shadow }]}>
        <View style={styles.head}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar: risa, fiesta, gato…"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Buscar un emoji"
            style={[styles.search, { color: theme.text, backgroundColor: theme.soft }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            onPress={onClose}
            style={[styles.close, { backgroundColor: theme.soft }]}>
            <Icon icon={X} size={18} />
          </Pressable>
        </View>

        {!query && groups && (
          <ScrollView
            horizontal
            style={{ flexGrow: 0 }}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabs}>
            {[
              ...(recent.length ? [{ i: -1, icon: '🕘', name: 'Recientes' }] : []),
              ...groups.map((g, i) => ({ i, icon: g.emojis[0]?.[0] ?? '·', name: g.name })),
            ].map((t) => (
              <Pressable
                key={t.i}
                accessibilityRole="tab"
                accessibilityLabel={t.name}
                accessibilityState={{ selected: tab === t.i }}
                onPress={() => setTab(t.i)}
                style={[styles.tab, tab === t.i && { backgroundColor: theme.soft }]}>
                <Text style={{ fontSize: 20 }}>{t.icon}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.grid}>
          {!groups && (
            <Text style={[styles.note, { color: theme.textSecondary }]}>
              {failed ? 'No se han podido cargar los emojis. Prueba otra vez.' : 'Cargando…'}
            </Text>
          )}
          {groups && !shown.length && (
            <Text style={[styles.note, { color: theme.textSecondary }]}>
              {query ? 'Ningún emoji con ese nombre' : 'Aún no has usado ninguno'}
            </Text>
          )}
          {shown.map((e) => (
            <Pressable
              key={e}
              accessibilityRole="button"
              accessibilityLabel={`Reaccionar con ${e}`}
              onPress={() => pick(e)}
              style={({ pressed }) => [styles.cell, pressed && { backgroundColor: theme.soft }]}>
              <Text style={styles.emoji}>{e}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10,12,16,0.35)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '62%',
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
    borderTopLeftRadius: Radius.frame,
    borderTopRightRadius: Radius.frame,
    paddingTop: 16,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  search: { flex: 1, height: 44, borderRadius: Radius.small, paddingHorizontal: 16, fontSize: 15 },
  close: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: { gap: 4, paddingHorizontal: 12, paddingVertical: 8 },
  tab: {
    width: 44,
    height: 40,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    paddingBottom: 32,
  },
  cell: {
    width: '12.5%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.small,
  },
  emoji: { fontSize: 28 },
  note: { padding: 16, fontSize: 15 },
});
