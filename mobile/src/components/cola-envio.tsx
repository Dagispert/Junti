import { CloudOff, RotateCw, Upload, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import { cargarCola, enviarCola, quitar, reintentar, sinConexion, useCola } from '@/lib/cola';
import { apuntarError } from '@/lib/errores';

import { Icon } from './icon';

/**
 * Lo que espera a tener conexión para enviarse: lo envía en cuanto puede y,
 * mientras tanto, lo enseña en una pastilla pequeña arriba.
 */
export function ColaEnvio() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { status, addMoment, addComment } = useStore();
  const cola = useCola();
  const [offline, setOffline] = useState(sinConexion());
  const enviar = useRef({ addMoment, addComment });
  enviar.current = { addMoment, addComment };

  useEffect(() => {
    if (status !== 'ready') return;
    cargarCola();
    const intentar = () => {
      setOffline(sinConexion());
      enviarCola({
        momento: (d) => enviar.current.addMoment(d),
        comentario: (d: { momentId: string; text: string; replyTo?: string }) =>
          enviar.current.addComment(d.momentId, d.text, d.replyTo),
      }).catch(() => {});
    };
    const primero = setTimeout(intentar, 1500);
    const cada = setInterval(intentar, 20_000);
    if (Platform.OS !== 'web' || typeof window === 'undefined')
      return () => {
        clearTimeout(primero);
        clearInterval(cada);
      };
    const visible = () => document.visibilityState === 'visible' && intentar();
    const sinRed = () => setOffline(true);
    window.addEventListener('online', intentar);
    window.addEventListener('offline', sinRed);
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearTimeout(primero);
      clearInterval(cada);
      window.removeEventListener('online', intentar);
      window.removeEventListener('offline', sinRed);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [status]);

  // un envío que no sale por algo que no es la conexión: se apunta
  const fallidos = cola.filter((p) => p.error);
  const avisados = useRef(new Set<string>());
  useEffect(() => {
    for (const p of fallidos)
      if (!avisados.current.has(p.id)) {
        avisados.current.add(p.id);
        apuntarError(new Error(`Cola de envío (${p.tipo}): ${p.error}`), 'aviso');
      }
  }, [fallidos]);

  if (status !== 'ready' || !cola.length) return null;
  const esperando = cola.length - fallidos.length;
  const momentos = cola.filter((p) => p.tipo === 'momento').length;
  const que =
    momentos === cola.length
      ? `${cola.length} ${cola.length === 1 ? 'publicación' : 'publicaciones'}`
      : momentos === 0
        ? `${cola.length} ${cola.length === 1 ? 'comentario' : 'comentarios'}`
        : `${cola.length} cosas`;

  return (
    <View pointerEvents="box-none" style={[styles.capa, { top: insets.top + 6 }]}>
      <Animated.View
        entering={FadeInUp.duration(300)}
        exiting={FadeOutUp.duration(250)}
        accessibilityLiveRegion="polite"
        style={[styles.pastilla, { backgroundColor: theme.card, boxShadow: theme.shadow }]}>
        {fallidos.length ? (
          <>
            <Text style={[styles.txt, { color: theme.text }]} numberOfLines={1}>
              No se pudo enviar {fallidos.length === 1 ? 'algo' : `${fallidos.length} cosas`}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reintentar el envío"
              hitSlop={8}
              onPress={async () => {
                for (const p of fallidos) await reintentar(p.id);
                enviarCola(
                  {
                    momento: (d) => enviar.current.addMoment(d),
                    comentario: (d: { momentId: string; text: string; replyTo?: string }) =>
                      enviar.current.addComment(d.momentId, d.text, d.replyTo),
                  },
                  true,
                ).catch(() => {});
              }}
              style={styles.boton}>
              <Icon icon={RotateCw} size={16} color={theme.text} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Descartar lo que no se pudo enviar"
              hitSlop={8}
              onPress={() => fallidos.forEach((p) => quitar(p.id))}
              style={styles.boton}>
              <Icon icon={X} size={16} color={theme.textSecondary} />
            </Pressable>
          </>
        ) : (
          <>
            <Icon icon={offline ? CloudOff : Upload} size={16} color={theme.textSecondary} />
            <Text style={[styles.txt, { color: theme.text }]} numberOfLines={1}>
              {offline
                ? `Sin conexión · ${que} por enviar`
                : `Enviando ${esperando === 1 ? que : `${esperando} de ${que}`}…`}
            </Text>
          </>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  capa: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 50 },
  pastilla: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 999,
    maxWidth: '92%',
  },
  txt: { fontSize: 14, fontWeight: '500', flexShrink: 1 },
  boton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
