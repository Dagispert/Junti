import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Button, Lead, Notice, Photo, Screen, Tag, Title } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { errorText, useStore } from '@/data/store';
import type { Moment } from '@/data/types';
import { monthOf } from '@/lib/time';

/** Un álbum: sus momentos en cuadrícula; se eligen y se quitan desde aquí. */
export default function AlbumScreen() {
  const { id, select } = useLocalSearchParams<{ id: string; select?: string }>();
  const theme = useTheme();
  const { albums, moments, group: groupById, me, setAlbumMoments, deleteAlbum } = useStore();
  const album = albums.find((a) => a.id === id);
  const [choosing, setChoosing] = useState(select === '1');
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [confirming, setConfirming] = useState(false);
  if (!album) {
    return (
      <Screen>
        <Lead strong="Este álbum ya no existe." />
        <Button label="Volver" variant="quiet" onPress={() => router.back()} />
      </Screen>
    );
  }
  const group = groupById(album.groupId);
  const inAlbum = album.momentIds
    .map((mid) => moments.find((m) => m.id === mid))
    .filter((m): m is Moment => !!m);
  // Para elegir: todos los momentos del grupo, del más reciente al más antiguo.
  const all = moments
    .filter((m) => m.groupId === album.groupId)
    .sort((a, b) => b.createdAt - a.createdAt);
  const selection = picked ?? new Set(album.momentIds);
  const canDelete = album.createdBy === me || !!group?.isAdmin;

  const toggle = (mid: string) => {
    const next = new Set(selection);
    if (next.has(mid)) next.delete(mid);
    else next.add(mid);
    setPicked(next);
  };
  const save = async () => {
    setBusy(true);
    setNotice('');
    try {
      const before = new Set(album.momentIds);
      await setAlbumMoments(
        album.id,
        [...selection].filter((m) => !before.has(m)),
        [...before].filter((m) => !selection.has(m)),
      );
      setChoosing(false);
      setPicked(null);
    } catch (error) {
      setNotice(errorText(error));
    }
    setBusy(false);
  };

  const tile = (m: Moment, selectable: boolean) => {
    const on = selection.has(m.id);
    return (
      <Pressable
        key={m.id}
        accessibilityRole={selectable ? 'checkbox' : 'button'}
        accessibilityState={selectable ? { checked: on } : undefined}
        accessibilityLabel={m.text ?? 'Momento'}
        onPress={() =>
          selectable
            ? toggle(m.id)
            : router.push({ pathname: '/moment/[id]', params: { id: m.id } })
        }
        style={styles.cell}>
        <Photo moment={m} style={StyleSheet.absoluteFill} badge={!selectable} animate={false} />
        {selectable && (
          <View
            style={[
              styles.check,
              on
                ? { backgroundColor: theme.accent, borderColor: theme.accent }
                : { borderColor: '#FFFFFF' },
            ]}>
            {on && <Icon icon={Check} size={14} color={theme.onAccent} />}
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <Screen
      header={
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            style={[styles.round, { backgroundColor: theme.card }]}>
            <Icon icon={ArrowLeft} color={theme.text} />
          </Pressable>
          {choosing ? (
            <Button compact label={busy ? 'Guardando…' : 'Listo'} disabled={busy} onPress={save} />
          ) : (
            <Button
              compact
              variant="quiet"
              label="Elegir momentos"
              onPress={() => setChoosing(true)}
            />
          )}
        </View>
      }>
      <View style={{ gap: 8 }}>
        {group && <Tag>{group.name}</Tag>}
        <Title>{album.title}</Title>
        {!!album.description && (
          <Text style={{ color: theme.textSecondary, fontSize: 17, lineHeight: 24 }}>
            {album.description}
          </Text>
        )}
        {!choosing && inAlbum.length > 0 && (
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
            {inAlbum.length} {inAlbum.length === 1 ? 'momento' : 'momentos'} ·{' '}
            {monthOf(inAlbum[0].createdAt).label}
            {inAlbum.length > 1 &&
            monthOf(inAlbum[0].createdAt).key !== monthOf(inAlbum[inAlbum.length - 1].createdAt).key
              ? ` – ${monthOf(inAlbum[inAlbum.length - 1].createdAt).label}`
              : ''}
          </Text>
        )}
      </View>

      {choosing ? (
        <>
          <Text style={{ color: theme.textSecondary, fontSize: 15 }}>
            Toca los momentos que van en este álbum ({selection.size})
          </Text>
          <View style={styles.grid}>{all.map((m) => tile(m, true))}</View>
        </>
      ) : inAlbum.length ? (
        <View style={styles.grid}>{inAlbum.map((m) => tile(m, false))}</View>
      ) : (
        <Lead strong="Todavía está vacío.">Toca «Elegir momentos» para llenarlo.</Lead>
      )}
      <Notice>{notice}</Notice>

      {canDelete && !choosing && (
        <Button
          variant="quiet"
          label={confirming ? '¿Seguro? Toca otra vez para borrar el álbum' : 'Borrar el álbum'}
          onPress={async () => {
            if (!confirming) return setConfirming(true);
            await deleteAlbum(album.id).catch(() => {});
            router.back();
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  cell: { width: '32.6%', aspectRatio: 1, borderRadius: Radius.small, overflow: 'hidden' },
  check: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
