import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, useTheme } from '@/constants/theme';
import { type FamilyId, useFamily, useFamilyColorMode } from '@/lib/families';

import { Icon } from './icon';
import { Card } from './ui';

/**
 * La etiqueta de una familia («Reto · Foto de tu desayuno»): su icono, su
 * nombre y, si hace falta, de qué es en concreto.
 */
export function FamilyTag({
  family,
  detail,
  style,
}: {
  family: FamilyId;
  detail?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const f = useFamily(family);
  const mode = useFamilyColorMode();
  const colored = mode !== 'plain';
  const ink = colored ? f.color : theme.textSecondary;
  return (
    <View
      accessibilityLabel={`${f.label}${detail ? `: ${detail}` : ''}`}
      style={[
        styles.tag,
        {
          backgroundColor: !colored ? theme.soft : mode === 'tinted' ? theme.card : f.tint,
        },
        style,
      ]}>
      <Icon icon={f.icon} size={14} color={ink} />
      <Text numberOfLines={1} style={[styles.tagText, { color: ink }]}>
        <Text style={{ fontWeight: '700' }}>{f.label}</Text>
        {detail ? <Text style={{ fontWeight: '500' }}> · {detail}</Text> : null}
      </Text>
    </View>
  );
}

/**
 * La tarjeta de una familia: según el ajuste, tintada con su color, con una
 * pestaña de color arriba, o neutra.
 */
export function FamilyCard({
  family,
  children,
  style,
}: {
  family: FamilyId;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const f = useFamily(family);
  const mode = useFamilyColorMode();
  return (
    <Card style={[mode === 'tinted' && { backgroundColor: f.tint }, style]}>
      {mode === 'accent' && family !== 'moment' && (
        <View pointerEvents="none" style={[styles.tab, { backgroundColor: f.color }]} />
      )}
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    paddingHorizontal: 11,
    borderRadius: Radius.pill,
    maxWidth: '100%',
  },
  tagText: { fontSize: 13, flexShrink: 1 },
  tab: {
    position: 'absolute',
    top: 0,
    left: 32,
    width: 40,
    height: 4,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    zIndex: 2,
  },
});
