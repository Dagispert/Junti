import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar, Button, Card, Field, Lead, Notice, Screen, Tag, Title } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { frequencies } from '@/data/library';
import { errorText, useStore } from '@/data/store';

const sameDays = (a: number[], b: number[]) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join();

/** Ajustes de un grupo: nombre, frecuencia de propuestas, integrantes y salir. */
export default function GroupSettings() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const theme = useTheme();
  const store = useStore();
  const group = store.group(groupId);
  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [removing, setRemoving] = useState('');

  if (!group) return null;
  const { me } = store;

  const run = async (action: () => Promise<unknown>, done = '') => {
    setNotice('');
    setBusy(true);
    try {
      await action();
      setNotice(done);
    } catch (error) {
      setNotice(errorText(error));
    }
    setBusy(false);
  };

  const muted = !!group.mutedUntil && group.mutedUntil > Date.now();

  // Recuento de la votación: cuántas personas prefieren cada frecuencia.
  const tally = frequencies.map((f) => ({
    ...f,
    count: Object.values(group.votes).filter((v) => v === f.perWeek).length,
  }));
  const top = Math.max(...tally.map((t) => t.count));
  const winners = top > 0 ? tally.filter((t) => t.count === top) : [];
  const current = frequencies.find((f) => sameDays(f.days, group.cadenceDays));
  // Con empate decide quien administra; con mayoría clara, se propone aplicarla.
  const consensus = winners.length === 1 ? winners[0] : undefined;
  const pendingChange = consensus && consensus.perWeek !== current?.perWeek ? consensus : undefined;

  const leave = (removeMoments: boolean) =>
    run(async () => {
      await store.leaveGroup(group.id, removeMoments);
      router.dismissAll();
      router.replace('/');
    });

  return (
    <Screen
      header={
        <View style={styles.header}>
          <Button compact label="Cerrar" variant="quiet" onPress={() => router.back()} />
        </View>
      }>
      <Title>Ajustes del grupo</Title>

      {group.isAdmin && (
        <Card style={styles.card}>
          <Field label="Nombre del grupo" value={name} onChangeText={setName} />
          <Field label="Descripción (opcional)" value={description} onChangeText={setDescription} />
          <Button
            label="Guardar"
            disabled={
              busy || !name.trim() || (name === group.name && description === group.description)
            }
            onPress={() =>
              run(() => store.updateGroup(group.id, name.trim(), description.trim()), 'Guardado.')
            }
          />
        </Card>
      )}

      <View style={{ gap: Spacing.two }}>
        <Tag>Propuestas</Tag>
        <Lead strong={current ? `${current.label}.` : 'Frecuencia personalizada.'}>
          Elige cuántas te gustaría recibir; el grupo sigue la opción más votada.
        </Lead>
        <Card style={{ padding: 6 }}>
          {tally.map((option, i) => {
            const mine = group.votes[me] === option.perWeek;
            return (
              <Pressable
                key={option.perWeek}
                accessibilityRole="button"
                accessibilityLabel={`Votar: ${option.label}`}
                disabled={busy}
                onPress={() => run(() => store.voteFrequency(group.id, option.perWeek))}
                style={[styles.option, i > 0 && { borderTopWidth: 1, borderTopColor: theme.soft }]}>
                <View
                  style={[
                    styles.radio,
                    { borderColor: mine ? theme.accent : theme.border },
                    mine && { backgroundColor: theme.accent },
                  ]}
                />
                <Text style={{ flex: 1, color: theme.text, fontSize: 16 }}>{option.label}</Text>
                {option.count > 0 && (
                  <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
                    {option.count} {option.count === 1 ? 'voto' : 'votos'}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </Card>
        {group.isAdmin && pendingChange && (
          <Button
            label={`Aplicar la más votada: ${pendingChange.label.toLowerCase()}`}
            disabled={busy}
            onPress={() =>
              run(() => store.setCadence(group.id, pendingChange.days), 'Frecuencia actualizada.')
            }
          />
        )}
        {group.isAdmin && winners.length > 1 && (
          <View style={{ gap: Spacing.one }}>
            <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
              Hay empate. Como administras el grupo, decides tú:
            </Text>
            {winners.map((w) => (
              <Button
                key={w.perWeek}
                variant="quiet"
                label={w.label}
                disabled={busy}
                onPress={() =>
                  run(() => store.setCadence(group.id, w.days), 'Frecuencia actualizada.')
                }
              />
            ))}
          </View>
        )}
        {!group.isAdmin && pendingChange && (
          <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
            La más votada es «{pendingChange.label.toLowerCase()}». Quien administra el grupo puede
            aplicarla.
          </Text>
        )}
      </View>

      <View style={{ gap: Spacing.two }}>
        <Tag>Tus avisos de este grupo</Tag>
        <Card style={{ padding: 6 }}>
          <View style={styles.option}>
            <Text style={{ flex: 1, color: theme.text, fontSize: 16 }}>
              Recibir la propuesta a partir de
            </Text>
            <Button
              compact
              variant="quiet"
              label="−"
              disabled={busy}
              onPress={() => run(() => store.setPreferredHour(group.id, (group.myHour + 23) % 24))}
            />
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '500' }}>
              {String(group.myHour).padStart(2, '0')}:00
            </Text>
            <Button
              compact
              variant="quiet"
              label="+"
              disabled={busy}
              onPress={() => run(() => store.setPreferredHour(group.id, (group.myHour + 1) % 24))}
            />
          </View>
          <View style={[styles.option, { borderTopWidth: 1, borderTopColor: theme.soft }]}>
            <Text style={{ flex: 1, color: theme.text, fontSize: 16 }}>
              {muted ? 'Silenciado una semana' : 'Avisos activos'}
            </Text>
            <Button
              compact
              variant="quiet"
              label={muted ? 'Reactivar' : 'Silenciar una semana'}
              disabled={busy}
              onPress={() =>
                run(() => store.setMuted(group.id, muted ? null : Date.now() + 7 * 86_400_000))
              }
            />
          </View>
        </Card>
        <Text style={{ color: theme.textSecondary, fontSize: 14, lineHeight: 20 }}>
          La hora es la tuya, estés donde estés. Silenciar no lo ve nadie más.
        </Text>
      </View>

      <View style={{ gap: Spacing.two }}>
        <Tag>Integrantes</Tag>
        <Card style={{ padding: 6 }}>
          {group.memberIds.map((id, i) => {
            const member = store.user(id);
            const admin = group.adminIds.includes(id);
            return (
              <View
                key={id}
                style={[styles.option, i > 0 && { borderTopWidth: 1, borderTopColor: theme.soft }]}>
                <Avatar userId={id} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontSize: 16 }}>
                    {member.name}
                    {id === me ? ' (tú)' : ''}
                  </Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                    {admin ? 'Administra el grupo' : member.city || 'Integrante'}
                  </Text>
                </View>
                {group.isAdmin && id !== me && (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Button
                      compact
                      variant="quiet"
                      label={admin ? 'Quitar admin' : 'Hacer admin'}
                      disabled={busy}
                      onPress={() =>
                        run(() => store.setMemberRole(group.id, id, admin ? 'member' : 'admin'))
                      }
                    />
                    <Button
                      compact
                      variant="quiet"
                      label={removing === id ? '¿Seguro?' : 'Expulsar'}
                      disabled={busy}
                      onPress={() =>
                        removing === id
                          ? run(() => store.removeMember(group.id, id))
                          : setRemoving(id)
                      }
                    />
                  </View>
                )}
              </View>
            );
          })}
        </Card>
      </View>

      <Notice>{notice}</Notice>

      <View style={{ gap: Spacing.two }}>
        <Tag>Salir</Tag>
        {leaving ? (
          <>
            <Lead strong="¿Qué hacemos con tus momentos?">
              Pueden quedarse en la memoria del grupo o retirarse contigo.
            </Lead>
            <Button
              label="Salir y dejar mis momentos"
              disabled={busy}
              onPress={() => leave(false)}
            />
            <Button
              label="Salir y retirar mis momentos"
              variant="quiet"
              disabled={busy}
              onPress={() => leave(true)}
            />
            <Button label="Cancelar" variant="quiet" onPress={() => setLeaving(false)} />
          </>
        ) : (
          <Button label="Salir del grupo" variant="quiet" onPress={() => setLeaving(true)} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'flex-start', paddingVertical: Spacing.two },
  card: { padding: 20, gap: Spacing.three },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  radio: { width: 20, height: 20, borderRadius: Radius.pill, borderWidth: 2 },
});
