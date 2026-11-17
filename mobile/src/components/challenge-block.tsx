import { router } from 'expo-router';
import { Heart, MessageCircle, Mic, Play, Plus, X } from 'lucide-react-native';
import { useLayoutEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Hand, Radius, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import type { Moment, Proposal } from '@/data/types';
import { useFamily, useFamilyColorMode } from '@/lib/families';
import { daysLeft } from '@/lib/time';

import { FamilyCard, FamilyTag } from './family';
import { Icon } from './icon';
import { MomentCard } from './moment-card';
import { SPRINGY_CSS, useSmoothHeight } from './motion';
import { NudgeBell } from './nudge-bell';
import { Avatar, AvatarRow, Photo } from './ui';

const TILE_W = 150;
const TILE_H = 196;

/** «de hoy», «de ayer» o «15 nov» (el día de una propuesta). */
function dayLabel(at: number) {
  const day = (t: number) => new Date(t).setHours(0, 0, 0, 0);
  const diff = Math.round((day(Date.now()) - day(at)) / 86_400_000);
  if (diff === 0) return 'de hoy';
  if (diff === 1) return 'de ayer';
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(at);
}

/**
 * Un reto (o la propuesta del día) en «Hoy»: todas sus respuestas juntas, en una tira que se desliza,
 * con el nombre del reto bien a la vista. Así, con varios retos a la vez, se
 * sabe a cuál pertenece cada foto y el «Hoy» no se convierte en un caos.
 */
export function ChallengeBlock({ challenge, answers }: { challenge: Proposal; answers: Moment[] }) {
  const theme = useTheme();
  // Retos y propuestas del día se agrupan igual; cambia solo su familia y sus palabras.
  const isChallenge = challenge.kind === 'challenge';
  // un plan: varias publicaciones (de varias personas) de un mismo día, importadas
  const isPlan = challenge.kind === 'plan';
  // un minijuego de karaoke: se canta en su pantalla y se ve el montaje
  const karaoke = challenge.game?.type === 'karaoke';
  const family = isChallenge ? 'challenge' : isPlan ? 'memory' : 'prompt';
  const fam = useFamily(family);
  const theme0 = useTheme();
  // Sin color: el botón de participar, neutro.
  const plain = useFamilyColorMode() === 'plain';
  const f = plain ? { ...fam, color: theme0.text, tint: theme0.soft } : fam;
  const { me, user } = useStore();
  const open = !challenge.endsAt || challenge.endsAt > Date.now();
  const left = challenge.endsAt && open ? daysLeft(challenge.endsAt) : undefined;
  const ordered = [...answers].sort((a, b) => b.sharedAt - a.sharedAt);
  // Quién ha participado (nunca quién falta).
  const people = [...new Set(ordered.map((m) => m.authorId))];
  const names = people.map((id) => (id === me ? 'tú' : user(id).name.split(' ')[0]));
  const list =
    names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : names[0];
  const mine = people.includes(me);
  // La respuesta abierta en grande (con sus comentarios), y las animaciones de paso.
  const [openId, setOpenId] = useState<string | null>(null);
  const tiles = useRef(new Map<string, HTMLElement>());
  const panel = useRef<HTMLElement | null>(null);
  const photo = useRef<HTMLElement | null>(null);
  const grow = useRef<DOMRect | null>(null);
  const shrink = useRef<{ id: string; rect: DOMRect } | null>(null);
  const opened = ordered.find((m) => m.id === openId);
  // La tarjeta crece al abrir una respuesta y encoge al cerrarla, sin saltos.
  const cardRef = useSmoothHeight([openId, ordered.length]);
  const rest = ordered.filter((m) => m.id !== openId);

  const openAnswer = (id: string | null) => {
    if (id === openId) return;
    grow.current = id ? (tiles.current.get(id)?.getBoundingClientRect() ?? null) : null;
    shrink.current =
      openId && photo.current ? { id: openId, rect: photo.current.getBoundingClientRect() } : null;
    setOpenId(id);
  };

  useLayoutEffect(() => {
    if (Platform.OS !== 'web') return;
    // La que se cierra vuelve, encogiendo, a su sitio en la tira.
    const back = shrink.current;
    shrink.current = null;
    if (back) {
      const tile = tiles.current.get(back.id);
      const m = ordered.find((x) => x.id === back.id);
      if (tile) flyInto(tile, back.rect, m?.imageUri);
    }
    // La que se abre crece desde su miniatura hasta la publicación entera.
    const from = grow.current;
    grow.current = null;
    const box = panel.current;
    const pic = photo.current;
    if (!openId || !from || !box || typeof box.animate !== 'function') return;
    void box;
    const ease = 'cubic-bezier(.2,.85,.25,1)';
    // (el alto de la tarjeta lo anima useSmoothHeight: crece y encoge sin saltos)
    if (pic) {
      const to = pic.getBoundingClientRect();
      const image = opened?.imageUri;
      if (image) {
        // Vuela una copia de la miniatura (su imagen ya está cargada); la foto
        // grande se enseña al aterrizar: así no se ve en blanco ni salta.
        pic.style.visibility = 'hidden';
        const ghost = document.createElement('div');
        Object.assign(ghost.style, {
          position: 'fixed',
          left: `${from.left}px`,
          top: `${from.top}px`,
          width: `${from.width}px`,
          height: `${from.height}px`,
          background: `#2B2E33 url("${image}") center / cover no-repeat`,
          borderRadius: '18px',
          zIndex: '999',
          pointerEvents: 'none',
          transformOrigin: 'top left',
          boxShadow: '0 18px 40px rgba(20,22,26,0.25)',
        });
        document.body.appendChild(ghost);
        const fly = ghost.animate(
          [
            { transform: 'none', borderRadius: '18px' },
            {
              transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})`,
              borderRadius: '12px',
            },
          ],
          { duration: 560, easing: SPRINGY_CSS, fill: 'forwards' },
        );
        const land = () => {
          pic.style.visibility = '';
          ghost.remove();
        };
        fly.onfinish = land;
        fly.oncancel = land;
      } else {
        pic.style.transformOrigin = 'top left';
        pic.animate(
          [
            {
              transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`,
              borderRadius: '18px',
            },
            { transform: 'none' },
          ],
          { duration: 560, easing: ease },
        );
      }
      // Lo demás (autor, reacciones, comentarios) aparece detrás, en cascada.
      [...(pic.parentElement?.children ?? [])]
        .filter((el) => el !== pic)
        .forEach((el, i) =>
          (el as HTMLElement).animate(
            [
              { opacity: 0, transform: 'translateY(14px)' },
              { opacity: 1, transform: 'none' },
            ],
            { duration: 420, delay: 260 + i * 70, easing: ease, fill: 'backwards' },
          ),
        );
    }
    // Que se vea entera, sin saltos: después de crecer, se coloca en pantalla.
    const id = setTimeout(() => {
      const r = box.getBoundingClientRect();
      if (r.top < 110 || r.top > window.innerHeight * 0.55)
        box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  const participated = !list
    ? ''
    : isPlan
      ? `Fotos de ${list}`
      : people.length === 1 && mine
        ? 'Has participado'
        : `${list[0].toUpperCase()}${list.slice(1)} ${people.length === 1 ? 'ha' : 'han'} participado`;

  return (
    <FamilyCard family={family} boxRef={cardRef} style={{ padding: 16, gap: 12 }}>
      <View style={styles.head}>
        <FamilyTag
          family={family}
          detail={
            isPlan
              ? new Intl.DateTimeFormat('es-ES', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }).format(challenge.startsAt)
              : !isChallenge
                ? dayLabel(challenge.startsAt)
                : !open
                  ? 'terminado'
                  : left
                    ? left === 1
                      ? 'queda 1 día'
                      : `quedan ${left} días`
                    : 'sin fecha'
          }
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
            {ordered.length}{' '}
            {isPlan
              ? ordered.length === 1
                ? 'publicación'
                : 'publicaciones'
              : ordered.length === 1
                ? 'respuesta'
                : 'respuestas'}
          </Text>
          {open && (
            <NudgeBell
              targetId={challenge.id}
              groupId={challenge.groupId}
              done={people}
              owner={challenge.createdBy}
              label={isChallenge ? 'el reto' : 'la propuesta'}
            />
          )}
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={!isChallenge}
        onPress={() =>
          router.push({ pathname: '/group/[id]/retos', params: { id: challenge.groupId } })
        }>
        <Text style={[styles.title, { color: theme.text }]}>{challenge.title}</Text>
        {!!challenge.body && (
          <Text numberOfLines={2} style={{ color: theme.textSecondary, fontSize: 15 }}>
            {challenge.body}
          </Text>
        )}
      </Pressable>
      {karaoke && answers.length > 0 && (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({ pathname: '/karaoke/[id]', params: { id: challenge.id, watch: '1' } })
          }
          style={[styles.watch, { backgroundColor: f.color }]}>
          <Icon icon={Play} size={16} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>
            {people.length > 1 ? `Ver el karaoke · ${people.length} voces` : 'Ver el karaoke'}
          </Text>
        </Pressable>
      )}

      {opened && (
        <View
          ref={(n) => {
            panel.current = n as unknown as HTMLElement;
          }}
          style={styles.panel}>
          <MomentCard
            key={opened.id}
            moment={opened}
            embedded
            photoRef={(n) => {
              photo.current = n as HTMLElement;
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar la respuesta"
            onPress={() => openAnswer(null)}
            style={styles.close}>
            <Icon icon={X} size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingVertical: 4, paddingRight: 4 }}>
        {rest.map((m) => (
          <Pressable
            key={m.id}
            ref={(n) => {
              if (n) tiles.current.set(m.id, n as unknown as HTMLElement);
              else tiles.current.delete(m.id);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Abrir la respuesta de ${user(m.authorId).name}`}
            onPress={() => openAnswer(m.id)}
            style={styles.tile}>
            {m.imageUri || m.videoUri ? (
              <Photo moment={m} style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.paper, { backgroundColor: f.tint }]}>
                <Text numberOfLines={6} style={[styles.paperText, { color: theme.text }]}>
                  {m.text ?? '🎙'}
                </Text>
              </View>
            )}
            <View style={styles.tileFoot}>
              <Avatar userId={m.authorId} size={22} />
              <Text numberOfLines={1} style={styles.tileName}>
                {m.authorId === me ? 'Tú' : user(m.authorId).name.split(' ')[0]}
              </Text>
              {m.reactions.length > 0 && (
                <View style={styles.count}>
                  <Icon icon={Heart} size={11} color="#FFFFFF" />
                  <Text style={styles.countText}>{m.reactions.length}</Text>
                </View>
              )}
              {m.comments.length > 0 && (
                <View style={styles.count}>
                  <Icon icon={MessageCircle} size={11} color="#FFFFFF" />
                  <Text style={styles.countText}>{m.comments.length}</Text>
                </View>
              )}
            </View>
          </Pressable>
        ))}
        {/* en el karaoke, cada uno canta una vez */}
        {open && !(karaoke && mine) && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isChallenge
                ? mine
                  ? 'Añadir otra respuesta al reto'
                  : 'Participar en el reto'
                : mine
                  ? 'Añadir otra respuesta a la propuesta'
                  : 'Responder a la propuesta'
            }
            onPress={() =>
              karaoke
                ? router.push({ pathname: '/karaoke/[id]', params: { id: challenge.id } })
                : router.push({
                    pathname: '/publish',
                    params: { groupId: challenge.groupId, proposalId: challenge.id },
                  })
            }
            style={[styles.tile, styles.join, { borderColor: f.color }]}>
            <Icon icon={karaoke ? Mic : Plus} size={26} color={f.color} />
            <Text style={[styles.joinText, { color: f.color }]}>
              {karaoke
                ? mine
                  ? 'Cantar otra vez'
                  : 'Cantar'
                : mine
                  ? 'Añadir otra'
                  : isChallenge
                    ? 'Participar'
                    : 'Responder'}
            </Text>
          </Pressable>
        )}
      </ScrollView>

      <View style={styles.foot}>
        <AvatarRow userIds={people} size={24} />
        <Text style={{ color: theme.textSecondary, fontSize: 13, flexShrink: 1 }}>
          {participated}
        </Text>
      </View>
    </FamilyCard>
  );
}

/**
 * La foto que se cierra vuela, encogiendo, hasta su miniatura en la tira: una
 * copia flotante (para que no la recorte la tira) y, al llegar, la miniatura.
 */
function flyInto(tile: HTMLElement, from: DOMRect, image?: string) {
  if (typeof tile.animate !== 'function' || typeof document === 'undefined') return;
  const to = tile.getBoundingClientRect();
  const ease = 'cubic-bezier(.3,.8,.25,1)';
  if (!image) {
    tile.animate(
      [
        { transform: 'scale(1.18)', opacity: 0.3 },
        { transform: 'none', opacity: 1 },
      ],
      {
        duration: 420,
        easing: ease,
      },
    );
    return;
  }
  const ghost = document.createElement('div');
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
    backgroundImage: `url("${image}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    borderRadius: '18px',
    zIndex: '999',
    pointerEvents: 'none',
    transformOrigin: 'top left',
    boxShadow: '0 18px 40px rgba(20,22,26,0.25)',
  });
  document.body.appendChild(ghost);
  ghost
    .animate(
      [
        { transform: 'none', opacity: 1 },
        {
          transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})`,
          opacity: 1,
        },
      ],
      { duration: 480, easing: ease, fill: 'forwards' },
    )
    .finished.then(() => ghost.remove())
    .catch(() => ghost.remove());
  tile.animate([{ opacity: 0 }, { opacity: 0, offset: 0.92 }, { opacity: 1 }], { duration: 500 });
}

const styles = StyleSheet.create({
  watch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 22,
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
  },
  // Al colocarse en pantalla, que no quede bajo la cabecera.
  panel: { position: 'relative', scrollMarginTop: 150 } as never,
  close: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,22,26,0.55)',
    zIndex: 5,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 24, lineHeight: 28, fontWeight: '600', letterSpacing: -0.4 },
  tile: {
    width: TILE_W,
    height: TILE_H,
    borderRadius: Radius.inner,
    overflow: 'hidden',
    backgroundColor: '#2B2E33',
  },
  paper: { padding: 14, justifyContent: 'center' },
  paperText: { fontFamily: Hand, fontSize: 22, lineHeight: 23, textAlign: 'center' },
  tileFoot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  tileName: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', flex: 1 },
  count: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  countText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  join: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  joinText: { fontSize: 15, fontWeight: '600' },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
