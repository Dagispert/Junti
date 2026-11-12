import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DatePick } from '@/components/date-pick';
import { Icon } from '@/components/icon';
import { Avatar, Button, Field, Notice, Screen, Tag, Title } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { errorText, useStore } from '@/data/store';
import type { EventKind } from '@/data/types';
import { fromISO, KINDS, longDate, toISO, today } from '@/lib/calendar';

/** Elegir una fecha con flechas de día, mes y año (funciona igual en web y en el móvil). */
/** Crear o editar un evento del calendario. */
export default function EventScreen() {
  const { groupId, id, date } = useLocalSearchParams<{
    groupId: string;
    id?: string;
    date?: string;
  }>();
  const theme = useTheme();
  const { events, group, user, me, saveEvent, deleteEvent } = useStore();
  const existing = events.find((e) => e.id === id);
  const g = group(groupId);

  const [kind, setKind] = useState<EventKind>(existing?.kind ?? 'birthday');
  const [personId, setPersonId] = useState<string | undefined>(existing?.personId);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [titleTouched, setTitleTouched] = useState(!!existing);
  const [start, setStart] = useState(
    existing ? fromISO(existing.startsOn) : date ? fromISO(date) : today(),
  );
  const [end, setEnd] = useState<Date | undefined>(
    existing?.endsOn ? fromISO(existing.endsOn) : undefined,
  );
  const [place, setPlace] = useState(existing?.place ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const yearly = KINDS[kind].yearly;
  const canEdit = !existing || existing.createdBy === me || g?.isAdmin;
  const autoTitle = (k: EventKind, pid?: string) =>
    k === 'birthday' && pid ? `Cumpleaños de ${user(pid).name.split(' ')[0]}` : '';
  const shownTitle = titleTouched ? title : autoTitle(kind, personId) || title;

  const save = async () => {
    setBusy(true);
    setNotice('');
    try {
      await saveEvent({
        id: existing?.id,
        groupId,
        kind,
        title: shownTitle.trim(),
        description: description.trim() || undefined,
        place: place.trim() || undefined,
        startsOn: toISO(start),
        endsOn: end && !yearly && end > start ? toISO(end) : undefined,
        yearly,
        personId: kind === 'birthday' ? personId : undefined,
      });
      router.back();
    } catch (e) {
      setNotice(errorText(e));
      setBusy(false);
    }
  };

  return (
    <Screen
      header={
        <View style={styles.header}>
          <Button compact label="Cancelar" variant="quiet" onPress={() => router.back()} />
          {canEdit && (
            <Button
              compact
              label={busy ? 'Guardando…' : 'Guardar'}
              disabled={busy || !shownTitle.trim()}
              onPress={save}
            />
          )}
        </View>
      }>
      <View style={{ gap: 12 }}>
        <Tag>Calendario de {g?.name}</Tag>
        <Title>{existing ? 'Evento' : 'Nuevo evento'}</Title>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}>
        {(Object.keys(KINDS) as EventKind[]).map((k) => (
          <Pressable
            key={k}
            accessibilityRole="button"
            accessibilityState={{ selected: kind === k }}
            disabled={!canEdit}
            onPress={() => setKind(k)}
            style={[
              styles.chip,
              {
                backgroundColor: kind === k ? KINDS[k].color : theme.card,
                borderColor: kind === k ? theme.text : 'transparent',
              },
            ]}>
            <Icon icon={KINDS[k].icon} size={18} color={theme.text} />
            <Text style={{ color: theme.text, fontSize: 15, fontWeight: '500' }}>
              {KINDS[k].label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {kind === 'birthday' && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>¿De quién?</Text>
          <View style={styles.people}>
            {(g?.memberIds ?? []).map((pid) => (
              <Pressable
                key={pid}
                accessibilityRole="button"
                accessibilityState={{ selected: personId === pid }}
                disabled={!canEdit}
                onPress={() => setPersonId(personId === pid ? undefined : pid)}
                style={[
                  styles.person,
                  { backgroundColor: personId === pid ? KINDS.birthday.color : theme.card },
                ]}>
                <Avatar userId={pid} size={30} />
                <Text style={{ color: theme.text, fontSize: 15 }}>
                  {pid === me ? 'Yo' : user(pid).name.split(' ')[0]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <Field
        label="Título"
        value={shownTitle}
        editable={canEdit}
        onChangeText={(t) => {
          setTitle(t);
          setTitleTouched(true);
        }}
        placeholder={
          kind === 'trip'
            ? 'Viaje a Lisboa'
            : kind === 'reunion'
              ? 'Nos vemos en Madrid'
              : 'Ponle un nombre'
        }
      />

      <DatePick
        label={yearly ? 'Fecha (se repite cada año)' : 'Fecha'}
        value={start}
        onChange={canEdit ? setStart : () => {}}
        hideYear={kind === 'birthday'}
      />
      {(kind === 'trip' || kind === 'reunion' || kind === 'celebration') &&
        (end ? (
          <View style={{ gap: 8 }}>
            <DatePick label="Hasta" value={end} onChange={canEdit ? setEnd : () => {}} />
            {canEdit && (
              <Button
                compact
                variant="quiet"
                label="Es un solo día"
                onPress={() => setEnd(undefined)}
              />
            )}
          </View>
        ) : (
          canEdit && (
            <Button
              compact
              variant="quiet"
              label="＋ Dura varios días"
              onPress={() => setEnd(new Date(start.getTime() + 3 * 86_400_000))}
            />
          )
        ))}

      {kind !== 'birthday' && (
        <Field
          label="Lugar (opcional)"
          value={place}
          editable={canEdit}
          onChangeText={setPlace}
          placeholder="Madrid, la casa del pueblo…"
        />
      )}
      <Field
        label="Nota (opcional)"
        value={description}
        editable={canEdit}
        onChangeText={setDescription}
        multiline
        style={{ height: 90, paddingTop: 16 }}
      />

      <Notice>{notice}</Notice>
      {existing && canEdit && (
        <View style={{ alignItems: 'center' }}>
          {confirm ? (
            <Button
              label="Sí, borrar el evento"
              onPress={() =>
                deleteEvent(existing.id)
                  .then(() => router.back())
                  .catch((e) => setNotice(errorText(e)))
              }
            />
          ) : (
            <Button
              compact
              variant="quiet"
              label="Borrar evento"
              onPress={() => setConfirm(true)}
            />
          )}
        </View>
      )}
      {!canEdit && (
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
          Solo quien lo creó o quien administra el grupo puede cambiarlo.
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.two },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 4,
    paddingRight: 16,
    borderRadius: Radius.pill,
  },
});
