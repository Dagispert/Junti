import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { OriginsEditor } from '@/components/origins-editor';
import { Avatar, AvatarRow, Button, Field, Notice, Screen } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { frequencies } from '@/data/library';
import { STICKERS } from '@/data/look';
import { errorText, PALETTE, useStore } from '@/data/store';
import { exportMemory } from '@/lib/export';
import { NARRATIVE_STYLES, styleOf } from '@/lib/narrative';
import { playTone } from '@/lib/voice-clip';

const sameDays = (a: number[], b: number[]) =>
  a.length === b.length && [...a].sort().every((d, i) => d === [...b].sort()[i]);
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

type Section =
  | 'nombre'
  | 'origen'
  | 'aspecto'
  | 'propuestas'
  | 'narradora'
  | 'apodo'
  | 'avisos'
  | 'integrantes';

/**
 * Los ajustes del grupo, ordenados: arriba, cómo es el grupo; luego, lo de
 * todos («Vuestro grupo»), lo tuyo («Para ti»), quiénes sois y la memoria.
 * Cada apartado se abre con un toque y enseña un resumen cerrado. Lo que solo
 * cambia quien administra se ve, pero no se toca.
 */
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
  const [myNick, setMyNick] = useState(group?.nicknames[store.me] ?? '');
  const [open, setOpen] = useState<Section | null>(null);

  if (!group) return null;
  const { me } = store;
  const admin = group.isAdmin;
  const adminNames = new Intl.ListFormat('es', { type: 'conjunction' }).format(
    group.adminIds.map((id) => store.user(id).name.split(' ')[0]),
  );

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
  const consensus = winners.length === 1 ? winners[0] : undefined;
  const pendingChange = consensus && consensus.perWeek !== current?.perWeek ? consensus : undefined;

  const firstOrigin = group.origins[0];
  const originSummary = firstOrigin
    ? `${firstOrigin.place}${firstOrigin.year ? ` · ${firstOrigin.year}` : ''}${group.origins.length > 1 ? ` y ${group.origins.length - 1} más` : ''}`
    : 'Sin contar';

  const leave = (removeMoments: boolean) =>
    run(async () => {
      await store.leaveGroup(group.id, removeMoments);
      router.dismissAll();
      router.replace('/');
    });

  const row = (id: Section, title: string, summary: ReactNode, body: ReactNode) => (
    <Row
      key={id}
      title={title}
      summary={summary}
      open={open === id}
      onToggle={() => setOpen(open === id ? null : id)}>
      {body}
    </Row>
  );

  return (
    <Screen
      header={
        <View style={styles.header}>
          <Button compact label="Cerrar" variant="quiet" onPress={() => router.back()} />
        </View>
      }>
      {/* ── Cómo es el grupo, de un vistazo ── */}
      <View style={[styles.hero, { backgroundColor: theme.card, boxShadow: theme.shadow }]}>
        <View style={[styles.heroCover, { backgroundColor: group.color }]}>
          {group.coverUri && (
            <Image
              source={{ uri: group.coverUri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          )}
          {!!group.sticker && <Text style={styles.heroSticker}>{group.sticker}</Text>}
        </View>
        <View style={{ padding: 20, gap: 6 }}>
          <Text style={[styles.heroName, { color: theme.text }]}>{group.name}</Text>
          {!!group.description && (
            <Text style={{ color: theme.textSecondary, fontSize: 15, lineHeight: 21 }}>
              {group.description}
            </Text>
          )}
          <View style={styles.heroMeta}>
            <AvatarRow userIds={group.memberIds} size={26} />
            <Text style={{ color: theme.textSecondary, fontSize: 13, flex: 1 }}>
              {group.memberIds.length} {group.memberIds.length === 1 ? 'persona' : 'personas'}
              {firstOrigin
                ? ` · empezó en ${firstOrigin.place}${firstOrigin.year ? `, ${firstOrigin.year}` : ''}`
                : ''}
            </Text>
          </View>
          {!admin && (
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
              Lo administra {adminNames}.
            </Text>
          )}
        </View>
      </View>

      {/* ── Vuestro grupo ── */}
      <SectionTitle
        title="Vuestro grupo"
        hint={
          admin
            ? 'Lo que compartís todos.'
            : 'Lo que compartís todos. Algunas cosas solo las cambia quien administra.'
        }
      />
      <View style={[styles.list, { backgroundColor: theme.card }]}>
        {admin &&
          row(
            'nombre',
            'Nombre y descripción',
            group.name,
            <View style={styles.body}>
              <Field label="Nombre del grupo" value={name} onChangeText={setName} />
              <Field
                label="Una frase sobre vosotros (opcional)"
                value={description}
                onChangeText={setDescription}
              />
              <Button
                compact
                label="Guardar"
                disabled={
                  busy || !name.trim() || (name === group.name && description === group.description)
                }
                onPress={() =>
                  run(
                    () => store.updateGroup(group.id, name.trim(), description.trim()),
                    'Guardado',
                  )
                }
              />
            </View>,
          )}
        {row(
          'origen',
          'Dónde empezó todo',
          originSummary,
          <View style={styles.body}>
            <OriginsEditor group={group} bare />
          </View>,
        )}
        {admin &&
          row(
            'aspecto',
            'Portada, color y pegatina',
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[styles.dot, { backgroundColor: group.color }]} />
              {!!group.sticker && <Text style={{ fontSize: 15 }}>{group.sticker}</Text>}
            </View>,
            <View style={styles.body}>
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
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', flex: 1 }}>
                  <Button
                    compact
                    label={group.coverUri ? 'Cambiar portada' : 'Elegir portada'}
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
              <Small>Color</Small>
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
              <Small>Pegatina (sale en vuestras historias)</Small>
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
            </View>,
          )}
        {row(
          'propuestas',
          'Propuestas',
          current ? current.label : 'Personalizada',
          <View style={styles.body}>
            <Small>Vota cuántas te gustaría recibir; el grupo sigue la opción más votada.</Small>
            <View>
              {tally.map((option, i) => {
                const mine = group.votes[me] === option.perWeek;
                return (
                  <Pressable
                    key={option.perWeek}
                    accessibilityRole="button"
                    accessibilityLabel={`Votar: ${option.label}`}
                    disabled={busy}
                    onPress={() => run(() => store.voteFrequency(group.id, option.perWeek))}
                    style={[
                      styles.option,
                      i > 0 && { borderTopWidth: 1, borderTopColor: theme.soft },
                    ]}>
                    <View
                      style={[
                        styles.radio,
                        { borderColor: mine ? theme.accent : theme.border },
                        mine && { backgroundColor: theme.accent },
                      ]}
                    />
                    <Text style={{ flex: 1, color: theme.text, fontSize: 16 }}>
                      {option.label}
                      {current?.perWeek === option.perWeek ? ' · ahora' : ''}
                    </Text>
                    {option.count > 0 && (
                      <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
                        {option.count} {option.count === 1 ? 'voto' : 'votos'}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
            {admin && pendingChange && (
              <Button
                compact
                label={`Aplicar la más votada: ${pendingChange.label.toLowerCase()}`}
                disabled={busy}
                onPress={() =>
                  run(
                    () => store.setCadence(group.id, pendingChange.days),
                    'Frecuencia actualizada',
                  )
                }
              />
            )}
            {admin && winners.length > 1 && (
              <View style={{ gap: 4 }}>
                <Small>Hay empate. Como administras el grupo, decides tú:</Small>
                {winners.map((w) => (
                  <Button
                    key={w.perWeek}
                    compact
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
            {!admin && pendingChange && (
              <Small>
                La más votada es «{pendingChange.label.toLowerCase()}». Quien administra puede
                aplicarla.
              </Small>
            )}
          </View>,
        )}
        {row(
          'narradora',
          'La narradora',
          group.narrativeEnabled ? `Activada · ${styleOf(group.narrativeStyle).label}` : 'Apagada',
          <View style={styles.body}>
            <Small>
              Cuenta en voz alta la historia de cada semana y cada mes con lo que compartís.
            </Small>
            {admin ? (
              <Button
                compact
                label={group.narrativeEnabled ? 'Apagar la narradora' : 'Activar la narradora'}
                variant={group.narrativeEnabled ? 'quiet' : 'primary'}
                disabled={busy}
                onPress={() =>
                  run(
                    () =>
                      store.setNarrative(group.id, !group.narrativeEnabled, group.narrativeStyle),
                    group.narrativeEnabled ? 'Narradora apagada' : 'Narradora activada',
                  )
                }
              />
            ) : (
              !group.narrativeEnabled && <Small>Quien administra el grupo puede activarla.</Small>
            )}
            {group.narrativeEnabled && (
              <>
                <Small>
                  {admin
                    ? 'Su tono (toca uno para oír cómo suena):'
                    : 'Tono elegido por el grupo (toca uno para oír cómo suena):'}
                </Small>
                <View style={styles.styles}>
                  {NARRATIVE_STYLES.map((option) => {
                    const on = group.narrativeStyle === option.id;
                    return (
                      <Pressable
                        key={option.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Estilo ${option.label}`}
                        accessibilityState={{ selected: on }}
                        disabled={busy}
                        onPress={() => {
                          // Al elegirlo se oye cómo suena; quien no administra solo lo escucha.
                          playTone(option.id);
                          if (admin) run(() => store.setNarrative(group.id, true, option.id));
                        }}
                        style={[
                          styles.style,
                          { backgroundColor: on ? theme.accent : theme.soft },
                          !admin && !on && { opacity: 0.45 },
                        ]}>
                        <Text
                          style={{
                            color: on ? theme.onAccent : theme.text,
                            fontSize: 15,
                            fontWeight: '500',
                          }}>
                          {option.label}
                        </Text>
                        <Text
                          style={{
                            color: on ? theme.onAccent : theme.textSecondary,
                            fontSize: 13,
                            opacity: 0.85,
                          }}>
                          {option.hint}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={[styles.option, { paddingHorizontal: 0 }]}>
                  <Text style={{ flex: 1, color: theme.text, fontSize: 15 }}>
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
              </>
            )}
            <Text style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 17 }}>
              Usa Gemini, la IA de Google, en su plan gratuito. Solo se envían nombres de pila,
              ciudades y los textos, lugares, reacciones y comentarios del periodo; nunca fotos,
              vídeos ni audios. En ese plan, Google puede revisar y usar lo enviado para mejorar sus
              servicios.
            </Text>
          </View>,
        )}
      </View>

      {/* ── Para ti ── */}
      <SectionTitle title="Para ti" hint="Solo te afecta a ti; nadie más lo ve." />
      <View style={[styles.list, { backgroundColor: theme.card }]}>
        {row(
          'apodo',
          'Cómo te llaman aquí',
          group.nicknames[me] ?? 'Sin apodo',
          <View style={styles.body}>
            <Field
              label="Tu apodo en este grupo"
              value={myNick}
              onChangeText={setMyNick}
              placeholder={store.user(me).about.nickname ?? 'Por ejemplo: la peque, el capi…'}
              maxLength={40}
            />
            <Small>Lo verán en tu ficha y la narradora lo usará.</Small>
            <Button
              compact
              label="Guardar apodo"
              disabled={busy || myNick.trim() === (group.nicknames[me] ?? '')}
              onPress={() =>
                run(() => store.setGroupNickname(group.id, myNick.trim() || null), 'Apodo guardado')
              }
            />
          </View>,
        )}
        {row(
          'avisos',
          'Avisos y descanso',
          muted ? 'Silenciado' : `Desde las ${hh(group.myHour)}`,
          <View style={styles.body}>
            <Stepper
              label="La propuesta, a partir de"
              value={hh(group.myHour)}
              disabled={busy}
              onMinus={() => run(() => store.setPreferredHour(group.id, (group.myHour + 23) % 24))}
              onPlus={() => run(() => store.setPreferredHour(group.id, (group.myHour + 1) % 24))}
            />
            <Stepper
              label="Descanso desde las"
              value={hh(group.quietFrom)}
              disabled={busy}
              onMinus={() =>
                run(() => store.setQuietHours(group.id, (group.quietFrom + 23) % 24, group.quietTo))
              }
              onPlus={() =>
                run(() => store.setQuietHours(group.id, (group.quietFrom + 1) % 24, group.quietTo))
              }
            />
            <Stepper
              label="hasta las"
              value={hh(group.quietTo)}
              disabled={busy}
              onMinus={() =>
                run(() => store.setQuietHours(group.id, group.quietFrom, (group.quietTo + 23) % 24))
              }
              onPlus={() =>
                run(() => store.setQuietHours(group.id, group.quietFrom, (group.quietTo + 1) % 24))
              }
            />
            <View style={[styles.option, { paddingHorizontal: 0 }]}>
              <Text style={{ flex: 1, color: theme.text, fontSize: 15 }}>
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
            <Small>
              La hora es la tuya, estés donde estés. En tus horas de descanso no llega ningún aviso:
              lo que pase te espera por la mañana.
            </Small>
          </View>,
        )}
      </View>

      {/* ── Integrantes ── */}
      <SectionTitle title="Quiénes sois" />
      <View style={[styles.list, { backgroundColor: theme.card }]}>
        {group.memberIds.map((id, i) => {
          const member = store.user(id);
          const isAdmin = group.adminIds.includes(id);
          return (
            <View
              key={id}
              style={[styles.member, i > 0 && { borderTopWidth: 1, borderTopColor: theme.soft }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Ver la ficha de ${member.name}`}
                onPress={() =>
                  router.push({ pathname: '/person/[id]', params: { id, groupId: group.id } })
                }
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                <Avatar userId={id} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontSize: 16 }}>
                    {member.name}
                    {id === me ? ' (tú)' : ''}
                  </Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                    {[isAdmin && 'Administra', member.city].filter(Boolean).join(' · ') ||
                      'Integrante'}
                  </Text>
                </View>
              </Pressable>
              {admin && id !== me && (
                <View style={{ alignItems: 'flex-end' }}>
                  <Button
                    compact
                    variant="quiet"
                    label={isAdmin ? 'Quitar admin' : 'Hacer admin'}
                    disabled={busy}
                    onPress={() =>
                      run(() => store.setMemberRole(group.id, id, isAdmin ? 'member' : 'admin'))
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
      </View>

      {Platform.OS === 'web' && (
        <>
          <SectionTitle
            title="Vuestra memoria"
            hint="Fotos, vídeos y notas de voz por meses, y una página para verlo todo sin la app."
          />
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
        </>
      )}

      <Notice>{notice}</Notice>

      <View style={{ gap: Spacing.two, marginTop: Spacing.three }}>
        {leaving ? (
          <View style={[styles.leave, { backgroundColor: theme.card }]}>
            <Text style={{ color: theme.text, fontSize: 17, fontWeight: '500' }}>
              ¿Qué hacemos con tus momentos?
            </Text>
            <Small>Pueden quedarse en la memoria del grupo o retirarse contigo.</Small>
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
          </View>
        ) : (
          <Button label="Salir del grupo" variant="quiet" onPress={() => setLeaving(true)} />
        )}
      </View>
    </Screen>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 2, marginTop: Spacing.three, paddingHorizontal: 4 }}>
      <Text style={{ color: theme.text, fontSize: 20, fontWeight: '500', letterSpacing: -0.3 }}>
        {title}
      </Text>
      {!!hint && (
        <Text style={{ color: theme.textSecondary, fontSize: 14, lineHeight: 19 }}>{hint}</Text>
      )}
    </View>
  );
}

function Small({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text style={{ color: theme.textSecondary, fontSize: 14, lineHeight: 19 }}>{children}</Text>
  );
}

/** Un apartado plegable: título y resumen; al tocarlo se abre debajo. */
function Row({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={styles.rowWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        onPress={onToggle}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
        <Text style={{ color: theme.text, fontSize: 16, flex: 1 }}>{title}</Text>
        {typeof summary === 'string' ? (
          <Text
            numberOfLines={1}
            style={{ color: theme.textSecondary, fontSize: 14, maxWidth: '50%' }}>
            {summary}
          </Text>
        ) : (
          summary
        )}
        <Icon icon={open ? ChevronDown : ChevronRight} size={16} />
      </Pressable>
      {open && <Animated.View entering={FadeIn.duration(250)}>{children}</Animated.View>}
    </View>
  );
}

function Stepper({
  label,
  value,
  disabled,
  onMinus,
  onPlus,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onMinus: () => void;
  onPlus: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Text style={{ flex: 1, color: theme.text, fontSize: 15 }}>{label}</Text>
      <Button compact variant="quiet" label="−" disabled={disabled} onPress={onMinus} />
      <Text
        style={{
          color: theme.text,
          fontSize: 16,
          fontWeight: '500',
          fontVariant: ['tabular-nums'],
        }}>
        {value}
      </Text>
      <Button compact variant="quiet" label="+" disabled={disabled} onPress={onPlus} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'flex-start', paddingVertical: Spacing.two },
  hero: { borderRadius: Radius.frame, overflow: 'hidden' },
  heroCover: { height: 120, alignItems: 'flex-end', justifyContent: 'flex-end' },
  heroSticker: { fontSize: 40, margin: 12 },
  heroName: { fontSize: 28, lineHeight: 34, fontWeight: '500', letterSpacing: -0.6 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  list: { borderRadius: Radius.inner, overflow: 'hidden' },
  rowWrap: { paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56 },
  body: { gap: 12, paddingBottom: 16 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  coverRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  cover: { width: 72, height: 72, borderRadius: Radius.small, overflow: 'hidden' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 3, borderColor: 'transparent' },
  sticker: {
    width: 42,
    height: 42,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  styles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  style: { flexBasis: '47%', flexGrow: 1, borderRadius: 16, padding: 12, gap: 2 },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  leave: { borderRadius: Radius.inner, padding: 20, gap: 10 },
});
