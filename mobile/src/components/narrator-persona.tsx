import { Play, Square } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Hand, useTheme } from '@/constants/theme';
import { sampleNarrator, useStore } from '@/data/store';
import type { Group, NarratorPersona } from '@/data/types';

import { Icon } from './icon';
import { Button, Field } from './ui';

// Cómo es la narradora del grupo: siempre la misma voz, su acento, cuánto
// vacila, si usa dichos, cómo se llama y algo más de ella. Se puede escuchar
// antes de guardar.

const VOICES: { id: string; label: string; who: 'ella' | 'él' }[] = [
  { id: 'Sulafat', label: 'Cálida', who: 'ella' },
  { id: 'Laomedeia', label: 'Alegre', who: 'ella' },
  { id: 'Pulcherrima', label: 'Con chispa', who: 'ella' },
  { id: 'Vindemiatrix', label: 'Dulce', who: 'ella' },
  { id: 'Gacrux', label: 'Madura', who: 'ella' },
  { id: 'Achernar', label: 'Suave', who: 'ella' },
  { id: 'Aoede', label: 'Fresca', who: 'ella' },
  { id: 'Achird', label: 'Cercano', who: 'él' },
  { id: 'Puck', label: 'Alegre', who: 'él' },
  { id: 'Sadachbia', label: 'Animado', who: 'él' },
  { id: 'Algenib', label: 'Grave', who: 'él' },
  { id: 'Schedar', label: 'Sereno', who: 'él' },
  { id: 'Charon', label: 'Profundo', who: 'él' },
];

const ACCENTS: { id: string; label: string }[] = [
  { id: 'espana', label: 'España' },
  { id: 'andaluz', label: 'Andaluz' },
  { id: 'canario', label: 'Canario' },
  { id: 'cubano', label: 'Cubano' },
  { id: 'mexicano', label: 'Mexicano' },
  { id: 'argentino', label: 'Argentino' },
  { id: 'colombiano', label: 'Colombiano' },
  { id: 'venezolano', label: 'Venezolano' },
  { id: 'dominicano', label: 'Dominicano' },
  { id: 'puertorriqueno', label: 'Boricua' },
  { id: 'chileno', label: 'Chileno' },
  { id: 'peruano', label: 'Peruano' },
  { id: 'latino', label: 'Latino neutro' },
  { id: 'otro', label: 'Otro…' },
];

const HUMOR = ['Seria', 'Con gracia', 'Pícara', 'Muy jodedora'];

/** Un resumen en una línea («Yoli · cubana · muy jodedora · con dichos»). */
export function personaSummary(p?: NarratorPersona) {
  if (!p) return '';
  const accent =
    p.accent === 'otro' ? p.accentOther : ACCENTS.find((a) => a.id === p.accent)?.label;
  return [
    p.name,
    accent && `acento ${accent.toLowerCase()}`,
    p.humor != null && HUMOR[p.humor].toLowerCase(),
    p.sayings && 'con dichos',
  ]
    .filter(Boolean)
    .join(' · ');
}

export function NarratorPersonaEditor({ group }: { group: Group }) {
  const theme = useTheme();
  const store = useStore();
  const admin = group.isAdmin;
  const saved = group.narrator ?? {};
  const [p, setP] = useState<NarratorPersona>(saved);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [listening, setListening] = useState<'' | 'loading' | 'playing'>('');
  const [said, setSaid] = useState('');
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => audio.current?.pause(), []);
  const set = (patch: Partial<NarratorPersona>) => {
    setNote('');
    setP((x) => ({ ...x, ...patch }));
  };
  const changed = JSON.stringify(clean(p)) !== JSON.stringify(clean(saved));

  const listen = async () => {
    if (listening === 'playing') {
      audio.current?.pause();
      setListening('');
      return;
    }
    setListening('loading');
    setSaid('');
    setNote('');
    const r = await sampleNarrator(group.id, clean(p));
    if (r.text) setSaid(r.text);
    if (r.error || !r.audio || Platform.OS !== 'web') {
      setNote(r.error ?? '');
      setListening('');
      return;
    }
    audio.current?.pause();
    const a = new Audio(r.audio);
    audio.current = a;
    a.onended = () => setListening('');
    setListening('playing');
    a.play().catch(() => setListening(''));
  };

  const save = async () => {
    setBusy(true);
    setNote('');
    try {
      const c = clean(p);
      await store.setNarrator(group.id, Object.keys(c).length ? c : null);
      setNote('Guardada. Las historias se volverán a contar con ella.');
    } catch {
      setNote('No se ha podido guardar. Prueba de nuevo.');
    }
    setBusy(false);
  };

  const chip = (on: boolean, label: string, onPress: () => void, key?: string) => (
    <Pressable
      key={key ?? label}
      accessibilityRole="radio"
      aria-checked={on}
      disabled={!admin}
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: on ? theme.accent : theme.soft },
        !admin && !on && { opacity: 0.45 },
      ]}>
      <Text style={{ color: on ? theme.onAccent : theme.text, fontSize: 14, fontWeight: '500' }}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.box}>
      <Text style={[styles.title, { color: theme.text }]}>Cómo es la narradora</Text>
      <Text style={[styles.small, { color: theme.textSecondary }]}>
        Siempre la misma voz y la misma forma de ser, se elija el tono que se elija.
        {admin ? '' : ' Quien administra el grupo puede cambiarla.'}
      </Text>

      <Field
        label="Cómo se llama (opcional)"
        value={p.name ?? ''}
        editable={admin}
        maxLength={30}
        placeholder="Por ejemplo: Yoli"
        onChangeText={(name) => set({ name })}
      />

      <Text style={[styles.label, { color: theme.textSecondary }]}>Su voz</Text>
      <View style={styles.row}>
        {chip(!p.voice, 'La del tono', () => set({ voice: undefined }))}
      </View>
      {(['ella', 'él'] as const).map((who) => (
        <View key={who} style={styles.row}>
          <Text style={[styles.who, { color: theme.textSecondary }]}>
            {who === 'ella' ? 'Ella' : 'Él'}
          </Text>
          {VOICES.filter((v) => v.who === who).map((v) =>
            chip(p.voice === v.id, v.label, () => set({ voice: v.id }), v.id),
          )}
        </View>
      ))}

      <Text style={[styles.label, { color: theme.textSecondary }]}>Su acento</Text>
      <View style={styles.row}>
        {ACCENTS.map((a) =>
          chip((p.accent ?? 'espana') === a.id, a.label, () => set({ accent: a.id }), a.id),
        )}
      </View>
      {p.accent === 'otro' && (
        <Field
          label="¿De dónde es su acento?"
          value={p.accentOther ?? ''}
          editable={admin}
          maxLength={40}
          placeholder="Por ejemplo: Galicia, Uruguay…"
          onChangeText={(accentOther) => set({ accentOther })}
        />
      )}

      <Text style={[styles.label, { color: theme.textSecondary }]}>Su humor</Text>
      <View style={styles.row}>
        {HUMOR.map((h, i) => chip((p.humor ?? 1) === i, h, () => set({ humor: i }), h))}
      </View>

      <View style={styles.row}>
        {chip(!!p.sayings, p.sayings ? '✓ Con dichos y refranes' : 'Con dichos y refranes', () =>
          set({ sayings: !p.sayings }),
        )}
      </View>

      <Field
        label="Algo más de ella (opcional)"
        value={p.notes ?? ''}
        editable={admin}
        multiline
        maxLength={300}
        placeholder="Cómo os llama, sus muletillas, de qué se ríe… Por ejemplo: os llama «mi gente» y siempre va con prisa."
        onChangeText={(notes) => set({ notes })}
        style={{ minHeight: 76, textAlignVertical: 'top' }}
      />

      {!!said && <Text style={[styles.said, { color: theme.text }]}>«{said}»</Text>}
      {!!note && <Text style={[styles.small, { color: theme.text }]}>{note}</Text>}

      <View style={[styles.row, { gap: 10 }]}>
        <Pressable
          accessibilityRole="button"
          disabled={listening === 'loading'}
          onPress={listen}
          style={[styles.listen, { backgroundColor: theme.soft }]}>
          <Icon icon={listening === 'playing' ? Square : Play} size={16} color={theme.text} />
          <Text style={{ color: theme.text, fontSize: 15, fontWeight: '500' }}>
            {listening === 'loading'
              ? 'Preparando su voz…'
              : listening === 'playing'
                ? 'Parar'
                : 'Escucharla'}
          </Text>
        </Pressable>
        {admin && <Button compact label="Guardar" disabled={busy || !changed} onPress={save} />}
      </View>
    </View>
  );
}

/** Solo lo que tiene valor (para comparar y guardar). */
function clean(p: NarratorPersona): NarratorPersona {
  const out: NarratorPersona = {};
  if (p.name?.trim()) out.name = p.name.trim();
  if (p.voice) out.voice = p.voice;
  if (p.accent && p.accent !== 'espana') out.accent = p.accent;
  if (p.accent === 'otro' && p.accentOther?.trim()) out.accentOther = p.accentOther.trim();
  if (p.humor != null && p.humor !== 1) out.humor = p.humor;
  if (p.sayings) out.sayings = true;
  if (p.notes?.trim()) out.notes = p.notes.trim();
  return out;
}

const styles = StyleSheet.create({
  box: { gap: 12, paddingTop: 8 },
  title: { fontSize: 17, fontWeight: '600' },
  small: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 13, marginTop: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  who: { fontSize: 13, width: 30 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  said: { fontFamily: Hand, fontSize: 22, lineHeight: 25 },
  listen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
});
