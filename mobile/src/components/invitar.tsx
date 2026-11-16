import { UserPlus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, useTheme } from '@/constants/theme';
import { errorText, useStore } from '@/data/store';
import type { Group } from '@/data/types';
import { copyText, inviteLink } from '@/lib/invite';

import { Icon } from './icon';
import { Button, Notice, Tag } from './ui';

/** Crea el enlace de invitación y abre el menú de compartir del móvil. */
export function useInvitar(group: Group | undefined) {
  const { createInvite } = useStore();
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState('');
  const invitar = async () => {
    if (!group) return;
    setNotice('');
    try {
      const next = code || (await createInvite(group.id));
      setCode(next);
      // si no hay menú de compartir, se ve el enlace para copiarlo
      await Share.share({
        message: `Únete a «${group.name}» en Junti: ${inviteLink(next)}`,
      }).catch(() => {});
    } catch (error) {
      setNotice(errorText(error));
    }
  };
  return { code, notice, invitar };
}

/** El botón «Invitar» (una píldora pequeña con su icono). */
export function BotonInvitar({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Invitar al grupo"
      onPress={onPress}
      style={({ pressed }) => [
        styles.boton,
        { backgroundColor: theme.accent, opacity: pressed ? 0.8 : 1 },
      ]}>
      <Icon icon={UserPlus} size={16} color={theme.onAccent} />
      <Text style={[styles.botonTxt, { color: theme.onAccent }]}>Invitar</Text>
    </Pressable>
  );
}

/** El enlace ya creado, para copiarlo (por si no salió el menú de compartir). */
export function EnlaceInvitacion({ code, notice }: { code: string; notice: string }) {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);
  return (
    <>
      {!!code && (
        <View style={[styles.code, { backgroundColor: theme.soft }]}>
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
    </>
  );
}

const styles = StyleSheet.create({
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  botonTxt: { fontSize: 15, fontWeight: '600' },
  code: { borderRadius: Radius.inner, padding: Spacing.three, gap: Spacing.two, marginTop: 8 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, flexWrap: 'wrap' },
});
