import { router } from 'expo-router';
import { Check, Copy, RefreshCw } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Button, Screen, Title } from '@/components/ui';
import { useTheme } from '@/constants/theme';
import { INBOX_URL, newShareToken, shareToken } from '@/lib/shared';

const web = Platform.OS === 'web' && typeof navigator !== 'undefined';
const ua = web ? navigator.userAgent : '';
const isAndroid = /Android/i.test(ua);
const appUrl = () =>
  web ? `${location.origin}${(process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '')}/compartir` : '';

/**
 * Cómo mandar a Junti una foto o un mensaje desde WhatsApp (o cualquier app):
 * en Android, la web instalada sale en el menú de compartir; en iPhone, con un
 * Atajo que se crea una vez y usa un código personal.
 */
export default function CompartirAjustes() {
  const theme = useTheme();
  const [token, setToken] = useState('');
  const [copied, setCopied] = useState('');
  const [tab, setTab] = useState<'iphone' | 'android'>(isAndroid ? 'android' : 'iphone');

  useEffect(() => {
    shareToken()
      .then(setToken)
      .catch(() => {});
  }, []);

  const copy = (what: string, value: string) => {
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopied(what);
    setTimeout(() => setCopied(''), 1800);
  };
  const Copyable = ({ id, label, value }: { id: string; label: string; value: string }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Copiar ${label}`}
      onPress={() => copy(id, value)}
      style={[styles.copy, { backgroundColor: theme.soft }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{label}</Text>
        <Text
          numberOfLines={1}
          style={{ color: theme.text, fontSize: 14, fontFamily: 'monospace' }}>
          {value || '…'}
        </Text>
      </View>
      <Icon icon={copied === id ? Check : Copy} size={18} color={theme.text} />
    </Pressable>
  );
  const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
    <View style={styles.step}>
      <View style={[styles.num, { backgroundColor: theme.text }]}>
        <Text style={{ color: theme.background, fontWeight: '700' }}>{n}</Text>
      </View>
      <View style={{ flex: 1, gap: 8 }}>{children}</View>
    </View>
  );
  const P = ({ children }: { children: React.ReactNode }) => (
    <Text style={{ color: theme.text, fontSize: 16, lineHeight: 22 }}>{children}</Text>
  );
  const B = ({ children }: { children: React.ReactNode }) => (
    <Text style={{ fontWeight: '700' }}>{children}</Text>
  );

  return (
    <Screen
      header={
        <View style={{ flexDirection: 'row' }}>
          <Button compact label="Volver" variant="quiet" onPress={() => router.back()} />
        </View>
      }>
      <Title>Guardar desde WhatsApp</Title>
      <Text style={{ color: theme.textSecondary, fontSize: 16, lineHeight: 22 }}>
        Mantén pulsada una foto o un mensaje en WhatsApp, toca Compartir y mándalo a Junti: eliges
        el grupo y si es un momento o un recuerdo.
      </Text>

      <View style={[styles.tabs, { backgroundColor: theme.soft }]}>
        {(['iphone', 'android'] as const).map((t) => (
          <Pressable
            key={t}
            accessibilityRole="tab"
            aria-selected={tab === t}
            onPress={() => setTab(t)}
            style={[styles.tab, tab === t && { backgroundColor: theme.card }]}>
            <Text style={{ color: theme.text, fontWeight: '600' }}>
              {t === 'iphone' ? 'iPhone' : 'Android'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'android' ? (
        <View style={{ gap: 16 }}>
          <Step n={1}>
            <P>
              Instala Junti: en Chrome, menú <B>⋮</B> → <B>Instalar app</B> (o «Añadir a pantalla de
              inicio»).
            </P>
          </Step>
          <Step n={2}>
            <P>
              En WhatsApp, mantén pulsada una foto o un mensaje → <B>Compartir</B> → <B>Junti</B>.
            </P>
          </Step>
          <Step n={3}>
            <P>Elige el grupo y si es un momento o un recuerdo. ¡Listo!</P>
          </Step>
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          <Text style={{ color: theme.textSecondary, fontSize: 15, lineHeight: 21 }}>
            En iPhone se hace con un Atajo que se crea una sola vez (unos dos minutos). Si alguien
            ya lo tiene, os lo podéis pasar, pero cada uno pone su propio código.
          </Text>
          <Step n={1}>
            <P>
              Abre la app <B>Atajos</B> y toca <B>+</B>. Ponle de nombre <B>Guardar en Junti</B>.
            </P>
          </Step>
          <Step n={2}>
            <P>
              Toca <B>ⓘ</B> (abajo) y activa <B>Mostrar en la hoja para compartir</B>. En «Recibir»,
              deja Imágenes, Archivos multimedia, Texto y URL.
            </P>
          </Step>
          <Step n={3}>
            <P>
              Añade la acción <B>Obtener contenido de URL</B> y en la URL pega esta:
            </P>
            <Copyable id="url" label="Dirección" value={INBOX_URL} />
            <P>
              Toca <B>Mostrar más</B>: método <B>POST</B>. En <B>Cabeceras</B>, añade una con la
              clave <B>Authorization</B> y este valor:
            </P>
            <Copyable
              id="token"
              label="Tu código (personal)"
              value={token ? `Bearer ${token}` : ''}
            />
            <P>
              En <B>Cuerpo de la solicitud</B> elige <B>Formulario</B> y añade un campo de tipo{' '}
              <B>Archivo</B>, de nombre <B>media</B>, con el valor <B>Entrada del atajo</B>.
            </P>
          </Step>
          <Step n={4}>
            <P>
              Añade la acción <B>Abrir URL</B> con esta dirección:
            </P>
            <Copyable id="app" label="Junti" value={appUrl()} />
          </Step>
          <Step n={5}>
            <P>
              Ya está. En WhatsApp: mantén pulsada una foto o un mensaje → <B>Compartir</B> →{' '}
              <B>Guardar en Junti</B>.
            </P>
          </Step>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              newShareToken()
                .then(setToken)
                .catch(() => {})
            }
            style={styles.reset}>
            <Icon icon={RefreshCw} size={14} color={theme.textSecondary} />
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
              El código es solo tuyo. Si crees que alguien lo tiene, toca aquí para cambiarlo (y
              cámbialo también en el Atajo).
            </Text>
          </Pressable>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', borderRadius: 999, padding: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 999 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  num: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12 },
  reset: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingVertical: 8 },
});
