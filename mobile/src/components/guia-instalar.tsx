// La guía para instalar Junti en el móvil, lo primero al entrar desde el
// navegador (también desde un enlace de invitación). PROVISIONAL: se quita con
// GUIA_INSTALACION (lib/instalar.ts) cuando salga la app de verdad.

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  EllipsisVertical,
  Menu,
  Share,
  SquarePlus,
  TriangleAlert,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Hand, useTheme } from '@/constants/theme';
import {
  alCambiarInstalable,
  chromeIos,
  dentroDeOtraApp,
  instalarDirecto,
  puedeInstalarDirecto,
  saltarGuia,
  samsung,
  sistema,
} from '@/lib/instalar';
import { copyText, peekInvite } from '@/lib/invite';

import { Icon } from './icon';
import { Logo } from './logo';
import { Button, Screen, Title } from './ui';

const PULSO = `@keyframes giPulso { 0%,100% { box-shadow: 0 0 0 0 rgba(226,96,63,.55) } 60% { box-shadow: 0 0 0 9px rgba(226,96,63,0) } }`;
const NARANJA = '#E2603F';

export function GuiaInstalar({ onSeguir }: { onSeguir: () => void }) {
  const theme = useTheme();
  const [tab, setTab] = useState<'ios' | 'android'>(sistema === 'android' ? 'android' : 'ios');
  const [directo, setDirecto] = useState(puedeInstalarDirecto());
  const [hecho, setHecho] = useState(false);
  const [copiado, setCopiado] = useState('');
  useEffect(() => alCambiarInstalable(() => setDirecto(puedeInstalarDirecto())), []);
  // la invitación del enlace (se guarda justo después de pintar esto)
  const codigo = (() => {
    try {
      const u = new URL(window.location.href);
      if (u.pathname.endsWith('/join') && u.searchParams.get('code'))
        return u.searchParams.get('code');
    } catch {
      // sin URL: la guardada
    }
    return peekInvite();
  })();

  const copiar = async (que: string, texto: string) => {
    if (await copyText(texto)) {
      setCopiado(que);
      setTimeout(() => setCopiado(''), 2000);
    }
  };

  /** Un botón de mentira, como el que hay que tocar, latiendo. */
  const Toca = ({ children }: { children: React.ReactNode }) => (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        borderRadius: 12,
        padding: '6px 10px',
        background: theme.card,
        border: `2px solid ${NARANJA}`,
        animation: 'giPulso 1.8s ease-out infinite',
      }}>
      {children}
    </div>
  );
  const Maqueta = ({ children }: { children: React.ReactNode }) => (
    <View style={[styles.maqueta, { backgroundColor: theme.soft }]}>{children}</View>
  );
  const T = ({ children, fuerte }: { children: React.ReactNode; fuerte?: boolean }) => (
    <Text
      style={{
        color: theme.text,
        fontSize: fuerte ? 15 : 14,
        fontWeight: fuerte ? '600' : '400',
      }}>
      {children}
    </Text>
  );
  const Paso = ({
    n,
    titulo,
    children,
    maqueta,
  }: {
    n: number;
    titulo: string;
    children?: React.ReactNode;
    maqueta?: React.ReactNode;
  }) => (
    <Animated.View
      entering={FadeInDown.delay(120 + n * 90).duration(380)}
      style={[styles.paso, { backgroundColor: theme.card, boxShadow: theme.shadow }]}>
      <View style={styles.fila}>
        <View style={[styles.num, { backgroundColor: theme.text }]}>
          <Text style={{ color: theme.background, fontWeight: '700' }}>{n}</Text>
        </View>
        <Text style={{ color: theme.text, fontSize: 17, fontWeight: '600', flex: 1 }}>
          {titulo}
        </Text>
      </View>
      {!!children && (
        <Text style={{ color: theme.textSecondary, fontSize: 14, lineHeight: 20 }}>{children}</Text>
      )}
      {maqueta}
    </Animated.View>
  );

  const pasosIos = (
    <>
      <Paso
        n={1}
        titulo="Toca el botón Compartir"
        maqueta={
          <Maqueta>
            {chromeIos ? (
              <View style={[styles.fila, { justifyContent: 'space-between', flex: 1 }]}>
                <View style={[styles.barra, { backgroundColor: theme.card }]}>
                  <T>dagispert.github.io</T>
                </View>
                <Toca>
                  <Icon icon={Share} size={20} color={theme.text} />
                </Toca>
              </View>
            ) : (
              <View style={[styles.fila, { justifyContent: 'space-around', flex: 1 }]}>
                <Icon icon={ChevronLeft} size={22} color={theme.textSecondary} />
                <Icon icon={ChevronRight} size={22} color={theme.textSecondary} />
                <Toca>
                  <Icon icon={Share} size={22} color={theme.text} />
                </Toca>
                <Text style={{ color: theme.textSecondary, fontSize: 20 }}>⧉</Text>
              </View>
            )}
          </Maqueta>
        }>
        {chromeIos
          ? 'Es el cuadrado con la flecha hacia arriba, arriba a la derecha, junto a la dirección.'
          : 'Es el cuadrado con la flecha hacia arriba, en la barra de Safari. Si no lo ves, toca primero «···».'}
      </Paso>
      <Paso
        n={2}
        titulo="Elige «Añadir a pantalla de inicio»"
        maqueta={
          <Maqueta>
            <Toca>
              <T fuerte>Añadir a pantalla de inicio</T>
              <Icon icon={SquarePlus} size={18} color={theme.text} />
            </Toca>
          </Maqueta>
        }>
        Está en la lista que se abre. Si no aparece, desliza hacia abajo o toca «Ver más».
      </Paso>
      <Paso
        n={3}
        titulo="Toca «Añadir»"
        maqueta={
          <Maqueta>
            <View style={[styles.fila, { justifyContent: 'space-between', flex: 1 }]}>
              <Text style={{ color: theme.textSecondary, fontSize: 14 }}>Cancelar</Text>
              <T fuerte>Junti</T>
              <Toca>
                <Text style={{ color: '#2F7BF6', fontSize: 15, fontWeight: '700' }}>Añadir</Text>
              </Toca>
            </View>
          </Maqueta>
        }>
        Arriba a la derecha. Si sale «Abrir como app web», déjalo activado.
      </Paso>
      <Paso
        n={4}
        titulo="Abre Junti desde tu pantalla de inicio"
        maqueta={
          <Maqueta>
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Toca>
                <Logo size={40} />
              </Toca>
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Junti</Text>
            </View>
          </Maqueta>
        }>
        Ya tienes el icono junto a tus apps. Entra desde ahí (y ya puedes cerrar Safari).
      </Paso>
    </>
  );

  const pasosAndroid = (
    <>
      <Paso
        n={1}
        titulo={samsung ? 'Toca el menú ≡' : 'Toca el menú ⋮'}
        maqueta={
          <Maqueta>
            <View style={[styles.fila, { justifyContent: 'space-between', flex: 1 }]}>
              <View style={[styles.barra, { backgroundColor: theme.card }]}>
                <T>dagispert.github.io</T>
              </View>
              <Toca>
                <Icon icon={samsung ? Menu : EllipsisVertical} size={20} color={theme.text} />
              </Toca>
            </View>
          </Maqueta>
        }>
        {samsung
          ? 'Está abajo a la derecha, en Samsung Internet.'
          : 'Son los tres puntos de arriba a la derecha, en Chrome.'}
      </Paso>
      <Paso
        n={2}
        titulo="Elige «Instalar aplicación»"
        maqueta={
          <Maqueta>
            <Toca>
              <Icon icon={Download} size={18} color={theme.text} />
              <T fuerte>
                {samsung ? 'Añadir página a › Pantalla de inicio' : 'Instalar aplicación'}
              </T>
            </Toca>
          </Maqueta>
        }>
        En algunos móviles se llama «Añadir a pantalla de inicio».
      </Paso>
      <Paso n={3} titulo="Confirma con «Instalar»">
        Si te pregunta, elige «Instalar» (no «Crear acceso directo»).
      </Paso>
      <Paso
        n={4}
        titulo="Abre Junti desde tus aplicaciones"
        maqueta={
          <Maqueta>
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Toca>
                <Logo size={40} />
              </Toca>
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Junti</Text>
            </View>
          </Maqueta>
        }>
        Tendrás el icono en la pantalla de inicio. Entra siempre desde ahí.
      </Paso>
    </>
  );

  return (
    <Screen>
      <style>{PULSO}</style>
      <Animated.View entering={FadeInDown.duration(400)} style={{ gap: 14, paddingTop: 36 }}>
        <Logo size={56} />
        <Title>Instala Junti en tu móvil</Title>
        <Text style={{ color: theme.textSecondary, fontSize: 17, lineHeight: 24 }}>
          <Text style={{ color: theme.text }}>Antes de nada, un momento.</Text> Junti funciona como
          una app: con su icono, a pantalla completa y con avisos cuando el grupo comparte algo. Es
          gratis y no ocupa casi nada.
        </Text>
      </Animated.View>

      {dentroDeOtraApp && (
        <View style={[styles.aviso, { backgroundColor: '#FDEBD9' }]}>
          <Icon icon={TriangleAlert} size={18} color="#8A4B12" />
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={{ color: '#5A3210', fontSize: 14, lineHeight: 20 }}>
              Estás dentro de otra app y desde aquí no se puede instalar. Toca «···» y elige «Abrir
              en el navegador» ({sistema === 'ios' ? 'Safari' : 'Chrome'}), o copia el enlace y
              pégalo allí.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => copiar('enlace', window.location.href)}
              style={[styles.chip, { backgroundColor: '#FFFFFF' }]}>
              <Icon icon={copiado === 'enlace' ? Check : Copy} size={15} color="#5A3210" />
              <Text style={{ color: '#5A3210', fontSize: 14, fontWeight: '600' }}>
                {copiado === 'enlace' ? 'Copiado' : 'Copiar el enlace'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* la invitación: en iPhone la app instalada no la recuerda, hay que llevarse el código */}
      {!!codigo && (
        <View style={[styles.invitacion, { backgroundColor: theme.card, boxShadow: theme.shadow }]}>
          <Text style={{ fontFamily: Hand, fontSize: 26, color: theme.text }}>
            ¡Te han invitado a un grupo!
          </Text>
          {tab === 'ios' ? (
            <>
              <Text style={{ color: theme.textSecondary, fontSize: 14, lineHeight: 20 }}>
                Copia el código antes de instalar. Al abrir la app, entra o crea tu cuenta y pégalo
                en «Unirme con un código».
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Copiar el código de invitación"
                onPress={() => copiar('codigo', codigo)}
                style={[styles.codigo, { backgroundColor: theme.soft }]}>
                <Text
                  style={{ color: theme.text, fontSize: 18, fontFamily: 'monospace', flex: 1 }}
                  numberOfLines={1}>
                  {codigo}
                </Text>
                <Icon icon={copiado === 'codigo' ? Check : Copy} size={18} color={theme.text} />
                <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>
                  {copiado === 'codigo' ? 'Copiado' : 'Copiar'}
                </Text>
              </Pressable>
            </>
          ) : (
            <Text style={{ color: theme.textSecondary, fontSize: 14, lineHeight: 20 }}>
              Instala la app y ábrela: la invitación te estará esperando al entrar.
            </Text>
          )}
        </View>
      )}

      {/* iPhone o Android */}
      <View style={[styles.pestanas, { backgroundColor: theme.soft }]}>
        {(['ios', 'android'] as const).map((t) => (
          <Pressable
            key={t}
            accessibilityRole="tab"
            aria-selected={tab === t}
            onPress={() => setTab(t)}
            style={[styles.pestana, tab === t && { backgroundColor: theme.card }]}>
            <Text
              style={{ color: theme.text, fontSize: 15, fontWeight: tab === t ? '600' : '400' }}>
              {t === 'ios' ? 'iPhone' : 'Android'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'android' && hecho ? (
        <View style={[styles.paso, { backgroundColor: theme.card, alignItems: 'center' }]}>
          <Text style={{ fontFamily: Hand, fontSize: 30, color: theme.text }}>¡Instalada!</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 15, textAlign: 'center' }}>
            Ábrela desde tu pantalla de inicio o desde tus aplicaciones.
          </Text>
        </View>
      ) : tab === 'android' && directo ? (
        <View style={{ gap: 10 }}>
          <Button label="Instalar Junti" onPress={async () => setHecho(await instalarDirecto())} />
          <Text style={{ color: theme.textSecondary, fontSize: 13, textAlign: 'center' }}>
            Si no sale nada, sigue estos pasos:
          </Text>
          {pasosAndroid}
        </View>
      ) : tab === 'ios' ? (
        <View style={{ gap: 12 }}>
          {sistema === 'ios' && !chromeIos && (
            <Text style={{ color: theme.textSecondary, fontSize: 14 }}>Desde Safari:</Text>
          )}
          {pasosIos}
        </View>
      ) : (
        <View style={{ gap: 12 }}>{pasosAndroid}</View>
      )}

      <View style={{ alignItems: 'center', paddingBottom: 24 }}>
        <Button
          compact
          variant="quiet"
          label="Seguir en el navegador por ahora"
          onPress={() => {
            saltarGuia();
            onSeguir();
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  num: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  paso: { borderRadius: 22, padding: 16, gap: 10 },
  maqueta: {
    borderRadius: 16,
    padding: 12,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  barra: {
    flex: 1,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    paddingHorizontal: 14,
    marginRight: 10,
  },
  aviso: { flexDirection: 'row', gap: 10, borderRadius: 18, padding: 14 },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
  },
  invitacion: { borderRadius: 22, padding: 18, gap: 10, transform: [{ rotate: '-0.4deg' }] },
  codigo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
  },
  pestanas: { flexDirection: 'row', borderRadius: 14, padding: 4 },
  pestana: {
    flex: 1,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
