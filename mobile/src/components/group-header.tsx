import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, useTheme } from '@/constants/theme';
import { errorText, useStore } from '@/data/store';
import type { Group } from '@/data/types';
import { copyText, inviteLink } from '@/lib/invite';

import { Icon } from './icon';
import { Button, Notice, Tag, Title } from './ui';

/** Cabecera del grupo: nombre, invitación y la hora local de cada integrante. */
export function GroupHeader({ group }: { group: Group }) {
  const theme = useTheme();
  const { createInvite } = useStore();
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);

  const invite = async () => {
    setNotice('');
    try {
      const next = code || (await createInvite(group.id));
      setCode(next);
      // Abre el menú de compartir del móvil; si no lo hay, se ve el enlace para copiarlo.
      await Share.share({
        message: `Únete a «${group.name}» en Junti: ${inviteLink(next)}`,
      }).catch(() => {});
    } catch (error) {
      setNotice(errorText(error));
    }
  };

  return (
    <View style={styles.header}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" onPress={() => router.dismissTo('/')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon icon={ChevronLeft} size={16} />
            <Text style={{ color: theme.textSecondary, fontSize: 15 }}>Mis grupos</Text>
          </View>
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
          <View testID="tour-invitar">
            <Button compact variant="quiet" label="Invitar" onPress={invite} />
          </View>
        </View>
      </View>
      <Title>{group.name}</Title>
      {!!code && (
        <View style={[styles.code, { backgroundColor: theme.card, boxShadow: theme.shadow }]}>
          <Tag>Invitación · caduca en 14 días</Tag>
          <Text selectable numberOfLines={2} style={{ color: theme.text, fontSize: 15 }}>
            {inviteLink(code)}
          </Text>
          <View style={styles.codeRow}>
            <Button
              compact
              label={copied ? 'Enlace copiado' : 'Copiar enlace'}
              onPress={async () => setCopied(await copyText(inviteLink(code)))}
            />
            <Text selectable style={{ color: theme.textSecondary, fontSize: 15 }}>
              o el código <Text style={{ color: theme.text, fontWeight: '500' }}>{code}</Text>
            </Text>
          </View>
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
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, flexWrap: 'wrap' },
});
