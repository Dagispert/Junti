import { router } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/theme';
import { useNotifications } from '@/lib/notifications';

import { Icon } from './icon';

/** La campana del centro de notificaciones, con el globo de las nuevas. */
export function NotifBell({ groupId }: { groupId?: string }) {
  const theme = useTheme();
  const { fresh, unread } = useNotifications();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        fresh
          ? `Notificaciones: ${fresh} nuevas`
          : unread
            ? `Notificaciones: ${unread} sin ver`
            : 'Notificaciones'
      }
      hitSlop={6}
      onPress={() =>
        router.push({ pathname: '/notificaciones', params: groupId ? { groupId } : {} } as never)
      }
      style={styles.bell}>
      <Icon icon={Bell} size={21} color={theme.text} />
      {fresh > 0 ? (
        <View style={[styles.count, { borderColor: theme.background }]}>
          <Text style={styles.countText}>{fresh > 9 ? '9+' : fresh}</Text>
        </View>
      ) : unread > 0 ? (
        <View style={[styles.dot, { borderColor: theme.background }]} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bell: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  count: {
    position: 'absolute',
    top: 1,
    right: 0,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 2,
    backgroundColor: '#E5484D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '800' },
  dot: {
    position: 'absolute',
    top: 6,
    right: 7,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    backgroundColor: '#E5484D',
  },
});
