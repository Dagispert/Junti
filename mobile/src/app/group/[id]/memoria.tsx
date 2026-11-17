import { useLocalSearchParams } from 'expo-router';
import { History } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { useSmoothHeight } from '@/components/motion';

import { AlbumShelf } from '@/components/album-shelf';
import { FilmRoll3D, FilmRollGrid } from '@/components/film-roll-3d';
import { RecapCard } from '@/components/recap-card';
import { StoryBook } from '@/components/story-book';
import { GroupHeader } from '@/components/group-header';
import { PolaroidPile, Scribble } from '@/components/scrapbook';
import { Soundtrack } from '@/components/soundtrack';
import { Lead, Screen } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import type { Moment } from '@/data/types';
import { esMinijuego, useFotogramasJuegos } from '@/lib/juegos-pelicula';
import { weekStart } from '@/lib/recap';
import { WeekShelf } from '@/components/week-shelf';
import { monthOf } from '@/lib/time';

import { Missing } from './index';

/** La memoria del grupo: lo de esta semana en un montón de polaroids, la banda sonora y un carrete por mes, y otro con vuestra historia. */
export default function Memory() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { group: groupById, moments, user, proposals } = useStore();
  // los minijuegos del grupo, cada uno como un fotograma de su mes
  const delGrupo = proposals.filter((p) => p.groupId === id);
  const fotogramasJuegos = useFotogramasJuegos(delGrupo);
  const tomasDeJuegos = new Set(delGrupo.filter(esMinijuego).map((p) => p.id));
  const group = groupById(id);
  // las semanas anteriores, plegadas hasta que se pidan
  const [verSemanas, setVerSemanas] = useState(false);
  const estanteRef = useSmoothHeight([verSemanas]);
  if (!group) return <Missing />;
  const botonSemanas = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        verSemanas ? 'Ocultar las semanas anteriores' : 'Ver las semanas anteriores'
      }
      aria-expanded={verSemanas}
      hitSlop={8}
      onPress={() => setVerSemanas((v) => !v)}
      style={[styles.boton, { backgroundColor: verSemanas ? theme.text : theme.soft }]}>
      <Icon icon={History} size={18} color={verSemanas ? theme.background : theme.text} />
    </Pressable>
  );

  // Por fecha de lo que pasó (los recuerdos, en la suya).
  const all = moments.filter((m) => m.groupId === id).sort((a, b) => b.createdAt - a.createdAt);
  const months: { key: string; label: string; items: Moment[] }[] = [];
  // Los recuerdos (lo de antes de Junti) van en «Nuestra historia», no por meses.
  // (las tomas sueltas de los minijuegos van dentro de su fotograma)
  const delCarrete = [
    ...all.filter((m) => !m.memory && !(m.proposalId && tomasDeJuegos.has(m.proposalId))),
    ...fotogramasJuegos,
  ].sort((a, b) => b.createdAt - a.createdAt);
  for (const moment of delCarrete) {
    const { key, label } = monthOf(moment.createdAt);
    const last = months[months.length - 1];
    if (last?.key === key) last.items.push(moment);
    else months.push({ key, label, items: [moment] });
  }

  // esta semana: de lunes a hoy (la que está en curso)
  const thisWeek = weekStart(Date.now());
  const hayAnteriores = all.some((m) => !m.memory && m.createdAt < thisWeek);
  const week = all.filter((m) => !m.memory && m.createdAt >= thisWeek);
  // lo de la semana: los momentos (sin las tomas de los juegos) y los juegos
  const momentosSemana = week.filter((m) => !(m.proposalId && tomasDeJuegos.has(m.proposalId)));
  const juegosSemana = fotogramasJuegos.filter((j) => j.createdAt >= thisWeek).length;
  const cuenta = [
    momentosSemana.length
      ? `${momentosSemana.length} ${momentosSemana.length === 1 ? 'momento' : 'momentos'}`
      : '',
    juegosSemana ? `${juegosSemana} ${juegosSemana === 1 ? 'juego' : 'juegos'}` : '',
  ]
    .filter(Boolean)
    .join(' y ');
  const who = [...new Set(week.map((m) => user(m.authorId).name.split(' ')[0]))];
  const whoText =
    who.length > 1 ? `${who.slice(0, -1).join(', ')} y ${who[who.length - 1]}` : who[0];
  const pile = (week.length >= 3 ? week : all).filter((m) => m.imageUri || m.videoUri).slice(0, 7);

  return (
    <Screen header={<GroupHeader group={group} />}>
      {all.length === 0 ? (
        <Lead strong="La memoria del grupo se irá llenando sola,">
          mes a mes, con lo que compartáis.
        </Lead>
      ) : (
        <View style={styles.hero}>
          {pile.length > 0 && <PolaroidPile moments={pile} size={320} />}
          <Text style={[styles.heroText, { color: theme.text }]}>
            {momentosSemana.length + juegosSemana >= 6
              ? 'Ha pasado mucho esta semana'
              : cuenta
                ? `Esta semana, ${cuenta}`
                : 'Una semana tranquila'}
          </Text>
          {week.length > 0 && (
            <Scribble size={22} rotate={-2}>
              Gracias a {whoText} ♡
            </Scribble>
          )}
        </View>
      )}

      {/* La semana en curso (se puede ver cómo va) y, debajo, todas las anteriores. */}
      {week.length > 0 ? (
        <RecapCard
          groupId={group.id}
          kind="week"
          from={thisWeek}
          hint="Así va vuestra semana"
          accessory={hayAnteriores ? botonSemanas : null}
        />
      ) : (
        hayAnteriores && (
          <View style={styles.soloBoton}>
            <Text style={{ color: theme.textSecondary, fontSize: 15 }}>Semanas anteriores</Text>
            {botonSemanas}
          </View>
        )
      )}
      {/* Las semanas anteriores, plegadas: se despliegan con el icono. */}
      <View ref={estanteRef as never} style={{ overflow: 'hidden' }}>
        {verSemanas && (
          <Animated.View entering={FadeInDown.duration(320)}>
            <WeekShelf groupId={group.id} moments={all} />
          </Animated.View>
        )}
      </View>

      {/* Vuestra historia, como un diario de recuerdos que se abre y pasa hojas. */}
      <StoryBook groupId={group.id} origins={group.origins} moments={all} />

      <Soundtrack groupId={group.id} />
      <AlbumShelf groupId={group.id} />

      {months.length > 0 && (
        <FilmRollGrid>
          {months.map((m, i) => (
            <FilmRoll3D
              key={m.key}
              moments={m.items}
              label={m.label}
              index={i}
              groupId={group.id}
            />
          ))}
        </FilmRollGrid>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three },
  boton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soloBoton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  heroText: { fontSize: 24, letterSpacing: -0.4, textAlign: 'center' },
});
