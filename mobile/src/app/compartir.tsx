import { router } from 'expo-router';
import { History, Camera } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Icon } from '@/components/icon';
import { Button, Lead, Screen, Title } from '@/components/ui';
import { Hand, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import { clearInbox, handOff, loadShared, type Shared } from '@/lib/shared';

/**
 * «Guardar en Junti»: lo que llega desde el menú de compartir de otra app
 * (WhatsApp, la galería…). Se elige el grupo y si es un momento de ahora o un
 * recuerdo de antes, y se pasa a «Publicar» con todo ya puesto.
 */
export default function Compartir() {
  const theme = useTheme();
  const { groups, me, user } = useStore();
  const [shared, setShared] = useState<Shared | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  // quién lo mandó en WhatsApp ('' = yo)
  const [sender, setSender] = useState('');

  useEffect(() => {
    loadShared().then(setShared);
  }, []);
  useEffect(() => {
    if (!groupId && groups.length) setGroupId(groups[0].id);
  }, [groups, groupId]);

  const go = async (memory: boolean) => {
    if (!shared || !groupId) return;
    handOff(shared);
    // ya está en la app: el buzón del servidor se vacía
    if (shared.inboxIds.length) clearInbox();
    router.replace({
      pathname: '/publish',
      params: {
        groupId,
        ...(memory ? { memory: '1' } : {}),
        ...(sender ? { creditedTo: sender } : {}),
      },
    });
  };

  const header = (
    <View style={styles.header}>
      <Button compact label="Cancelar" variant="quiet" onPress={() => router.replace('/')} />
    </View>
  );

  if (!shared)
    return (
      <Screen header={header}>
        <View style={{ paddingTop: 80, alignItems: 'center', gap: 12 }}>
          <ActivityIndicator />
          <Text style={{ color: theme.textSecondary }}>Recogiendo lo que has compartido…</Text>
        </View>
      </Screen>
    );

  const empty = !shared.items.length && !shared.text;
  return (
    <Screen header={header}>
      <Title>Guardar en Junti</Title>
      {empty ? (
        <View style={{ gap: 14 }}>
          <Lead strong="No ha llegado nada.">
            Desde WhatsApp, mantén pulsada una foto o un mensaje, toca Compartir y elige Junti.
          </Lead>
          <Button label="Cómo se configura" onPress={() => router.replace('/compartir-ajustes')} />
        </View>
      ) : (
        <>
          {/* lo que ha llegado */}
          {shared.items.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10 }}>
              {shared.items.map((it, i) => (
                <View
                  key={it.uri}
                  style={[styles.thumb, { transform: [{ rotate: `${i % 2 ? 2 : -2}deg` }] }]}>
                  {it.kind === 'photo' ? (
                    <Image
                      source={{ uri: it.uri }}
                      style={StyleSheet.absoluteFill}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, styles.video]}>
                      <Text style={{ color: '#FFFFFF', fontSize: 13 }}>Vídeo</Text>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          )}
          {!!shared.text && (
            <Text style={[styles.text, { color: theme.text, backgroundColor: theme.card }]}>
              «{shared.text}»
            </Text>
          )}

          <Text style={[styles.label, { color: theme.textSecondary }]}>¿En qué grupo?</Text>
          <View style={styles.row}>
            {groups.map((g) => {
              const on = g.id === groupId;
              return (
                <Pressable
                  key={g.id}
                  accessibilityRole="radio"
                  aria-checked={on}
                  onPress={() => {
                    setGroupId(g.id);
                    setSender('');
                  }}
                  style={[styles.chip, { backgroundColor: on ? theme.accent : theme.soft }]}>
                  <Text
                    style={{
                      color: on ? theme.onAccent : theme.text,
                      fontSize: 15,
                      fontWeight: '500',
                    }}>
                    {g.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* quién lo mandó en WhatsApp: saldrá a su nombre */}
          <Text style={[styles.label, { color: theme.textSecondary }]}>¿Quién lo mandó?</Text>
          <View style={styles.row}>
            {[
              '',
              ...(groups.find((g) => g.id === groupId)?.memberIds ?? []).filter((id) => id !== me),
            ].map((id) => {
              const on = sender === id;
              return (
                <Pressable
                  key={id || 'yo'}
                  accessibilityRole="radio"
                  aria-checked={on}
                  onPress={() => setSender(id)}
                  style={[styles.chip, { backgroundColor: on ? theme.accent : theme.soft }]}>
                  <Text
                    style={{
                      color: on ? theme.onAccent : theme.text,
                      fontSize: 15,
                      fontWeight: '500',
                    }}>
                    {id ? user(id).name.split(' ')[0] : 'Yo'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {!!sender && (
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
              Saldrá a nombre de {user(sender).name.split(' ')[0]}, con «lo compartiste tú».
            </Text>
          )}

          <Text style={[styles.label, { color: theme.textSecondary }]}>¿Qué es?</Text>
          <View style={{ gap: 10 }}>
            <Option
              icon={Camera}
              title="Un momento de ahora"
              hint="Sale hoy en el grupo"
              onPress={() => go(false)}
            />
            <Option
              icon={History}
              title="Un recuerdo de antes"
              hint="Se guarda en su fecha, en vuestra historia"
              onPress={() => go(true)}
            />
          </View>
        </>
      )}
    </Screen>
  );
}

function Option({
  icon,
  title,
  hint,
  onPress,
}: {
  icon: typeof Camera;
  title: string;
  hint: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.option, { backgroundColor: theme.card, boxShadow: theme.shadow }]}>
      <View style={[styles.icon, { backgroundColor: theme.soft }]}>
        <Icon icon={icon} size={22} color={theme.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '600' }}>{title}</Text>
        <Text style={{ color: theme.textSecondary, fontSize: 14 }}>{hint}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'flex-start' },
  thumb: {
    width: 120,
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#2B2E33',
  },
  video: { alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: Hand, fontSize: 22, lineHeight: 26, padding: 16, borderRadius: 16 },
  label: { fontSize: 13, marginTop: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 20 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
