import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, MaxContentWidth, Radius, Spacing, useTheme } from '@/constants/theme';
import { getUser } from '@/data/store';
import type { Moment } from '@/data/types';

/** Contenedor de pantalla con scroll, márgenes seguros y ancho máximo. */
export function Screen({ children, header }: { children: ReactNode; header?: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.background,
        paddingTop: insets.top,
      }}>
      <View style={styles.column}>{header}</View>
      <ScrollView
        contentContainerStyle={[styles.column, styles.content]}
        keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </View>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text style={[styles.title, { color: theme.text, fontFamily: Fonts?.serif }]}>{children}</Text>
  );
}

export function Avatar({ userId, size = 32 }: { userId: string; size?: number }) {
  const user = getUser(userId);
  return (
    <View
      accessibilityLabel={user.name}
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: user.color,
        },
      ]}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.42 }}>
        {user.name[0]}
      </Text>
    </View>
  );
}

export function AvatarRow({ userIds, size = 26 }: { userIds: string[]; size?: number }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row' }}>
      {userIds.map((id, i) => (
        <View
          key={id}
          style={{
            marginLeft: i ? -size / 4 : 0,
            borderRadius: size,
            borderWidth: 2,
            borderColor: theme.card,
          }}>
          <Avatar userId={id} size={size} />
        </View>
      ))}
    </View>
  );
}

/** La foto de un momento, o su sustituto en los datos de ejemplo. */
export function Photo({ moment, style }: { moment: Moment; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  if (moment.imageUri) {
    return (
      <View style={[styles.photo, style]}>
        <Image
          source={{ uri: moment.imageUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      </View>
    );
  }
  if (moment.placeholder) {
    return (
      <View style={[styles.photo, { backgroundColor: moment.placeholder.color }, style]}>
        <Text style={styles.photoEmoji}>{moment.placeholder.emoji}</Text>
      </View>
    );
  }
  // Momento solo de texto.
  return (
    <View style={[styles.photo, { backgroundColor: theme.border, padding: Spacing.two }, style]}>
      <Text
        numberOfLines={4}
        style={{
          color: theme.text,
          fontFamily: Fonts?.serif,
          textAlign: 'center',
        }}>
        {moment.text}
      </Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  color,
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'quiet';
  color?: string;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary && { backgroundColor: color ?? theme.accent },
        (pressed || disabled) && { opacity: 0.5 },
      ]}>
      <Text
        style={{
          color: primary ? theme.onAccent : theme.textSecondary,
          fontWeight: '600',
          fontSize: 15,
        }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
  },
  content: { paddingBottom: Spacing.five, gap: Spacing.three },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '600' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  photo: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoEmoji: { fontSize: 64 },
  button: {
    paddingVertical: 10,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.large,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
});
