import { router } from 'expo-router';
import { RefreshCw, Sparkles } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Hand, Spacing, useTheme } from '@/constants/theme';
import type { Group } from '@/data/types';
import { apuntarError } from '@/lib/errores';
import type { FamilyId } from '@/lib/families';
import {
  type IdeaReto,
  pedirIdeasRetos,
  type RespuestaIdeas,
  type TipoIdea,
} from '@/lib/ideas-retos';

import { FamilyTag } from './family';
import { Icon } from './icon';
import { Button, Card, Tag } from './ui';

const duracion = (d: number) => (d === 1 ? '1 día' : `${d} días`);

/** Cómo se ve y qué dice el botón de cada tipo de idea. */
const TIPO: Record<TipoIdea, { familia: FamilyId; boton: string; dias: boolean }> = {
  reto: { familia: 'challenge', boton: 'Lanzar este reto', dias: true },
  karaoke: { familia: 'challenge', boton: 'Preparar el karaoke', dias: true },
  encuesta: { familia: 'poll', boton: 'Crear la encuesta', dias: true },
  quiz: { familia: 'quiz', boton: 'Crear el quiz', dias: true },
  pregunta: { familia: 'open', boton: 'Preguntar', dias: false },
  recuerdo: { familia: 'memory', boton: 'Compartir un recuerdo', dias: false },
  cuento: { familia: 'challenge', boton: 'Empezar el cuento', dias: true },
  zoom: { familia: 'challenge', boton: 'Preparar el zoom', dias: true },
};

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
      .then((r) => {
        setRes(r);
        // si la IA no respondió, se apunta (para verlo en «Errores recientes»)
        if (r.reason === 'busy' && !r.ideas.length)
          apuntarError(
            new Error(`Ideas de la narradora: ${r.detalle ?? 'sin respuesta'}`),
            'aviso',
          );
      })
      .catch((e) => {
        setFallo(true);
        apuntarError(e, 'aviso');
      })
      .finally(() => setPensando(false));
  };
  useEffect(() => {
    pedir(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id]);

  // Cada idea abre lo mismo que el «+», ya relleno (y se puede cambiar todo).
  const lanzar = (idea: IdeaReto) => {
    const g = group.id;
    const days = String(idea.days);
    switch (idea.tipo ?? 'reto') {
      case 'karaoke':
        return router.push({
          pathname: '/new-karaoke',
          params: {
            groupId: g,
            q: [idea.cancion?.titulo, idea.cancion?.artista].filter(Boolean).join(' '),
            title: idea.title,
            days,
          },
        });
      case 'encuesta':
      case 'quiz':
        return router.push({
          pathname: '/ask',
          params: {
            groupId: g,
            kind: idea.tipo === 'quiz' ? 'quiz' : 'poll',
            title: idea.title,
            options: JSON.stringify(idea.opciones ?? []),
            days,
          },
        });
      case 'pregunta':
        return router.push({
          pathname: '/ask',
          params: { groupId: g, kind: 'open', title: idea.title },
        });
      case 'cuento':
        return router.push({
          pathname: '/new-cuento',
          params: { groupId: g, inicio: idea.title, days: idea.days > 5 ? '7' : '3' },
        });
      case 'zoom':
        return router.push({ pathname: '/new-zoom', params: { groupId: g, pista: idea.title } });
      case 'recuerdo':
        return router.push({
          pathname: '/publish',
          params: { groupId: g, memory: '1', pista: idea.title },
        });
      default:
        return router.push({
          pathname: '/new-challenge',
          params: { groupId: g, title: idea.title, body: idea.body, days },
        });
    }
  };

  if (res?.reason === 'off') {
    return (
      <View style={{ gap: Spacing.two }}>
        <Tag>Pensados para vosotros</Tag>
        <Card style={styles.card}>
          <View style={styles.fila}>
            <Icon icon={Sparkles} size={18} color={theme.textSecondary} />
            <Text style={{ color: theme.text, fontSize: 16, lineHeight: 22, flex: 1 }}>
              Si activáis la narradora, os propondrá retos, karaokes, encuestas y más a partir de lo
              que vais compartiendo.
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
              La narradora está pensando qué proponeros…
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
        ideas.map((idea, i) => {
          const t = TIPO[idea.tipo ?? 'reto'] ?? TIPO.reto;
          return (
            <Animated.View key={idea.title} entering={FadeInDown.delay(i * 90).duration(350)}>
              <Card style={styles.card}>
                <View style={styles.cabecera}>
                  <FamilyTag family={t.familia} />
                  {(idea.tipo === 'karaoke' || idea.tipo === 'cuento' || idea.tipo === 'zoom') && (
                    <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                      {idea.tipo === 'karaoke'
                        ? 'Karaoke'
                        : idea.tipo === 'cuento'
                          ? 'El cuento a trozos'
                          : 'Zoom misterioso'}
                    </Text>
                  )}
                </View>
                <View style={{ gap: 4 }}>
                  <Text
                    style={{ color: theme.text, fontSize: 19, fontWeight: '500', lineHeight: 24 }}>
                    {idea.title}
                  </Text>
                  {idea.tipo === 'karaoke' && idea.cancion && (
                    <Text style={{ color: theme.text, fontSize: 15 }}>
                      ♪ {idea.cancion.titulo}
                      {idea.cancion.artista ? ` · ${idea.cancion.artista}` : ''}
                    </Text>
                  )}
                  {!!idea.body && (
                    <Text style={{ color: theme.textSecondary, fontSize: 15, lineHeight: 20 }}>
                      {idea.body}
                    </Text>
                  )}
                  {!!idea.opciones?.length && (
                    <View style={styles.opciones}>
                      {idea.opciones.map((o) => (
                        <View key={o} style={[styles.opcion, { backgroundColor: theme.soft }]}>
                          <Text style={{ color: theme.text, fontSize: 14 }}>{o}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
                {!!idea.porque && (
                  <Text style={{ color: theme.textSecondary, fontSize: 18, fontFamily: Hand }}>
                    {idea.porque}
                  </Text>
                )}
                <View style={styles.pie}>
                  <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                    {t.dias ? duracion(idea.days) : ''}
                  </Text>
                  <Button compact label={t.boton} onPress={() => lanzar(idea)} />
                </View>
              </Card>
            </Animated.View>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, gap: 12 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  otras: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  opcion: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  pie: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
