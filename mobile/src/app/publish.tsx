import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { SendCinematic } from '@/components/cinematics';
import { CityPicker } from '@/components/city-picker';
import { useGroupPeople } from '@/components/connection-card';
import { DatePick } from '@/components/date-pick';
import { Icon } from '@/components/icon';
import { InlineVideo, VoiceNote } from '@/components/media-players';
import { PressScale } from '@/components/motion';
import { Button, Notice, Screen, Tag, Title } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { errorText, useStore } from '@/data/store';
import { dateFromFile, dateFromPickerExif } from '@/lib/exif';
import type { Place } from '@/lib/geo';
import { secondsOf, videoPoster } from '@/lib/media';
import { mmss } from '@/lib/music';
import { useVoiceRecorder } from '@/lib/recorder';
import { Camera, ImageIcon, MapPin, Mic, Plus, Video, X } from 'lucide-react-native';

const MAX_VIDEO = 30;

type Media = {
  uri: string;
  kind: 'photo' | 'video';
  mime?: string;
  duration?: number;
  poster?: string;
};

/**
 * Compartir un momento (foto, vídeo, voz y/o texto) o, con «memory», añadir un
 * recuerdo de antes que se guarda en su fecha.
 */
export default function Publish() {
  const { groupId, proposalId, memory } = useLocalSearchParams<{
    groupId: string;
    proposalId?: string;
    memory?: string;
  }>();
  const remembering = memory === '1';
  const theme = useTheme();
  const { group: groupById, proposals, addMoment, me, user } = useStore();
  const meUser = user(me);
  const home: Place | null =
    meUser.lat != null && meUser.lng != null
      ? { name: meUser.city, country: meUser.country, lat: meUser.lat, lng: meUser.lng }
      : null;
  const [busy, setBusy] = useState(false);
  const [media, setMedia] = useState<Media>();
  // Más fotos además de la principal (hasta 10 en total).
  const [extra, setExtra] = useState<string[]>([]);
  const [preparing, setPreparing] = useState(false);
  const voice = useVoiceRecorder();
  const [text, setText] = useState('');
  const [notice, setNotice] = useState('');
  const [place, setPlace] = useState<Place | null>(null);
  const [picking, setPicking] = useState(false);
  // Recuerdo: cuándo fue (por defecto, hace un año) y si la fecha salió de la foto.
  const [when, setWhen] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    d.setHours(12, 0, 0, 0);
    return d;
  });
  const [dateFromPhoto, setDateFromPhoto] = useState(false);

  const group = groupById(groupId);
  const proposal = proposals.find((p) => p.id === proposalId);
  const people = useGroupPeople(group);
  const [sent, setSent] = useState(false);
  const leave = useCallback(() => router.back(), []);
  if (!group) return null;

  if (sent) {
    return (
      <View style={{ flex: 1, backgroundColor: '#070A14' }}>
        <SendCinematic people={people} groupName={group.name} onDone={leave} />
      </View>
    );
  }

  const pick = async (
    source: 'camera' | 'library',
    want: 'photo' | 'video' | 'any',
    append = false,
  ) => {
    setNotice('');
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setNotice(
            'Sin permiso para usar la cámara. Puedes activarlo en los ajustes del teléfono.',
          );
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes:
          want === 'photo' ? ['images'] : want === 'video' ? ['videos'] : ['images', 'videos'],
        quality: 0.8,
        exif: remembering,
        // Desde la galería se pueden elegir varias fotos a la vez.
        allowsMultipleSelection: source === 'library' && !remembering,
        selectionLimit: append ? 10 - 1 - extra.length : 10,
        videoMaxDuration: MAX_VIDEO,
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
      };
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const photos = result.assets.filter((a) => a.type !== 'video');
      if (append || (result.assets.length > 1 && photos.length > 1)) {
        // Varias fotos: la primera es la principal; los vídeos van de uno en uno.
        const uris = photos.map((a) => a.uri);
        if (append && media?.kind === 'photo') {
          setExtra((list) => [...list, ...uris].slice(0, 9));
        } else {
          setMedia({ uri: uris[0], kind: 'photo', mime: 'image/jpeg' });
          setExtra(uris.slice(1, 10));
        }
        if (photos.length < result.assets.length) {
          setNotice('Los vídeos van de uno en uno: se han añadido solo las fotos.');
        }
        return;
      }
      setExtra([]);
      const asset = result.assets[0];
      if (remembering && asset.type !== 'video') {
        // La fecha en que se hizo la foto, si la guarda.
        const taken = dateFromPickerExif(asset.exif) ?? (await dateFromFile(asset.uri));
        if (taken) {
          setWhen(new Date(taken));
          setDateFromPhoto(true);
        } else setDateFromPhoto(false);
      }
      if (asset.type !== 'video') {
        setMedia({ uri: asset.uri, kind: 'photo', mime: 'image/jpeg' });
        return;
      }
      const duration = secondsOf(asset.duration);
      if (duration && duration > MAX_VIDEO + 1) {
        setNotice(
          `Ese vídeo dura ${Math.round(duration)} segundos y el máximo son ${MAX_VIDEO}. Recórtalo en tu galería y vuelve a elegirlo.`,
        );
        return;
      }
      if (asset.fileSize && asset.fileSize > 50 * 1024 * 1024) {
        setNotice('Ese vídeo pesa más de 50 MB. Prueba con uno más corto o con menos calidad.');
        return;
      }
      setPreparing(true);
      const poster = await videoPoster(asset.uri);
      setMedia({
        uri: asset.uri,
        kind: 'video',
        mime: asset.mimeType ?? 'video/mp4',
        duration,
        poster,
      });
      setPreparing(false);
    } catch {
      setPreparing(false);
      setNotice('No se ha podido abrir la cámara o la galería en este dispositivo.');
    }
  };

  const publish = async () => {
    setNotice('');
    setBusy(true);
    try {
      await addMoment({
        groupId,
        proposalId: proposal?.id,
        media,
        voice: voice.result,
        text: text.trim() || undefined,
        place: place ?? undefined,
        rememberedAt: remembering ? when.getTime() : undefined,
        morePhotos: media?.kind === 'photo' && extra.length ? extra : undefined,
      });
      setSent(true);
    } catch (error) {
      setNotice(errorText(error));
      setBusy(false);
    }
  };

  const recording = voice.state === 'recording';
  const empty = !media && !preparing;
  const canSend = !busy && !preparing && !recording && (!!media || !!text.trim() || !!voice.result);

  // Las fuentes, como botones grandes dentro del marco vacío.
  const sources = remembering
    ? [
        { icon: ImageIcon, label: 'Galería', onPress: () => pick('library', 'any') },
        { icon: Camera, label: 'Hacer foto', onPress: () => pick('camera', 'photo') },
      ]
    : [
        { icon: Camera, label: 'Foto', onPress: () => pick('camera', 'photo') },
        { icon: Video, label: 'Vídeo', onPress: () => pick('camera', 'video') },
        { icon: ImageIcon, label: 'Galería', onPress: () => pick('library', 'any') },
        ...(voice.supported && !voice.result
          ? [{ icon: Mic, label: 'Voz', onPress: voice.start }]
          : []),
      ];

  return (
    <Screen
      header={
        <View style={styles.header}>
          <Button compact label="Cancelar" variant="quiet" onPress={() => router.back()} />
          <Button
            compact
            label={busy ? 'Guardando…' : remembering ? 'Guardar recuerdo' : 'Publicar'}
            disabled={!canSend}
            onPress={publish}
          />
        </View>
      }>
      <View style={{ gap: 12 }}>
        {/* El destino siempre a la vista antes de publicar. */}
        <Tag>Para {group.name}</Tag>
        <Title>
          {proposal ? proposal.title : remembering ? 'Un recuerdo' : 'Comparte un momento'}
        </Title>
        {remembering && (
          <Text style={{ color: theme.textSecondary, fontSize: 15, lineHeight: 21 }}>
            Una foto o un vídeo de antes. Se guardará en su fecha y aparecerá en la memoria, en el
            mapa y en «tal día como hoy».
          </Text>
        )}
      </View>

      {/* El marco: vacío con las fuentes grandes, o con la foto/vídeo elegido. */}
      <View style={[styles.stage, { backgroundColor: theme.card, boxShadow: theme.shadow }]}>
        {media?.kind === 'video' ? (
          <View style={[styles.preview, { overflow: 'hidden', backgroundColor: '#000' }]}>
            <InlineVideo uri={media.uri} />
            {!!media.duration && (
              <Text style={styles.videoTag}>▶ {Math.round(media.duration)} s</Text>
            )}
          </View>
        ) : media ? (
          <Image source={{ uri: media.uri }} style={styles.preview} contentFit="cover" />
        ) : (
          <View style={[styles.preview, styles.empty, { backgroundColor: theme.soft }]}>
            {preparing ? (
              <Text style={{ color: theme.textSecondary, fontSize: 15 }}>Preparando el vídeo…</Text>
            ) : recording ? (
              <Text style={{ color: theme.textSecondary, fontSize: 15 }}>Grabando tu voz…</Text>
            ) : (
              <View style={styles.sourceGrid}>
                {sources.map((s) => (
                  <View key={s.label} style={styles.sourceCell}>
                    <PressScale
                      accessibilityRole="button"
                      accessibilityLabel={s.label}
                      onPress={s.onPress}
                      style={[styles.source, { backgroundColor: theme.card }]}>
                      <Icon icon={s.icon} size={28} color={theme.text} />
                      <Text style={[styles.sourceLabel, { color: theme.text }]}>{s.label}</Text>
                    </PressScale>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
        {media && (
          <View style={styles.floating}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cambiar"
              onPress={() => pick('library', 'any')}
              style={styles.floatButton}>
              <Text style={styles.floatText}>Cambiar</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quitar"
              onPress={() => {
                setMedia(undefined);
                setExtra([]);
              }}
              style={styles.floatButton}>
              <Icon icon={X} size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        )}
      </View>
      {/* Varias fotos: la tira de miniaturas, para quitar o añadir. */}
      {media?.kind === 'photo' && !remembering && (
        <View style={styles.thumbs}>
          {[media.uri, ...extra].map((uri, i) => (
            <View key={uri + i} style={styles.thumb}>
              <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              {i > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Quitar la foto ${i + 1}`}
                  onPress={() => setExtra((list) => list.filter((_, k) => k !== i - 1))}
                  style={styles.thumbRemove}>
                  <Icon icon={X} size={12} color="#FFFFFF" />
                </Pressable>
              )}
            </View>
          ))}
          {extra.length < 9 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Añadir más fotos"
              onPress={() => pick('library', 'photo', true)}
              style={[styles.thumb, styles.thumbAdd, { backgroundColor: theme.soft }]}>
              <Icon icon={Plus} size={20} color={theme.text} />
            </Pressable>
          )}
        </View>
      )}
      <Notice>{notice}</Notice>

      {/* Nota de voz: grabando, o ya grabada. */}
      {recording && (
        <View style={[styles.recording, { backgroundColor: theme.card }]}>
          <View style={styles.redDot} />
          <View style={styles.liveBars}>
            {Array.from(
              { length: 48 },
              (_, i) => voice.levels[i - (48 - voice.levels.length)] ?? 0,
            ).map((v, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: Math.max(3, (v / 100) * 30),
                  borderRadius: 2,
                  backgroundColor: '#E2703A',
                }}
              />
            ))}
          </View>
          <Text style={{ color: theme.text, fontVariant: ['tabular-nums'], fontSize: 15 }}>
            {mmss(voice.seconds)} / 2:00
          </Text>
          <Button compact label="Parar" onPress={voice.stop} />
        </View>
      )}
      {voice.result && !recording && (
        <View style={{ gap: 8 }}>
          <VoiceNote voice={voice.result} />
          <Button compact variant="quiet" label="Quitar la nota de voz" onPress={voice.reset} />
        </View>
      )}
      {!!voice.error && <Notice>{voice.error}</Notice>}

      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={remembering ? '¿Qué pasó aquel día?' : 'Cuéntalo, si te apetece…'}
        placeholderTextColor={theme.textSecondary}
        multiline
        style={[styles.input, { color: theme.text, backgroundColor: theme.card }]}
      />

      {remembering && (
        <View style={{ gap: 8 }}>
          <DatePick value={when} onChange={(d) => setWhen(d)} label="¿Cuándo fue?" />
          {dateFromPhoto && (
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
              Fecha leída de la foto. Cámbiala si no es esa
            </Text>
          )}
        </View>
      )}

      {/* Lugar: solo si se quiere, y a nivel de ciudad. */}
      {picking ? (
        <CityPicker
          value={place}
          onChange={(p) => {
            setPlace(p);
            setPicking(false);
          }}
          label={remembering ? '¿Dónde fue?' : '¿Dónde estás?'}
          clear="Sin lugar"
          startOpen
          onClose={() => setPicking(false)}
        />
      ) : (
        <View style={styles.chips}>
          {place ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quitar el lugar"
              onPress={() => setPlace(null)}
              style={[styles.chip, { backgroundColor: theme.card }]}>
              <Icon icon={MapPin} size={16} color={theme.text} />
              <Text style={{ color: theme.text, fontSize: 15 }}>
                {place.name}
                {place.country ? `, ${place.country}` : ''}
              </Text>
              <Icon icon={X} size={16} />
            </Pressable>
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={() => setPicking(true)}
                style={[styles.chip, { backgroundColor: theme.card }]}>
                <Icon icon={MapPin} size={16} color={theme.text} />
                <Text style={{ color: theme.text, fontSize: 15 }}>
                  {remembering ? '¿Dónde fue?' : 'Añadir lugar'}
                </Text>
              </Pressable>
              {home && !remembering && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setPlace(home)}
                  style={[styles.chip, { backgroundColor: theme.soft }]}>
                  <Text style={{ color: theme.textSecondary, fontSize: 15 }}>En {home.name}</Text>
                </Pressable>
              )}
            </>
          )}
          {!empty && voice.supported && !voice.result && !recording && !remembering && (
            <Pressable
              accessibilityRole="button"
              onPress={voice.start}
              style={[styles.chip, { backgroundColor: theme.card }]}>
              <Icon icon={Mic} size={16} color={theme.text} />
              <Text style={{ color: theme.text, fontSize: 15 }}>Añadir voz</Text>
            </Pressable>
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.two },
  stage: { borderRadius: Radius.frame, padding: 12 },
  preview: { width: '100%', aspectRatio: 4 / 5, borderRadius: Radius.inner },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 20 },
  sourceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    width: '100%',
  },
  sourceCell: { width: '45%' },
  source: {
    width: '100%',
    aspectRatio: 1.15,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    boxShadow: '0 8px 20px rgba(20,22,26,0.06)',
  },
  sourceLabel: { fontSize: 17, fontWeight: '500' },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: 56, height: 56, borderRadius: 12, overflow: 'hidden' },
  thumbAdd: { alignItems: 'center', justifyContent: 'center' },
  thumbRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(20,22,26,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floating: { position: 'absolute', top: 22, right: 22, flexDirection: 'row', gap: 8 },
  floatButton: {
    height: 36,
    minWidth: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,22,26,0.55)',
  },
  floatText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  videoTag: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  recording: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 999,
    boxShadow: '0 10px 24px rgba(20,22,26,0.1)',
  },
  redDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E5484D' },
  liveBars: { flex: 1, height: 30, flexDirection: 'row', alignItems: 'center', gap: 2 },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  chip: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    minHeight: 100,
    fontSize: 17,
    lineHeight: 24,
    borderRadius: Radius.inner,
    padding: 20,
    textAlignVertical: 'top',
  },
});
