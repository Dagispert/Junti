import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { SendCinematic } from '@/components/cinematics';
import { CityPicker } from '@/components/city-picker';
import { useGroupPeople } from '@/components/connection-card';
import { DatePick } from '@/components/date-pick';
import { Icon } from '@/components/icon';
import { type Clip, InlineVideo, VoiceNote } from '@/components/media-players';
import { PhotoCropper } from '@/components/photo-cropper';
import { VideoTrimmer } from '@/components/video-trimmer';
import { PressScale } from '@/components/motion';
import { Button, Notice, ProgressButton, Screen, Tag, Title } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { errorText, useStore } from '@/data/store';
import { dateFromFile, dateFromPickerExif } from '@/lib/exif';
import type { Place } from '@/lib/geo';
import { secondsOf, videoLength, videoPoster } from '@/lib/media';
import { mmss } from '@/lib/music';
import { useVoiceRecorder } from '@/lib/recorder';
import { dateFromWhatsAppName, takeHandOff } from '@/lib/shared';
import { Camera, Crop, ImageIcon, MapPin, Mic, Play, Plus, Video, X } from 'lucide-react-native';

/** Lo que se enseña de un vídeo, como mucho (se elige el tramo). */
const MAX_VIDEO = 30;
/** El vídeo de partida puede ser más largo: se elige qué parte se ve. */
const MAX_SOURCE = 10 * 60;

type Media = {
  uri: string;
  kind: 'photo' | 'video';
  mime?: string;
  duration?: number;
  poster?: string;
  /** El tramo del vídeo que se enseña. */
  clip?: Clip;
};

/**
 * Compartir un momento (foto, vídeo, voz y/o texto) o, con «memory», añadir un
 * recuerdo de antes que se guarda en su fecha.
 */
export default function Publish() {
  const { groupId, proposalId, memory, year, addTo } = useLocalSearchParams<{
    groupId: string;
    proposalId?: string;
    memory?: string;
    /** Añadir mi versión a este recuerdo (de otra persona). */
    addTo?: string;
    /** Un recuerdo de un año concreto (al rellenar un hueco de la historia). */
    year?: string;
  }>();
  const adding = !!addTo;
  // Una versión se elige como un recuerdo (galería o cámara), pero sin fecha ni lugar propios.
  const remembering = memory === '1' || adding;
  const theme = useTheme();
  const {
    group: groupById,
    proposals,
    addMoment,
    addMemoryAddition,
    moments,
    me,
    user,
  } = useStore();
  const target = adding ? moments.find((m) => m.id === addTo) : undefined;
  const meUser = user(me);
  const home: Place | null =
    meUser.lat != null && meUser.lng != null
      ? { name: meUser.city, country: meUser.country, lat: meUser.lat, lng: meUser.lng }
      : null;
  const [busy, setBusy] = useState(false);
  // Fotos y vídeos, mezclados (hasta 10). «sel» es el que se ve en grande.
  const [items, setItems] = useState<Media[]>([]);
  const [sel, setSel] = useState(0);
  const media: Media | undefined = items[Math.min(sel, items.length - 1)];
  const current = Math.min(sel, Math.max(0, items.length - 1));
  const update = (i: number, change: Partial<Media>) =>
    setItems((list) => list.map((m, k) => (k === i ? { ...m, ...change } : m)));
  const [preparing, setPreparing] = useState(false);
  const voice = useVoiceRecorder();
  const [text, setText] = useState('');
  const [notice, setNotice] = useState('');
  const [place, setPlace] = useState<Place | null>(null);
  const [picking, setPicking] = useState(false);
  // Recuerdo: cuándo fue (por defecto, hace un año) y si la fecha salió de la foto.
  const [when, setWhen] = useState(() => {
    const d = new Date();
    if (year && /^\d{4}$/.test(year)) d.setFullYear(Number(year), 6, 1);
    else d.setFullYear(d.getFullYear() - 1);
    d.setHours(12, 0, 0, 0);
    return d;
  });
  const [dateFromPhoto, setDateFromPhoto] = useState(false);
  // La foto que se está recortando (su posición en la lista).
  const [cropping, setCropping] = useState<number | null>(null);
  // Lo que llega compartido desde otra app (WhatsApp…), ya puesto.
  useEffect(() => {
    const s = takeHandOff();
    if (!s) return;
    if (s.text) setText(s.text.slice(0, 2000));
    if (!s.items.length) return;
    // un recuerdo: la fecha que trae el nombre del archivo de WhatsApp
    if (remembering) {
      const taken = s.items.map((it) => dateFromWhatsAppName(it.name)).find((d) => d);
      if (taken) {
        setWhen(new Date(taken));
        setDateFromPhoto(true);
      }
    }
    (async () => {
      const list: Media[] = [];
      for (const it of s.items) {
        if (it.kind === 'photo') list.push({ uri: it.uri, kind: 'photo', mime: it.mime });
        else
          list.push({
            uri: it.uri,
            kind: 'video',
            mime: it.mime,
            duration: await videoLength(it.uri),
            poster: await videoPoster(it.uri),
          });
      }
      setItems(list);
      setSel(0);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const group = groupById(groupId);
  const proposal = proposals.find((p) => p.id === proposalId);
  const people = useGroupPeople(group);
  const [sent, setSent] = useState(false);
  const leave = useCallback(() => router.back(), []);
  if (!group) return null;

  if (cropping !== null && items[cropping]?.kind === 'photo') {
    return (
      <PhotoCropper
        uri={items[cropping].uri}
        onCancel={() => setCropping(null)}
        onDone={(cropped) => {
          update(cropping, { uri: cropped });
          setCropping(null);
        }}
      />
    );
  }

  if (sent) {
    return (
      <View style={{ flex: 1, backgroundColor: '#070A14' }}>
        <SendCinematic people={people} groupName={group.name} onDone={leave} />
      </View>
    );
  }

  /** Un vídeo elegido: comprueba su duración y su peso, y prepara su portada. */
  const prepareVideo = async (asset: ImagePicker.ImagePickerAsset): Promise<Media | string> => {
    const duration = secondsOf(asset.duration) ?? (await videoLength(asset.uri));
    if (duration && duration > MAX_SOURCE + 1)
      return `Un vídeo dura ${Math.round(duration / 60)} minutos: elige vídeos de como mucho ${MAX_SOURCE / 60} minutos y luego la parte que quieres enseñar.`;
    if (asset.fileSize && asset.fileSize > 50 * 1024 * 1024)
      return 'Un vídeo pesa más de 50 MB. Prueba con uno más corto o con menos calidad.';
    const poster = await videoPoster(asset.uri);
    return {
      uri: asset.uri,
      kind: 'video',
      mime: asset.mimeType ?? 'video/mp4',
      duration,
      poster,
      clip: duration ? { start: 0, end: Math.min(duration, MAX_VIDEO) } : undefined,
    };
  };

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
      const room = append ? 10 - items.length : 10;
      if (room <= 0) return;
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes:
          want === 'photo' ? ['images'] : want === 'video' ? ['videos'] : ['images', 'videos'],
        quality: 0.8,
        exif: remembering,
        // Desde la galería se pueden elegir varias fotos y vídeos a la vez.
        allowsMultipleSelection: source === 'library',
        selectionLimit: room,
        videoMaxDuration: MAX_SOURCE,
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
      };
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const picked = result.assets.slice(0, room);
      // Un recuerdo: la fecha de la primera foto que la guarde.
      if (remembering && !adding && !append) {
        let taken: number | undefined;
        for (const asset of picked.filter((a) => a.type !== 'video')) {
          taken = dateFromPickerExif(asset.exif) ?? (await dateFromFile(asset.uri)) ?? undefined;
          if (taken) break;
        }
        if (taken) {
          setWhen(new Date(taken));
          setDateFromPhoto(true);
        } else setDateFromPhoto(false);
      }
      const hasVideo = picked.some((a) => a.type === 'video');
      if (hasVideo) setPreparing(true);
      const added: Media[] = [];
      const problems: string[] = [];
      for (const asset of picked) {
        if (asset.type !== 'video') {
          added.push({ uri: asset.uri, kind: 'photo', mime: 'image/jpeg' });
          continue;
        }
        const video = await prepareVideo(asset);
        if (typeof video === 'string') problems.push(video);
        else added.push(video);
      }
      setPreparing(false);
      if (problems.length) setNotice(problems[0]);
      if (!added.length) return;
      if (append) {
        setItems((list) => [...list, ...added].slice(0, 10));
        setSel(items.length);
      } else {
        setItems(added);
        setSel(0);
      }
    } catch {
      setPreparing(false);
      setNotice('No se ha podido abrir la cámara o la galería en este dispositivo.');
    }
  };

  const publish = async () => {
    setNotice('');
    setBusy(true);
    try {
      // De cada vídeo, solo el tramo elegido (si no es el vídeo entero); la portada, de su inicio.
      const ready: Media[] = [];
      for (const m of items) {
        if (m.kind !== 'video' || !m.clip || !m.duration) {
          ready.push(m);
          continue;
        }
        const whole = m.clip.start < 0.05 && m.clip.end >= m.duration - 0.1;
        ready.push(
          whole
            ? { ...m, clip: undefined }
            : {
                ...m,
                poster:
                  m.clip.start > 0.2
                    ? ((await videoPoster(m.uri, m.clip.start)) ?? m.poster)
                    : m.poster,
              },
        );
      }
      if (adding) {
        await addMemoryAddition(addTo!, { text: text.trim() || undefined, items: ready });
        router.back();
        return;
      }
      await addMoment({
        groupId,
        proposalId: proposal?.id,
        media: ready[0],
        more: ready.slice(1),
        voice: voice.result,
        text: text.trim() || undefined,
        place: place ?? undefined,
        rememberedAt: remembering ? when.getTime() : undefined,
      });
      setSent(true);
    } catch (error) {
      setNotice(errorText(error));
      setBusy(false);
    }
  };

  const recording = voice.state === 'recording';
  const empty = !media && !preparing;
  const canSend =
    !busy && !preparing && !recording && (items.length > 0 || !!text.trim() || !!voice.result);

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
          {/* Al publicar, el botón se recoge en un círculo que carga. */}
          <ProgressButton
            label={adding ? 'Añadir mi versión' : remembering ? 'Guardar recuerdo' : 'Publicar'}
            busy={busy}
            disabled={!canSend}
            onPress={publish}
          />
        </View>
      }>
      <View style={{ gap: 12 }}>
        {/* El destino siempre a la vista antes de publicar. */}
        <Tag>Para {group.name}</Tag>
        <Title>
          {adding
            ? 'Tu versión'
            : proposal
              ? proposal.title
              : remembering
                ? 'Un recuerdo'
                : 'Comparte un momento'}
        </Title>
        {adding && (
          <Text style={{ color: theme.textSecondary, fontSize: 15, lineHeight: 21 }}>
            Cuenta cómo lo recuerdas tú y añade tus fotos o vídeos de aquel día. Se sumará al
            recuerdo de {target ? user(target.authorId).name.split(' ')[0] : 'tu grupo'}
            {target?.text ? ` («${target.text.slice(0, 60)}»)` : ''}.
          </Text>
        )}
        {remembering && !adding && (
          <Text style={{ color: theme.textSecondary, fontSize: 15, lineHeight: 21 }}>
            Fotos y vídeos de antes, todos los que quieras. Se guardará en su fecha y aparecerá en
            la memoria, en el mapa y en «tal día como hoy».
          </Text>
        )}
      </View>

      {/* El marco: vacío con las fuentes grandes, o con la foto/vídeo elegido. */}
      <View style={[styles.stage, { backgroundColor: theme.card, boxShadow: theme.shadow }]}>
        {media?.kind === 'video' ? (
          <View style={[styles.preview, { overflow: 'hidden', backgroundColor: '#000' }]}>
            <InlineVideo uri={media.uri} clip={media.clip} />
            {!!media.duration && (
              <Text style={styles.videoTag}>
                ▶ {Math.round(media.clip ? media.clip.end - media.clip.start : media.duration)} s
              </Text>
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
            {media.kind === 'photo' && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Recortar la foto"
                onPress={() => setCropping(current)}
                style={styles.floatButton}>
                <Icon icon={Crop} size={16} color="#FFFFFF" />
                <Text style={styles.floatText}>Recortar</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cambiar"
              onPress={() => pick('library', 'any')}
              style={styles.floatButton}>
              <Text style={styles.floatText}>Cambiar</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={items.length > 1 ? 'Quitar esta' : 'Quitar'}
              onPress={() => {
                setItems((list) => list.filter((_, k) => k !== current));
                setSel(Math.max(0, current - 1));
              }}
              style={styles.floatButton}>
              <Icon icon={X} size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        )}
      </View>
      {/* Vídeo: qué parte se enseña. */}
      {media?.kind === 'video' && media.clip && !!media.duration && media.duration > 1.5 && (
        <View style={{ gap: 6 }}>
          <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>
            ¿Qué parte del vídeo quieres enseñar?
          </Text>
          <VideoTrimmer
            uri={media.uri}
            duration={media.duration}
            value={media.clip}
            max={MAX_VIDEO}
            onChange={(clip) => update(current, { clip })}
          />
        </View>
      )}
      {/* La tira: fotos y vídeos, para elegir cuál se ve, recortarlo, quitarlo o añadir más. */}
      {items.length > 0 && (
        <View style={styles.thumbs}>
          {items.map((m, i) => (
            <View
              key={m.uri + i}
              style={[
                styles.thumb,
                i === current && { borderWidth: 2.5, borderColor: theme.text },
              ]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${m.kind === 'video' ? 'Vídeo' : 'Foto'} ${i + 1}`}
                onPress={() => (i === current && m.kind === 'photo' ? setCropping(i) : setSel(i))}
                style={StyleSheet.absoluteFill}>
                {(m.kind === 'photo' || m.poster) && (
                  <Image
                    source={{ uri: m.kind === 'photo' ? m.uri : m.poster }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                  />
                )}
                {m.kind === 'video' && (
                  <View style={[StyleSheet.absoluteFill, styles.thumbVideo]}>
                    <Icon icon={Play} size={16} color="#FFFFFF" />
                  </View>
                )}
              </Pressable>
              {items.length > 1 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Quitar ${m.kind === 'video' ? 'el vídeo' : 'la foto'} ${i + 1}`}
                  onPress={() => {
                    setItems((list) => list.filter((_, k) => k !== i));
                    if (current >= i) setSel(Math.max(0, current - 1));
                  }}
                  style={styles.thumbRemove}>
                  <Icon icon={X} size={12} color="#FFFFFF" />
                </Pressable>
              )}
            </View>
          ))}
          {items.length < 10 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Añadir más fotos o vídeos"
              onPress={() => pick('library', 'any', true)}
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
        placeholder={
          adding
            ? '¿Cómo lo recuerdas tú?'
            : remembering
              ? '¿Qué pasó aquel día?'
              : 'Cuéntalo, si te apetece…'
        }
        placeholderTextColor={theme.textSecondary}
        multiline
        style={[styles.input, { color: theme.text, backgroundColor: theme.card }]}
      />

      {remembering && !adding && (
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
      {adding ? null : picking ? (
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
  thumbVideo: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,22,26,0.35)',
  },
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
    flexDirection: 'row',
    gap: 6,
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
