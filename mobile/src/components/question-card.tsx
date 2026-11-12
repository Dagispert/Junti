import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Spacing, useTheme } from '@/constants/theme';
import { errorText, useStore } from '@/data/store';
import type { Question } from '@/data/types';
import { daysLeft, relative } from '@/lib/time';

import { Icon } from './icon';
import { Avatar, AvatarRow, Card, Notice } from './ui';
import { ArrowUp, ChartColumn, Check, CircleHelp, MessageCircle, X } from 'lucide-react-native';

const LABEL = {
  poll: { icon: ChartColumn, text: 'Encuesta' },
  quiz: { icon: CircleHelp, text: 'Quiz' },
  open: { icon: MessageCircle, text: 'Pregunta' },
} as const;
const GOOD = '#16A34A';
const BAD = '#DC2626';

/**
 * Una pregunta al grupo. Antes de responder, solo la pregunta y sus opciones;
 * al responder, lo que han dicho los demás (y, en un quiz, la solución).
 * Nunca hay puntos ni rankings.
 */
export function QuestionCard({ question }: { question: Question }) {
  const theme = useTheme();
  const { me, user, answerQuestion, deleteQuestion } = useStore();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [confirming, setConfirming] = useState(false);

  const mine = question.answers.find((a) => a.userId === me);
  const isAuthor = question.createdBy === me;
  const closed = !!question.closesAt && question.closesAt <= Date.now();
  const left = question.closesAt && !closed ? daysLeft(question.closesAt) : undefined;
  // Ver resultados: si ya respondí, si es mía, o si ya se cerró.
  const reveal = !!mine || isAuthor || closed;
  const canAnswer = !closed && !(question.kind === 'quiz' && (isAuthor || mine));
  const first = (id: string) => user(id).name.split(' ')[0];

  const answer = async (a: { choice?: number; text?: string }) => {
    setBusy(true);
    setNotice('');
    try {
      await answerQuestion(question.id, a);
      setDraft('');
    } catch (error) {
      setNotice(errorText(error));
    }
    setBusy(false);
  };

  const total = question.answers.length;

  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        <View style={styles.kind}>
          <Icon icon={LABEL[question.kind].icon} size={16} />
          <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '500' }}>
            {LABEL[question.kind].text}
          </Text>
        </View>
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
                      { width: `${Math.round(share * 100)}%`, backgroundColor: theme.border },
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
          {reveal &&
            question.answers.map((a) => (
              <View key={a.userId} style={styles.reply}>
                <Avatar userId={a.userId} size={30} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>
                    {a.userId === me ? 'Tú' : first(a.userId)}
                  </Text>
                  <Text style={{ color: theme.text, fontSize: 15, lineHeight: 21 }}>{a.text}</Text>
                </View>
              </View>
            ))}
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
        <Pressable
          accessibilityRole="button"
          onPress={() => (confirming ? deleteQuestion(question.id) : setConfirming(true))}
          style={{ alignSelf: 'flex-end' }}>
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
            {confirming ? '¿Seguro? Toca otra vez para borrarla' : 'Borrar'}
          </Text>
        </Pressable>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, gap: Spacing.two },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kind: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  reply: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
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
