import { router, useLocalSearchParams } from 'expo-router';
import { BookOpen, Lock, Mic, Pause, Play, Square } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { VoiceNote } from '@/components/media-players';
import { Avatar, Button, Notice, Screen, Tag } from '@/components/ui';
import { Hand, Spacing, useTheme } from '@/constants/theme';
import { errorText, useStore } from '@/data/store';
import type { Moment } from '@/data/types';
import { idParaPublicar } from '@/lib/cola';
import { mmss } from '@/lib/music';
import { markRead } from '@/lib/notifications';
import { useVoiceRecorder } from '@/lib/recorder';
import { daysLeft } from '@/lib/time';

/** Lo que puede durar cada trozo. */
const MAX_S = 45;

/**
 * El cuento a trozos: la primera frase, y cada uno graba cómo sigue oyendo solo
 * el trozo anterior. Al terminar el plazo se escucha entero, trozo a trozo.
 */
export default function Cuento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useEffect(() => {
    if (id) markRead(`proposal:${id}`);
  }, [id]);
  const theme = useTheme();
  const { proposals, moments, me, user, addMoment } = useStore();
  const proposal = proposals.find((p) => p.id === id);
  const juego = proposal?.juego;
  const trozos = useMemo(
    () =>
      moments.filter((m) => m.proposalId === id && m.voice).sort((a, b) => a.sharedAt - b.sharedAt),
    [moments, id],
  );
  const voz = useVoiceRecorder();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  // como mucho MAX_S segundos por trozo
  useEffect(() => {
    if (voz.state === 'recording' && voz.seconds >= MAX_S) voz.stop();
  }, [voz]);

  if (!proposal || !juego)
    return (
      <Screen>
        <Text style={{ color: theme.text, fontSize: 17 }}>Este cuento ya no está.</Text>
        <Button label="Volver" variant="quiet" onPress={() => router.back()} />
      </Screen>
    );

  const abierto = !proposal.endsAt || proposal.endsAt > Date.now();
  const ultimo = trozos.at(-1);
  const meToca = abierto && ultimo?.authorId !== me;
  const primero = (uid?: string) => (uid ? user(uid).name.split(' ')[0] : 'Junti');
  const quedan = proposal.endsAt ? daysLeft(proposal.endsAt) : undefined;

  const enviar = async () => {
    if (!voz.result) return;
    setBusy(true);
    setNotice('');
    try {
      await addMoment({
        id: idParaPublicar(),
        groupId: proposal.groupId,
        proposalId: proposal.id,
        voice: voz.result,
      });
      voz.reset();
    } catch (e) {
      setNotice(errorText(e));
    }
    setBusy(false);
  };

  return (
    <Screen
      header={
        <View style={styles.header}>
          <Button compact label="Cerrar" variant="quiet" onPress={() => router.back()} />
        </View>
      }>
      <View style={{ gap: 10 }}>
        <Tag>
          {abierto
            ? quedan
              ? `El cuento a trozos · ${quedan === 1 ? 'queda 1 día' : `quedan ${quedan} días`}`
              : 'El cuento a trozos'
            : 'El cuento a trozos · terminado'}
        </Tag>
      </View>

      {/* La primera frase, como escrita a mano en un papel */}
      <View style={[styles.papel, { backgroundColor: theme.card, boxShadow: theme.shadow }]}>
        <Icon icon={BookOpen} size={20} color={theme.textSecondary} />
        <Text style={[styles.inicio, { color: theme.text }]}>{juego.inicio}</Text>
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
          Lo empezó {primero(proposal.createdBy)}
        </Text>
      </View>

      {abierto ? (
        <>
          {/* Lo que no se oye todavía: los trozos de antes del último */}
          {trozos.length > 1 && (
            <View style={[styles.escondidos, { backgroundColor: theme.soft }]}>
              <Icon icon={Lock} size={16} color={theme.textSecondary} />
              <View style={{ flexDirection: 'row' }}>
                {trozos.slice(0, -1).map((t, i) => (
                  <View key={t.id} style={{ marginLeft: i ? -8 : 0 }}>
                    <Avatar userId={t.authorId} size={26} />
                  </View>
                ))}
              </View>
              <Text style={{ color: theme.textSecondary, fontSize: 14, flex: 1 }}>
                {trozos.length - 1 === 1
                  ? '1 trozo escondido hasta el final'
                  : `${trozos.length - 1} trozos escondidos hasta el final`}
              </Text>
            </View>
          )}

          {ultimo ? (
            <View style={{ gap: 8 }}>
              <Text style={[styles.subtitulo, { color: theme.text }]}>
                {ultimo.authorId === me
                  ? 'Tu trozo'
                  : `Así sigue, según ${primero(ultimo.authorId)}`}
              </Text>
              <View style={styles.fila}>
                <Avatar userId={ultimo.authorId} size={36} />
                <View style={{ flex: 1 }}>
                  <VoiceNote voice={ultimo.voice!} />
                </View>
              </View>
            </View>
          ) : (
            <Text style={{ color: theme.textSecondary, fontSize: 16 }}>
              Nadie lo ha seguido aún. ¡Te toca!
            </Text>
          )}

          {meToca ? (
            <View style={[styles.grabar, { backgroundColor: theme.card, boxShadow: theme.shadow }]}>
              <Text style={[styles.subtitulo, { color: theme.text }]}>
                {ultimo ? '¿Y luego qué pasó?' : '¿Cómo sigue?'}
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 15, lineHeight: 21 }}>
                Graba cómo sigue el cuento (hasta {MAX_S} segundos). Quien venga después solo oirá
                tu trozo.
              </Text>
              {!voz.supported ? (
                <Text style={{ color: theme.textSecondary }}>
                  Este navegador no deja grabar la voz.
                </Text>
              ) : voz.state === 'recording' ? (
                <View style={{ alignItems: 'center', gap: 10 }}>
                  <View style={styles.ondas}>
                    {Array.from({ length: 32 }, (_, i) => (
                      <View
                        key={i}
                        style={{
                          width: 4,
                          borderRadius: 2,
                          backgroundColor: '#E2603F',
                          height: 6 + (voz.levels[i - (32 - voz.levels.length)] ?? 0) * 40,
                        }}
                      />
                    ))}
                  </View>
                  <Text style={{ color: theme.text, fontVariant: ['tabular-nums'] }}>
                    {mmss(voz.seconds)} / {mmss(MAX_S)}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Parar"
                    onPress={voz.stop}
                    style={[styles.mic, { backgroundColor: '#E2603F' }]}>
                    <Icon icon={Square} size={26} color="#FFFFFF" />
                  </Pressable>
                </View>
              ) : voz.result ? (
                <View style={{ gap: 10 }}>
                  <VoiceNote voice={voz.result} />
                  <View style={styles.fila}>
                    <Button
                      compact
                      label={busy ? 'Enviando…' : 'Enviar mi trozo'}
                      disabled={busy}
                      onPress={enviar}
                    />
                    <Button compact variant="quiet" label="Repetir" onPress={voz.reset} />
                  </View>
                </View>
              ) : (
                <View style={{ alignItems: 'center', gap: 8 }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Grabar mi trozo"
                    onPress={voz.start}
                    style={[styles.mic, { backgroundColor: theme.accent }]}>
                    <Icon icon={Mic} size={28} color={theme.onAccent} />
                  </Pressable>
                  <Text style={{ color: theme.textSecondary, fontSize: 14 }}>Toca para grabar</Text>
                </View>
              )}
              {!!voz.error && <Notice>{voz.error}</Notice>}
            </View>
          ) : (
            <Text style={{ color: theme.textSecondary, fontSize: 15, lineHeight: 21 }}>
              Ya has seguido el cuento. Ahora le toca a otra persona; si después te toca otra vez,
              podrás seguirlo de nuevo.
            </Text>
          )}
          <Notice>{notice}</Notice>
        </>
      ) : (
        <CuentoEntero inicio={juego.inicio} trozos={trozos} />
      )}
    </Screen>
  );
}

/** El cuento ya terminado: se escucha entero, trozo a trozo. */
function CuentoEntero({ inicio, trozos }: { inicio: string; trozos: Moment[] }) {
  const theme = useTheme();
  const { user } = useStore();
  const [sonando, setSonando] = useState<number | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const vivo = useRef(true);
  useEffect(
    () => () => {
      vivo.current = false;
      audio.current?.pause();
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    },
    [],
  );

  const parar = () => {
    vivo.current = false;
    audio.current?.pause();
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    setSonando(null);
  };

  const escuchar = async () => {
    vivo.current = true;
    // la primera frase, leída en voz alta (si el móvil sabe)
    setSonando(-1);
    if (typeof speechSynthesis !== 'undefined') {
      await new Promise<void>((ok) => {
        const u = new SpeechSynthesisUtterance(inicio);
        u.lang = 'es-ES';
        u.onend = () => ok();
        u.onerror = () => ok();
        speechSynthesis.speak(u);
        setTimeout(ok, 15000);
      });
    }
    for (let i = 0; i < trozos.length && vivo.current; i++) {
      setSonando(i);
      await new Promise<void>((ok) => {
        const a = new Audio(trozos[i].voice!.uri);
        audio.current = a;
        a.onended = () => ok();
        a.onerror = () => ok();
        a.play().catch(() => ok());
      });
      if (vivo.current) await new Promise((r) => setTimeout(r, 350));
    }
    if (vivo.current) setSonando(null);
  };

  if (!trozos.length)
    return (
      <Text style={{ color: theme.textSecondary, fontSize: 16 }}>
        Este cuento terminó sin que nadie lo siguiera.
      </Text>
    );

  return (
    <View style={{ gap: Spacing.three }}>
      <Pressable
        accessibilityRole="button"
        onPress={sonando === null ? escuchar : parar}
        style={[styles.grande, { backgroundColor: theme.accent }]}>
        <Icon icon={sonando === null ? Play : Pause} size={20} color={theme.onAccent} />
        <Text style={{ color: theme.onAccent, fontSize: 17, fontWeight: '600' }}>
          {sonando === null ? 'Escuchar el cuento entero' : 'Parar'}
        </Text>
      </Pressable>
      {trozos.map((t, i) => (
        <Animated.View
          key={t.id}
          entering={FadeInDown.delay(60 * i).duration(300)}
          style={[
            styles.trozo,
            {
              backgroundColor: theme.card,
              borderColor: sonando === i ? theme.accent : 'transparent',
            },
          ]}>
          <View style={styles.fila}>
            <Avatar userId={t.authorId} size={32} />
            <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600', flex: 1 }}>
              {i + 1}. {user(t.authorId).name.split(' ')[0]}
            </Text>
          </View>
          <VoiceNote voice={t.voice!} />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'flex-start', paddingVertical: Spacing.two },
  papel: { borderRadius: 22, padding: 22, gap: 10, transform: [{ rotate: '-0.5deg' }] },
  inicio: { fontFamily: Hand, fontSize: 28, lineHeight: 32 },
  escondidos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    padding: 12,
  },
  subtitulo: { fontSize: 18, fontWeight: '600' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  grabar: { borderRadius: 24, padding: 20, gap: 12 },
  ondas: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 52 },
  mic: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  grande: {
    height: 54,
    borderRadius: 27,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  trozo: { borderRadius: 20, padding: 14, gap: 10, borderWidth: 2 },
});
