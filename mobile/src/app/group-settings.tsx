import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar, Button, Card, Field, Lead, Notice, Screen, Tag, Title } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { frequencies } from '@/data/library';
import { errorText, PALETTE, useStore } from '@/data/store';
import { exportMemory } from '@/lib/export';
import { NARRATIVE_STYLES } from '@/lib/narrative';

// Pegatinas para el grupo: salen en sus historias y en la lista de grupos.
const STICKERS = [
  '🍍',
  '🌻',
  '🌊',
  '🏔️',
  '🌙',
  '☕',
  '🎈',
  '🧡',
  '🐾',
  '🌵',
  '🍋',
  '🌍',
  '✈️',
  '🎶',
  '🏡',
  '📮',
];

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
  const [exporting, setExporting] = useState('');

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
              run(() => store.updateGroup(group.id, name.trim(), description.trim()), 'Guardado')
            }
          />
        </Card>
      )}

      {group.isAdmin && (
        <View style={{ gap: Spacing.two }}>
          <Tag>Aspecto</Tag>
          <Card style={styles.card}>
            {/* Portada */}
            <View style={styles.coverRow}>
              <View style={[styles.cover, { backgroundColor: group.color }]}>
                {group.coverUri && (
                  <Image
                    source={{ uri: group.coverUri }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                  />
                )}
              </View>
              <View style={{ flex: 1, gap: 8 }}>
                <Text style={{ color: theme.text, fontSize: 17 }}>Portada</Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <Button
                    compact
                    label={group.coverUri ? 'Cambiar' : 'Elegir foto'}
                    disabled={busy}
                    onPress={async () => {
                      const result = await ImagePicker.launchImageLibraryAsync({
                        mediaTypes: ['images'],
                        quality: 0.8,
                      }).catch(() => null);
                      const uri = result && !result.canceled ? result.assets[0].uri : null;
                      if (uri)
                        run(() => store.styleGroup(group.id, { coverUri: uri }), 'Portada lista');
                    }}
                  />
                  {group.coverUri && (
                    <Button
                      compact
                      variant="quiet"
                      label="Quitar"
                      disabled={busy}
                      onPress={() => run(() => store.styleGroup(group.id, { coverUri: null }))}
                    />
                  )}
                </View>
              </View>
            </View>

            {/* Color */}
            <View style={{ gap: 8 }}>
              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Color</Text>
              <View style={styles.swatches}>
                {PALETTE.map((c) => (
                  <Pressable
                    key={c}
                    accessibilityRole="radio"
                    accessibilityLabel={`Color ${c}`}
                    accessibilityState={{ checked: group.color === c }}
                    disabled={busy}
                    onPress={() => run(() => store.styleGroup(group.id, { color: c }))}
                    style={[
                      styles.swatch,
                      { backgroundColor: c },
                      group.color === c && { borderColor: theme.text },
                    ]}
                  />
                ))}
              </View>
            </View>

            {/* Pegatina */}
            <View style={{ gap: 8 }}>
              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                Pegatina (aparece en vuestras historias)
              </Text>
              <View style={styles.swatches}>
                {STICKERS.map((e) => (
                  <Pressable
                    key={e}
                    accessibilityRole="radio"
                    accessibilityLabel={`Pegatina ${e}`}
                    accessibilityState={{ checked: group.sticker === e }}
                    disabled={busy}
                    onPress={() =>
                      run(() =>
                        store.styleGroup(group.id, { sticker: group.sticker === e ? null : e }),
                      )
                    }
                    style={[
                      styles.sticker,
                      { backgroundColor: group.sticker === e ? theme.soft : 'transparent' },
                    ]}>
                    <Text style={{ fontSize: 24 }}>{e}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </Card>
        </View>
      )}

      <View style={{ gap: Spacing.two }}>
        <Tag>Propuestas</Tag>
        <Lead strong={current ? `${current.label}.` : 'Frecuencia personalizada.'}>
          Elige cuántas te gustaría recibir; el grupo sigue la opción más votada.
        </Lead>
        <Card style={{ padding: 8 }}>
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
                <Text style={{ flex: 1, color: theme.text, fontSize: 17 }}>{option.label}</Text>
                {option.count > 0 && (
                  <Text style={{ color: theme.textSecondary, fontSize: 15 }}>
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
              run(() => store.setCadence(group.id, pendingChange.days), 'Frecuencia actualizada')
            }
          />
        )}
        {group.isAdmin && winners.length > 1 && (
          <View style={{ gap: Spacing.one }}>
            <Text style={{ color: theme.textSecondary, fontSize: 15 }}>
              Hay empate. Como administras el grupo, decides tú:
            </Text>
            {winners.map((w) => (
              <Button
                key={w.perWeek}
                variant="quiet"
                label={w.label}
                disabled={busy}
                onPress={() =>
                  run(() => store.setCadence(group.id, w.days), 'Frecuencia actualizada')
                }
              />
            ))}
          </View>
        )}
        {!group.isAdmin && pendingChange && (
          <Text style={{ color: theme.textSecondary, fontSize: 15 }}>
            La más votada es «{pendingChange.label.toLowerCase()}». Quien administra el grupo puede
            aplicarla.
          </Text>
        )}
      </View>

      <View style={{ gap: Spacing.two }}>
        <Tag>Narradora</Tag>
        <Lead strong={group.narrativeEnabled ? 'Activada.' : 'Apagada.'}>
          Escribe con IA la crónica de cada semana y cada mes a partir de lo que compartís.
        </Lead>
        {group.isAdmin && (
          <Button
            label={group.narrativeEnabled ? 'Apagar la narradora' : 'Activar la narradora'}
            variant={group.narrativeEnabled ? 'quiet' : 'primary'}
            disabled={busy}
            onPress={() =>
              run(
                () => store.setNarrative(group.id, !group.narrativeEnabled, group.narrativeStyle),
                group.narrativeEnabled ? 'Narradora apagada' : 'Narradora activada',
              )
            }
          />
        )}
        {group.narrativeEnabled && (
          <>
            <Text style={{ color: theme.textSecondary, fontSize: 15 }}>
              {group.isAdmin ? 'Elige su estilo:' : 'Estilo elegido por el grupo:'}
            </Text>
            <View style={styles.styles}>
              {NARRATIVE_STYLES.map((option) => {
                const on = group.narrativeStyle === option.id;
                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Estilo ${option.label}`}
                    accessibilityState={{ selected: on }}
                    disabled={busy || !group.isAdmin}
                    onPress={() => run(() => store.setNarrative(group.id, true, option.id))}
                    style={[
                      styles.style,
                      { borderColor: on ? theme.accent : theme.border },
                      on && { backgroundColor: theme.soft },
                      !group.isAdmin && !on && { opacity: 0.45 },
                    ]}>
                    <Text style={{ color: theme.text, fontSize: 15, fontWeight: '500' }}>
                      {option.label}
                    </Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{option.hint}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Card style={{ padding: 8 }}>
              <View style={styles.option}>
                <Text style={{ flex: 1, color: theme.text, fontSize: 17 }}>
                  {group.myNarrativeOptOut
                    ? 'Tus momentos no se usan'
                    : 'Tus momentos forman parte de la crónica'}
                </Text>
                <Button
                  compact
                  variant="quiet"
                  label={group.myNarrativeOptOut ? 'Incluirlos' : 'No usarlos'}
                  disabled={busy}
                  onPress={() =>
                    run(() => store.setNarrativeOptOut(group.id, !group.myNarrativeOptOut))
                  }
                />
              </View>
            </Card>
          </>
        )}
        {!group.isAdmin && !group.narrativeEnabled && (
          <Text style={{ color: theme.textSecondary, fontSize: 15 }}>
            Quien administra el grupo puede activarla.
          </Text>
        )}
        <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 19 }}>
          Usa Gemini, la IA de Google, en su plan gratuito. Solo se envían nombres de pila, ciudades
          y los textos, lugares, reacciones y comentarios del periodo; nunca fotos, vídeos ni
          audios. En ese plan, Google puede revisar y usar lo enviado para mejorar sus servicios.
        </Text>
      </View>

      <View style={{ gap: Spacing.two }}>
        <Tag>Tus avisos de este grupo</Tag>
        <Card style={{ padding: 8 }}>
          <View style={styles.option}>
            <Text style={{ flex: 1, color: theme.text, fontSize: 17 }}>
              Recibir la propuesta a partir de
            </Text>
            <Button
              compact
              variant="quiet"
              label="−"
              disabled={busy}
              onPress={() => run(() => store.setPreferredHour(group.id, (group.myHour + 23) % 24))}
            />
            <Text style={{ color: theme.text, fontSize: 17, fontWeight: '500' }}>
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
            <Text style={{ flex: 1, color: theme.text, fontSize: 17 }}>Descanso desde las</Text>
            <Button
              compact
              variant="quiet"
              label="−"
              disabled={busy}
              onPress={() =>
                run(() => store.setQuietHours(group.id, (group.quietFrom + 23) % 24, group.quietTo))
              }
            />
            <Text style={{ color: theme.text, fontSize: 17, fontWeight: '500' }}>
              {String(group.quietFrom).padStart(2, '0')}:00
            </Text>
            <Button
              compact
              variant="quiet"
              label="+"
              disabled={busy}
              onPress={() =>
                run(() => store.setQuietHours(group.id, (group.quietFrom + 1) % 24, group.quietTo))
              }
            />
          </View>
          <View style={[styles.option, { borderTopWidth: 1, borderTopColor: theme.soft }]}>
            <Text style={{ flex: 1, color: theme.text, fontSize: 17 }}>hasta las</Text>
            <Button
              compact
              variant="quiet"
              label="−"
              disabled={busy}
              onPress={() =>
                run(() => store.setQuietHours(group.id, group.quietFrom, (group.quietTo + 23) % 24))
              }
            />
            <Text style={{ color: theme.text, fontSize: 17, fontWeight: '500' }}>
              {String(group.quietTo).padStart(2, '0')}:00
            </Text>
            <Button
              compact
              variant="quiet"
              label="+"
              disabled={busy}
              onPress={() =>
                run(() => store.setQuietHours(group.id, group.quietFrom, (group.quietTo + 1) % 24))
              }
            />
          </View>
          <View style={[styles.option, { borderTopWidth: 1, borderTopColor: theme.soft }]}>
            <Text style={{ flex: 1, color: theme.text, fontSize: 17 }}>
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
        <Text style={{ color: theme.textSecondary, fontSize: 15, lineHeight: 20 }}>
          La hora es la tuya, estés donde estés. En tus horas de descanso no llega ningún aviso: lo
          que pase te espera por la mañana. Silenciar no lo ve nadie más.
        </Text>
      </View>

      <View style={{ gap: Spacing.two }}>
        <Tag>Integrantes</Tag>
        <Card style={{ padding: 8 }}>
          {group.memberIds.map((id, i) => {
            const member = store.user(id);
            const admin = group.adminIds.includes(id);
            return (
              <View
                key={id}
                style={[styles.option, i > 0 && { borderTopWidth: 1, borderTopColor: theme.soft }]}>
                <Avatar userId={id} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontSize: 17 }}>
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

      {Platform.OS === 'web' && (
        <View style={{ gap: Spacing.two }}>
          <Tag>Vuestra memoria</Tag>
          <Lead strong="Descárgala entera:">
            fotos, vídeos y notas de voz ordenados por meses, y una página para verlo todo sin la
            app.
          </Lead>
          <Button
            label={exporting || 'Descargar la memoria'}
            variant="light"
            disabled={!!exporting}
            onPress={async () => {
              setExporting('Preparando…');
              try {
                await exportMemory({
                  group,
                  moments: store.moments.filter((m) => m.groupId === group.id),
                  albums: store.albums.filter((a) => a.groupId === group.id),
                  user: store.user,
                  onProgress: (done, total) => setExporting(`Preparando ${done} de ${total}…`),
                });
                setNotice('Descarga lista');
              } catch (error) {
                setNotice(errorText(error));
              }
              setExporting('');
            }}
          />
        </View>
      )}

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
  coverRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  cover: { width: 72, height: 88, borderRadius: Radius.small, overflow: 'hidden' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
  sticker: {
    width: 44,
    height: 44,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  styles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  style: {
    flexBasis: '47%',
    flexGrow: 1,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 12,
    gap: 2,
  },
  radio: { width: 20, height: 20, borderRadius: Radius.pill, borderWidth: 2 },
});
