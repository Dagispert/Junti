import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing, useTheme } from '@/constants/theme';
import type { Group } from '@/data/types';

import { Icon } from './icon';
import { NotifBell } from './notif-bell';
import { Button, Title } from './ui';

/** Cabecera del grupo: volver, calendario, ajustes (donde se invita) y avisos. */
export function GroupHeader({ group }: { group: Group }) {
  const theme = useTheme();
  return (
    <View style={styles.header}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" onPress={() => router.dismissTo('/')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon icon={ChevronLeft} size={16} />
            <Text style={{ color: theme.textSecondary, fontSize: 15 }}>Mis grupos</Text>
          </View>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View testID="tour-calendario">
            <Button
              compact
              variant="quiet"
              label="Calendario"
              onPress={() => router.push({ pathname: '/calendar', params: { groupId: group.id } })}
            />
          </View>
          <View testID="tour-ajustes">
            <Button
              compact
              variant="quiet"
              label="Ajustes"
              onPress={() =>
                router.push({ pathname: '/group-settings', params: { groupId: group.id } })
              }
            />
          </View>
          <NotifBell groupId={group.id} />
        </View>
      </View>
      <Title>{group.name}</Title>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: Spacing.two, paddingBottom: Spacing.three, gap: Spacing.two },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
