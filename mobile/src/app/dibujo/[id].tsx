import { router, useLocalSearchParams } from 'expo-router';
import { ArrowDown, Lock, Pencil, Type } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ComentariosJuego } from '@/components/comentarios-juego';
import { Icon } from '@/components/icon';
import { Lienzo, type LienzoRef } from '@/components/lienzo';
import { Avatar, Button, Notice, Screen, Tag } from '@/components/ui';
import { Hand, MaxContentWidth, Spacing, useTheme } from '@/constants/theme';
import { errorText, useStore } from '@/data/store';
import { type PasoDibujo, seguirDibujo, subirDibujo, usePasosDibujo } from '@/lib/dibujo';
import { markRead } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { daysLeft } from '@/lib/time';

/**
 * Dibujo a ciegas: frase → dibujo → frase… Cada uno ve solo el paso anterior;
 * al terminar se destapa la cadena entera.
 */
export default function Dibujo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useEffect(() => {
    if (id) markRead(`proposal:${id}`);
  }, [id]);
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { proposals, me, user, refresh } = useStore();
  const proposal = proposals.find((p) => p.id === id);
  const meta = proposal?.dibujo?.pasos ?? [];
  const n = meta.length;
  const pasos = usePasosDibujo(id ?? '', n);
  const lienzo = useRef<LienzoRef>(null);
  const [trazos, setTrazos] = useState(0);
  const [texto, setTexto] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [terminando, setTerminando] = useState<'' | 'preguntar' | 'cerrando'>('');

  if (!proposal?.dibujo)
    return (
      <Screen>
        <Text style={{ color: theme.text, fontSize: 17 }}>Este dibujo a ciegas ya no está.</Text>
        <Button label="Volver" variant="quiet" onPress={() => router.back()} />
      </Screen>
    );

  const abierto = !proposal.endsAt || proposal.endsAt > Date.now();
  const ultimoMeta = meta.at(-1);
  const ultimo = pasos?.find((p) => p.orden === n - 1);
  const meToca = abierto && !!ultimoMeta && ultimoMeta.u !== me;
  const toca: 'dibujo' | 'frase' = n % 2 === 1 ? 'dibujo' : 'frase';
  const quedan = proposal.endsAt ? daysLeft(proposal.endsAt) : undefined;
  const primero = (uid?: string) => (uid ? user(uid).name.split(' ')[0] : 'Junti');
  const lado = Math.min(Math.min(width, MaxContentWidth) - 48, 420);

  const enviar = async () => {
    setBusy(true);
    setNotice('');
    try {
      if (toca === 'dibujo') {
        const png = await lienzo.current!.exportar();
        const ruta = await subirDibujo(proposal.groupId, me, png);
        await seguirDibujo(proposal.id, n - 1, { ruta });
      } else {
        await seguirDibujo(proposal.id, n - 1, { texto: texto.trim() });
        setTexto('');
      }
    } catch (e) {
      setNotice(errorText(e));
    }
    await refresh().catch(() => {});
    setBusy(false);
  };

  return (
    <Screen
      header={
        <View style={styles.header}>
          <Button compact label="Cerrar" variant="quiet" onPress={() => router.back()} />
        </View>
      }>
      <View style={{ gap: 8 }}>
        <Tag>
          {abierto
            ? `Dibujo a ciegas${quedan ? ` · ${quedan === 1 ? 'queda 1 día' : `quedan ${quedan} días`}` : ''}`
            : 'Dibujo a ciegas · terminado'}
        </Tag>
        <Text style={[styles.titulo, { color: theme.text }]}>
          {abierto
            ? meToca
              ? toca === 'dibujo'
                ? 'Dibuja esto'
                : '¿Qué es este dibujo?'
              : 'Dibujo a ciegas'
            : 'Así fue cambiando'}
        </Text>
        <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
          Lo empezó {proposal.createdBy === me ? 'tú' : primero(proposal.createdBy)}
        </Text>
      </View>

      {abierto ? (
        <>
          {/* la cadena: quién ha hecho cada paso; lo de dentro, escondido */}
          <View style={[styles.cadena, { backgroundColor: theme.soft }]}>
            <Icon icon={Lock} size={16} color={theme.textSecondary} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 }}>
              {meta.map((p, i) => (
                <View key={i} style={[styles.eslabon, { backgroundColor: theme.card }]}>
                  <Avatar userId={p.u} size={20} />
                  <Icon icon={p.t === 'd' ? Pencil : Type} size={12} color={theme.textSecondary} />
                </View>
              ))}
            </View>
          </View>
          <Text style={{ color: theme.textSecondary, fontSize: 14, lineHeight: 20 }}>
            {n === 1 ? '1 paso' : `${n} pasos`} hasta ahora. Cada uno ve solo el anterior: la cadena
            entera se destapa al terminar
            {quedan ? ` (${quedan === 1 ? 'mañana' : `en ${quedan} días`})` : ''}.
          </Text>

          {meToca ? (
            pasos === null ? (
              <Text style={{ color: theme.textSecondary }}>Cargando…</Text>
            ) : !ultimo ? (
              <Text style={{ color: theme.textSecondary }}>No se ha podido cargar el paso.</Text>
            ) : (
              <View style={{ gap: Spacing.three }}>
                <Animated.View entering={FadeInDown.duration(350)} style={{ gap: 8 }}>
                  <View style={styles.fila}>
                    <Avatar userId={ultimo.user_id} size={26} />
                    <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
                      {ultimo.tipo === 'frase'
                        ? `${primero(ultimo.user_id)} escribió:`
                        : `${primero(ultimo.user_id)} dibujó:`}
                    </Text>
                  </View>
                  <Paso paso={ultimo} lado={lado} />
                </Animated.View>

                {toca === 'dibujo' ? (
                  <View style={{ gap: 10 }}>
                    <Text style={[styles.sub, { color: theme.text }]}>Tu dibujo</Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 14, lineHeight: 20 }}>
                      Sin letras ni números: quien venga después solo verá tu dibujo.
                    </Text>
                    <Lienzo ref={lienzo} lado={lado} onCambio={setTrazos} />
                    <Button
                      label={busy ? 'Enviando…' : 'Enviar mi dibujo'}
                      disabled={busy || !trazos}
                      onPress={enviar}
                    />
                  </View>
                ) : (
                  <View style={{ gap: 10 }}>
                    <Text style={[styles.sub, { color: theme.text }]}>¿Qué crees que es?</Text>
                    <View style={[styles.caja, { backgroundColor: theme.card }]}>
                      <TextInput
                        value={texto}
                        onChangeText={setTexto}
                        placeholder="Un pulpo haciendo la compra…"
                        placeholderTextColor={theme.textSecondary}
                        maxLength={160}
                        style={[styles.input, { color: theme.text }]}
                      />
                    </View>
                    <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                      Escríbelo como una frase: el siguiente tendrá que dibujarla.
                    </Text>
                    <Button
                      label={busy ? 'Enviando…' : 'Enviar'}
                      disabled={busy || texto.trim().length < 2}
                      onPress={enviar}
                    />
                  </View>
                )}
              </View>
            )
          ) : (
            <View style={{ gap: 10 }}>
              <Text style={[styles.sub, { color: theme.text }]}>
                {n === 1 ? 'Tu frase' : 'Tu paso'}
              </Text>
              {ultimo && <Paso paso={ultimo} lado={lado} />}
              <Text style={{ color: theme.textSecondary, fontSize: 15, lineHeight: 21 }}>
                Ahora le toca a otra persona. Si después vuelve a tocarte, podrás seguir la cadena
                de nuevo.
              </Text>
            </View>
          )}
          <Notice>{notice}</Notice>

          {/* quien lo empezó puede terminarlo antes */}
          {proposal.createdBy === me && n >= 3 && (
            <View style={{ gap: 8, alignItems: 'center' }}>
              {terminando === 'preguntar' ? (
                <>
                  <Text style={{ color: theme.textSecondary, fontSize: 14, textAlign: 'center' }}>
                    Nadie más podrá seguirlo y se destapará la cadena entera. ¿Lo terminamos?
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
                  label={terminando === 'cerrando' ? 'Terminando…' : 'Terminar ya y destapar'}
                  disabled={terminando === 'cerrando'}
                  onPress={() => setTerminando('preguntar')}
                />
              )}
            </View>
          )}
        </>
      ) : (
        <CadenaEntera pasos={pasos} lado={lado} proposalId={proposal.id} />
      )}
    </Screen>
  );
}

/** Un paso: la frase escrita a mano o el dibujo. */
function Paso({ paso, lado }: { paso: PasoDibujo; lado: number }) {
  const theme = useTheme();
  if (paso.tipo === 'frase')
    return (
      <View style={[styles.papel, { backgroundColor: theme.card, boxShadow: theme.shadow }]}>
        <Text style={[styles.mano, { color: theme.text }]}>{paso.texto}</Text>
      </View>
    );
  return (
    <View style={{ alignItems: 'center' }}>
      <img
        src={paso.url}
        alt="El dibujo"
        style={{
          width: lado,
          height: lado,
          borderRadius: 18,
          background: '#FFFFFF',
          boxShadow: '0 10px 30px rgba(20,22,26,.18)',
          display: 'block',
        }}
      />
    </View>
  );
}

/** La cadena entera, paso a paso, como se fue pasando de mano en mano. */
function CadenaEntera({
  pasos,
  lado,
  proposalId,
}: {
  pasos: PasoDibujo[] | null;
  lado: number;
  proposalId: string;
}) {
  const theme = useTheme();
  const { user } = useStore();
  if (!pasos) return <Text style={{ color: theme.textSecondary }}>Cargando…</Text>;
  const primera = pasos[0];
  const ultima = [...pasos].reverse().find((p) => p.tipo === 'frase');
  const nombre = (uid: string) => user(uid).name.split(' ')[0];
  return (
    <View style={{ gap: Spacing.two }}>
      {pasos.length < 2 && (
        <Text style={{ color: theme.textSecondary, fontSize: 16 }}>
          Terminó sin que nadie lo siguiera.
        </Text>
      )}
      {pasos.map((p, i) => (
        <Animated.View
          key={p.orden}
          entering={FadeInDown.delay(350 * i).duration(450)}
          style={{ gap: 8 }}>
          {i > 0 && (
            <View style={{ alignItems: 'center' }}>
              <Icon icon={ArrowDown} size={18} color={theme.textSecondary} />
            </View>
          )}
          <View style={styles.fila}>
            <Avatar userId={p.user_id} size={26} />
            <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
              {i === 0
                ? `${nombre(p.user_id)} empezó con:`
                : p.tipo === 'dibujo'
                  ? `${nombre(p.user_id)} lo dibujó así:`
                  : `${nombre(p.user_id)} creyó que era:`}
            </Text>
          </View>
          <Paso paso={p} lado={Math.round(lado * 0.82)} />
        </Animated.View>
      ))}
      {pasos.length > 2 && ultima && ultima.orden > 0 && (
        <Animated.View
          entering={FadeInDown.delay(350 * pasos.length + 200).duration(500)}
          style={{ alignItems: 'center', marginTop: 8 }}>
          <Text style={[styles.final, { color: '#2F7D4F' }]}>
            Empezó en «{primera.texto}» y acabó en «{ultima.texto}»
          </Text>
        </Animated.View>
      )}
      <Text style={[styles.sub, { color: theme.text, marginTop: 8 }]}>¿Qué os ha parecido?</Text>
      <ComentariosJuego proposalId={proposalId} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'flex-start', paddingVertical: Spacing.two },
  titulo: { fontSize: 30, lineHeight: 36, fontWeight: '600', letterSpacing: -0.5 },
  sub: { fontSize: 18, fontWeight: '600' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cadena: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 12 },
  eslabon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 3,
    paddingRight: 8,
    height: 28,
    borderRadius: 14,
  },
  papel: { borderRadius: 20, padding: 20, transform: [{ rotate: '-0.6deg' }] },
  mano: { fontFamily: Hand, fontSize: 30, lineHeight: 34 },
  final: { fontFamily: Hand, fontSize: 26, lineHeight: 30, textAlign: 'center' },
  caja: { borderRadius: 18, paddingHorizontal: 16 },
  input: { fontSize: 17, paddingVertical: 14, minWidth: 0, outlineStyle: 'none' } as never,
});
