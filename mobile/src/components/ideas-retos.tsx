import { router } from 'expo-router';
import { RefreshCw, Sparkles } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Hand, Spacing, useTheme } from '@/constants/theme';
import type { Group } from '@/data/types';
import { type IdeaReto, pedirIdeasRetos, type RespuestaIdeas } from '@/lib/ideas-retos';

import { Icon } from './icon';
import { Button, Card, Tag } from './ui';

const duracion = (d: number) => (d === 1 ? '1 día' : `${d} días`);

/**
 * «Pensados para vosotros»: retos que la narradora inventa a partir de lo que
 * comparte el grupo. Cambian cada pocos días (o al pedir otros).
 */
export function IdeasNarradora({ group }: { group: Group }) {
  const theme = useTheme();
  const [res, setRes] = useState<RespuestaIdeas>();
  const [pensando, setPensando] = useState(true);
  const [fallo, setFallo] = useState(false);

  const pedir = (otras: boolean) => {
    setPensando(true);
    setFallo(false);
    pedirIdeasRetos(group.id, otras)
      .then(setRes)
      .catch(() => setFallo(true))
      .finally(() => setPensando(false));
  };
  useEffect(() => {
    pedir(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id]);

  const lanzar = (idea: IdeaReto) =>
    router.push({
      pathname: '/new-challenge',
      params: { groupId: group.id, title: idea.title, body: idea.body, days: String(idea.days) },
    });

  if (res?.reason === 'off') {
    return (
      <View style={{ gap: Spacing.two }}>
        <Tag>Pensados para vosotros</Tag>
        <Card style={styles.card}>
          <View style={styles.fila}>
            <Icon icon={Sparkles} size={18} color={theme.textSecondary} />
            <Text style={{ color: theme.text, fontSize: 16, lineHeight: 22, flex: 1 }}>
              Si activáis la narradora, os inventará retos a partir de lo que vais compartiendo.
            </Text>
          </View>
          <Button
            compact
            variant="light"
            label="Ir a los ajustes del grupo"
            onPress={() =>
              router.push({ pathname: '/group-settings', params: { groupId: group.id } })
            }
          />
        </Card>
      </View>
    );
  }
  if (res?.reason === 'forbidden' || res?.reason === 'bad') return null;

  const ideas = res?.ideas ?? [];
  return (
    <View style={{ gap: Spacing.two }}>
      <View style={styles.cabecera}>
        <Tag>Pensados para vosotros</Tag>
        {!pensando && ideas.length > 0 && (res?.left ?? 0) > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pedir otras ideas"
            onPress={() => pedir(true)}
            hitSlop={8}
            style={styles.otras}>
            <Icon icon={RefreshCw} size={14} color={theme.textSecondary} />
            <Text style={{ color: theme.textSecondary, fontSize: 14 }}>Otras ideas</Text>
          </Pressable>
        )}
      </View>

      {pensando && (
        <Card style={styles.card}>
          <View style={styles.fila}>
            <Icon icon={Sparkles} size={18} color={theme.textSecondary} />
            <Text style={{ color: theme.textSecondary, fontSize: 16, fontFamily: Hand }}>
              La narradora está pensando en vosotros…
            </Text>
          </View>
        </Card>
      )}

      {!pensando && (fallo || (!ideas.length && res?.reason === 'busy')) && (
        <Card style={styles.card}>
          <Text style={{ color: theme.textSecondary, fontSize: 15 }}>
            Ahora mismo no se le ocurre nada. Prueba otra vez en un rato.
          </Text>
          <Button compact variant="light" label="Reintentar" onPress={() => pedir(false)} />
        </Card>
      )}

      {!pensando &&
        ideas.map((idea, i) => (
          <Animated.View key={idea.title} entering={FadeInDown.delay(i * 90).duration(350)}>
            <Card style={styles.card}>
              <View style={{ gap: 4 }}>
                <Text
                  style={{ color: theme.text, fontSize: 19, fontWeight: '500', lineHeight: 24 }}>
                  {idea.title}
                </Text>
                {!!idea.body && (
                  <Text style={{ color: theme.textSecondary, fontSize: 15, lineHeight: 20 }}>
                    {idea.body}
                  </Text>
                )}
              </View>
              {!!idea.porque && (
                <Text style={{ color: theme.textSecondary, fontSize: 18, fontFamily: Hand }}>
                  {idea.porque}
                </Text>
              )}
              <View style={styles.pie}>
                <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                  {duracion(idea.days)}
                </Text>
                <Button compact label="Lanzar este reto" onPress={() => lanzar(idea)} />
              </View>
            </Card>
          </Animated.View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, gap: 12 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  otras: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pie: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
