import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Hand, Spacing, useTheme } from '@/constants/theme';
import { errorText, useStore } from '@/data/store';
import type { Question } from '@/data/types';
import { useFamily, useFamilyColorMode } from '@/lib/families';
import { daysLeft, relative } from '@/lib/time';

import { type Burst, EmojiBursts } from './emoji-burst';
import { FamilyCard, FamilyTag } from './family';
import { Icon } from './icon';
import { OwnerActions } from './owner-actions';
import { Avatar, AvatarRow, Notice } from './ui';
import { ArrowUp, Check, X } from 'lucide-react-native';

const web = (o: Record<string, unknown>) => o as object;

// Animaciones propias de cada familia (solo en la web).
const CSS = `
@keyframes jq-drop { 0%{opacity:0;transform:translateY(-26px) rotate(var(--r))} 70%{opacity:1;transform:translateY(3px) rotate(var(--r))} 100%{opacity:1;transform:translateY(0) rotate(var(--r))} }
`;
function useCss() {
  useEffect(() => {
    if (typeof document === 'undefined' || document.getElementById('jq-css')) return;
    const el = document.createElement('style');
    el.id = 'jq-css';
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);
}
const GOOD = '#16A34A';
const BAD = '#DC2626';

/**
 * Una pregunta al grupo. Antes de responder, solo la pregunta y sus opciones;
 * al responder, lo que han dicho los demás (y, en un quiz, la solución).
 * Nunca hay puntos ni rankings.
 */
export function QuestionCard({ question }: { question: Question }) {
  const theme = useTheme();
  const { me, user, answerQuestion, deleteQuestion, editQuestion } = useStore();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  useCss();
  const fam = useFamily(question.kind);
  const colored = useFamilyColorMode() !== 'plain';
  // Quiz: al responder, la tarjeta se da la vuelta; si aciertas, una pequeña fiesta.
  const [flip, setFlip] = useState(0);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [height, setHeight] = useState(0);
  // Encuesta: las barras crecen (con un rebote) al enseñar los resultados.
  const [grown, setGrown] = useState(false);

  const mine = question.answers.find((a) => a.userId === me);
  const isAuthor = question.createdBy === me;
  const closed = !!question.closesAt && question.closesAt <= Date.now();
  const left = question.closesAt && !closed ? daysLeft(question.closesAt) : undefined;
  // Ver resultados: si ya respondí, si es mía, o si ya se cerró.
  const reveal = !!mine || isAuthor || closed;
  useEffect(() => {
    if (!reveal) return setGrown(false);
    const id = setTimeout(() => setGrown(true), 60);
    return () => clearTimeout(id);
  }, [reveal]);
  const answered = useRef(!!mine);
  // La solución llega al responder: si acertaste, la fiesta.
  const celebrate = useRef(false);
  useEffect(() => {
    if (!celebrate.current || !mine || question.correct === undefined) return;
    celebrate.current = false;
    if (mine.choice === question.correct) setBursts([{ id: Date.now(), emoji: '🎉' }]);
  }, [mine, question.correct]);
  const canAnswer = !closed && !(question.kind === 'quiz' && (isAuthor || mine));
  const first = (id: string) => user(id).name.split(' ')[0];

  const answer = async (a: { choice?: number; text?: string }) => {
    setBusy(true);
    setNotice('');
    try {
      if (question.kind === 'quiz' && !answered.current) {
        // Media vuelta, se responde, y la otra media enseña la solución.
        setFlip(1);
        await answerQuestion(question.id, a);
        setFlip(2);
        setTimeout(() => setFlip(0), 420);
        celebrate.current = true;
      } else {
        await answerQuestion(question.id, a);
      }
      answered.current = true;
      setDraft('');
    } catch (error) {
      setNotice(errorText(error));
    }
    setBusy(false);
  };

  const total = question.answers.length;

  return (
    <FamilyCard
      family={question.kind}
      style={[
        styles.card,
        web({
          transform: `perspective(900px) rotateY(${flip === 1 ? 90 : 0}deg)`,
          transition: flip ? 'transform .32s cubic-bezier(.4,0,.2,1)' : 'none',
        }),
      ]}>
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
      />
      <View style={styles.top}>
        <FamilyTag family={question.kind} />
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
          {closed
            ? 'Cerrada'
            : left
              ? left === 1
                ? 'Queda 1 día'
                : `Quedan ${left} días`
              : relative(question.createdAt)}
        </Text>
      </View>
      <View style={styles.who}>
        <Avatar userId={question.createdBy} size={28} />
        <Text style={{ color: theme.textSecondary, fontSize: 15 }}>
          {isAuthor ? 'Has preguntado' : `${first(question.createdBy)} pregunta`}
        </Text>
      </View>
      <Text style={[styles.title, { color: theme.text }]}>{question.title}</Text>

      {/* Opciones: para votar, o con los resultados. */}
      {question.options && (
        <View style={{ gap: 8 }}>
          {question.options.map((option, i) => {
            const voters = question.answers.filter((a) => a.choice === i).map((a) => a.userId);
            const share = total ? voters.length / total : 0;
            const chosen = mine?.choice === i;
            const isCorrect = question.kind === 'quiz' && question.correct === i;
            const wrongPick = question.kind === 'quiz' && chosen && question.correct !== i;
            const tint = !reveal
              ? theme.soft
              : isCorrect
                ? 'rgba(22,163,74,0.12)'
                : wrongPick
                  ? 'rgba(220,38,38,0.1)'
                  : theme.soft;
            return (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={option}
                accessibilityState={{ selected: chosen }}
                disabled={busy || !canAnswer || chosen}
                onPress={() => answer({ choice: i })}
                style={[
                  styles.option,
                  { backgroundColor: tint },
                  chosen && { borderColor: theme.accent, borderWidth: 1.5 },
                ]}>
                {reveal && question.kind === 'poll' && (
                  <View
                    style={[
                      styles.bar,
                      {
                        width: `${grown ? Math.round(share * 100) : 0}%`,
                        backgroundColor: colored ? fam.color : theme.border,
                        opacity: colored ? 0.22 : 0.8,
                      },
                      web({
                        transition: `width .9s cubic-bezier(.34,1.56,.64,1) ${i * 0.08}s`,
                      }),
                    ]}
                  />
                )}
                {isCorrect && reveal && <Icon icon={Check} size={16} color={GOOD} />}
                {wrongPick && <Icon icon={X} size={16} color={BAD} />}
                <Text style={[styles.optionText, { color: theme.text }]} numberOfLines={2}>
                  {option}
                </Text>
                {reveal && voters.length > 0 && <AvatarRow userIds={voters} size={22} />}
                {reveal && question.kind === 'poll' && (
                  <Text style={[styles.percent, { color: theme.textSecondary }]}>
                    {Math.round(share * 100)}%
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Quiz: qué tal te fue (sin puntos). */}
      {question.kind === 'quiz' && mine && question.correct !== undefined && (
        <Text
          style={{
            color: mine.choice === question.correct ? GOOD : BAD,
            fontSize: 15,
            fontWeight: '600',
          }}>
          {mine.choice === question.correct
            ? 'Acertaste'
            : `Era «${question.options?.[question.correct]}»`}
        </Text>
      )}

      {/* Pregunta abierta: responder y leer a los demás. */}
      {question.kind === 'open' && (
        <View style={{ gap: 12 }}>
          {/* Las respuestas, como notas que caen sobre la tarjeta. */}
          {reveal && question.answers.length > 0 && (
            <View style={styles.notes}>
              {question.answers.map((a, i) => (
                <View
                  key={a.userId}
                  style={[
                    styles.note,
                    { backgroundColor: colored ? fam.tint : theme.soft },
                    web({
                      '--r': `${i % 2 ? 1.6 : -1.4}deg`,
                      transform: `rotate(${i % 2 ? 1.6 : -1.4}deg)`,
                      animation: `jq-drop .55s cubic-bezier(.22,.8,.2,1) ${i * 0.09}s both`,
                    }),
                  ]}>
                  <View style={styles.noteHead}>
                    <Avatar userId={a.userId} size={22} />
                    <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '600' }}>
                      {a.userId === me ? 'Tú' : first(a.userId)}
                    </Text>
                  </View>
                  <Text style={[styles.noteText, { color: theme.text }]}>{a.text}</Text>
                </View>
              ))}
            </View>
          )}
          {canAnswer && (
            <View style={[styles.compose, { backgroundColor: theme.soft }]}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={mine ? 'Cambiar mi respuesta…' : 'Tu respuesta…'}
                placeholderTextColor={theme.textSecondary}
                multiline
                maxLength={1000}
                accessibilityLabel="Tu respuesta"
                style={[styles.input, { color: theme.text }]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Enviar respuesta"
                disabled={busy || !draft.trim()}
                onPress={() => answer({ text: draft.trim() })}
                style={[
                  styles.send,
                  { backgroundColor: theme.accent, opacity: busy || !draft.trim() ? 0.4 : 1 },
                ]}>
                <Icon icon={ArrowUp} size={18} color={theme.onAccent} />
              </Pressable>
            </View>
          )}
        </View>
      )}

      {!reveal && (
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
          {question.kind === 'quiz'
            ? 'Responde para ver la solución y lo que han dicho los demás.'
            : 'Responde para ver lo que han dicho los demás.'}
        </Text>
      )}
      {reveal && total === 0 && (
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
          Aún no ha respondido nadie.
        </Text>
      )}
      <Notice>{notice}</Notice>

      {isAuthor && (
        <OwnerActions
          fields={[{ label: 'La pregunta', value: question.title, max: 200, required: true }]}
          onSave={([title]) => editQuestion(question.id, title)}
          onDelete={() => deleteQuestion(question.id)}
          canEdit={total === 0}
          cantEditNote="Ya hay respuestas: ahora solo se puede eliminar."
        />
      )}
      <EmojiBursts
        bursts={bursts}
        height={height}
        onDone={(id) => setBursts((b) => b.filter((x) => x.id !== id))}
      />
    </FamilyCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, gap: Spacing.two },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  who: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 24, lineHeight: 28, fontWeight: '500', letterSpacing: -0.4 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, opacity: 0.8 },
  optionText: { flex: 1, fontSize: 17, paddingVertical: 12 },
  percent: { fontSize: 13, fontVariant: ['tabular-nums'], minWidth: 36, textAlign: 'right' },
  notes: { gap: 10 },
  note: { borderRadius: 6, padding: 12, gap: 6, boxShadow: '0 6px 14px rgba(20,22,26,0.08)' },
  noteHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noteText: { fontFamily: Hand, fontSize: 22, lineHeight: 24 },
  compose: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    borderRadius: 20,
    paddingLeft: 16,
    padding: 8,
  },
  input: { flex: 1, fontSize: 15, lineHeight: 21, paddingVertical: 8, maxHeight: 120 },
  send: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
