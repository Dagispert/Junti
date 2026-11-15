import { Check, Download, Share2, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { popIn } from './motion';

import { Hand, HandBold } from '@/constants/theme';
import { NO_REC } from '@/lib/dom-recorder';
import { shareFile } from '@/lib/export-media';

import { Icon } from './icon';

type State =
  | { phase: 'idle' }
  | { phase: 'working'; progress: number; what: 'video' | 'photo' }
  | { phase: 'recording'; progress: number; cancel: () => void }
  | {
      phase: 'options';
      title: string;
      choices: { label: string; on: boolean }[];
      action: string;
      go: (values: boolean[]) => void;
    }
  | {
      phase: 'ready';
      blob: Blob;
      name: string;
      title: string;
      preview?: string;
      what: 'video' | 'photo';
    }
  | { phase: 'error'; message: string };

/**
 * Exportar: mientras se prepara, el progreso (y cancelar); cuando está, una
 * vista previa con «Compartir» (el menú del teléfono) y «Guardar».
 */
export function useExport() {
  const [state, setState] = useState<State>({ phase: 'idle' });
  const abort = useRef<AbortController | null>(null);

  const run = async (
    what: 'video' | 'photo',
    make: (ctl: { signal: AbortSignal; progress: (p: number) => void }) => Promise<Blob>,
    name: string,
    title: string,
  ) => {
    abort.current = new AbortController();
    setState({ phase: 'working', progress: 0, what });
    try {
      const blob = await make({
        signal: abort.current.signal,
        progress: (p) => setState((s) => (s.phase === 'working' ? { ...s, progress: p } : s)),
      });
      const preview = URL.createObjectURL(blob);
      const ext = blob.type.includes('mp4')
        ? 'mp4'
        : blob.type.includes('webm')
          ? 'webm'
          : blob.type.includes('png')
            ? 'png'
            : 'jpg';
      setState({ phase: 'ready', blob, name: `${name}.${ext}`, title, preview, what });
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') setState({ phase: 'idle' });
      else
        setState({
          phase: 'error',
          message:
            (error as Error)?.message || 'No se ha podido preparar. Prueba otra vez en un momento.',
        });
    }
  };

  // Antes de crear: elegir qué incluir.
  const choose = (o: {
    title: string;
    choices: { label: string; on: boolean }[];
    action: string;
    go: (values: boolean[]) => void;
  }) => setState({ phase: 'options', ...o });

  // Grabación en directo: la pantalla se ve tal cual y arriba, un aviso discreto.
  const recording = (cancel: () => void) => setState({ phase: 'recording', progress: 0, cancel });
  const progress = (p: number) =>
    setState((s) =>
      s.phase === 'recording' && Math.abs(s.progress - p) >= 0.01 ? { ...s, progress: p } : s,
    );
  const ready = (blob: Blob, name: string, title: string) => {
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    setState({
      phase: 'ready',
      blob,
      name: `${name}.${ext}`,
      title,
      preview: URL.createObjectURL(blob),
      what: 'video',
    });
  };

  const close = () => {
    if (state.phase === 'recording') state.cancel();
    abort.current?.abort();
    if (state.phase === 'ready' && state.preview) URL.revokeObjectURL(state.preview);
    setState({ phase: 'idle' });
  };

  const overlay =
    state.phase === 'idle' ? null : state.phase === 'recording' ? (
      <View {...NO_REC} style={styles.recBar} pointerEvents="box-none">
        <View style={styles.recPill}>
          <View style={styles.recDot} />
          <Text style={styles.recText}>
            Grabando el vídeo · {Math.round(state.progress * 100)} %
          </Text>
          <Pressable accessibilityRole="button" onPress={close} hitSlop={8}>
            <Text style={[styles.recText, { textDecorationLine: 'underline' }]}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    ) : (
      <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut} style={styles.backdrop}>
        <Animated.View entering={popIn(0, 360)} style={styles.sheet}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={state.phase === 'working' ? 'Cancelar' : 'Cerrar'}
            onPress={close}
            style={styles.close}>
            <Icon icon={X} size={18} color="#1F2124" />
          </Pressable>
          {state.phase === 'working' && (
            <>
              <Text style={styles.title}>
                {state.what === 'video' ? 'Grabando vuestro vídeo…' : 'Preparando la foto…'}
              </Text>
              <Text style={styles.hint}>
                {state.what === 'video'
                  ? 'Se graba aquí mismo, en tiempo real: tarda lo que dura la narración. No cierres esta pantalla.'
                  : 'Un momento.'}
              </Text>
              {state.what === 'video' && (
                <View style={styles.bar}>
                  <View style={[styles.fill, { width: `${Math.round(state.progress * 100)}%` }]} />
                </View>
              )}
              {state.what === 'video' && (
                <Text style={styles.percent}>{Math.round(state.progress * 100)} %</Text>
              )}
            </>
          )}
          {state.phase === 'ready' && (
            <>
              <Text style={styles.title}>
                {state.what === 'video' ? 'Vuestro vídeo está listo' : 'Tu foto está lista'}
              </Text>
              {state.preview && state.what === 'photo' && (
                // eslint-disable-next-line jsx-a11y/alt-text
                <img src={state.preview} style={previewStyle} alt="Vista previa" />
              )}
              {state.preview && state.what === 'video' && (
                <video src={state.preview} style={previewStyle} controls playsInline muted />
              )}
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => shareFile(state.blob, state.name, state.title).catch(() => {})}
                  style={[styles.action, { backgroundColor: '#1F2124' }]}>
                  <Icon icon={Share2} size={18} color="#FFFFFF" />
                  <Text style={[styles.actionText, { color: '#FFFFFF' }]}>Compartir</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => download(state.blob, state.name)}
                  style={[styles.action, { backgroundColor: '#EDEDEF' }]}>
                  <Icon icon={Download} size={18} color="#1F2124" />
                  <Text style={styles.actionText}>Guardar</Text>
                </Pressable>
              </View>
            </>
          )}
          {state.phase === 'options' && (
            <>
              <Text style={styles.title}>{state.title}</Text>
              {state.choices.map((c, i) => (
                <Pressable
                  key={c.label}
                  accessibilityRole="checkbox"
                  aria-checked={c.on}
                  onPress={() =>
                    setState((s) =>
                      s.phase === 'options'
                        ? {
                            ...s,
                            choices: s.choices.map((x, k) => (k === i ? { ...x, on: !x.on } : x)),
                          }
                        : s,
                    )
                  }
                  style={styles.choice}>
                  <View style={[styles.box, c.on && styles.boxOn]}>
                    {c.on && <Icon icon={Check} size={14} color="#FFFFFF" />}
                  </View>
                  <Text style={styles.choiceText}>{c.label}</Text>
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                onPress={() => state.go(state.choices.map((c) => c.on))}
                style={[styles.action, { backgroundColor: '#1F2124', flex: 0 }]}>
                <Text style={[styles.actionText, { color: '#FFFFFF' }]}>{state.action}</Text>
              </Pressable>
            </>
          )}
          {state.phase === 'error' && (
            <>
              <Text style={styles.title}>No ha salido</Text>
              <Text style={styles.hint}>{state.message}</Text>
            </>
          )}
        </Animated.View>
      </Animated.View>
    );

  return {
    run,
    choose,
    recording,
    progress,
    ready,
    fail: (message: string) => setState({ phase: 'error', message }),
    overlay,
    busy: state.phase === 'working' || state.phase === 'recording',
    live: state.phase === 'recording',
  };
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

const previewStyle = {
  width: '100%',
  maxHeight: 360,
  objectFit: 'contain' as const,
  borderRadius: 14,
  background: '#EFE4D2',
};

const styles = StyleSheet.create({
  recBar: {
    position: 'fixed' as 'absolute',
    top: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 210,
  },
  recPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(20,22,26,0.82)',
  },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E5484D' },
  recText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  // Fija en la pantalla (aunque la página tenga scroll).
  backdrop: {
    position: 'fixed' as 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(20,22,26,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 200,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FBF7F0',
    borderRadius: 26,
    padding: 22,
    gap: 14,
    boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
  },
  close: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EDE6DA',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  title: { fontFamily: HandBold, fontSize: 34, color: '#1F2124', paddingRight: 36 },
  hint: { fontSize: 15, lineHeight: 21, color: '#5A6168' },
  bar: { height: 10, borderRadius: 5, backgroundColor: '#E6DCCB', overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5, backgroundColor: '#C2477A' },
  percent: { fontFamily: Hand, fontSize: 22, color: '#5A6168', textAlign: 'right' },
  actions: { flexDirection: 'row', gap: 10 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  box: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#B9B2A6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: '#1F2124', borderColor: '#1F2124' },
  choiceText: { fontSize: 16, color: '#1F2124', flex: 1 },
  action: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { fontSize: 16, fontWeight: '600', color: '#1F2124' },
});
