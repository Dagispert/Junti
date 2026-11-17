import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ConnectionCard } from '@/components/connection-card';
import { GroupHeader } from '@/components/group-header';
import type { Moment, Proposal, Question, Song } from '@/data/types';
import { ChallengeBlock } from '@/components/challenge-block';
import { CuentoHoy, KaraokeHoy } from '@/components/minijuegos-hoy';
import { FamilyCard, FamilyTag } from '@/components/family';
import { MomentCard } from '@/components/moment-card';
import { QuestionCard } from '@/components/question-card';
import { SongCard } from '@/components/song-card';
import { OnThisDay } from '@/components/on-this-day';
import { UpcomingCard } from '@/components/upcoming-card';
import { RecapCard } from '@/components/recap-card';
import { Appear } from '@/components/motion';
import { Button, Lead, Screen } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import { featuredWeek, weekStart } from '@/lib/recap';

/** Hoy: la propuesta vigente y los momentos recientes del grupo. */
export default function Today() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const {
    me,
    group: groupById,
    moments,
    proposals,
    questions,
    songs,
    dismissed,
    dismissProposal,
  } = useStore();
  const group = groupById(id);
  // Lo que respondo aquí se queda a la vista (para ver el resultado) hasta salir.
  const shown = useRef(new Set<string>());
  // Lo de antes de hoy se asoma difuminado; con un toque, se ve entero.
  const [earlierOpen, setEarlierOpen] = useState(false);
  if (!group) return <Missing />;

  const feed = moments.filter((m) => m.groupId === id);
  // Lunes y martes: el resumen de la semana que acaba de terminar, si tuvo vida.
  const lastWeek = weekStart(Date.now()) - 7 * 86_400_000;
  const lastWeekReady =
    new Date().getDay() >= 1 && new Date().getDay() <= 2 && featuredWeek(feed) === lastWeek
      ? lastWeek
      : null;
  // La propuesta más reciente, si no la he respondido ni apartado.
  const latest = proposals
    .filter((p) => p.groupId === id && p.kind === 'prompt')
    .sort((a, b) => b.startsAt - a.startsAt)[0];
  const proposal =
    latest &&
    !dismissed.includes(latest.id) &&
    !feed.some((m) => m.proposalId === latest.id && m.authorId === me)
      ? latest
      : undefined;

  // Preguntas del grupo que aún no he respondido: arriba, a la vista (las tres más recientes).
  const groupQuestions = questions.filter((q) => q.groupId === id);
  const pending = groupQuestions
    .filter(
      (q) =>
        q.createdBy !== me &&
        (shown.current.has(q.id) || !q.answers.some((a) => a.userId === me)) &&
        (!q.closesAt || q.closesAt > Date.now()),
    )
    .slice(0, 3);
  pending.forEach((q) => shown.current.add(q.id));

  // Todo lo del grupo en una sola línea de tiempo: los momentos, los retos
  // (aunque nadie haya participado todavía) y las preguntas, encuestas y quiz.
  // Las respuestas a un mismo reto (o a la misma propuesta del día) van juntas,
  // en un solo bloque, donde está su última novedad: así se ve a qué responde cada una.
  type Entry =
    | { kind: 'moment'; moment: Moment; at: number }
    | { kind: 'challenge'; challenge: Proposal; answers: Moment[]; at: number }
    | { kind: 'question'; question: Question; at: number }
    | { kind: 'song'; song: Song; at: number };
  const entries: Entry[] = [];
  const blocks = new Map<string, Entry & { kind: 'challenge' }>();
  const block = (challenge: Proposal, at: number) => {
    let b = blocks.get(challenge.id);
    if (!b) {
      b = { kind: 'challenge', challenge, answers: [], at };
      blocks.set(challenge.id, b);
      entries.push(b);
    }
    b.at = Math.max(b.at, at);
    return b;
  };
  for (const moment of feed) {
    const challenge = proposals.find((p) => p.id === moment.proposalId);
    if (!challenge) entries.push({ kind: 'moment', moment, at: moment.sharedAt });
    else block(challenge, moment.sharedAt).answers.push(moment);
  }
  for (const c of proposals) if (c.groupId === id && c.kind === 'challenge') block(c, c.startsAt);
  for (const q of groupQuestions)
    if (!pending.includes(q)) entries.push({ kind: 'question', question: q, at: q.createdAt });
  // y las canciones que se añaden a la banda sonora
  for (const song of songs)
    if (song.groupId === id) entries.push({ kind: 'song', song, at: song.createdAt });
  entries.sort((a, b) => b.at - a.at);

  // Hoy, primero; lo de antes, después (y, hasta que se pide, solo asomando).
  const midnight = new Date().setHours(0, 0, 0, 0);
  const today = entries.filter((e) => e.at >= midnight);
  const earlier = entries.filter((e) => e.at < midnight);
  const card = (entry: Entry, i: number, animate = true) => {
    const inner =
      entry.kind === 'challenge' ? (
        // cada minijuego, con su propia tarjeta
        entry.challenge.game?.type === 'karaoke' ? (
          <KaraokeHoy challenge={entry.challenge} answers={entry.answers} />
        ) : entry.challenge.juego ? (
          <CuentoHoy challenge={entry.challenge} answers={entry.answers} />
        ) : (
          <ChallengeBlock challenge={entry.challenge} answers={entry.answers} />
        )
      ) : entry.kind === 'song' ? (
        <SongCard song={entry.song} />
      ) : entry.kind === 'question' ? (
        <QuestionCard question={entry.question} />
      ) : (
        <MomentCard moment={entry.moment} />
      );
    const key =
      entry.kind === 'challenge'
        ? `reto-${entry.challenge.id}`
        : entry.kind === 'song'
          ? `cancion-${entry.song.id}`
          : entry.kind === 'question'
            ? `pregunta-${entry.question.id}`
            : entry.moment.id;
    return animate ? (
      <Appear key={key} index={i + 1}>
        {inner}
      </Appear>
    ) : (
      <View key={key}>{inner}</View>
    );
  };

  return (
    <Screen header={<GroupHeader group={group} />}>
      <ConnectionCard group={group} />
      {proposal && (
        <FamilyCard family="prompt" style={styles.proposal}>
          <FamilyTag
            family="prompt"
            detail={
              proposal.startsAt >= new Date().setHours(0, 0, 0, 0) ? 'la de hoy' : 'la última'
            }
          />
          <Text style={[styles.question, { color: theme.text }]}>{proposal.title}</Text>
          <View style={styles.actions}>
            <Button
              label="Responder"
              onPress={() =>
                router.push({
                  pathname: '/publish',
                  params: { groupId: id, proposalId: proposal.id },
                })
              }
            />
            {/* Posponer u omitir no deja rastro visible para los demás. */}
            <Button
              label="Más tarde"
              variant="quiet"
              onPress={() => dismissProposal(proposal.id, 'snoozed').catch(() => {})}
            />
            <Button
              label="Omitir"
              variant="quiet"
              onPress={() => dismissProposal(proposal.id, 'skipped').catch(() => {})}
            />
          </View>
        </FamilyCard>
      )}
      {/* Preguntas del grupo que aún no he respondido. */}
      {pending.map((q) => (
        <QuestionCard key={q.id} question={q} />
      ))}
      <UpcomingCard groupId={group.id} />
      <OnThisDay groupId={group.id} />
      {lastWeekReady != null && (
        <RecapCard
          groupId={group.id}
          kind="week"
          from={lastWeekReady}
          hint="Ya está vuestro resumen"
        />
      )}
      {entries.length === 0 && (
        <Lead strong="Aquí aparecerán los momentos del grupo.">
          Comparte el primero con el botón «+» e invita a los demás desde «Ajustes».
        </Lead>
      )}
      {today.map((entry, i) => card(entry, i))}
      {earlier.length > 0 &&
        (earlierOpen ? (
          <>
            <Divider label="Antes de hoy" />
            {earlier.map((entry, i) => card(entry, i))}
          </>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Seguir viendo lo anterior: ${earlier.length}`}
            onPress={() => setEarlierOpen(true)}>
            {/* lo siguiente asoma, cada vez más difuminado */}
            <View style={styles.peek} pointerEvents="none">
              {/* anclado arriba: se ve el principio de lo siguiente */}
              <View style={[styles.peekInner, { gap: Spacing.three }]}>
                {earlier.slice(0, 2).map((entry, i) => card(entry, i, false))}
              </View>
              <LinearGradient
                colors={[`${theme.background}00`, `${theme.background}D9`, theme.background]}
                locations={[0, 0.55, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
            <View style={styles.more}>
              <Text style={[styles.moreTitle, { color: theme.text }]}>
                {today.length ? 'Hasta aquí lo de hoy' : 'Hoy todavía no ha pasado nada'}
              </Text>
              <View style={[styles.moreButton, { backgroundColor: theme.text }]}>
                <Text style={{ color: theme.background, fontSize: 15, fontWeight: '600' }}>
                  Seguir viendo lo anterior
                </Text>
              </View>
            </View>
          </Pressable>
        ))}
    </Screen>
  );
}

/** El grupo no existe o ya no pertenezco a él. */
export function Missing() {
  return (
    <Screen>
      <View style={{ paddingTop: Spacing.five, gap: Spacing.three }}>
        <Lead strong="No se encuentra este grupo.">Tira hacia abajo para recargar.</Lead>
        <Button label="Volver a mis grupos" variant="quiet" onPress={() => router.replace('/')} />
      </View>
    </Screen>
  );
}

/** Una raya con su texto en medio («Antes de hoy»). */
function Divider({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.divider}>
      <View style={[styles.line, { backgroundColor: theme.soft }]} />
      <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '500' }}>{label}</Text>
      <View style={[styles.line, { backgroundColor: theme.soft }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  peek: { height: 230, overflow: 'hidden' },
  peekInner: { position: 'absolute', top: 0, left: 0, right: 0 },
  more: { alignItems: 'center', gap: 12, marginTop: -40, paddingBottom: 8 },
  moreTitle: { fontSize: 17, fontWeight: '600', letterSpacing: -0.2 },
  moreButton: { height: 44, paddingHorizontal: 20, borderRadius: 22, justifyContent: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  line: { flex: 1, height: 1 },
  proposal: { padding: 24, gap: 16 },
  question: { fontSize: 28, lineHeight: 32, fontWeight: '500', letterSpacing: -0.6 },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginLeft: -2 },
});
