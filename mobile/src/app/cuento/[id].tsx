import { router, useLocalSearchParams } from 'expo-router';
import { BookOpen, Lock, Mic, Pause, Play, Square } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ComentariosJuego } from '@/components/comentarios-juego';
import { Icon } from '@/components/icon';
import { VoiceNote } from '@/components/media-players';
import { Avatar, Button, Notice, Screen, Tag } from '@/components/ui';
import { Hand, Spacing, useTheme } from '@/constants/theme';
import { errorText, useStore } from '@/data/store';
import type { Moment } from '@/data/types';
import { idParaPublicar } from '@/lib/cola';
import { supabase } from '@/lib/supabase';
import { useCuentoEntero } from '@/lib/cuento-entero';
import { vozDelCuento } from '@/lib/ideas-retos';
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
  const { proposals, moments, me, user, addMoment, refresh } = useStore();
  const [terminando, setTerminando] = useState<'' | 'preguntar' | 'cerrando'>('');
  const proposal = proposals.find((p) => p.id === id);
  const juego = proposal?.juego;
  const trozos = useMemo(
    () =>
      moments.filter((m) => m.proposalId === id && m.voice).sort((a, b) => a.sharedAt - b.sharedAt),
    [moments, id],
  );
  const voz = useVoiceRecorder();
  // la primera frase, con la voz de la narradora (si el grupo la tiene activada)
  const [vozInicio, setVozInicio] = useState<string | null>(null);
  useEffect(() => {
    if (proposal?.juego && proposal.groupId)
      vozDelCuento(proposal.groupId, proposal.id).then(setVozInicio);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal?.id]);
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
        <View style={[styles.fila, { justifyContent: 'space-between' }]}>
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
            Lo empezó {primero(proposal.createdBy)}
          </Text>
          {!!vozInicio && <BotonNarradora src={vozInicio} />}
        </View>
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
                  ? '1 trozo escondido'
                  : `${trozos.length - 1} trozos escondidos`}
                {quedan
                  ? `: el cuento entero se podrá escuchar cuando termine (${quedan === 1 ? 'mañana' : `en ${quedan} días`})`
                  : ' hasta el final'}
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
                          // los niveles van de 0 a 100
                          height: Math.max(
                            4,
                            Math.min(
                              48,
                              ((voz.levels[i - (32 - voz.levels.length)] ?? 0) / 100) * 48,
                            ),
                          ),
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
          {/* quien lo empezó puede terminarlo antes del plazo */}
          {proposal.createdBy === me && trozos.length >= 2 && (
            <View style={{ gap: 8, alignItems: 'center' }}>
              {terminando === 'preguntar' ? (
                <>
                  <Text style={{ color: theme.textSecondary, fontSize: 14, textAlign: 'center' }}>
                    Nadie más podrá seguirlo y se podrá escuchar entero. ¿Lo terminamos?
                  </Text>
                  <View style={styles.fila}>
                    <Button
                      compact
                      label="Sí, terminarlo"
                      onPress={async () => {
                        setTerminando('cerrando');
                        const { error } = await supabase
                          .from('proposals')
                          .update({ ends_at: new Date().toISOString() })
                          .eq('id', proposal.id);
                        if (error) setNotice(errorText(error));
                        await refresh().catch(() => {});
                        setTerminando('');
                      }}
                    />
                    <Button
                      compact
                      variant="quiet"
                      label="Aún no"
                      onPress={() => setTerminando('')}
                    />
                  </View>
                </>
              ) : (
                <Button
                  compact
                  variant="quiet"
                  label={terminando === 'cerrando' ? 'Terminando…' : 'Terminar el cuento ya'}
                  disabled={terminando === 'cerrando'}
                  onPress={() => setTerminando('preguntar')}
                />
              )}
            </View>
          )}
        </>
      ) : (
        <CuentoEntero
          inicio={juego.inicio}
          vozInicio={vozInicio}
          trozos={trozos}
          groupId={proposal.groupId}
          proposalId={proposal.id}
        />
      )}
    </Screen>
  );
}

/** «Escuchar a la narradora»: la primera frase con su voz. */
function BotonNarradora({ src }: { src: string }) {
  const theme = useTheme();
  const [sonando, setSonando] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => audio.current?.pause(), []);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        if (sonando) {
          audio.current?.pause();
          setSonando(false);
          return;
        }
        const a = audio.current ?? new Audio(src);
        audio.current = a;
        a.currentTime = 0;
        a.onended = () => setSonando(false);
        a.play()
          .then(() => setSonando(true))
          .catch(() => setSonando(false));
      }}
      style={[styles.narradora, { backgroundColor: theme.soft }]}>
      <Icon icon={sonando ? Pause : Play} size={14} color={theme.text} />
      <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>
        {sonando ? 'Parar' : 'Escuchar a la narradora'}
      </Text>
    </Pressable>
  );
}

/**
 * El cuento ya terminado: la narradora lee el comienzo, suenan los trozos y
 * ella pone el final (lo escribe al terminar el plazo, tras escucharlos).
 */
function CuentoEntero({
  inicio,
  vozInicio,
  trozos,
  groupId,
  proposalId,
}: {
  inicio: string;
  vozInicio: string | null;
  trozos: Moment[];
  groupId: string;
  proposalId: string;
}) {
  const theme = useTheme();
  const { user } = useStore();
  const { sonando, preparando, cierre, escribiendo, escuchar, parar } = useCuentoEntero({
    groupId,
    proposalId,
    inicio,
    trozos,
    vozInicio,
  });

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
        disabled={preparando}
        onPress={sonando === null ? escuchar : parar}
        style={[styles.grande, { backgroundColor: theme.accent }]}>
        <Icon icon={sonando === null ? Play : Pause} size={20} color={theme.onAccent} />
        <Text style={{ color: theme.onAccent, fontSize: 17, fontWeight: '600' }}>
          {preparando
            ? 'Preparando el cuento…'
            : sonando === null
              ? 'Escuchar el cuento entero'
              : 'Parar'}
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
      {/* el final de la narradora */}
      {trozos.length > 0 && (
        <View
          style={[
            styles.cierre,
            {
              backgroundColor: theme.card,
              borderColor: sonando === trozos.length ? theme.accent : 'transparent',
            },
          ]}>
          <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '600' }}>
            Y el final, según la narradora
          </Text>
          <Text style={[styles.inicio, { color: theme.text, fontSize: 24, lineHeight: 28 }]}>
            {cierre
              ? cierre.texto
              : escribiendo
                ? 'Está escuchando el cuento para escribirle un final…'
                : 'Ahora mismo no puede escribir el final; lo intentará la próxima vez que abráis el cuento.'}
          </Text>
        </View>
      )}
      <Text style={[styles.subtitulo, { color: theme.text, marginTop: 8 }]}>
        ¿Qué os ha parecido?
      </Text>
      <ComentariosJuego proposalId={proposalId} />
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
  ondas: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    height: 52,
    overflow: 'hidden',
  },
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
  cierre: {
    borderRadius: 22,
    padding: 18,
    gap: 8,
    borderWidth: 2,
    transform: [{ rotate: '0.5deg' }],
  },
  narradora: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
});
