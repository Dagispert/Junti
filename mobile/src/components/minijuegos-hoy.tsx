// Cada minijuego tiene su propia tarjeta en «Hoy», con su identidad: el
// karaoke es un escenario (carátula, dorado y focos); el cuento a trozos, una
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

const ORO = '#F6C945';

const plazo = (p: Proposal) => {
  if (p.endsAt && p.endsAt <= Date.now()) return 'terminado';
  const d = p.endsAt ? daysLeft(p.endsAt) : undefined;
  return d ? (d === 1 ? 'queda 1 día' : `quedan ${d} días`) : '';
};

/* ───────────── Karaoke: un escenario ───────────── */

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
    <View style={k.card}>
      {/* la carátula, enorme y difuminada, como luz de escenario */}
      {!!game.artwork && (
        <Image
          source={{ uri: game.artwork }}
          style={[StyleSheet.absoluteFill, { opacity: 0.45 }]}
          blurRadius={30}
          contentFit="cover"
        />
      )}
      <View style={k.velo} />
      <View style={k.cabecera}>
        <View style={k.etiqueta}>
          <Icon icon={Mic} size={13} color="#1D1F22" />
          <Text style={k.etiquetaTxt}>KARAOKE</Text>
        </View>
        <Text style={k.plazo}>{plazo(challenge)}</Text>
        {abierto && (
          <NudgeBell
            targetId={challenge.id}
            groupId={challenge.groupId}
            done={voces}
            owner={challenge.createdBy}
            label="el karaoke"
          />
        )}
      </View>
      <Pressable accessibilityRole="button" onPress={() => ir(voces.length > 0)} style={k.cuerpo}>
        <View style={k.portada}>
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
            <Icon icon={Mic} size={34} color="rgba(255,255,255,0.8)" />
          )}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text numberOfLines={2} style={k.cancion}>
            {game.song}
          </Text>
          {!!game.artist && (
            <Text numberOfLines={1} style={k.artista}>
              {game.artist}
            </Text>
          )}
          <View style={k.voces}>
            {voces.slice(0, 6).map((u, i) => (
              <View key={u} style={[k.cara, { marginLeft: i ? -8 : 0 }]}>
                <Avatar userId={u} size={24} />
              </View>
            ))}
            <Text style={k.vocesTxt}>
              {voces.length === 0
                ? 'nadie ha cantado aún'
                : voces.length === 1
                  ? '1 voz'
                  : `${voces.length} voces`}
            </Text>
          </View>
        </View>
      </Pressable>
      <View style={k.botones}>
        {voces.length > 0 && (
          <Pressable accessibilityRole="button" onPress={() => ir(true)} style={[k.boton, k.oro]}>
            <Icon icon={Play} size={16} color="#1D1F22" />
            <Text style={[k.botonTxt, { color: '#1D1F22' }]}>Ver el karaoke</Text>
          </Pressable>
        )}
        {abierto && !cantado && (
          <Pressable
            accessibilityRole="button"
            onPress={() => ir()}
            style={[k.boton, voces.length ? k.hueco : k.oro]}>
            <Icon icon={Mic} size={16} color={voces.length ? '#FFFFFF' : '#1D1F22'} />
            <Text style={[k.botonTxt, { color: voces.length ? '#FFFFFF' : '#1D1F22' }]}>
              Cantar
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const k = StyleSheet.create({
  card: { borderRadius: 28, overflow: 'hidden', backgroundColor: '#16171B', padding: 16, gap: 14 },
  velo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(12,12,16,0.45)',
  },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  etiqueta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: ORO,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  etiquetaTxt: { color: '#1D1F22', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  plazo: { color: 'rgba(255,255,255,0.7)', fontSize: 13, flex: 1 },
  cuerpo: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  portada: {
    width: 92,
    height: 92,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    boxShadow: '0 12px 30px rgba(0,0,0,0.45)',
  },
  cancion: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  artista: { color: 'rgba(255,255,255,0.7)', fontSize: 15 },
  voces: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  cara: { borderRadius: 14, borderWidth: 2, borderColor: '#16171B' },
  vocesTxt: { color: ORO, fontSize: 13, fontWeight: '600', marginLeft: 8 },
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
  oro: { backgroundColor: ORO },
  hueco: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' },
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
