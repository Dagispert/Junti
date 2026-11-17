// Cada minijuego tiene su propia tarjeta en «Hoy», con su identidad: el
// karaoke es un bar de karaoke (neón, la canción que se ilumina como una letra y
// un ecualizador); el cuento a trozos, una
// página de libreta escrita a mano.

import { Image } from 'expo-image';
import { router } from 'expo-router';
import { BookOpen, Lock, Mic, Play } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Hand, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import type { Moment, Proposal } from '@/data/types';
import { useEsquema } from '@/lib/appearance';
import { useMontaje } from '@/lib/montaje';
import { daysLeft } from '@/lib/time';

import { Icon } from './icon';
import { NudgeBell } from './nudge-bell';
import { Avatar } from './ui';

const plazo = (p: Proposal) => {
  if (p.endsAt && p.endsAt <= Date.now()) return 'terminado';
  const d = p.endsAt ? daysLeft(p.endsAt) : undefined;
  return d ? (d === 1 ? 'queda 1 día' : `quedan ${d} días`) : '';
};

/* ───────────── Karaoke: un bar de karaoke de noche ───────────── */

const NEON = '#FF4FA3';
const CIAN = '#5BE7FF';
const ORO = '#FFD25E';
const FONDO = '#140F24';

// Las animaciones del karaoke (una sola vez en la página).
const ANIM_KARAOKE = `
@keyframes kNeon { 0%,18%,22%,60%,64%,100% { opacity: 1 } 20%,62% { opacity: .35 } }
@keyframes kBarrido { 0% { clip-path: inset(0 100% 0 0) } 70%,100% { clip-path: inset(0 0 0 0) } }
@keyframes kEq { 0%,100% { transform: scaleY(.25) } 50% { transform: scaleY(1) } }
@keyframes kAro { 0% { transform: scale(1); opacity: .7 } 100% { transform: scale(1.45); opacity: 0 } }
`;

export function KaraokeHoy({ challenge, answers }: { challenge: Proposal; answers: Moment[] }) {
  const { me } = useStore();
  const game = challenge.game!;
  const abierto = !challenge.endsAt || challenge.endsAt > Date.now();
  const voces = [...new Set([...answers.map((m) => m.authorId), ...(game.montaje?.voces ?? [])])];
  const cantado = voces.includes(me);
  const montaje = useMontaje(game);
  const ir = (watch?: boolean) =>
    router.push({
      pathname: '/karaoke/[id]',
      params: { id: challenge.id, ...(watch ? { watch: '1' } : {}) },
    });

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 28,
        overflow: 'hidden',
        background: `radial-gradient(ellipse at 50% 0%, #2B1C4D 0%, ${FONDO} 65%)`,
        padding: 18,
        boxShadow: '0 18px 40px rgba(20,22,26,0.22)',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}>
      <style>{ANIM_KARAOKE}</style>
      {/* la carátula, como luz de fondo */}
      {!!game.artwork && (
        <div
          style={{
            position: 'absolute',
            inset: -40,
            background: `url("${game.artwork}") center / cover`,
            filter: 'blur(40px) saturate(1.4)',
            opacity: 0.22,
          }}
        />
      )}
      {/* puntitos de luz, como un bar */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(rgba(255,255,255,.07) 1px, transparent 1.5px) 0 0 / 16px 16px',
        }}
      />

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* el letrero de neón y el plazo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              color: '#FFE3F1',
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 4,
              fontStyle: 'italic',
              textShadow: `0 0 4px ${NEON}, 0 0 10px ${NEON}, 0 0 22px ${NEON}`,
              animation: 'kNeon 5s infinite',
            }}>
            KARAOKE
          </div>
          <div style={{ flex: 1, color: 'rgba(255,255,255,.6)', fontSize: 13, textAlign: 'right' }}>
            {plazo(challenge)}
          </div>
          {abierto && (
            <NudgeBell
              targetId={challenge.id}
              groupId={challenge.groupId}
              done={voces}
              owner={challenge.createdBy}
              label="el karaoke"
            />
          )}
        </div>

        {/* la carátula con su aro de sonido, y la canción que se ilumina como una letra */}
        <Pressable
          accessibilityRole="button"
          onPress={() => ir(voces.length > 0)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <div style={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
            {[0, 1].map((i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 20,
                  border: `2px solid ${CIAN}`,
                  animation: `kAro 2.4s ease-out ${i * 1.2}s infinite`,
                }}
              />
            ))}
            <View style={kb.portada}>
              {montaje.video ? (
                <video
                  src={montaje.video}
                  poster={montaje.poster}
                  muted
                  autoPlay
                  loop
                  playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : game.artwork ? (
                <Image
                  source={{ uri: game.artwork }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
              ) : (
                <Icon icon={Mic} size={34} color="rgba(255,255,255,0.85)" />
              )}
            </View>
          </div>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            {/* el título: gris debajo y dorado encima, que se va llenando */}
            <div
              style={{ position: 'relative', fontSize: 24, lineHeight: '28px', fontWeight: 800 }}>
              <div style={{ color: 'rgba(255,255,255,.28)' }}>{game.song}</div>
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  color: ORO,
                  textShadow: `0 0 10px rgba(255,210,94,.45)`,
                  animation: 'kBarrido 3.6s linear infinite',
                }}>
                {game.song}
              </div>
            </div>
            {!!game.artist && (
              <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 15, marginTop: 4 }}>
                {game.artist}
              </div>
            )}
            {/* el ecualizador */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 3,
                height: 22,
                marginTop: 10,
              }}>
              {[0.9, 0.5, 1.1, 0.7, 1.3, 0.6, 1, 0.8].map((d, i) => (
                <div
                  key={i}
                  style={{
                    width: 4,
                    height: '100%',
                    borderRadius: 2,
                    transformOrigin: 'bottom',
                    background: i % 2 ? CIAN : NEON,
                    animation: `kEq ${d}s ease-in-out ${i * 0.11}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        </Pressable>

        {/* quién ha cantado */}
        <View style={kb.voces}>
          {voces.slice(0, 6).map((u, i) => (
            <View key={u} style={[kb.cara, { marginLeft: i ? -8 : 0 }]}>
              <Avatar userId={u} size={26} />
            </View>
          ))}
          <Text style={kb.vocesTxt}>
            {voces.length === 0
              ? 'Nadie ha cantado aún: ¿abres tú el micro?'
              : voces.length === 1
                ? '1 voz'
                : `${voces.length} voces`}
          </Text>
        </View>

        <View style={kb.botones}>
          {voces.length > 0 && (
            <Pressable
              accessibilityRole="button"
              onPress={() => ir(true)}
              style={[kb.boton, kb.lleno]}>
              <Icon icon={Play} size={16} color={FONDO} />
              <Text style={[kb.botonTxt, { color: FONDO }]}>Ver el karaoke</Text>
            </Pressable>
          )}
          {abierto && !cantado && (
            <Pressable
              accessibilityRole="button"
              onPress={() => ir()}
              style={[kb.boton, voces.length ? kb.hueco : kb.lleno]}>
              <Icon icon={Mic} size={16} color={voces.length ? '#FFFFFF' : FONDO} />
              <Text style={[kb.botonTxt, { color: voces.length ? '#FFFFFF' : FONDO }]}>Cantar</Text>
            </Pressable>
          )}
        </View>
      </div>
    </div>
  );
}

const kb = StyleSheet.create({
  portada: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
  },
  voces: { flexDirection: 'row', alignItems: 'center' },
  cara: { borderRadius: 15, borderWidth: 2, borderColor: FONDO },
  vocesTxt: { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '600', marginLeft: 8 },
  botones: { flexDirection: 'row', gap: 10 },
  boton: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  lleno: { backgroundColor: ORO },
  hueco: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)' },
  botonTxt: { fontSize: 15, fontWeight: '700' },
});

/* ───────────── El cuento a trozos: una página de libreta ───────────── */

export function CuentoHoy({ challenge, answers }: { challenge: Proposal; answers: Moment[] }) {
  const theme = useTheme();
  const oscuro = useEsquema() === 'dark';
  const { me } = useStore();
  const juego = challenge.juego!;
  const abierto = !challenge.endsAt || challenge.endsAt > Date.now();
  const trozos = [...answers].filter((m) => m.voice).sort((a, b) => a.sharedAt - b.sharedAt);
  const ultimo = trozos.at(-1);
  const meToca = abierto && ultimo?.authorId !== me;
  const papel = oscuro ? '#2A2620' : '#FBF6EA';
  const tinta = oscuro ? '#F1E9DA' : '#2B2620';
  const raya = oscuro ? 'rgba(241,233,218,0.08)' : 'rgba(43,38,32,0.07)';
  const ir = () => router.push({ pathname: '/cuento/[id]', params: { id: challenge.id } });
  return (
    <View style={[c.card, { backgroundColor: papel, boxShadow: theme.shadow }]}>
      {/* las rayas de la libreta y el margen rojo */}
      {Array.from({ length: 9 }, (_, i) => (
        <View key={i} style={[c.raya, { top: 70 + i * 30, backgroundColor: raya }]} />
      ))}
      <View style={c.margen} />
      <View style={c.cabecera}>
        <Icon icon={BookOpen} size={15} color={tinta} />
        <Text style={[c.etiqueta, { color: tinta }]}>El cuento a trozos</Text>
        <Text style={[c.plazo, { color: tinta }]}>{plazo(challenge)}</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={ir}>
        <Text numberOfLines={4} style={[c.inicio, { color: tinta }]}>
          {juego.inicio}
        </Text>
      </Pressable>
      {/* la cadena: quién ha ido siguiendo (los trozos, con candado hasta el final) */}
      <View style={c.cadena}>
        {trozos.map((t, i) => (
          <View key={t.id} style={c.eslabon}>
            {i > 0 && <View style={[c.hilo, { borderColor: tinta }]} />}
            <View>
              <Avatar userId={t.authorId} size={30} />
              {abierto && i < trozos.length - 1 && (
                <View style={[c.candado, { backgroundColor: papel }]}>
                  <Icon icon={Lock} size={10} color={tinta} />
                </View>
              )}
            </View>
          </View>
        ))}
        {abierto && (
          <View style={c.eslabon}>
            {trozos.length > 0 && <View style={[c.hilo, { borderColor: tinta }]} />}
            <View style={[c.hueco, { borderColor: tinta }]}>
              <Text style={{ color: tinta, fontSize: 16, fontWeight: '700' }}>?</Text>
            </View>
          </View>
        )}
      </View>
      <Text style={{ color: tinta, opacity: 0.7, fontSize: 14 }}>
        {!abierto
          ? `${trozos.length} ${trozos.length === 1 ? 'trozo' : 'trozos'}: ya se puede escuchar entero`
          : trozos.length === 0
            ? 'Nadie lo ha seguido aún'
            : meToca
              ? '¿Cómo sigue? Te toca'
              : 'Has puesto el último trozo: ahora le toca a otra persona'}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={ir}
        style={[c.boton, { backgroundColor: tinta }]}>
        <Icon icon={abierto ? Mic : Play} size={16} color={papel} />
        <Text style={{ color: papel, fontSize: 15, fontWeight: '700' }}>
          {!abierto ? 'Escuchar el cuento entero' : meToca ? 'Seguir el cuento' : 'Ver el cuento'}
        </Text>
      </Pressable>
    </View>
  );
}

const c = StyleSheet.create({
  card: { borderRadius: 24, padding: 18, paddingLeft: 30, gap: 14, overflow: 'hidden' },
  raya: { position: 'absolute', left: 0, right: 0, height: 1 },
  margen: {
    position: 'absolute',
    left: 18,
    top: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: 'rgba(214,82,82,0.45)',
  },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  etiqueta: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  plazo: { fontSize: 13, opacity: 0.6, marginLeft: 'auto' },
  inicio: { fontFamily: Hand, fontSize: 27, lineHeight: 30 },
  cadena: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', rowGap: 8 },
  eslabon: { flexDirection: 'row', alignItems: 'center' },
  hilo: {
    width: 14,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    opacity: 0.5,
    marginHorizontal: 2,
  },
  candado: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hueco: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boton: {
    height: 46,
    borderRadius: 23,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
