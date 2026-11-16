import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Lead, Screen, Title } from '@/components/ui';
import { Fonts, Spacing, useTheme } from '@/constants/theme';
import { erroresRecientes, resolverError, soyAdmin, type ErrorAgrupado } from '@/lib/errores';
import { relative } from '@/lib/time';

const PERIODOS = [
  { dias: 1, label: 'Hoy' },
  { dias: 7, label: '7 días' },
  { dias: 30, label: '30 días' },
];

const TIPO: Record<string, string> = {
  error: 'Error',
  promesa: 'Error',
  aviso: 'Fallo mostrado',
  pantalla: 'Pantalla rota',
  cierre: 'Cierre',
};

/** Qué navegador y móvil, en corto («iPhone · Safari · instalada»). */
function movil(ua: string | null) {
  if (!ua) return '';
  const so = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Mac/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : 'Otro';
  const nav = /CriOS|Chrome/.test(ua)
    ? 'Chrome'
    : /FxiOS|Firefox/.test(ua)
      ? 'Firefox'
      : /SamsungBrowser/.test(ua)
        ? 'Samsung'
        : /Safari/.test(ua)
          ? 'Safari'
          : '';
  return [so, nav, ua.includes('instalada') ? 'instalada' : ''].filter(Boolean).join(' · ');
}

/** Solo para quien mantiene la app: los fallos que ha tenido la gente. */
export default function Errores() {
  const theme = useTheme();
  const [admin, setAdmin] = useState<boolean>();
  const [dias, setDias] = useState(7);
  const [lista, setLista] = useState<ErrorAgrupado[]>();
  const [abierto, setAbierto] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');

  const cargar = useCallback(() => {
    setAviso('');
    erroresRecientes(dias)
      .then(setLista)
      .catch(() => setAviso('No se han podido cargar los errores.'));
  }, [dias]);

  useEffect(() => {
    soyAdmin().then(setAdmin, () => setAdmin(false));
  }, []);
  useEffect(() => {
    if (admin) cargar();
  }, [admin, cargar]);

  if (admin === false) {
    return (
      <Screen>
        <Title>Errores recientes</Title>
        <Lead strong="Esta sección es solo para quien mantiene Junti." />
        <Button label="Volver" variant="quiet" onPress={() => router.back()} />
      </Screen>
    );
  }

  const total = lista?.reduce((n, e) => n + Number(e.veces), 0) ?? 0;
  return (
    <Screen>
      <View style={{ gap: Spacing.two }}>
        <Title>Errores recientes</Title>
        <Lead
          strong={
            lista === undefined
              ? 'Cargando…'
              : lista.length
                ? `${lista.length} ${lista.length === 1 ? 'fallo distinto' : 'fallos distintos'}, ${total} ${total === 1 ? 'vez' : 'veces'} en total.`
                : 'Ningún error. Todo va bien.'
          }>
          {lista?.length
            ? 'Agrupados por fallo, el más reciente arriba. Toca uno para ver los detalles.'
            : ''}
        </Lead>
      </View>

      <View style={styles.periodos}>
        {PERIODOS.map((p) => {
          const on = p.dias === dias;
          return (
            <Pressable
              key={p.dias}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => setDias(p.dias)}
              style={[styles.chip, { backgroundColor: on ? theme.accent : theme.soft }]}>
              <Text style={{ color: on ? theme.onAccent : theme.text, fontWeight: '500' }}>
                {p.label}
              </Text>
            </Pressable>
          );
        })}
        <Pressable accessibilityRole="button" onPress={cargar} style={styles.chip}>
          <Text style={{ color: theme.textSecondary, fontWeight: '500' }}>Actualizar</Text>
        </Pressable>
      </View>

      {aviso ? <Text style={{ color: theme.text }}>{aviso}</Text> : null}

      {lista?.map((e) => {
        const open = abierto === e.fingerprint;
        const personas = Number(e.personas);
        return (
          <Card key={e.fingerprint} style={{ padding: 16, gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              onPress={() => setAbierto(open ? null : e.fingerprint)}
              style={{ gap: 6 }}>
              <View style={styles.fila}>
                <Text style={[styles.tipo, { color: theme.textSecondary }]}>
                  {TIPO[e.kind] ?? e.kind}
                </Text>
                <Text style={[styles.veces, { color: theme.text }]}>
                  {e.veces}× · {personas} {personas === 1 ? 'persona' : 'personas'}
                </Text>
              </View>
              <Text
                numberOfLines={open ? undefined : 3}
                style={[styles.msg, { color: theme.text }]}>
                {e.message}
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                {relative(Date.parse(e.ultima))} · {e.screen || '—'} · {movil(e.device)}
              </Text>
            </Pressable>
            {open && (
              <View style={{ gap: 8 }}>
                <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                  Primera vez {relative(Date.parse(e.primera))} · versión {e.version ?? '—'}
                </Text>
                {e.stack ? (
                  <Text
                    selectable
                    style={[styles.stack, { color: theme.text, backgroundColor: theme.soft }]}>
                    {e.stack}
                  </Text>
                ) : null}
                <Text selectable style={{ color: theme.textSecondary, fontSize: 12 }}>
                  {e.device}
                </Text>
                <Button
                  compact
                  variant="quiet"
                  label="Marcar como resuelto"
                  onPress={() =>
                    resolverError(e.fingerprint).then(
                      () => setLista((l) => l?.filter((x) => x.fingerprint !== e.fingerprint)),
                      () => setAviso('No se ha podido marcar como resuelto.'),
                    )
                  }
                />
              </View>
            )}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  periodos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 999, justifyContent: 'center' },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  tipo: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  veces: { fontSize: 13, fontWeight: '600' },
  msg: { fontSize: 15, lineHeight: 21 },
  stack: { fontFamily: Fonts?.mono, fontSize: 11, lineHeight: 15, padding: 10, borderRadius: 10 },
});
