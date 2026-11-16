import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Music, Pause, Play, Search, Upload } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Icon } from '@/components/icon';
import { LyricsEditor, type LyricsValue } from '@/components/lyrics-editor';
import { Button, Field, Notice, Screen, Tag, Title } from '@/components/ui';
import { VideoTrimmer } from '@/components/video-trimmer';
import { Spacing, useTheme } from '@/constants/theme';
import { errorText, useStore } from '@/data/store';
import { waveform } from '@/lib/karaoke';
import { mmss, searchSongs, type FoundSong } from '@/lib/music';

const DURATIONS = [
  { days: 3, label: '3 días' },
  { days: 7, label: 'Una semana' },
  { days: 14, label: 'Dos semanas' },
  { days: 0, label: 'Sin fecha' },
];
/** Como mucho, 5 minutos cantando (el vídeo de cada uno tiene que caber). */
const MAX_TRAMO = 300;

type Chosen = {
  url: string;
  song: string;
  artist?: string;
  artwork?: string;
  /** una pista subida (si no, el fragmento de Apple) */
  file?: { uri: string; mime: string; name: string };
};

/**
 * Proponer un karaoke: una canción (buscada, con sus 30 s gratis, o una pista
 * de karaoke subida), el trozo que se canta y, si se quiere, la letra.
 */
export default function NewKaraoke() {
  // Puede llegar con una canción propuesta por la narradora (se busca sola).
  const params = useLocalSearchParams<{ groupId: string; q?: string; days?: string }>();
  const { groupId } = params;
  const theme = useTheme();
  const { group: groupById, addKaraoke } = useStore();
  const group = groupById(groupId);
  const [source, setSource] = useState<'search' | 'upload'>('search');
  const [query, setQuery] = useState(params.q ?? '');
  const [results, setResults] = useState<FoundSong[]>([]);
  const [searching, setSearching] = useState(false);
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [duration, setDuration] = useState(0);
  const [clip, setClip] = useState({ start: 0, end: 0 });
  const [bars, setBars] = useState<number[]>([]);
  const [lyrics, setLyrics] = useState<LyricsValue>({});
  const [days, setDays] = useState(() => {
    const d = Number(params.days);
    if (!(d > 0)) return 7;
    // la duración disponible más cercana
    return DURATIONS.filter((x) => x.days).reduce((a, b) =>
      Math.abs(b.days - d) < Math.abs(a.days - d) ? b : a,
    ).days;
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  // Buscar mientras se escribe (con una pequeña espera).
  useEffect(() => {
    if (source !== 'search' || chosen) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const abort = new AbortController();
    const wait = setTimeout(() => {
      setSearching(true);
      searchSongs(q, abort.signal)
        .then((r) => setResults(r.filter((s) => s.preview)))
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 350);
    return () => {
      clearTimeout(wait);
      abort.abort();
    };
  }, [query, source, chosen]);

  // Al elegir la canción: su duración, su forma de onda y el tramo de partida.
  useEffect(() => {
    if (!chosen) return;
    let alive = true;
    const a = new Audio();
    a.preload = 'metadata';
    a.src = chosen.url;
    a.onloadedmetadata = () => {
      if (!alive) return;
      const d = Number.isFinite(a.duration) ? a.duration : 30;
      setDuration(d);
      setClip({ start: 0, end: Math.min(d, MAX_TRAMO) });
    };
    setBars([]);
    waveform(chosen.url).then((b) => alive && setBars(b));
    return () => {
      alive = false;
      a.src = '';
    };
  }, [chosen]);

  // Escuchar el tramo elegido.
  const player = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  useEffect(() => () => player.current?.pause(), []);
  const ensurePlayer = () => {
    if (!chosen) return null;
    let a = player.current;
    if (!a || a.dataset.src !== chosen.url) {
      a?.pause();
      a = new Audio(chosen.url);
      a.dataset.src = chosen.url;
      player.current = a;
      const el = a;
      let frame = 0;
      // la posición, fotograma a fotograma (para que la letra vaya al segundo)
      const tick = () => {
        setAt(el.currentTime);
        if (el.currentTime >= latest.current.end) el.pause();
        else frame = requestAnimationFrame(tick);
      };
      el.onpause = () => {
        cancelAnimationFrame(frame);
        setPlaying(false);
      };
      el.onplay = () => {
        setPlaying(true);
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(tick);
      };
    }
    return a;
  };
  const playClip = () => {
    const a = ensurePlayer();
    if (!a) return;
    a.currentTime = latest.current.start;
    a.play().catch(() => setPlaying(false));
  };
  const listen = () => {
    if (playing) player.current?.pause();
    else playClip();
  };
  const latest = useRef(clip);
  latest.current = clip;

  const pickFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*,.mp3,.m4a,.wav,.aac';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 45 * 1024 * 1024) {
        setNotice('La pista pesa demasiado (como mucho 45 MB).');
        return;
      }
      setNotice('');
      // «Artista - Canción (karaoke).mp3» → canción y artista
      const base = file.name.replace(/\.[^.]+$/, '');
      const tidy = (x: string) =>
        x
          .replace(/[_]+/g, ' ')
          .replace(/[([]?\b(karaoke|instrumental|version|versión)\b[)\]]?/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
      const [artist, song] = / - /.test(base) ? base.split(/ - (.*)/s) : [undefined, base];
      const url = URL.createObjectURL(file);
      setChosen({
        url,
        song: tidy(song ?? base) || base,
        artist: artist ? tidy(artist) : undefined,
        file: { uri: url, mime: file.type || 'audio/mpeg', name: file.name },
      });
    };
    input.click();
  };

  if (!group) return null;

  const save = async () => {
    if (!chosen) return;
    setBusy(true);
    setNotice('');
    player.current?.pause();
    try {
      const id = await addKaraoke(
        groupId,
        {
          song: chosen.song.trim() || 'Canción',
          artist: chosen.artist?.trim() || undefined,
          artwork: chosen.artwork,
          previewUrl: chosen.file ? undefined : chosen.url,
          start: clip.start,
          end: clip.end,
          lyrics: lyrics.lyrics,
          lines: lyrics.lines,
        },
        days || undefined,
        chosen.file,
      );
      router.replace({ pathname: '/karaoke/[id]', params: { id } });
    } catch (error) {
      setNotice(errorText(error));
      setBusy(false);
    }
  };

  const ready = !!chosen && duration > 0 && clip.end - clip.start >= 3;
  const max = Math.min(duration, MAX_TRAMO);
  return (
    <Screen
      header={
        <View style={styles.header}>
          <Button compact label="Cancelar" variant="quiet" onPress={() => router.back()} />
          <Button
            compact
            label={busy ? (chosen?.file ? 'Subiendo la pista…' : 'Proponiendo…') : 'Proponer'}
            disabled={busy || !ready}
            onPress={save}
          />
        </View>
      }>
      <View style={{ gap: 12 }}>
        <Tag>Para {group.name}</Tag>
        <Title>Karaoke</Title>
        <Text style={{ color: theme.textSecondary, fontSize: 16, lineHeight: 22 }}>
          Elegid una canción y el trozo que se canta. Cada uno se graba cantándolo entero y Junti
          junta las voces en un solo vídeo, pasando de uno a otro.
        </Text>
      </View>

      {/* De dónde sale la canción */}
      <View style={[styles.tabs, { backgroundColor: theme.soft }]}>
        {(
          [
            ['search', 'Buscar canción', Search],
            ['upload', 'Subir una pista', Upload],
          ] as const
        ).map(([key, label, icon]) => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            aria-selected={source === key}
            onPress={() => {
              if (source === key) return;
              player.current?.pause();
              setSource(key);
              setChosen(null);
              setNotice('');
            }}
            style={[styles.tab, source === key && { backgroundColor: theme.card }]}>
            <Icon icon={icon} size={16} color={theme.text} />
            <Text style={{ color: theme.text, fontWeight: '600' }}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {chosen ? (
        <View style={[styles.chosen, { backgroundColor: theme.card, boxShadow: theme.shadow }]}>
          <View style={[styles.art, { backgroundColor: theme.soft }]}>
            {chosen.artwork ? (
              <Image source={{ uri: chosen.artwork }} style={StyleSheet.absoluteFill} />
            ) : (
              <Icon icon={Music} size={24} color={theme.textSecondary} />
            )}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            {chosen.file ? (
              <>
                <TextInput
                  accessibilityLabel="Nombre de la canción"
                  value={chosen.song}
                  onChangeText={(song) => setChosen({ ...chosen, song })}
                  placeholder="Nombre de la canción"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.songInput, { color: theme.text }]}
                />
                <TextInput
                  accessibilityLabel="Artista"
                  value={chosen.artist ?? ''}
                  onChangeText={(artist) => setChosen({ ...chosen, artist })}
                  placeholder="Artista (opcional)"
                  placeholderTextColor={theme.textSecondary}
                  style={{ color: theme.textSecondary, fontSize: 15, padding: 0 }}
                />
              </>
            ) : (
              <>
                <Text
                  numberOfLines={1}
                  style={{ color: theme.text, fontSize: 17, fontWeight: '600' }}>
                  {chosen.song}
                </Text>
                <Text numberOfLines={1} style={{ color: theme.textSecondary, fontSize: 15 }}>
                  {chosen.artist}
                </Text>
              </>
            )}
          </View>
          <Button
            compact
            variant="quiet"
            label="Cambiar"
            onPress={() => {
              player.current?.pause();
              setChosen(null);
              if (source === 'upload') pickFile();
            }}
          />
        </View>
      ) : source === 'search' ? (
        <View style={{ gap: 10 }}>
          <Field
            label="La canción"
            value={query}
            onChangeText={setQuery}
            placeholder="Busca por título o artista"
            autoFocus
          />
          {searching && <ActivityIndicator color={theme.textSecondary} />}
          {results.map((s) => (
            <Pressable
              key={`${s.title}-${s.artist}-${s.preview}`}
              accessibilityRole="button"
              onPress={() =>
                setChosen({ url: s.preview!, song: s.title, artist: s.artist, artwork: s.artwork })
              }
              style={[styles.result, { backgroundColor: theme.card }]}>
              <View style={[styles.artSmall, { backgroundColor: theme.soft }]}>
                {!!s.artwork && (
                  <Image source={{ uri: s.artwork }} style={StyleSheet.absoluteFill} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={{ color: theme.text, fontSize: 16, fontWeight: '500' }}>
                  {s.title}
                </Text>
                <Text numberOfLines={1} style={{ color: theme.textSecondary, fontSize: 14 }}>
                  {s.artist}
                </Text>
              </View>
            </Pressable>
          ))}
          <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 18 }}>
            De cada canción se pueden usar 30 segundos gratis (los elige Apple, suele ser el
            estribillo). Para cantar otra parte o la canción entera, sube una pista de karaoke.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            onPress={pickFile}
            style={[styles.upload, { borderColor: theme.textSecondary }]}>
            <Icon icon={Upload} size={22} color={theme.text} />
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>
              Elegir la pista (mp3, m4a…)
            </Text>
          </Pressable>
          <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 18 }}>
            Busca «nombre de la canción karaoke» y descarga la versión sin voz. Puedes elegir un
            trozo o cantarla entera (hasta 5 minutos).
          </Text>
        </View>
      )}

      {/* El trozo que se canta */}
      {chosen && duration > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>
            ¿Qué trozo se canta?
          </Text>
          <VideoTrimmer
            label="Trozo de la canción"
            verb="se cantan"
            duration={duration}
            value={clip}
            max={max}
            onChange={setClip}
            strip={
              <View style={styles.wave}>
                {(bars.length ? bars : Array.from({ length: 64 }, () => 0.15)).map((b, i) => {
                  const t = ((i + 0.5) / (bars.length || 64)) * duration;
                  const past = playing && t <= at;
                  return (
                    <View
                      key={i}
                      style={{
                        flex: 1,
                        marginHorizontal: 0.5,
                        height: `${Math.round(b * 80) + 10}%`,
                        borderRadius: 2,
                        backgroundColor: past ? '#F2B33D' : theme.textSecondary,
                        opacity: past ? 1 : 0.55,
                      }}
                    />
                  );
                })}
              </View>
            }
          />
          <Pressable
            accessibilityRole="button"
            onPress={listen}
            style={[styles.listen, { backgroundColor: theme.soft }]}>
            <Icon icon={playing ? Pause : Play} size={16} color={theme.text} />
            <Text style={{ color: theme.text, fontWeight: '600' }}>
              {playing ? `${mmss(at)}` : 'Escuchar el trozo'}
            </Text>
          </Pressable>
        </View>
      )}

      {chosen && duration > 0 && (
        <LyricsEditor
          song={chosen.song}
          artist={chosen.artist}
          duration={duration}
          clip={clip}
          preview={!chosen.file}
          audio={() => player.current}
          playClip={playClip}
          playing={playing}
          at={at}
          onChange={setLyrics}
        />
      )}

      <View style={{ gap: 8 }}>
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
          Cuánto tiempo hay para cantar
        </Text>
        <View style={styles.chips}>
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
  tabs: { flexDirection: 'row', borderRadius: 999, padding: 4 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 999,
  },
  chosen: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18 },
  art: {
    width: 56,
    height: 56,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artSmall: { width: 44, height: 44, borderRadius: 8, overflow: 'hidden' },
  songInput: { fontSize: 17, fontWeight: '600', padding: 0 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14 },
  upload: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    height: 72,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  wave: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  listen: {
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 999,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 40, paddingHorizontal: 16, borderRadius: 999, justifyContent: 'center' },
});
