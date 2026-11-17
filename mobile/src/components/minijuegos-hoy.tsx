// Cada minijuego tiene su propia tarjeta en «Hoy», con su identidad: el
// karaoke es un póster de los 80-90 con su tele de tubo (y se mueve con la
// inclinación del móvil); el cuento a trozos, una
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
import { capa, useInclinacion } from '@/lib/inclinacion';
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

/* ───────────── Karaoke: un póster de los 80-90 con su tele de tubo ───────────── */

// cálidos y suaves (naranja y rojo), para que entone con el resto de la app
const NARANJA = '#FFB48A';
const ROJO_P = '#E8563F';
/** las letras grandes: crema cálida (antes moradas) */
const MORADO = '#FFF3E0';
const AMARILLO = '#FFE3A1';
const CREMA_P = '#FFF6EA';
/** la tinta: un marrón rojizo oscuro (antes violeta) */
const TINTA_P = '#4A2219';

/** Letras gordas con relieve: un borde y varias sombras en escalera. */
const relieve = (lado: string, borde: string, prof = 6) =>
  [
    `-2px -2px 0 ${borde}`,
    `2px -2px 0 ${borde}`,
    `-2px 2px 0 ${borde}`,
    `2px 2px 0 ${borde}`,
    ...Array.from(
      { length: prof },
      (_, i) => `${i + 3}px ${i + 3}px 0 ${i === prof - 1 ? borde : lado}`,
    ),
  ].join(', ');

// La entrada del póster (cuando aparece en pantalla, una vez).
const ANIM_POSTER = `
@keyframes kpTarjeta { from { opacity: 0; transform: scale(.94) translateY(14px) } to { opacity: 1; transform: none } }
@keyframes kpLetras { 0% { opacity: 0; transform: translateY(-46px) scale(1.5) rotate(-10deg) } 60% { opacity: 1; transform: translateY(4px) scale(.96) rotate(1deg) } 100% { opacity: 1; transform: none } }
@keyframes kpTele { 0% { opacity: 0; transform: translateX(70px) rotate(18deg) } 70% { opacity: 1; transform: translateX(-4px) rotate(-2deg) } 100% { opacity: 1; transform: none } }
@keyframes kpSube { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: none } }
@keyframes kpBrillo { 0% { opacity: 0; transform: scale(0) rotate(-90deg) } 70% { opacity: 1; transform: scale(1.3) rotate(10deg) } 100% { opacity: 1; transform: none } }
@keyframes kpTitila { 0%, 100% { transform: scale(1) } 50% { transform: scale(.75) } }
`;

/** Lo de dentro de la tele, llenando toda la pantalla (sin bandas a los lados). */
const LLENA: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
};

/** Un destello de cuatro puntas. */
function Destello({ size, style }: { size: number; style?: React.CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ position: 'absolute', overflow: 'visible', ...style }}>
      <path
        d="M50 0 C55 35 65 45 100 50 C65 55 55 65 50 100 C45 65 35 55 0 50 C35 45 45 35 50 0Z"
        fill={AMARILLO}
        stroke={TINTA_P}
        strokeWidth={5}
      />
    </svg>
  );
}

export function KaraokeHoy({ challenge, answers }: { challenge: Proposal; answers: Moment[] }) {
  const theme = useTheme();
  const { me, user } = useStore();
  const game = challenge.game!;
  const abierto = !challenge.endsAt || challenge.endsAt > Date.now();
  const voces = [...new Set([...answers.map((m) => m.authorId), ...(game.montaje?.voces ?? [])])];
  const cantado = voces.includes(me);
  const montaje = useMontaje(game);
  // en la tele: el montaje; si aún no, la última toma; si nadie ha cantado, la carátula
  const ultima = [...answers].filter((m) => m.videoUri).sort((a, b) => b.sharedAt - a.sharedAt)[0];
  const enLaTele = montaje.video ?? ultima?.videoUri;
  const ir = (watch?: boolean) =>
    router.push({
      pathname: '/karaoke/[id]',
      params: { id: challenge.id, ...(watch ? { watch: '1' } : {}) },
    });
  const caja = useRef<HTMLDivElement | null>(null);
  useInclinacion(caja);
  // la entrada: empieza cuando la tarjeta aparece en pantalla
  const [visto, setVisto] = useState(false);
  useEffect(() => {
    const el = caja.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisto(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisto(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const entra = (nombre: string, retraso: number, ms = 650): React.CSSProperties => ({
    animation: `${nombre} ${ms}ms cubic-bezier(.2,.9,.25,1.1) ${retraso}ms both`,
    animationPlayState: visto ? 'running' : 'paused',
  });
  return (
    <div
      ref={caja}
      style={{
        position: 'relative',
        marginTop: 26,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        // toda la tarjeta se inclina un poco con el móvil
        transform:
          'perspective(900px) rotateY(calc(var(--ix, 0) * 4deg)) rotateX(calc(var(--iy, 0) * -3deg))',
      }}>
      <style>{ANIM_POSTER}</style>
      <div style={{ position: 'absolute', inset: 0, ...entra('kpTarjeta', 0, 500) }}>
        {/* el póster: naranja con trama de puntos */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 26,
            overflow: 'hidden',
            background: `radial-gradient(circle, rgba(232,86,63,.35) 1.4px, transparent 1.8px) 0 0 / 9px 9px, radial-gradient(ellipse at 30% 20%, #FFCDA8, ${NARANJA} 55%, #FF8F66)`,
            boxShadow: '0 18px 40px rgba(20,22,26,0.25)',
          }}>
          {!!game.artwork && (
            <div
              style={{
                position: 'absolute',
                inset: -30,
                background: `url("${game.artwork}") center / cover`,
                filter: 'grayscale(1) contrast(1.1)',
                mixBlendMode: 'multiply',
                opacity: 0.1,
              }}
            />
          )}
        </div>
      </div>

      {/* «KARAOKE» en grande: se sale por arriba */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: -30,
          zIndex: 3,
          pointerEvents: 'none',
          ...entra('kpLetras', 120, 800),
        }}>
        <div
          style={{
            textAlign: 'center',
            fontSize: 58,
            lineHeight: '62px',
            fontWeight: 900,
            fontStyle: 'italic',
            letterSpacing: -1,
            color: MORADO,
            textShadow: relieve(ROJO_P, TINTA_P, 7),
            transform: `${capa(9)} rotate(-4deg)`,
          }}>
          KARAOKE
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          top: -26,
          left: 18,
          zIndex: 4,
          ...entra('kpBrillo', 650, 500),
        }}>
        <div style={{ animation: 'kpTitila 2.6s ease-in-out 1.4s infinite' }}>
          <Destello size={30} style={{ position: 'relative', transform: capa(14) }} />
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          top: 30,
          right: 22,
          zIndex: 4,
          ...entra('kpBrillo', 800, 500),
        }}>
        <div style={{ animation: 'kpTitila 2.2s ease-in-out 1.9s infinite' }}>
          <Destello size={20} style={{ position: 'relative', transform: capa(16) }} />
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          gap: 10,
          padding: '54px 16px 14px',
          alignItems: 'center',
        }}>
        {/* la canción, a lo póster */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            ...entra('kpSube', 380, 600),
          }}>
          <div
            style={{
              fontSize: 27,
              lineHeight: '30px',
              fontWeight: 900,
              color: AMARILLO,
              textShadow: relieve(ROJO_P, TINTA_P, 3),
              transform: capa(5),
              wordBreak: 'break-word',
            }}>
            {game.song.toUpperCase()}
          </div>
          {!!game.artist && (
            <div
              style={{
                alignSelf: 'flex-start',
                background: ROJO_P,
                color: CREMA_P,
                border: `2px solid ${TINTA_P}`,
                borderRadius: 8,
                padding: '2px 10px',
                fontSize: 14,
                fontWeight: 800,
                boxShadow: `3px 3px 0 ${TINTA_P}`,
                transform: capa(4),
              }}>
              {game.artist}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
            {voces.slice(0, 5).map((u, i) => (
              <div
                key={u}
                style={{
                  marginLeft: i ? -8 : 0,
                  borderRadius: 16,
                  border: `2px solid ${TINTA_P}`,
                  lineHeight: 0,
                }}>
                <Avatar userId={u} size={26} />
              </div>
            ))}
            <span
              style={{
                marginLeft: voces.length ? 8 : 0,
                color: TINTA_P,
                fontSize: 13,
                fontWeight: 800,
              }}>
              {voces.length === 0
                ? '¡Nadie ha cantado aún!'
                : voces.length === 1
                  ? `${user(voces[0]).name.split(' ')[0]} ya cantó`
                  : `${voces.length} voces`}
            </span>
          </div>
        </div>

        {/* la tele de tubo */}
        <Pressable accessibilityRole="button" onPress={() => ir(voces.length > 0)}>
          <div style={entra('kpTele', 260, 800)}>
            <div
              style={{
                width: 138,
                transform: `${capa(-6)} rotate(4deg)`,
                background: 'linear-gradient(160deg, #6E5A52, #43332D)',
                borderRadius: 22,
                padding: 10,
                paddingBottom: 22,
                border: `3px solid ${TINTA_P}`,
                boxShadow: `6px 7px 0 ${TINTA_P}`,
                position: 'relative',
              }}>
              <div
                style={{
                  position: 'relative',
                  aspectRatio: '1 / 1',
                  borderRadius: '16px / 18px',
                  overflow: 'hidden',
                  background: '#21170F',
                  boxShadow: 'inset 0 0 18px rgba(0,0,0,.8)',
                }}>
                {enLaTele ? (
                  <video
                    src={enLaTele}
                    poster={montaje.poster ?? ultima?.imageUri}
                    muted
                    autoPlay
                    loop
                    playsInline
                    style={LLENA}
                  />
                ) : game.artwork ? (
                  <img src={game.artwork} alt="" style={LLENA} />
                ) : null}
                {/* líneas de la pantalla y el brillo del cristal */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'repeating-linear-gradient(0deg, rgba(0,0,0,.22) 0 1px, transparent 1px 3px), radial-gradient(ellipse at 30% 20%, rgba(255,255,255,.28), transparent 45%)',
                    pointerEvents: 'none',
                  }}
                />
              </div>
              {/* botones de la tele */}
              <div style={{ position: 'absolute', bottom: 6, right: 14, display: 'flex', gap: 5 }}>
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    style={{ width: 8, height: 8, borderRadius: 4, background: '#A89186' }}
                  />
                ))}
              </div>
              <div
                style={{
                  position: 'absolute',
                  bottom: 7,
                  left: 14,
                  width: 34,
                  height: 5,
                  borderRadius: 3,
                  background:
                    'repeating-linear-gradient(90deg, #8C766C 0 2px, transparent 2px 4px)',
                }}
              />
            </div>
          </div>
        </Pressable>
      </div>

      {/* abajo: el plazo, el botón (pequeño) y la campanita, con los colores de tu tema */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          ...entra('kpSube', 520, 550),
          background: theme.card,
          borderTop: `3px solid ${TINTA_P}`,
          borderBottomLeftRadius: 26,
          borderBottomRightRadius: 26,
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
        <span
          style={{
            color: theme.text,
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}>
          {plazo(challenge) || 'karaoke'}
        </span>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {voces.length > 0 && (
            <Pressable
              accessibilityRole="button"
              onPress={() => ir(true)}
              style={[kp.boton, { backgroundColor: theme.accent }]}>
              <Icon icon={Play} size={14} color={theme.onAccent} />
              <Text style={[kp.botonTxt, { color: theme.onAccent }]}>Ver</Text>
            </Pressable>
          )}
          {abierto && !cantado && (
            <Pressable
              accessibilityRole="button"
              onPress={() => ir()}
              style={[kp.boton, { backgroundColor: voces.length ? theme.soft : theme.accent }]}>
              <Icon icon={Mic} size={14} color={voces.length ? theme.text : theme.onAccent} />
              <Text style={[kp.botonTxt, { color: voces.length ? theme.text : theme.onAccent }]}>
                Cantar
              </Text>
            </Pressable>
          )}
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
    </div>
  );
}

const kp = StyleSheet.create({
  boton: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  botonTxt: { fontSize: 14, fontWeight: '700' },
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
