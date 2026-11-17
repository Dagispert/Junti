import { router, useLocalSearchParams } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { ComentariosJuego } from '@/components/comentarios-juego';
import { Icon } from '@/components/icon';
import { Lupa } from '@/components/lupa';
import { Avatar, Button, Notice, Screen, Tag } from '@/components/ui';
import { Hand, MaxContentWidth, Spacing, useTheme } from '@/constants/theme';
import { errorText, useStore } from '@/data/store';
import { markRead } from '@/lib/notifications';
import { daysLeft } from '@/lib/time';
import {
  adivinar,
  type EstadoZoom,
  NIVELES,
  solucion,
  useFotoZoom,
  useResultadosZoom,
} from '@/lib/zoom';

/** «a la primera», «a la tercera»… */
const intento = (nivel: number) =>
  ['a la primera', 'a la segunda', 'a la tercera', 'a la cuarta', 'con la foto entera'][nivel] ??
  '';

/**
 * El zoom misterioso: se ve un detalle muy de cerca y hay que adivinar qué es.
 * Cada fallo aleja la imagen; al terminar (o al rendirse) se ve la foto
 * entera, la solución y cómo le fue a cada uno.
 */
export default function Zoom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useEffect(() => {
    if (id) markRead(`proposal:${id}`);
  }, [id]);
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { proposals, me, user } = useStore();
  const proposal = proposals.find((p) => p.id === id);
  const zoom = proposal?.zoom;
  const foto = useFotoZoom(zoom?.path);
  const resultados = useResultadosZoom(id);
  const mio = resultados.find((r) => r.user_id === me);
  const [texto, setTexto] = useState('');
  const [busy, setBusy] = useState(false);
  const [fallo, setFallo] = useState(0);
  const [notice, setNotice] = useState('');
  const [sol, setSol] = useState<string | null>(null);
  // lo último que respondió el servidor (antes de que llegue en tiempo real)
  const [local, setLocal] = useState<EstadoZoom | null>(null);
  const abierto = !proposal?.endsAt || proposal.endsAt > Date.now();
  const soyAutor = proposal?.createdBy === me;
  const terminado = !abierto || soyAutor || !!mio?.terminado || !!local?.terminado;
  useEffect(() => {
    if (terminado && id) solucion(id).then(setSol);
  }, [terminado, id, mio?.terminado]);

  const ranking = useMemo(
    () =>
      [...resultados].sort(
        (a, b) => Number(b.acierto) - Number(a.acierto) || b.puntos - a.puntos || a.nivel - b.nivel,
      ),
    [resultados],
  );

  if (!proposal || !zoom)
    return (
      <Screen>
        <Text style={{ color: theme.text, fontSize: 17 }}>Este zoom ya no está.</Text>
        <Button label="Volver" variant="quiet" onPress={() => router.back()} />
      </Screen>
    );

  const lado = Math.min(width, MaxContentWidth) - 60;
  const nivel = Math.max(mio?.nivel ?? 0, local?.nivel ?? 0);
  const quedan = proposal.endsAt ? daysLeft(proposal.endsAt) : undefined;
  const primero = (uid?: string) => (uid ? user(uid).name.split(' ')[0] : '');

  const probar = async (rendirse = false) => {
    if (!rendirse && !texto.trim()) return;
    setBusy(true);
    setNotice('');
    try {
      const r = await adivinar(proposal.id, texto.trim(), rendirse);
      setLocal(r);
      if (!r.acierto && !rendirse && !r.terminado) setFallo((x) => x + 1);
      if (r.respuesta) setSol(r.respuesta);
      setTexto('');
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
      <View style={{ gap: 8 }}>
        <Tag>
          {abierto
            ? `Zoom misterioso${quedan ? ` · ${quedan === 1 ? 'queda 1 día' : `quedan ${quedan} días`}` : ''}`
            : 'Zoom misterioso · terminado'}
        </Tag>
        <Text style={[styles.titulo, { color: theme.text }]}>
          {terminado ? (sol ? `Era: ${sol}` : 'La solución') : '¿Qué es?'}
        </Text>
        <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
          Lo propone {soyAutor ? 'tú' : primero(proposal.createdBy)}
        </Text>
      </View>

      {/* la lupa: muy de cerca y cada vez más lejos; al terminar, la foto entera */}
      <View style={{ alignItems: 'center', gap: 12 }}>
        <Animated.View key={fallo} entering={fallo ? FadeIn.duration(200) : undefined}>
          <div
            style={{
              animation: fallo ? 'zTiembla .45s ease' : undefined,
              borderRadius: terminado ? 22 : '50%',
              boxShadow: '0 18px 40px rgba(20,22,26,0.25)',
              border: `6px solid ${theme.card}`,
            }}>
            <style>{`@keyframes zTiembla { 0%,100% { transform: none } 20% { transform: translateX(-10px) rotate(-2deg) } 40% { transform: translateX(9px) rotate(2deg) } 60% { transform: translateX(-6px) } 80% { transform: translateX(4px) } }`}</style>
            <Lupa
              src={foto}
              cx={zoom.cx}
              cy={zoom.cy}
              zoom={terminado ? 1 : NIVELES[Math.min(nivel, NIVELES.length - 1)]}
              size={lado}
              redonda={!terminado}
            />
          </div>
        </Animated.View>
        {!terminado && (
          <View style={styles.puntos}>
            {NIVELES.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.punto,
                  {
                    backgroundColor:
                      i < nivel ? '#E8563F' : i === nivel ? theme.accent : theme.soft,
                  },
                ]}
              />
            ))}
          </View>
        )}
      </View>

      {!terminado ? (
        <View style={{ gap: 10 }}>
          {fallo > 0 && (
            <Animated.Text
              key={`f${fallo}`}
              entering={FadeInDown.duration(300)}
              style={{ color: '#E8563F', fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
              ¡No! Se aleja un poco…
            </Animated.Text>
          )}
          <View style={[styles.caja, { backgroundColor: theme.card, boxShadow: theme.shadow }]}>
            <TextInput
              value={texto}
              onChangeText={setTexto}
              placeholder="¿Qué crees que es?"
              placeholderTextColor={theme.textSecondary}
              onSubmitEditing={() => probar()}
              returnKeyType="send"
              maxLength={80}
              style={[styles.input, { color: theme.text }]}
            />
            <Pressable
              accessibilityRole="button"
              disabled={busy || !texto.trim()}
              onPress={() => probar()}
              style={[
                styles.boton,
                { backgroundColor: theme.accent, opacity: texto.trim() ? 1 : 0.5 },
              ]}>
              <Icon icon={Search} size={16} color={theme.onAccent} />
              <Text style={{ color: theme.onAccent, fontWeight: '700' }}>Adivinar</Text>
            </Pressable>
          </View>
          <Text style={{ color: theme.textSecondary, fontSize: 13, textAlign: 'center' }}>
            Intento {nivel + 1} de {NIVELES.length} · si aciertas ahora: {NIVELES.length - nivel}{' '}
            {NIVELES.length - nivel === 1 ? 'punto' : 'puntos'}
          </Text>
          <Button
            compact
            variant="quiet"
            label="Me rindo"
            disabled={busy}
            onPress={() => probar(true)}
          />
          <Notice>{notice}</Notice>
        </View>
      ) : (
        <View style={{ gap: Spacing.three }}>
          {!soyAutor && (mio || local) && (
            <Text
              style={[
                styles.mano,
                { color: (local ?? mio)!.acierto ? '#2E8B57' : theme.textSecondary },
              ]}>
              {(local ?? mio)!.acierto
                ? `¡Lo adivinaste ${intento((local ?? mio)!.nivel)}! +${(local ?? mio)!.puntos} ${(local ?? mio)!.puntos === 1 ? 'punto' : 'puntos'}`
                : 'Esta vez no… ¡a la próxima!'}
            </Text>
          )}
          {ranking.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={[styles.sub, { color: theme.text }]}>Cómo le fue a cada uno</Text>
              {ranking.map((r, i) => (
                <View key={r.user_id} style={[styles.fila, { backgroundColor: theme.card }]}>
                  <Text style={{ width: 22, color: theme.textSecondary, fontWeight: '700' }}>
                    {r.acierto ? i + 1 : '·'}
                  </Text>
                  <Avatar userId={r.user_id} size={30} />
                  <Text style={{ flex: 1, color: theme.text, fontSize: 15 }}>
                    {r.user_id === me ? 'Tú' : primero(r.user_id)}
                  </Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
                    {r.acierto
                      ? `${intento(r.nivel)} · ${r.puntos} pt`
                      : r.terminado
                        ? 'no lo adivinó'
                        : abierto
                          ? 'jugando…'
                          : 'no terminó'}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {soyAutor && abierto && (
            <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
              Es tu zoom: tú no juegas, pero ves cómo les va a los demás.
            </Text>
          )}
          <Text style={[styles.sub, { color: theme.text }]}>¿Qué os ha parecido?</Text>
          <ComentariosJuego proposalId={proposal.id} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'flex-start', paddingVertical: Spacing.two },
  titulo: { fontSize: 30, lineHeight: 36, fontWeight: '600', letterSpacing: -0.5 },
  mano: { fontFamily: Hand, fontSize: 28, lineHeight: 30, textAlign: 'center' },
  sub: { fontSize: 18, fontWeight: '600' },
  puntos: { flexDirection: 'row', gap: 8 },
  punto: { width: 10, height: 10, borderRadius: 5 },
  caja: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 26,
    padding: 6,
    paddingLeft: 18,
  },
  input: { flex: 1, minWidth: 0, fontSize: 17, paddingVertical: 10, outlineStyle: 'none' } as never,
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 21,
  },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 10 },
});
