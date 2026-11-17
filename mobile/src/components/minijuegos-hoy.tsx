// Cada minijuego tiene su propia tarjeta en «Hoy», con su identidad: el
// karaoke es un teatrillo (el telón se abre al aparecer); el cuento a trozos, una
// página de libreta escrita a mano.

import { Image } from 'expo-image';
import { router } from 'expo-router';
import { BookOpen, Lock, Mic, Play } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
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

/* ───────────── Karaoke: un teatrillo ───────────── */

const VERDE = '#1F5A47';
const CREMA = '#EEE4CF';
const ROSA = '#D98C8C';
const ROJO = '#A3242A';
const DORADO = '#C9A24A';
const NOCHE = '#18213A';

/** Una estrella de ocho puntas (la del medallón y la que cuelga). */
function Estrella({ size, color = DORADO }: { size: number; color?: string }) {
  const p: string[] = [];
  for (let i = 0; i < 16; i++) {
    const r = i % 2 ? (i % 4 === 1 ? 0.22 : 0.3) : i % 4 === 0 ? 1 : 0.62;
    const a = (i * Math.PI) / 8 - Math.PI / 2;
    p.push(`${(50 + Math.cos(a) * r * 50).toFixed(1)},${(50 + Math.sin(a) * r * 50).toFixed(1)}`);
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block' }}>
      <polygon points={p.join(' ')} fill={color} />
    </svg>
  );
}

/** El telón de un lado: pliegues rojos y flecos dorados abajo. */
function Telon({ lado, abierto }: { lado: 'izq' | 'der'; abierto: boolean }) {
  const izq = lado === 'izq';
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        [izq ? 'left' : 'right']: 0,
        width: '50.5%',
        zIndex: 4,
        transformOrigin: izq ? 'left top' : 'right top',
        // abierto: recogido a un lado, como un telón atado
        transform: abierto ? 'scaleX(0.2)' : 'none',
        transition: 'transform 1.4s cubic-bezier(.65,0,.25,1)',
        background: `repeating-linear-gradient(90deg, #7E151A 0px, #B12E33 9px, #C33A3E 13px, #8E1B20 22px, #6E1015 28px)`,
        boxShadow: izq ? 'inset -10px 0 18px rgba(0,0,0,.35)' : 'inset 10px 0 18px rgba(0,0,0,.35)',
        pointerEvents: abierto ? 'none' : 'auto',
      }}>
      {/* flecos */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 12,
          background: `repeating-linear-gradient(90deg, ${DORADO} 0 2px, transparent 2px 4px)`,
          borderTop: `3px solid ${DORADO}`,
        }}
      />
    </div>
  );
}

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

  // El telón se abre cuando la tarjeta aparece en pantalla (una vez).
  const [telon, setTelon] = useState(false);
  const caja = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = caja.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setTelon(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setTimeout(() => setTelon(true), 250);
          io.disconnect();
        }
      },
      { threshold: 0.45 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const rayas = `repeating-linear-gradient(90deg, ${VERDE} 0 26px, ${CREMA} 26px 50px, ${ROSA} 50px 53px, ${CREMA} 53px 64px)`;
  return (
    <div
      ref={caja}
      style={{
        position: 'relative',
        borderRadius: 28,
        overflow: 'hidden',
        background: rayas,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        padding: '0 12px 0',
        boxShadow: '0 18px 40px rgba(20,22,26,0.18)',
      }}>
      {/* El arco, con el medallón de la estrella */}
      <div
        style={{
          position: 'relative',
          height: 74,
          marginTop: 14,
          borderTopLeftRadius: '50% 70px',
          borderTopRightRadius: '50% 70px',
          border: `4px solid ${DORADO}`,
          borderBottom: 'none',
          background: `repeating-linear-gradient(90deg, ${VERDE} 0 18px, ${CREMA} 18px 34px)`,
        }}>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 8,
            width: 58,
            height: 58,
            marginLeft: -29,
            borderRadius: '50%',
            background: NOCHE,
            border: `3px solid ${DORADO}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Estrella size={38} />
        </div>
        {abierto && (
          <div style={{ position: 'absolute', right: 8, top: 22 }}>
            <NudgeBell
              targetId={challenge.id}
              groupId={challenge.groupId}
              done={voces}
              owner={challenge.createdBy}
              label="el karaoke"
            />
          </div>
        )}
      </div>

      {/* El marco: dos columnas crema y la boca del escenario */}
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {[0, 1].map((i) => (
          <div
            key={i}
            style={{
              order: i ? 2 : 0,
              width: 18,
              background: CREMA,
              borderLeft: `2px solid ${DORADO}`,
              borderRight: `2px solid ${DORADO}`,
              display: 'flex',
              justifyContent: 'center',
            }}>
            <div style={{ width: 6, margin: '10px 0', background: VERDE, borderRadius: 3 }} />
          </div>
        ))}
        <div
          style={{
            order: 1,
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            background: `radial-gradient(ellipse at 50% 35%, #2A3760 0%, ${NOCHE} 70%)`,
            minHeight: 420,
          }}>
          {/* la cenefa de arriba, con flecos */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              height: 34,
              zIndex: 5,
              background: `radial-gradient(circle at 50% 0, ${ROJO} 0 22px, transparent 23px) 0 0 / 44px 34px repeat-x, linear-gradient(${ROJO}, ${ROJO}) 0 0 / 100% 12px no-repeat`,
              filter: `drop-shadow(0 3px 0 ${DORADO})`,
            }}
          />
          <Telon lado="izq" abierto={telon} />
          <Telon lado="der" abierto={telon} />

          {/* Dentro del escenario: todo centrado */}
          <div
            style={{
              position: 'relative',
              zIndex: 2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: 10,
              padding: '30px 34px 22px',
            }}>
            {/* la estrella que cuelga */}
            <div style={{ width: 1, height: 18, background: DORADO, opacity: 0.8 }} />
            <div style={{ marginTop: -6 }}>
              <Estrella size={22} />
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: DORADO,
                color: NOCHE,
                borderRadius: 999,
                padding: '4px 12px',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 2,
              }}>
              KARAOKE
            </div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{plazo(challenge)}</div>
            <Pressable accessibilityRole="button" onPress={() => ir(voces.length > 0)}>
              <View style={t.portada}>
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
            </Pressable>
            <Text numberOfLines={2} style={t.cancion}>
              {game.song}
            </Text>
            {!!game.artist && (
              <Text numberOfLines={1} style={t.artista}>
                {game.artist}
              </Text>
            )}
            <View style={t.voces}>
              {voces.slice(0, 6).map((u, i) => (
                <View key={u} style={[t.cara, { marginLeft: i ? -8 : 0 }]}>
                  <Avatar userId={u} size={26} />
                </View>
              ))}
              <Text style={t.vocesTxt}>
                {voces.length === 0
                  ? 'nadie ha cantado aún'
                  : voces.length === 1
                    ? '1 voz'
                    : `${voces.length} voces`}
              </Text>
            </View>
            <View style={t.botones}>
              {voces.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => ir(true)}
                  style={[t.boton, t.oro]}>
                  <Icon icon={Play} size={16} color={NOCHE} />
                  <Text style={[t.botonTxt, { color: NOCHE }]}>Ver el karaoke</Text>
                </Pressable>
              )}
              {abierto && !cantado && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => ir()}
                  style={[t.boton, voces.length ? t.hueco : t.oro]}>
                  <Icon icon={Mic} size={16} color={voces.length ? '#FFFFFF' : NOCHE} />
                  <Text style={[t.botonTxt, { color: voces.length ? '#FFFFFF' : NOCHE }]}>
                    Cantar
                  </Text>
                </Pressable>
              )}
            </View>
          </div>
        </div>
      </div>

      {/* Las tablas del escenario y el frente de rayas */}
      <div
        style={{
          height: 16,
          background: `repeating-linear-gradient(90deg, #D9C7A4 0 30px, #CDB993 30px 31px)`,
          borderTop: `2px solid ${DORADO}`,
        }}
      />
      <div
        style={{
          height: 26,
          background: `repeating-linear-gradient(90deg, ${VERDE} 0 22px, ${CREMA} 22px 44px)`,
          borderTop: `2px solid ${DORADO}`,
          borderBottom: `2px solid ${DORADO}`,
          margin: '0 -12px',
        }}
      />
      <div style={{ height: 14, background: '#B23A3A', margin: '0 -12px' }} />
    </div>
  );
}

const t = StyleSheet.create({
  portada: {
    width: 132,
    height: 132,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 3,
    borderColor: DORADO,
    boxShadow: '0 14px 34px rgba(0,0,0,0.5)',
  },
  cancion: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  artista: { color: 'rgba(255,255,255,0.75)', fontSize: 15, textAlign: 'center' },
  voces: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  cara: { borderRadius: 15, borderWidth: 2, borderColor: NOCHE },
  vocesTxt: { color: DORADO, fontSize: 13, fontWeight: '700', marginLeft: 8 },
  botones: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 4 },
  boton: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  oro: { backgroundColor: DORADO },
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
