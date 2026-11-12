import { MapPin } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, useTheme } from '@/constants/theme';
import { errorText, useStore } from '@/data/store';
import type { Group, GroupOrigin } from '@/data/types';
import type { Place } from '@/lib/geo';

import { CityPicker } from './city-picker';
import { Icon } from './icon';
import { AvatarRow, Button, Card, Field, Lead, Notice, Tag } from './ui';

type Draft = {
  id?: string;
  place: Place | null;
  year: string;
  story: string;
  memberIds: string[];
};

const empty = (): Draft => ({ place: null, year: '', story: '', memberIds: [] });

/**
 * Dónde empezó todo: el punto de partida del grupo. Puede haber varios
 * comienzos (no todos se conocieron igual) y cada uno dice a quién incluye.
 * Lo puede contar cualquiera del grupo; «de dónde sois» lo fija quien administra.
 */
export function OriginsEditor({
  group,
  bare,
}: {
  group: Group;
  /** Sin título (dentro de otra sección). */ bare?: boolean;
}) {
  const theme = useTheme();
  const store = useStore();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [roots, setRoots] = useState(group.roots ?? '');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const name = (id: string) => group.nicknames[id] ?? store.user(id).name.split(' ')[0];
  const who = (ids: string[]) =>
    !ids.length || ids.length >= group.memberIds.length
      ? 'Todo el grupo'
      : new Intl.ListFormat('es', { type: 'conjunction' }).format(ids.map(name));

  const run = async (action: () => Promise<unknown>, after?: () => void) => {
    setBusy(true);
    setNotice('');
    try {
      await action();
      after?.();
    } catch (e) {
      setNotice(errorText(e));
    }
    setBusy(false);
  };

  const edit = (o: GroupOrigin) =>
    setDraft({
      id: o.id,
      place: { name: o.place, lat: o.lat ?? 0, lng: o.lng ?? 0 },
      year: o.year ? String(o.year) : '',
      story: o.story ?? '',
      memberIds: o.memberIds,
    });

  const yearNum = draft?.year ? Number(draft.year) : undefined;
  const yearOk =
    !draft?.year ||
    (Number.isInteger(yearNum) && yearNum! >= 1900 && yearNum! <= new Date().getFullYear());

  const save = () => {
    if (!draft?.place) return;
    const all = draft.memberIds.length >= group.memberIds.length;
    run(
      () =>
        store.saveOrigin(group.id, {
          id: draft.id,
          place: draft.place!.name,
          lat: draft.place!.lat || undefined,
          lng: draft.place!.lng || undefined,
          year: yearNum,
          story: draft.story.trim() || undefined,
          memberIds: all ? [] : draft.memberIds,
        }),
      () => setDraft(null),
    );
  };

  const toggle = (id: string) =>
    setDraft((d) => {
      if (!d) return d;
      const current = d.memberIds.length ? d.memberIds : [...group.memberIds];
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      return { ...d, memberIds: next.length >= group.memberIds.length ? [] : next };
    });

  // Quién no aparece en ningún comienzo. Si alguno incluye a todo el grupo
  // (os conocisteis a la vez), nunca falta nadie y esto no se muestra.
  const covered = new Set(
    group.origins.flatMap((o) => (o.memberIds.length ? o.memberIds : group.memberIds)),
  );
  const missing = group.origins.length ? group.memberIds.filter((id) => !covered.has(id)) : [];
  const missingNames = new Intl.ListFormat('es', { type: 'conjunction' }).format(
    missing.map((id) => (id === store.me ? 'tú' : name(id))),
  );

  return (
    <>
      {!bare && (
        <>
          <Tag>Dónde empezó todo</Tag>
          <Lead strong="Vuestro punto de partida.">
            Dónde os conocisteis. Si no todos os conocisteis igual, añadid un comienzo para cada
            historia. La narradora lo usa para contar de dónde venís.
          </Lead>
        </>
      )}

      {group.origins.map((o) => (
        <Card key={o.id} style={styles.card}>
          <View style={styles.originRow}>
            <Icon icon={MapPin} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: theme.text, fontSize: 17, fontWeight: '500' }}>
                {o.place}
                {o.year ? ` · ${o.year}` : ''}
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{who(o.memberIds)}</Text>
            </View>
            <AvatarRow userIds={o.memberIds.length ? o.memberIds : group.memberIds} size={24} />
          </View>
          {!!o.story && (
            <Text style={{ color: theme.text, fontSize: 15, lineHeight: 21 }}>{o.story}</Text>
          )}
          <View style={styles.actions}>
            <Button compact variant="quiet" label="Editar" onPress={() => edit(o)} />
            {(o.createdBy === store.me || group.isAdmin) && (
              <Button
                compact
                variant="quiet"
                label="Quitar"
                disabled={busy}
                onPress={() => run(() => store.deleteOrigin(o.id))}
              />
            )}
          </View>
        </Card>
      ))}

      {!draft && missing.length > 0 && (
        <Card style={[styles.card, { backgroundColor: theme.soft }]}>
          <View style={styles.originRow}>
            <AvatarRow userIds={missing} size={28} />
            <Text style={{ color: theme.text, fontSize: 15, lineHeight: 21, flex: 1 }}>
              {missing.length === 1 && missing[0] === store.me
                ? 'Falta cómo llegaste tú al grupo.'
                : `Falta cómo ${missing.length === 1 ? 'llegó' : 'llegaron'} ${missingNames} al grupo.`}
            </Text>
          </View>
          <View style={styles.actions}>
            <Button
              compact
              label="Contarlo"
              onPress={() => setDraft({ ...empty(), memberIds: missing })}
            />
          </View>
        </Card>
      )}

      {draft ? (
        <Card style={styles.card}>
          <CityPicker
            label="Dónde"
            empty="Elige la ciudad o el pueblo"
            hint="La ciudad donde os conocisteis. El sitio concreto, en la historia."
            clear="Quitar el lugar"
            value={draft.place}
            onChange={(place) => setDraft({ ...draft, place })}
            startOpen={!draft.place}
          />
          <Field
            label="Año (opcional)"
            value={draft.year}
            onChangeText={(year) =>
              setDraft({ ...draft, year: year.replace(/\D/g, '').slice(0, 4) })
            }
            keyboardType="number-pad"
            placeholder="2008"
          />
          <View style={{ gap: 8 }}>
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Quiénes</Text>
            <View style={styles.chips}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: !draft.memberIds.length }}
                onPress={() => setDraft({ ...draft, memberIds: [] })}
                style={[
                  styles.chip,
                  { backgroundColor: !draft.memberIds.length ? theme.accent : theme.soft },
                ]}>
                <Text
                  style={{
                    color: !draft.memberIds.length ? theme.onAccent : theme.text,
                    fontSize: 15,
                  }}>
                  Todos
                </Text>
              </Pressable>
              {group.memberIds.map((id) => {
                const on = !draft.memberIds.length || draft.memberIds.includes(id);
                const explicit = !!draft.memberIds.length && on;
                return (
                  <Pressable
                    key={id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => toggle(id)}
                    style={[
                      styles.chip,
                      { backgroundColor: explicit ? theme.accent : theme.soft },
                    ]}>
                    <Text
                      style={{
                        color: explicit ? theme.onAccent : on ? theme.text : theme.textSecondary,
                        fontSize: 15,
                      }}>
                      {name(id)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Field
            label="Cómo fue (opcional)"
            value={draft.story}
            onChangeText={(story) => setDraft({ ...draft, story })}
            maxLength={280}
            multiline
            placeholder="En el colegio, en 3.º B. Nos sentaron juntos el primer día…"
            style={{ minHeight: 88, paddingTop: 12, textAlignVertical: 'top' }}
          />
          {!yearOk && <Notice>Ese año no parece correcto.</Notice>}
          <View style={styles.actions}>
            <Button compact variant="quiet" label="Cancelar" onPress={() => setDraft(null)} />
            <Button
              compact
              label="Guardar"
              disabled={busy || !draft.place || !yearOk}
              onPress={save}
            />
          </View>
        </Card>
      ) : (
        <Button
          variant={group.origins.length ? 'quiet' : 'primary'}
          label={group.origins.length ? 'Añadir otro comienzo' : 'Contar dónde os conocisteis'}
          onPress={() => setDraft(empty())}
        />
      )}

      {group.isAdmin ? (
        <Card style={styles.card}>
          <Field
            label="De dónde sois (opcional)"
            value={roots}
            onChangeText={setRoots}
            maxLength={80}
            placeholder="Todos somos de Valladolid"
          />
          <Button
            compact
            label="Guardar"
            disabled={busy || roots.trim() === (group.roots ?? '')}
            onPress={() => run(() => store.setRoots(group.id, roots))}
          />
        </Card>
      ) : group.roots ? (
        <Text style={{ color: theme.textSecondary, fontSize: 15 }}>{group.roots}</Text>
      ) : null}
      {!!notice && <Notice>{notice}</Notice>}
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  originRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: Radius.pill, justifyContent: 'center' },
});
