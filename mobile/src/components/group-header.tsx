import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Spacing, useTheme } from '@/constants/theme';
import { getUser } from '@/data/store';
import type { Group } from '@/data/types';
import { clockIn } from '@/lib/time';

import { Avatar, Title } from './ui';

/** Cabecera del grupo: nombre y la hora local de cada integrante. */
export function GroupHeader({ group }: { group: Group }) {
  const theme = useTheme();
  return (
    <View style={styles.header}>
      <Link href="/" style={{ color: theme.textSecondary, fontSize: 14 }}>
        ‹ Mis grupos
      </Link>
      <Title>
        {group.emoji} {group.name}
      </Title>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.members}>
        {group.memberIds.map((id) => {
          const user = getUser(id);
          return (
            <View key={id} style={styles.member}>
              <Avatar userId={id} size={28} />
              <View>
                <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>
                  {user.name}
                </Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                  {clockIn(user.tz)} · {user.city}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
  members: { gap: Spacing.three },
  member: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
