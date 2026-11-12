import { StyleSheet, Text, View } from 'react-native';

import { Spacing, useTheme } from '@/constants/theme';
import { type LegalDoc, PRIVACY, TERMS, UPDATED } from '@/data/legal';

import { Button, Screen, Title } from './ui';

export type LegalKind = 'privacidad' | 'condiciones';

export const legalDoc = (kind: LegalKind): LegalDoc => (kind === 'condiciones' ? TERMS : PRIVACY);

/** Política de privacidad o condiciones de uso, para leer con calma. */
export function LegalView({ kind, onClose }: { kind: LegalKind; onClose: () => void }) {
  const theme = useTheme();
  const doc = legalDoc(kind);
  return (
    <Screen
      header={
        <View style={styles.header}>
          <Button compact label="Cerrar" variant="quiet" onPress={onClose} />
        </View>
      }>
      <Title>{doc.title}</Title>
      <Text style={[styles.meta, { color: theme.textSecondary }]}>Actualizada el {UPDATED}</Text>
      <Text style={[styles.body, { color: theme.text }]}>{doc.intro}</Text>
      {doc.sections.map((section) => (
        <View key={section.heading} style={{ gap: Spacing.one }}>
          <Text style={[styles.heading, { color: theme.text }]}>{section.heading}</Text>
          {section.bullets?.map((b) => (
            <View key={b} style={styles.bullet}>
              <Text style={[styles.body, { color: theme.textSecondary }]}>•</Text>
              <Text style={[styles.body, { flex: 1, color: theme.textSecondary }]}>{b}</Text>
            </View>
          ))}
          {section.paragraphs?.map((p) => (
            <Text key={p} style={[styles.body, { color: theme.textSecondary }]}>
              {p}
            </Text>
          ))}
        </View>
      ))}
      <View style={{ height: 40 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'flex-start', paddingVertical: Spacing.two },
  meta: { fontSize: 13, marginTop: -8 },
  heading: { fontSize: 17, fontWeight: '600', marginTop: Spacing.two },
  body: { fontSize: 15, lineHeight: 22 },
  bullet: { flexDirection: 'row', gap: 8 },
});
