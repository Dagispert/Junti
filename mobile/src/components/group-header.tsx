import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, useTheme } from '@/constants/theme';
import { errorText, useStore } from '@/data/store';
import type { Group } from '@/data/types';

import { Button, Notice, Tag, Title } from './ui';

/** Cabecera del grupo: nombre, invitación y la hora local de cada integrante. */
export function GroupHeader({ group }: { group: Group }) {
  const theme = useTheme();
  const { createInvite } = useStore();
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState('');

  const invite = async () => {
    setNotice('');
    try {
      const next = code || (await createInvite(group.id));
      setCode(next);
      // En el móvil abre el menú de compartir; en web no existe y basta con mostrar el código.
      await Share.share({
        message: `Únete a «${group.name}» en Junti con este código: ${next}`,
      }).catch(() => {});
    } catch (error) {
      setNotice(errorText(error));
    }
  };

  return (
    <View style={styles.header}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" onPress={() => router.dismissTo('/')}>
          <Text style={{ color: theme.textSecondary, fontSize: 14 }}>‹ Mis grupos</Text>
        </Pressable>
        <View style={{ flexDirection: 'row' }}>
          <Button
            compact
            variant="quiet"
            label="Calendario"
            onPress={() => router.push({ pathname: '/calendar', params: { groupId: group.id } })}
          />
          <Button
            compact
            variant="quiet"
            label="Ajustes"
            onPress={() =>
              router.push({ pathname: '/group-settings', params: { groupId: group.id } })
            }
          />
          <Button compact variant="quiet" label="Invitar" onPress={invite} />
        </View>
      </View>
      <Title>{group.name}</Title>
      {!!code && (
        <View style={[styles.code, { backgroundColor: theme.card, boxShadow: theme.shadow }]}>
          <Tag>Código · caduca en 14 días</Tag>
          <Text selectable style={[styles.codeText, { color: theme.text }]}>
            {code}
          </Text>
        </View>
      )}
      <Notice>{notice}</Notice>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: Spacing.two, paddingBottom: Spacing.three, gap: Spacing.two },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { borderRadius: Radius.inner, padding: Spacing.three, gap: Spacing.two },
  codeText: { fontSize: 24, fontWeight: '500', letterSpacing: 2 },
});
