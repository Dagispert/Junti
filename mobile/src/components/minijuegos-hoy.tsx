// Cada minijuego tiene su propia tarjeta en «Hoy», con su identidad: el
// karaoke es un póster de los 80-90 con su tele de tubo (y se mueve con la
// inclinación del móvil); el cuento a trozos, una
// página de libreta escrita a mano.

import { Image } from 'expo-image';
import { router } from 'expo-router';
import { BookOpen, Brush, Lock, Mic, Pause, Play, Search } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Hand, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import type { Moment, Proposal } from '@/data/types';
import { useEsquema } from '@/lib/appearance';
import { useCuentoEntero } from '@/lib/cuento-entero';
import { usePasosDibujo } from '@/lib/dibujo';
import { capa, useInclinacion } from '@/lib/inclinacion';
import { useMontaje } from '@/lib/montaje';
import { NIVELES, solucion, useFotoZoom, useResultadosZoom } from '@/lib/zoom';
import { daysLeft } from '@/lib/time';

import { ComentariosJuego } from './comentarios-juego';
import { Lupa } from './lupa';
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
      {!abierto && (
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            background: theme.card,
            borderBottomLeftRadius: 26,
            borderBottomRightRadius: 26,
            padding: '0 12px 12px',
            marginTop: -14,
          }}>
          <ComentariosJuego proposalId={challenge.id} />
        </div>
      )}
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
  // terminado: se escucha aquí mismo, y la cara de quien habla se agranda
  const cuento = useCuentoEntero({
    groupId: challenge.groupId,
    proposalId: challenge.id,
    inicio: juego.inicio,
    trozos,
    cargarCierre: false,
  });
  const habla = cuento.sonando;
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
        {!abierto && (
          <View style={c.eslabon}>
            <View
              style={[
                c.narradora,
                { borderColor: tinta },
                (habla === -1 || habla === trozos.length) && c.hablando,
              ]}>
              <Icon icon={BookOpen} size={14} color={tinta} />
            </View>
          </View>
        )}
        {trozos.map((t, i) => (
          <View key={t.id} style={c.eslabon}>
            {(i > 0 || !abierto) && <View style={[c.hilo, { borderColor: tinta }]} />}
            <View style={[c.cara, habla === i && c.hablando]}>
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
        disabled={cuento.preparando}
        onPress={abierto ? ir : cuento.sonando === null ? cuento.escuchar : cuento.parar}
        style={[c.boton, { backgroundColor: tinta }]}>
        <Icon
          icon={abierto ? Mic : cuento.sonando === null ? Play : Pause}
          size={16}
          color={papel}
        />
        <Text style={{ color: papel, fontSize: 15, fontWeight: '700' }}>
          {abierto
            ? meToca
              ? 'Seguir el cuento'
              : 'Ver el cuento'
            : cuento.preparando
              ? 'Preparando el cuento…'
              : cuento.sonando === null
                ? 'Escuchar el cuento entero'
                : 'Parar'}
        </Text>
      </Pressable>
      {!abierto && (
        <ComentariosJuego
          proposalId={challenge.id}
          colorTexto={tinta}
          colorSuave={oscuro ? 'rgba(241,233,218,0.6)' : 'rgba(43,38,32,0.55)'}
          colorFondo={oscuro ? 'rgba(241,233,218,0.08)' : 'rgba(43,38,32,0.06)'}
        />
      )}
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
  // el cambio de tamaño, suave
  cara: { borderRadius: 18, transitionProperty: 'transform', transitionDuration: '260ms' } as never,
  // quien está hablando: su cara, un poco más grande
  hablando: { transform: [{ scale: 1.3 }], zIndex: 2 },
  narradora: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    transitionProperty: 'transform',
    transitionDuration: '260ms',
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

/* ───────────── Zoom misterioso: un expediente de detective ───────────── */

const ANIM_EXPEDIENTE = `
@keyframes zxSube { from { opacity: 0; transform: translateY(18px) } to { opacity: 1; transform: none } }
@keyframes zxLupa { 0% { opacity: 0; transform: translateX(-40px) rotate(-25deg) scale(.8) } 70% { opacity: 1; transform: rotate(4deg) scale(1.03) } 100% { opacity: 1; transform: none } }
@keyframes zxSello { 0% { opacity: 0; transform: scale(2.2) rotate(-25deg) } 60% { opacity: 1; transform: scale(.92) rotate(-12deg) } 100% { opacity: 1; transform: scale(1) rotate(-12deg) } }
@keyframes zxBusca { 0%, 100% { transform: translate(0, 0) } 25% { transform: translate(3px, -2px) } 50% { transform: translate(-2px, 3px) } 75% { transform: translate(-3px, -1px) } }
`;

export function ZoomHoy({ challenge }: { challenge: Proposal }) {
  const theme = useTheme();
  const oscuro = useEsquema() === 'dark';
  const { me, user } = useStore();
  const z = challenge.zoom!;
  const abierto = !challenge.endsAt || challenge.endsAt > Date.now();
  const foto = useFotoZoom(z.path);
  const resultados = useResultadosZoom(challenge.id);
  const mio = resultados.find((r) => r.user_id === me);
  const soyAutor = challenge.createdBy === me;
  const [sol, setSol] = useState<string | null>(null);
  useEffect(() => {
    if (!abierto || soyAutor || mio?.terminado) solucion(challenge.id).then(setSol);
  }, [abierto, soyAutor, mio?.terminado, challenge.id]);
  const aciertos = resultados.filter((r) => r.acierto);
  const ir = () => router.push({ pathname: '/zoom/[id]', params: { id: challenge.id } });

  const caja = useRef<HTMLDivElement | null>(null);
  useInclinacion(caja);
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

  // el expediente: papel manila (más oscuro en modo oscuro)
  const manila = oscuro ? '#3B3123' : '#EBD8AE';
  const pestana = oscuro ? '#4A3E2C' : '#E2CB97';
  const tinta = oscuro ? '#F3E6CB' : '#3E2F1C';
  const sello = '#C8402E';
  const terminado = !abierto;

  const estado = soyAutor
    ? `${aciertos.length} de ${resultados.length} lo han adivinado`
    : mio?.acierto
      ? `¡Lo adivinaste! +${mio.puntos} pt`
      : mio?.terminado
        ? 'Esta vez no lo adivinaste'
        : mio
          ? `Vas por el intento ${mio.nivel + 1}`
          : '¿Te atreves?';

  return (
    <div
      ref={caja}
      style={{
        position: 'relative',
        marginTop: 18,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        transform:
          'perspective(900px) rotateY(calc(var(--ix, 0) * 3deg)) rotateX(calc(var(--iy, 0) * -2deg))',
        ...entra('zxSube', 0, 500),
      }}>
      <style>{ANIM_EXPEDIENTE}</style>
      {/* la pestaña de la carpeta */}
      <div
        style={{
          position: 'absolute',
          top: -16,
          left: 22,
          height: 26,
          padding: '4px 14px 0',
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          background: pestana,
          color: tinta,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 2,
        }}>
        ZOOM MISTERIOSO
      </div>
      <div
        style={{
          position: 'relative',
          borderRadius: 22,
          background: manila,
          boxShadow: theme.shadow,
          padding: 16,
          overflow: 'hidden',
        }}>
        {/* fibras del papel */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'repeating-linear-gradient(115deg, rgba(0,0,0,.025) 0 2px, transparent 2px 7px)',
            pointerEvents: 'none',
          }}
        />
        <div style={{ position: 'relative', display: 'flex', gap: 14, alignItems: 'center' }}>
          {/* la lupa */}
          <Pressable accessibilityRole="button" onPress={ir}>
            <div
              style={{
                position: 'relative',
                width: 132,
                height: 150,
                ...entra('zxLupa', 150, 800),
              }}>
              <div style={{ transform: capa(-7) }}>
                <div
                  style={{ animation: terminado ? undefined : 'zxBusca 6s ease-in-out infinite' }}>
                  <div
                    style={{
                      borderRadius: '50%',
                      border: `7px solid ${tinta}`,
                      boxShadow:
                        '0 10px 24px rgba(0,0,0,.25), inset 0 0 0 3px rgba(255,255,255,.25)',
                      width: 118,
                      height: 118,
                      overflow: 'hidden',
                      position: 'relative',
                    }}>
                    <Lupa
                      src={foto}
                      cx={z.cx}
                      cy={z.cy}
                      zoom={terminado ? 1 : NIVELES[0]}
                      size={104}
                      redonda
                    />
                    {/* el brillo del cristal */}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '50%',
                        background:
                          'radial-gradient(ellipse at 30% 25%, rgba(255,255,255,.45), transparent 45%)',
                        pointerEvents: 'none',
                      }}
                    />
                  </div>
                  {/* el mango */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 92,
                      top: 104,
                      width: 16,
                      height: 52,
                      borderRadius: 8,
                      background: tinta,
                      transform: 'rotate(-45deg)',
                      transformOrigin: 'top center',
                    }}
                  />
                </div>
              </div>
            </div>
          </Pressable>

          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div
              style={{
                color: tinta,
                fontFamily: Hand,
                fontSize: 30,
                lineHeight: '30px',
                ...entra('zxSube', 300, 500),
              }}>
              {terminado || (sol && !abierto) ? `Era: ${sol ?? '…'}` : '¿Qué es esto?'}
            </div>
            <div
              style={{ color: tinta, opacity: 0.75, fontSize: 13, ...entra('zxSube', 380, 500) }}>
              Lo propone {soyAutor ? 'tú' : user(challenge.createdBy ?? '').name.split(' ')[0]} ·{' '}
              {plazo(challenge)}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginTop: 4,
                ...entra('zxSube', 460, 500),
              }}>
              {aciertos.slice(0, 5).map((r, i) => (
                <div
                  key={r.user_id}
                  style={{
                    marginLeft: i ? -8 : 0,
                    borderRadius: 15,
                    border: `2px solid ${manila}`,
                    lineHeight: 0,
                  }}>
                  <Avatar userId={r.user_id} size={24} />
                </div>
              ))}
              <span
                style={{
                  marginLeft: aciertos.length ? 8 : 0,
                  color: tinta,
                  fontSize: 13,
                  fontWeight: 700,
                }}>
                {estado}
              </span>
            </div>
          </div>
        </div>

        {/* el sello */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            right: 14,
            top: 10,
            pointerEvents: 'none',
            ...entra('zxSello', 650, 500),
          }}>
          <div
            style={{
              transform: `${capa(10)} rotate(-12deg)`,
              border: `3px solid ${sello}`,
              color: sello,
              borderRadius: 8,
              padding: '2px 8px',
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: 2,
              opacity: 0.85,
            }}>
            {terminado ? 'RESUELTO' : '¿QUÉ ES?'}
          </div>
        </div>

        {/* abajo: el botón */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 12,
          }}>
          <Pressable
            accessibilityRole="button"
            onPress={ir}
            style={[kp.boton, { backgroundColor: theme.accent }]}>
            <Icon
              icon={terminado || soyAutor || mio?.terminado ? Play : Search}
              size={14}
              color={theme.onAccent}
            />
            <Text style={[kp.botonTxt, { color: theme.onAccent }]}>
              {terminado || soyAutor || mio?.terminado ? 'Ver' : mio ? 'Seguir' : 'Adivinar'}
            </Text>
          </Pressable>
        </div>
        {terminado && (
          <div style={{ position: 'relative', marginTop: 12 }}>
            <ComentariosJuego
              proposalId={challenge.id}
              colorTexto={tinta}
              colorSuave={oscuro ? 'rgba(243,230,203,.6)' : 'rgba(62,47,28,.55)'}
              colorFondo={oscuro ? 'rgba(243,230,203,.08)' : 'rgba(62,47,28,.07)'}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────── Dibujo a ciegas: una tira de papel doblada en acordeón ───────────── */

const ANIM_ACORDEON = `
@property --pl { syntax: '<angle>'; inherits: true; initial-value: 62deg; }
@keyframes dbRespira { 0%,100% { --pl: 60deg } 50% { --pl: 67deg } }
@keyframes dbAbre { from { --pl: 70deg } to { --pl: 14deg } }
@keyframes dbSube { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
@keyframes dbCinta { from { opacity: 0; transform: translateY(-10px) rotate(-14deg) scale(1.2) } to { opacity: 1; transform: rotate(-5deg) } }
`;

/** Una hoja de la tira y, dentro, la siguiente (así se pliegan juntas). */
function HojaAcordeon({
  i,
  total,
  ancho,
  alto,
  contenido,
}: {
  i: number;
  total: number;
  ancho: number;
  alto: number;
  contenido: (i: number) => React.ReactNode;
}) {
  if (i >= total) return null;
  return (
    <div
      style={{
        position: i === 0 ? 'relative' : 'absolute',
        left: i === 0 ? 0 : '100%',
        top: 0,
        width: ancho,
        height: alto,
        transformOrigin: 'left center',
        transform: i === 0 ? 'rotateY(var(--pl))' : `rotateY(calc(var(--pl) * ${i % 2 ? -2 : 2}))`,
        transformStyle: 'preserve-3d',
        background: '#FFFDF7',
        borderLeft: i ? '1px solid rgba(0,0,0,.08)' : undefined,
        boxSizing: 'border-box',
      }}>
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>{contenido(i)}</div>
      {/* la sombra del pliegue: una cara mira a la luz y la otra no */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            i % 2
              ? 'linear-gradient(90deg, rgba(0,0,0,.16), rgba(0,0,0,.04))'
              : 'linear-gradient(90deg, rgba(0,0,0,0), rgba(0,0,0,.07))',
        }}
      />
      <HojaAcordeon i={i + 1} total={total} ancho={ancho} alto={alto} contenido={contenido} />
    </div>
  );
}

export function DibujoHoy({ challenge }: { challenge: Proposal }) {
  const theme = useTheme();
  const oscuro = useEsquema() === 'dark';
  const { me, user } = useStore();
  const meta = challenge.dibujo?.pasos ?? [];
  const n = meta.length;
  const abierto = !challenge.endsAt || challenge.endsAt > Date.now();
  const terminado = !abierto;
  const pasos = usePasosDibujo(challenge.id, n);
  const ultimo = meta.at(-1);
  const meToca = abierto && !!ultimo && ultimo.u !== me;
  const toca = n % 2 === 1 ? 'dibujo' : 'frase';
  const ir = () => router.push({ pathname: '/dibujo/[id]', params: { id: challenge.id } });
  const nombre = (uid?: string) => (uid ? user(uid).name.split(' ')[0] : 'Junti');

  const caja = useRef<HTMLDivElement | null>(null);
  useInclinacion(caja);
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
  const entra = (nombreAnim: string, retraso: number, ms = 600): React.CSSProperties => ({
    animation: `${nombreAnim} ${ms}ms cubic-bezier(.2,.9,.25,1.1) ${retraso}ms both`,
    animationPlayState: visto ? 'running' : 'paused',
  });

  // cartulina verde salvia, con tinta verde oscura
  const carton = oscuro ? '#25312A' : '#D9E6CF';
  const tinta = oscuro ? '#E3EEDB' : '#23402F';
  const cinta = oscuro ? 'rgba(242,165,65,.75)' : 'rgba(242,165,65,.85)';

  // la tira: como mucho 6 hojas (las últimas)
  const MAX = 6;
  const desde = Math.max(0, n - MAX);
  const hojas = meta.slice(desde);
  // plegada se ve más estrecha, así que las hojas pueden ser más grandes
  const ancho = terminado
    ? Math.min(62, Math.floor(290 / (Math.max(1, hojas.length) * 0.97)))
    : Math.min(80, Math.floor(280 / (Math.max(1, hojas.length) * 0.5)));
  const alto = terminado ? 84 : 104;
  const angulo = terminado ? 14 : 62;
  const anchoTira = Math.ceil(hojas.length * ancho * Math.cos((angulo * Math.PI) / 180)) + 6;

  const contenido = (i: number) => {
    const m = hojas[i];
    const p = pasos?.find((x) => x.orden === desde + i);
    if (terminado && p) {
      if (p.tipo === 'dibujo' && p.url)
        return (
          <img
            src={p.url}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        );
      return (
        <div
          style={{
            padding: 5,
            fontFamily: Hand,
            fontSize: 12,
            lineHeight: '13px',
            color: '#2B2B2B',
            overflow: 'hidden',
            height: '100%',
            boxSizing: 'border-box',
          }}>
          {p.texto}
        </div>
      );
    }
    // cerrado: solo el dorso, con quién lo hizo
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 0 6px',
          boxSizing: 'border-box',
          background:
            'repeating-linear-gradient(0deg, transparent 0 11px, rgba(63,127,214,.12) 11px 12px)',
        }}>
        <span style={{ fontFamily: Hand, fontSize: 26, color: 'rgba(35,64,47,.45)' }}>
          {m.t === 'd' ? '✎' : '?'}
        </span>
        <div style={{ lineHeight: 0 }}>
          <Avatar userId={m.u} size={20} />
        </div>
      </div>
    );
  };

  const primera = pasos?.find((p) => p.orden === 0)?.texto;
  const ultimaFrase = pasos
    ? [...pasos].reverse().find((p) => p.tipo === 'frase' && p.orden > 0)?.texto
    : undefined;

  const titulo = terminado
    ? 'Así fue cambiando'
    : meToca
      ? toca === 'dibujo'
        ? 'Te toca dibujar'
        : 'Te toca adivinar'
      : n === 1
        ? 'Esperando el primer dibujo'
        : 'Pasando de mano en mano';

  return (
    <div
      ref={caja}
      style={{
        position: 'relative',
        marginTop: 14,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        transform:
          'perspective(900px) rotateY(calc(var(--ix, 0) * 3deg)) rotateX(calc(var(--iy, 0) * -2deg))',
        ...entra('dbSube', 0, 500),
      }}>
      <style>{ANIM_ACORDEON}</style>
      <div
        style={{
          position: 'relative',
          borderRadius: 22,
          background: carton,
          boxShadow: theme.shadow,
          padding: '26px 16px 16px',
          overflow: 'hidden',
        }}>
        {/* textura de cartulina */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: 'radial-gradient(rgba(0,0,0,.05) 1px, transparent 1.2px) 0 0 / 7px 7px',
            opacity: 0.6,
          }}
        />
        {/* la cinta con el nombre */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 14,
            padding: '3px 12px',
            background: cinta,
            color: '#3A2A12',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 2,
            ...entra('dbCinta', 250, 500),
          }}>
          DIBUJO A CIEGAS
        </div>

        {/* la tira en acordeón */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir el dibujo a ciegas"
          onPress={ir}
          style={{ width: '100%' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '18px 0 10px',
              transform: capa(-6),
            }}>
            <div
              style={{
                width: anchoTira,
                perspective: 700,
                filter: 'drop-shadow(0 10px 12px rgba(0,0,0,.18))',
              }}>
              <div
                style={{
                  ['--pl' as never]: `${angulo}deg`,
                  transformStyle: 'preserve-3d',
                  width: ancho,
                  ...(terminado
                    ? entra('dbAbre', 300, 1400)
                    : {
                        animation: 'dbRespira 5s ease-in-out infinite',
                      }),
                }}>
                <HojaAcordeon
                  i={0}
                  total={hojas.length}
                  ancho={ancho}
                  alto={alto}
                  contenido={contenido}
                />
              </div>
            </div>
          </div>
        </Pressable>
        {desde > 0 && (
          <div
            style={{
              position: 'relative',
              textAlign: 'center',
              color: tinta,
              opacity: 0.6,
              fontSize: 12,
              marginTop: -4,
            }}>
            y {desde} {desde === 1 ? 'paso' : 'pasos'} más antes
          </div>
        )}

        <div
          style={{
            position: 'relative',
            marginTop: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}>
          <div
            style={{
              color: tinta,
              fontFamily: Hand,
              fontSize: 30,
              lineHeight: '32px',
              ...entra('dbSube', 350, 500),
            }}>
            {titulo}
          </div>
          {terminado && primera && ultimaFrase && (
            <div
              style={{
                color: tinta,
                fontSize: 15,
                lineHeight: '20px',
                ...entra('dbSube', 1500, 600),
              }}>
              Empezó en «{primera}» y acabó en «<b>{ultimaFrase}</b>»
            </div>
          )}
          <div style={{ color: tinta, opacity: 0.75, fontSize: 13, ...entra('dbSube', 420, 500) }}>
            Lo empezó {challenge.createdBy === me ? 'tú' : nombre(challenge.createdBy)} ·{' '}
            {n === 1 ? '1 paso' : `${n} pasos`}
            {plazo(challenge) ? ` · ${plazo(challenge)}` : ''}
          </div>
        </div>

        <div
          style={{
            position: 'relative',
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: 12,
          }}>
          <Pressable
            accessibilityRole="button"
            onPress={ir}
            style={[kp.boton, { backgroundColor: theme.accent }]}>
            <Icon
              icon={terminado || !meToca ? Play : toca === 'dibujo' ? Brush : Search}
              size={14}
              color={theme.onAccent}
            />
            <Text style={[kp.botonTxt, { color: theme.onAccent }]}>
              {terminado
                ? 'Ver la cadena'
                : meToca
                  ? toca === 'dibujo'
                    ? 'Dibujar'
                    : 'Adivinar'
                  : 'Ver'}
            </Text>
          </Pressable>
        </div>
        {terminado && (
          <div style={{ position: 'relative', marginTop: 12 }}>
            <ComentariosJuego
              proposalId={challenge.id}
              colorTexto={tinta}
              colorSuave={oscuro ? 'rgba(227,238,219,.6)' : 'rgba(35,64,47,.55)'}
              colorFondo={oscuro ? 'rgba(227,238,219,.08)' : 'rgba(35,64,47,.07)'}
            />
          </div>
        )}
      </div>
    </div>
  );
}
