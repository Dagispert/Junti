import { Mic, Scissors, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Radius, useTheme } from '@/constants/theme';
import { errorText, useStore } from '@/data/store';
import type { Moment } from '@/data/types';

import { Icon } from './icon';
import { type Clip, InlineVideo } from './media-players';
import { Notice } from './ui';
import { VideoTrimmer } from './video-trimmer';

const MAX_VIDEO = 30;

/**
 * Corregir un momento ya publicado (solo su autor): el texto, quitar la nota
 * de voz, elegir otra parte del vídeo o eliminarlo entero.
 */
export function MomentEditor({ moment, onClose }: { moment: Moment; onClose: () => void }) {
  const theme = useTheme();
  const { editMoment, removeVoice, setVideoClip, deleteMoment } = useStore();
  const [text, setText] = useState(moment.text ?? '');
  const full = moment.videoFullDuration ?? moment.videoDuration ?? 0;
  const [clip, setClip] = useState<Clip | null>(
    moment.videoClip ?? (full ? { start: 0, end: Math.min(full, MAX_VIDEO) } : null),
  );
  const [trimming, setTrimming] = useState(false);
  const [confirm, setConfirm] = useState<'voice' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const visual = !!(moment.imageUri || moment.videoUri);
  // Sin foto, vídeo ni voz, el texto no puede quedar vacío.
  const canSave = !!text.trim() || visual || !!moment.voice;

  const run = async (job: () => Promise<void>, close = true) => {
    setBusy(true);
    setNotice('');
    try {
      await job();
      if (close) onClose();
    } catch (error) {
      setNotice(errorText(error));
    }
    setBusy(false);
  };

  const save = () =>
    run(async () => {
      if (text.trim() !== (moment.text ?? '')) await editMoment(moment.id, text.trim());
      if (trimming && clip && moment.videoAssetId) {
        const whole = clip.start < 0.05 && clip.end >= full - 0.1;
        await setVideoClip(moment.videoAssetId, whole ? null : clip);
      }
    });

  return (
    <View style={styles.box}>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        maxLength={2000}
        placeholder="Escribe algo…"
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel="Texto del momento"
        style={[styles.input, { color: theme.text, backgroundColor: theme.soft }]}
      />

      {/* El vídeo: elegir otra parte. */}
      {!!moment.videoUri && !!moment.videoAssetId && full > 1.5 && clip && (
        <View style={{ gap: 8 }}>
          {!trimming ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setTrimming(true)}
              style={[styles.row, { backgroundColor: theme.soft }]}>
              <Icon icon={Scissors} size={18} color={theme.text} />
              <Text style={[styles.rowText, { color: theme.text }]}>
                Elegir qué parte del vídeo se ve
              </Text>
            </Pressable>
          ) : (
            <>
              <View style={styles.preview}>
                <InlineVideo uri={moment.videoUri} clip={clip} />
              </View>
              <VideoTrimmer
                uri={moment.videoUri}
                duration={full}
                value={clip}
                max={MAX_VIDEO}
                onChange={setClip}
              />
            </>
          )}
        </View>
      )}

      {/* La nota de voz: quitarla (si queda algo más en el momento). */}
      {!!moment.voice && (visual || !!moment.text) && (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() =>
            confirm === 'voice'
              ? run(() => removeVoice(moment.id), false).then(() => setConfirm(null))
              : setConfirm('voice')
          }
          style={[styles.row, { backgroundColor: theme.soft }]}>
          <Icon icon={Mic} size={18} color={confirm === 'voice' ? '#C2385A' : theme.text} />
          <Text style={[styles.rowText, { color: confirm === 'voice' ? '#C2385A' : theme.text }]}>
            {confirm === 'voice' ? 'Toca otra vez para quitarla' : 'Quitar la nota de voz'}
          </Text>
        </Pressable>
      )}

      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() =>
          confirm === 'delete' ? run(() => deleteMoment(moment.id)) : setConfirm('delete')
        }
        style={[styles.row, { backgroundColor: theme.soft }]}>
        <Icon icon={Trash2} size={18} color="#C2385A" />
        <Text style={[styles.rowText, { color: '#C2385A' }]}>
          {confirm === 'delete'
            ? '¿Seguro? Toca otra vez para eliminarlo'
            : 'Eliminar la publicación'}
        </Text>
      </Pressable>

      <Notice>{notice}</Notice>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={onClose} hitSlop={6}>
          <Text style={{ color: theme.textSecondary, fontSize: 15 }}>Cancelar</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy || !canSave}
          onPress={save}
          style={[
            styles.save,
            { backgroundColor: theme.accent, opacity: busy || !canSave ? 0.5 : 1 },
          ]}>
          <Text style={{ color: theme.onAccent, fontSize: 15, fontWeight: '600' }}>
            {busy ? 'Guardando…' : 'Guardar'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 10 },
  input: {
    minHeight: 64,
    fontSize: 15,
    lineHeight: 20,
    borderRadius: Radius.small,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  preview: {
    height: 200,
    borderRadius: Radius.small,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: Radius.small,
  },
  rowText: { fontSize: 15, fontWeight: '500' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 18 },
  save: { height: 40, paddingHorizontal: 18, borderRadius: Radius.pill, justifyContent: 'center' },
});
