import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '@/constants/theme';
import { findLyrics, lineAt, type LyricLine } from '@/lib/lyrics';

const GOLD = '#F2B33D';
/** lo que se tarda en tocar al oír la línea */
const REACTION = 0.25;

export type LyricsValue = { lines?: LyricLine[]; lyrics?: string };

/**
 * La letra del karaoke: se busca sola en LRCLIB. Si está sincronizada, va al
 * ritmo de la canción (con el fragmento de Apple hay que decir qué línea suena,
 * porque Apple no dice de qué parte es). Si no, se pega y se marca el ritmo
 * tocando al empezar cada línea.
 */
export function LyricsEditor({
  song,
  artist,
  duration,
  clip,
  preview,
  audio,
  playClip,
  playing,
  at,
  onChange,
}: {
  song: string;
  artist?: string;
  duration: number;
  clip: { start: number; end: number };
  /** el fragmento de 30 s de Apple (no se sabe de qué parte de la canción es) */
  preview: boolean;
  audio: () => HTMLAudioElement | null;
  /** reproduce el trozo desde su inicio */
  playClip: () => void;
  playing: boolean;
  /** segundo del audio que suena ahora */
  at: number;
  onChange: (value: LyricsValue) => void;
}) {
  const theme = useTheme();
  const [state, setState] = useState<'searching' | 'synced' | 'text' | 'marking'>('searching');
  const [found, setFound] = useState<'lrclib' | 'plain' | 'none' | 'mine'>('none');
  const [raw, setRaw] = useState<LyricLine[]>([]);
  const [shift, setShift] = useState(0);
  const [aligned, setAligned] = useState(false);
  const [text, setText] = useState('');
  const [mark, setMark] = useState<{ lines: string[]; done: LyricLine[] }>({ lines: [], done: [] });

  // Buscar la letra al elegir la canción (y si se corrige el nombre).
  useEffect(() => {
    if (!song.trim()) return;
    const abort = new AbortController();
    setState('searching');
    const wait = setTimeout(() => {
      findLyrics(song.trim(), artist?.trim() || undefined, preview ? undefined : duration, abort.signal).then(
        (r) => {
          if (abort.signal.aborted) return;
          if (r?.lines) {
            setRaw(r.lines);
            setShift(0);
            // con una pista entera, la letra ya cuadra; con el fragmento, hay que situarla
            setAligned(!preview);
            setFound('lrclib');
            setText(r.plain ?? '');
            setState('synced');
          } else {
            setRaw([]);
            setFound(r?.plain ? 'plain' : 'none');
            setText(r?.plain ?? '');
            setState('text');
          }
        },
      );
    }, 600);
    return () => {
      clearTimeout(wait);
      abort.abort();
    };
  }, [song, artist, duration, preview]);

  const lines = useMemo(() => raw.map((l) => ({ t: l.t + shift, text: l.text })), [raw, shift]);

  // Lo que se guarda: solo las líneas del trozo.
  const latest = useRef(onChange);
  latest.current = onChange;
  useEffect(() => {
    if (state === 'synced' && aligned && lines.length) {
      const inside = lines.filter((l) => l.t >= clip.start - 6 && l.t < clip.end);
      latest.current({
        lines: inside.map((l) => ({ t: Math.round(l.t * 100) / 100, text: l.text })),
        lyrics: inside.map((l) => l.text).join('\n') || undefined,
      });
    } else if (state === 'text' || state === 'synced') latest.current({ lyrics: text.trim() || undefined });
  }, [state, aligned, lines, clip.start, clip.end, text]);

  const current = lineAt(lines, at + 0.05);
  const list = useRef<{ scrollTo: (o: { y: number; animated?: boolean }) => void } | null>(
    null,
  );
  const rows = useRef(new Map<number, number>());
  useEffect(() => {
    if (!playing || current < 0) return;
    const y = rows.current.get(current);
    if (y != null) list.current?.scrollTo({ y: Math.max(0, y - 60), animated: true });
  }, [current, playing]);

  // Tocar la línea que suena: así se sitúa la letra sobre el fragmento.
  const tapLine = (i: number) => {
    const a = audio();
    if (!a || !playing) {
      playClip();
      return;
    }
    setShift(a.currentTime - REACTION - raw[i].t);
    setAligned(true);
  };

  // Marcar el ritmo a mano: se toca al empezar cada línea.
  const startMarking = () => {
    const ls = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!ls.length) return;
    setMark({ lines: ls, done: [] });
    setState('marking');
    playClip();
  };
  const tapNow = () => {
    const a = audio();
    if (!a) return;
    const done = [...mark.done, { t: Math.max(0, a.currentTime - REACTION), text: mark.lines[mark.done.length] }];
    if (done.length >= mark.lines.length) finishMarking(done);
    else setMark({ ...mark, done });
  };
  const finishMarking = (done: LyricLine[]) => {
    audio()?.pause();
    if (!done.length) {
      setState('text');
      return;
    }
    setRaw(done);
    setShift(0);
    setAligned(true);
    setFound('mine');
    setState('synced');
  };
  // si el trozo acaba mientras se marca, se guarda lo marcado
  useEffect(() => {
    if (state === 'marking' && !playing && mark.done.length) finishMarking(mark.done);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const small = { color: theme.textSecondary, fontSize: 13, lineHeight: 18 };
  const link = (label: string, onPress: () => void) => (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={6}>
      <Text style={[small, { textDecorationLine: 'underline' }]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>La letra</Text>

      {state === 'searching' && (
        <View style={styles.row}>
          <ActivityIndicator color={theme.textSecondary} />
          <Text style={small}>Buscando la letra…</Text>
        </View>
      )}

      {state === 'synced' && (
        <>
          <Text style={small}>
            {found === 'mine'
              ? 'Con el ritmo que has marcado.'
              : 'Encontrada y sincronizada (de LRCLIB): irá pasando al ritmo de la canción.'}
          </Text>
          {!aligned && (
            <View style={[styles.hint, { backgroundColor: theme.soft }]}>
              <Text style={{ color: theme.text, fontSize: 15, lineHeight: 21 }}>
                Apple no dice de qué parte de la canción son sus 30 segundos.{' '}
                <Text style={{ fontWeight: '700' }}>Dale a escuchar y toca la línea que está sonando</Text>: el
                resto se coloca solo.
              </Text>
            </View>
          )}
          <View style={[styles.box, { backgroundColor: theme.card }]}>
            <ScrollView ref={list as never} style={{ maxHeight: 240 }} nestedScrollEnabled>
              {lines.map((l, i) => {
                const inClip = aligned && l.t >= clip.start - 0.5 && l.t < clip.end;
                const now = aligned && i === current && playing;
                return (
                  <Pressable
                    key={i}
                    accessibilityRole="button"
                    accessibilityLabel={`Línea ${i + 1}`}
                    onLayout={(e) => rows.current.set(i, e.nativeEvent.layout.y)}
                    onPress={() => tapLine(i)}
                    style={[styles.line, now && { backgroundColor: theme.soft }]}>
                    <Text
                      style={{
                        color: now ? GOLD : theme.text,
                        opacity: !aligned || inClip ? 1 : 0.35,
                        fontSize: now ? 17 : 15,
                        fontWeight: now ? '700' : '400',
                      }}>
                      {l.text}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
          {aligned && (
            <View style={styles.row}>
              <Text style={small}>¿Va desfasada?</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setShift((s) => s - 0.25)}
                style={[styles.nudge, { backgroundColor: theme.soft }]}>
                <Text style={{ color: theme.text, fontSize: 14 }}>Antes</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setShift((s) => s + 0.25)}
                style={[styles.nudge, { backgroundColor: theme.soft }]}>
                <Text style={{ color: theme.text, fontSize: 14 }}>Después</Text>
              </Pressable>
            </View>
          )}
          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            {aligned && preview && link('Volver a situarla', () => setAligned(false))}
            {link('Editar el texto y marcar el ritmo yo', () => setState('text'))}
          </View>
        </>
      )}

      {state === 'text' && (
        <>
          <Text style={small}>
            {found === 'plain'
              ? 'Hemos encontrado la letra, pero sin ritmo. Deja solo las líneas del trozo y marca el ritmo.'
              : found === 'none'
                ? 'No hemos encontrado la letra. Puedes pegarla (solo la del trozo) y marcar el ritmo.'
                : 'Deja solo las líneas del trozo y marca el ritmo.'}
          </Text>
          <TextInput
            accessibilityLabel="La letra"
            multiline
            value={text}
            onChangeText={setText}
            placeholder="Pega la letra del trozo, una línea por renglón"
            placeholderTextColor={theme.textSecondary}
            style={[styles.text, { color: theme.text, backgroundColor: theme.soft }]}
          />
          {!!text.trim() && (
            <Pressable
              accessibilityRole="button"
              onPress={startMarking}
              style={[styles.markButton, { backgroundColor: theme.text }]}>
              <Text style={{ color: theme.background, fontSize: 15, fontWeight: '600' }}>
                Marcar el ritmo
              </Text>
            </Pressable>
          )}
          <Text style={small}>
            {text.trim()
              ? 'Sin marcar el ritmo, cada línea dura lo mismo.'
              : 'La letra es opcional.'}
          </Text>
          {raw.length > 0 && link('Usar la letra sincronizada', () => setState('synced'))}
        </>
      )}

      {state === 'marking' && (
        <View style={[styles.marking, { backgroundColor: theme.card }]}>
          <Text style={small}>
            Toca «Ahora» justo cuando empiece cada línea ({mark.done.length + 1} de {mark.lines.length})
          </Text>
          <Text style={{ color: theme.textSecondary, fontSize: 15, textAlign: 'center' }}>
            {mark.lines[mark.done.length - 1] ?? ' '}
          </Text>
          <Text style={{ color: theme.text, fontSize: 20, fontWeight: '700', textAlign: 'center' }}>
            {mark.lines[mark.done.length]}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ahora"
            onPress={tapNow}
            style={[styles.now, { backgroundColor: GOLD }]}>
            <Text style={{ color: '#1D1F22', fontSize: 20, fontWeight: '800' }}>Ahora</Text>
          </Pressable>
          {link('Cancelar', () => {
            audio()?.pause();
            setState('text');
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hint: { borderRadius: 14, padding: 12 },
  box: { borderRadius: 16, padding: 6 },
  line: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10 },
  nudge: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  text: { minHeight: 120, borderRadius: 14, padding: 14, fontSize: 16, textAlignVertical: 'top' },
  markButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  marking: { borderRadius: 18, padding: 16, gap: 10, alignItems: 'center' },
  now: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
