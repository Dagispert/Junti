import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Play, Plus } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Hand, Radius, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import type { GalleryItem, Moment } from '@/data/types';

import { Icon } from './icon';
import { OwnerActions } from './owner-actions';
import { Avatar } from './ui';

/**
 * «Cómo lo recuerda cada uno»: la versión de quien publicó el recuerdo y la
 * de cada persona que ha añadido la suya (su texto y sus fotos o vídeos).
 * Nadie tiene por qué tener las mismas fotos ni recordarlo igual.
 */
export function MemoryVersions({ moment }: { moment: Moment }) {
  const theme = useTheme();
  const { me, user, editMemoryAddition, deleteMemoryAddition } = useStore();
  const first = (id: string) => user(id).name.split(' ')[0];
  const additions = moment.additions ?? [];

  return (
    <View style={{ gap: 14 }}>
      <Text style={[styles.title, { color: theme.text }]}>Cómo lo recuerda cada uno</Text>

      <View style={styles.version}>
        <Avatar userId={moment.authorId} size={34} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.name, { color: theme.text }]}>
            {moment.authorId === me ? 'Tú' : first(moment.authorId)}
            <Text style={{ color: theme.textSecondary, fontWeight: '400' }}> · lo guardó</Text>
          </Text>
          <Text style={[styles.text, { color: theme.text }]}>
            {moment.text || 'Sin palabras: solo las fotos.'}
          </Text>
        </View>
      </View>

      {additions.map((a) => (
        <View key={a.id} style={styles.version}>
          <Avatar userId={a.authorId} size={34} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={[styles.name, { color: theme.text }]}>
              {a.authorId === me ? 'Tú' : first(a.authorId)}
              {a.edited ? (
                <Text style={{ color: theme.textSecondary, fontWeight: '400' }}> · editado</Text>
              ) : null}
            </Text>
            {!!a.text && <Text style={[styles.text, { color: theme.text }]}>{a.text}</Text>}
            {a.items.length > 0 && <Thumbs items={a.items} />}
            {a.authorId === me && (
              <OwnerActions
                fields={[
                  {
                    label: '¿Cómo lo recuerdas tú?',
                    value: a.text ?? '',
                    max: 2000,
                    multiline: true,
                    required: a.items.length === 0,
                  },
                ]}
                onSave={([text]) => editMemoryAddition(a.id, text)}
                onDelete={() => deleteMemoryAddition(a.id)}
                deleteNote="Se quitan tu texto y tus fotos de este recuerdo."
              />
            )}
          </View>
        </View>
      ))}

      {moment.authorId !== me && (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: '/publish',
              params: { groupId: moment.groupId, addTo: moment.id },
            })
          }
          style={[styles.add, { backgroundColor: theme.text }]}>
          <Icon icon={Plus} size={18} color={theme.background} />
          <Text style={{ color: theme.background, fontSize: 15, fontWeight: '600' }}>
            {additions.some((a) => a.authorId === me) ? 'Añadir algo más' : 'Añadir tu versión'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function Thumbs({ items }: { items: GalleryItem[] }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6 }}>
      {items.map((it) => (
        <View key={it.uri} style={styles.thumb}>
          <Image
            source={{ uri: it.kind === 'photo' ? it.uri : it.poster }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          {it.kind === 'video' && (
            <View style={[StyleSheet.absoluteFill, styles.play]}>
              <Icon icon={Play} size={16} color="#FFFFFF" />
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

/** Una línea para la tarjeta de un recuerdo: quién más ha añadido su versión. */
export function VersionsLine({ moment }: { moment: Moment }) {
  const theme = useTheme();
  const { user, me } = useStore();
  if (!moment.memory) return null;
  const others = [...new Set((moment.additions ?? []).map((a) => a.authorId))].filter(
    (id) => id !== me,
  );
  const mine = (moment.additions ?? []).some((a) => a.authorId === me);
  const names = others.map((id) => user(id).name.split(' ')[0]);
  const list =
    names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : names[0];
  const label = others.length
    ? `${list} ${others.length === 1 ? 'ha' : 'han'} añadido su versión${mine ? ', y tú la tuya' : ''}`
    : mine
      ? 'Has añadido tu versión'
      : moment.authorId === me
        ? 'Los demás pueden añadir su versión de este recuerdo'
        : '¿Lo recuerdas distinto? Añade tu versión';
  const canAdd = moment.authorId !== me && !mine && !others.length;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        canAdd
          ? router.push({
              pathname: '/publish',
              params: { groupId: moment.groupId, addTo: moment.id },
            })
          : router.push({ pathname: '/moment/[id]', params: { id: moment.id } })
      }
      style={styles.line}>
      <Text style={{ color: theme.textSecondary, fontSize: 14, flex: 1 }}>{label}</Text>
      <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>
        {canAdd ? 'Añadir' : 'Ver'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: Hand, fontSize: 28 },
  version: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  name: { fontSize: 15, fontWeight: '600' },
  text: { fontSize: 16, lineHeight: 22 },
  thumb: { width: 64, height: 64, borderRadius: Radius.small, overflow: 'hidden' },
  play: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: Radius.pill,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingTop: 10,
  },
});
