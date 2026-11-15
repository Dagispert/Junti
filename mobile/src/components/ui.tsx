import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  FadeInLeft,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, MaxContentWidth, Radius, Spacing, useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';

import { EASE_IN_VIEW, SPRING } from './motion';
import { VideoClip, VideoFrame, Waveform } from './media-players';
import type { Moment } from '@/data/types';

/** Contenedor de pantalla con scroll, márgenes seguros y ancho máximo. Al tirar hacia abajo, recarga. */
export function Screen({ children, header }: { children: ReactNode; header?: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { refresh } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } catch {
      // Sin conexión: se queda lo que ya había en pantalla.
    }
    setRefreshing(false);
  };
  return (
    <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: insets.top }}>
      <View style={styles.column}>{header}</View>
      <ScrollView
        contentContainerStyle={[styles.column, styles.content]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.textSecondary}
          />
        }>
        {children}
      </ScrollView>
    </View>
  );
}

/** Titular grande, fino y apretado. */
export function Title({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const theme = useTheme();
  return <Text style={[styles.title, { color: theme.text }, style]}>{children}</Text>;
}

/**
 * Texto en dos tonos: la primera frase en tinta y el resto en gris.
 * Es el recurso tipográfico principal de la app.
 */
export function Lead({ strong, children }: { strong: string; children?: ReactNode }) {
  const theme = useTheme();
  return (
    <Text style={[styles.lead, { color: theme.textSecondary }]}>
      <Text style={{ color: theme.text }}>{strong}</Text>
      {children ? ' ' : ''}
      {children}
    </Text>
  );
}

/** Etiqueta pequeña en monoespaciada sobre gris. */
export function Tag({ children, center }: { children: ReactNode; center?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.tag, { backgroundColor: theme.soft }, center && { alignSelf: 'center' }]}>
      <Text style={[styles.tagText, { color: theme.textSecondary }]}>{children}</Text>
    </View>
  );
}

export function Avatar({ userId, size = 32 }: { userId: string; size?: number }) {
  const user = useStore().user(userId);
  return (
    <View
      accessibilityLabel={user.name}
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: user.color },
      ]}>
      {user.avatarUri ? (
        <Image
          source={{ uri: user.avatarUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : (
        <Text style={{ color: '#fff', fontWeight: '600', fontSize: size * 0.4 }}>
          {user.name[0]}
        </Text>
      )}
    </View>
  );
}

export function AvatarRow({ userIds, size = 28 }: { userIds: string[]; size?: number }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row' }}>
      {userIds.slice(0, 5).map((id, i) => (
        // Se despliegan uno detrás de otro, deslizándose desde el anterior.
        <Animated.View
          key={id}
          entering={FadeInLeft.delay(i * 70)
            .duration(380)
            .easing(EASE_IN_VIEW)}
          style={{
            marginLeft: i ? -size / 3 : 0,
            borderRadius: size,
            borderWidth: 2,
            borderColor: theme.card,
          }}>
          <Avatar userId={id} size={size} />
        </Animated.View>
      ))}
    </View>
  );
}

/** La foto de un momento; si es solo texto, un panel gris con sus palabras. */
export function Photo({
  moment,
  style,
  badge = true,
  animate = true,
}: {
  moment: Moment;
  style?: StyleProp<ViewStyle>;
  /** Mostrar ▶ en los vídeos (desactivado donde ya hay un botón grande). */
  badge?: boolean;
  /** Animar los vídeos (clip de 3 s en bucle) en vez de mostrar una imagen fija. */
  animate?: boolean;
}) {
  const theme = useTheme();
  if (moment.imageUri) {
    return (
      <View style={[styles.photo, { backgroundColor: theme.soft }, style]}>
        <Image
          source={{ uri: moment.imageUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
        />
        {/* En los vídeos, la portada se anima: sus primeros segundos en bucle, como un GIF. */}
        {moment.videoUri && animate && (
          <VideoClip uri={moment.videoUri} start={moment.videoClip?.start} />
        )}
        {badge && moment.videoUri && (
          <View style={styles.playBadge}>
            <Text style={{ color: '#1D1F22', fontSize: 11, marginLeft: 2 }}>▶</Text>
          </View>
        )}
      </View>
    );
  }
  if (moment.videoUri) {
    // Vídeo sin portada guardada: se muestra su primer fotograma.
    return (
      <View style={[styles.photo, { backgroundColor: '#2B2E33' }, style]}>
        {animate ? (
          <VideoClip uri={moment.videoUri} start={moment.videoClip?.start} />
        ) : (
          <VideoFrame uri={moment.videoUri} start={moment.videoClip?.start} />
        )}
        {badge && (
          <View style={styles.playBadge}>
            <Text style={{ color: '#1D1F22', fontSize: 11, marginLeft: 2 }}>▶</Text>
          </View>
        )}
      </View>
    );
  }
  return (
    <View style={[styles.photo, { backgroundColor: theme.soft, padding: Spacing.two }, style]}>
      {moment.voice && !moment.text ? (
        <Waveform wave={moment.voice.waveform} height={56} />
      ) : (
        <Text numberOfLines={4} style={{ color: theme.text, fontSize: 13, textAlign: 'center' }}>
          {moment.text}
        </Text>
      )}
    </View>
  );
}

/** Velo oscuro para que el texto blanco se lea sobre cualquier foto. */
export function Scrim({ edge, height = '45%' }: { edge: 'top' | 'bottom'; height?: `${number}%` }) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={
        edge === 'top'
          ? ['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)']
          : ['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)']
      }
      style={[styles.scrim, edge === 'top' ? { top: 0 } : { bottom: 0 }, { height }]}
    />
  );
}

const FAN = [
  { rotate: '-9deg', x: -0.42, y: 0.06 },
  { rotate: '-2deg', x: 0, y: 0 },
  { rotate: '8deg', x: 0.42, y: 0.05 },
];

/** Hasta tres fotos apiladas en abanico, con marco blanco. */
export function PhotoFan({ moments, size = 150 }: { moments: Moment[]; size?: number }) {
  const theme = useTheme();
  const shown = moments.slice(0, 3);
  if (!shown.length) return null;
  // Con una o dos fotos se usan las posiciones centrales para que no quede cojo.
  const slots = shown.length === 1 ? [FAN[1]] : shown.length === 2 ? [FAN[0], FAN[2]] : FAN;
  return (
    <View style={{ height: size * 1.3, alignItems: 'center', justifyContent: 'center' }}>
      {shown.map((moment, i) => (
        <View
          key={moment.id}
          style={[
            styles.fanFrame,
            {
              width: size,
              height: size * 1.12,
              borderRadius: size * 0.2,
              backgroundColor: theme.card,
              boxShadow: theme.shadow,
              transform: [
                { translateX: slots[i].x * size },
                { translateY: slots[i].y * size },
                { rotate: slots[i].rotate },
              ],
            },
          ]}>
          <Photo moment={moment} style={{ flex: 1, borderRadius: size * 0.16 }} />
        </View>
      ))}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  compact,
}: {
  label: string;
  onPress: () => void;
  /** primary: píldora de tinta · light: píldora blanca (sobre fotos) · quiet: solo texto. */
  variant?: 'primary' | 'light' | 'quiet';
  disabled?: boolean;
  compact?: boolean;
}) {
  const theme = useTheme();
  const background =
    variant === 'primary' ? theme.accent : variant === 'light' ? '#FFFFFF' : 'transparent';
  const color =
    variant === 'primary' ? theme.onAccent : variant === 'light' ? '#1D1F22' : theme.textSecondary;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: background },
        // Al tocarlo se hunde un poco (no se apaga: apagado es «desactivado»).
        pressed && !disabled && { transform: [{ scale: 0.97 }], opacity: 0.88 },
        disabled && { opacity: 0.45 },
        webTransition,
      ]}>
      <Text style={{ color, fontWeight: '500', fontSize: compact ? 14 : 15 }}>{label}</Text>
    </Pressable>
  );
}

/**
 * Botón que, mientras trabaja, se recoge en un círculo con un anillo que gira
 * (la misma pieza cambia de ancho y de radio con un muelle; el texto se va con
 * un desenfoque corto). Al terminar vuelve a su forma.
 */
export function ProgressButton({
  label,
  busy,
  disabled,
  onPress,
}: {
  label: string;
  busy: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const [natural, setNatural] = useState(0);
  const k = useSharedValue(0);
  const spin = useSharedValue(0);
  useEffect(() => {
    k.value = withSpring(busy ? 1 : 0, SPRING);
    spin.value = busy
      ? withRepeat(withTiming(360, { duration: 800, easing: Easing.linear }), -1)
      : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);
  const box = useAnimatedStyle(() =>
    natural
      ? {
          width: natural + (40 - natural) * k.value,
          borderRadius: Radius.small + (20 - Radius.small) * k.value,
        }
      : {},
  );
  const text = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - k.value * 1.8),
    ...(Platform.OS === 'web' ? ({ filter: `blur(${(k.value * 4).toFixed(2)}px)` } as object) : {}),
  }));
  const ring = useAnimatedStyle(() => ({
    opacity: k.value,
    transform: [{ rotate: `${spin.value}deg` }],
  }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={busy ? `${label}: guardando` : label}
      accessibilityState={{ busy, disabled: disabled || busy }}
      disabled={disabled || busy}
      onPress={onPress}>
      <Animated.View
        onLayout={(e) => !busy && !natural && setNatural(e.nativeEvent.layout.width)}
        style={[
          styles.button,
          styles.buttonCompact,
          {
            backgroundColor: theme.accent,
            overflow: 'hidden',
            opacity: disabled && !busy ? 0.45 : 1,
          },
          box,
        ]}>
        <Animated.Text
          numberOfLines={1}
          style={[{ color: theme.onAccent, fontWeight: '500', fontSize: 14 }, text]}>
          {label}
        </Animated.Text>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              width: 18,
              height: 18,
              borderRadius: 9,
              borderWidth: 2,
              borderColor: theme.onAccent,
              borderTopColor: 'transparent',
            },
            ring,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

const webTransition = {
  transitionProperty: 'transform, opacity',
  transitionDuration: '140ms',
  transitionTimingFunction: 'cubic-bezier(0.2, 0, 0, 1)',
} as object;

/** Tarjeta blanca con marco grueso: dentro va una foto con esquinas propias. */
export function Card({
  children,
  style,
  boxRef,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** para medirla o animar su alto */
  boxRef?: (node: unknown) => void;
}) {
  const theme = useTheme();
  return (
    <View
      ref={boxRef as never}
      style={[styles.card, { backgroundColor: theme.card, boxShadow: theme.shadow }, style]}>
      {children}
    </View>
  );
}

/** Campo de texto con etiqueta. */
export function Field({ label, style, ...props }: TextInputProps & { label: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.textSecondary}
        style={[styles.field, { color: theme.text, backgroundColor: theme.soft }, style]}
        {...props}
      />
    </View>
  );
}

/** Mensaje de error o de aviso bajo un formulario. */
export function Notice({ children }: { children: ReactNode }) {
  const theme = useTheme();
  if (!children) return null;
  return <Text style={{ color: theme.text, fontSize: 15, lineHeight: 20 }}>{children}</Text>;
}

const styles = StyleSheet.create({
  column: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: 20,
  },
  content: { paddingTop: Spacing.two, paddingBottom: Spacing.five, gap: Spacing.four },
  title: { fontSize: 34, lineHeight: 40, fontWeight: '500', letterSpacing: -0.8 },
  lead: { fontSize: 20, lineHeight: 28 },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  tagText: { fontSize: 13, fontWeight: '500' },
  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photo: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  playBadge: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrim: { position: 'absolute', left: 0, right: 0 },
  fanFrame: { position: 'absolute', padding: 8 },
  button: {
    height: 48,
    paddingHorizontal: 24,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCompact: { height: 40, paddingHorizontal: 16, borderRadius: Radius.small },
  card: { borderRadius: Radius.frame, padding: 12 },
  field: {
    fontSize: 17,
    height: 52,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
  },
});
