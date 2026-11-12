import { LinearGradient } from 'expo-linear-gradient';
import { Lock, Mail, Sparkles } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Brand, TAGLINE } from '@/constants/brand';
import { Hand, Radius, Spacing, useTheme } from '@/constants/theme';
import type { Moment } from '@/data/types';
import { progress, useClock } from '@/lib/clock';
import { clockIn } from '@/lib/time';

import { SKY } from './cinematics';
import { GlobeMap } from './globe-map';
import type { GlobePerson } from './globe-map.types';
import { Icon } from './icon';
import { Logo } from './logo';
import { PolaroidPile, StickyNote } from './scrapbook';
import { SkyBadge } from './sky-badge';
import { Button } from './ui';

const base =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  window.location.pathname.startsWith('/Junti')
    ? '/Junti'
    : '';
const photo = (i: number) => `${base}/bienvenida/${i}.jpg`;
// Un grupo de ejemplo para enseñar la app sin cuenta: amigos de siempre que
// hoy viven en Valladolid, Buenos Aires, Berlín y Tokio.
const EXAMPLE: GlobePerson[] = [
  {
    id: 'tu',
    photo: photo(0),
    name: 'Tú',
    lat: 41.65,
    lng: -4.72,
    tz: 'Europe/Madrid',
    isMe: true,
    city: 'Valladolid',
    country: 'España',
    color: '#5B7DB1',
  },
  {
    id: 'lu',
    photo: photo(1),
    name: 'Lu',
    lat: -34.6,
    lng: -58.38,
    tz: 'America/Argentina/Buenos_Aires',
    city: 'Buenos Aires',
    country: 'Argentina',
    color: '#B8648F',
  },
  {
    id: 'tomi',
    photo: photo(3),
    name: 'Tomi',
    lat: 52.52,
    lng: 13.4,
    tz: 'Europe/Berlin',
    city: 'Berlín',
    country: 'Alemania',
    color: '#4E8D7C',
  },
  {
    id: 'marta',
    photo: photo(2),
    name: 'Martuki',
    lat: 35.68,
    lng: 139.69,
    tz: 'Asia/Tokyo',
    city: 'Tokio',
    country: 'Japón',
    color: '#C9A227',
  },
];

const exampleMoments = [1, 2, 3, 0].map(
  (i) =>
    ({
      id: `ejemplo-${i}`,
      groupId: 'ejemplo',
      authorId: 'ejemplo',
      imageUri: photo(i),
      createdAt: 0,
      sharedAt: 0,
      authorTz: 'Europe/Madrid',
      reactions: [],
      comments: [],
    }) as Moment,
);

/**
 * La bienvenida para quien aún no tiene cuenta: qué es Junti, con el planeta y
 * un grupo de ejemplo, para que se entienda antes de registrarse.
 */
export function Welcome({
  invited,
  onCreate,
  onSignIn,
  onLegal,
}: {
  invited: boolean;
  onCreate: () => void;
  onSignIn: () => void;
  onLegal: (doc: 'privacidad' | 'condiciones') => void;
}) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const t = useClock(true, 3000);
  const mark = progress(t, 300, 1800);
  const globe = Math.min(height * 0.46, width * 1.05, 460);

  return (
    <Animated.ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ paddingBottom: 64 }}>
      {/* Portada: la marca, el planeta con el grupo de ejemplo y las dos acciones */}
      <View style={{ minHeight: height }}>
        <LinearGradient colors={SKY} style={StyleSheet.absoluteFill} />
        <View style={[styles.column, { paddingTop: 48, gap: 12 }]}>
          <Logo size={40} drawn={mark} />
          <Animated.Text entering={FadeInDown.delay(1100).duration(600)} style={styles.headline}>
            Para quienes se quieren y viven lejos
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.delay(1300).duration(600)}
            style={[styles.lead, { color: theme.textSecondary }]}>
            Un rincón privado donde tu gente comparte su día a día, aunque estéis en distintos
            países. Sin likes, sin seguidores, sin postureo.
          </Animated.Text>
        </View>
        <View style={{ height: globe, marginTop: 8 }}>
          <GlobeMap people={EXAMPLE} height={globe} interactive transparent />
        </View>
        <Animated.View
          entering={FadeInDown.delay(1800).duration(600)}
          style={[styles.column, { gap: 8, paddingTop: 8 }]}>
          {invited && (
            <View style={[styles.invite, { backgroundColor: theme.card }]}>
              <Icon icon={Mail} color={Brand.sunset} />
              <Text style={{ color: theme.text, fontSize: 15, flex: 1, lineHeight: 21 }}>
                Te han invitado a un grupo. Crea tu cuenta (o entra) y estarás dentro.
              </Text>
            </View>
          )}
          <Button label="Crear mi cuenta" onPress={onCreate} />
          <Button label="Ya tengo cuenta" variant="quiet" onPress={onSignIn} />
        </Animated.View>
      </View>

      {/* Cómo funciona, con el grupo de ejemplo */}
      <View style={[styles.column, { gap: 56, paddingTop: 48 }]}>
        <Section
          kicker="Cada día"
          title="Una pregunta para todos"
          text="Junti os propone algo pequeño a la hora que prefiera cada uno: qué ves por tu ventana, qué has comido, qué canción te acompaña. Responder lleva un minuto.">
          <View style={[styles.mock, { backgroundColor: theme.card, boxShadow: theme.shadow }]}>
            <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '500' }}>
              Propuesta de hoy
            </Text>
            <Text style={[styles.mockTitle, { color: theme.text }]}>¿Qué ves por tu ventana?</Text>
            <View style={[styles.fakeButton, { backgroundColor: theme.accent }]}>
              <Text style={{ color: theme.onAccent, fontSize: 15, fontWeight: '500' }}>
                Responder
              </Text>
            </View>
          </View>
        </Section>

        <Section
          kicker="Momentos"
          title="Lo pequeño, compartido"
          text="Una foto, un vídeo corto, una nota de voz o unas palabras. Sin pensar en quién da like: solo para los tuyos.">
          <PolaroidPile moments={exampleMoments} size={Math.min(width - 48, 320)} />
        </Section>

        <Section
          kicker="Un mismo mapa"
          title="Dónde está cada uno, y qué hora es allí"
          text="Vuestras ciudades en el planeta, unidas por un hilo. Sabes si Lu está desayunando o si en Tokio ya es mañana.">
          <View style={[styles.mock, { backgroundColor: theme.card, boxShadow: theme.shadow }]}>
            {EXAMPLE.map((p) => (
              <View key={p.id} style={styles.clockRow}>
                <SkyBadge tz={p.tz} size={20} />
                <Text style={{ color: theme.text, fontSize: 15, flex: 1 }}>
                  {p.name} · {p.city}
                </Text>
                <Text
                  style={{
                    color: theme.textSecondary,
                    fontSize: 15,
                    fontVariant: ['tabular-nums'],
                  }}>
                  {clockIn(p.tz)}
                </Text>
              </View>
            ))}
          </View>
        </Section>

        <Section
          kicker="Vuestra memoria"
          title="Una historia que se cuenta sola"
          text="Cada semana y cada mes, un resumen con vuestras fotos y vuestra música. Si queréis, una narradora os lo cuenta en voz alta.">
          <StickyNote rotate={-2} width={Math.min(width - 64, 300)} style={{ alignSelf: 'center' }}>
            Mientras Lu tomaba mate en Buenos Aires, en Tokio Martuki ya iba por la cena. Y Tomi, en
            Berlín, se apuntó a alemán… por cuarta vez.
          </StickyNote>
        </Section>

        <Section
          kicker="Privado de verdad"
          title="Solo vuestro grupo"
          text="Nada es público: lo ve solo quien está en el grupo. Sin anuncios. Te vas cuando quieras y te llevas tus recuerdos.">
          <View
            style={[
              styles.mock,
              { backgroundColor: theme.card, boxShadow: theme.shadow, gap: 12 },
            ]}>
            {[
              { icon: Lock, text: 'Fotos en un almacén privado de la Unión Europea' },
              { icon: Sparkles, text: 'La IA es opcional y la activa vuestro grupo' },
              { icon: Mail, text: 'Te unes solo con una invitación' },
            ].map((r) => (
              <View key={r.text} style={styles.clockRow}>
                <Icon icon={r.icon} />
                <Text style={{ color: theme.text, fontSize: 15, flex: 1 }}>{r.text}</Text>
              </View>
            ))}
          </View>
        </Section>

        <View style={{ gap: 8, alignItems: 'stretch' }}>
          <Text style={[styles.headline, { fontSize: 28, lineHeight: 34 }]}>{TAGLINE}</Text>
          <Button label="Crear mi cuenta" onPress={onCreate} />
          <Button label="Ya tengo cuenta" variant="quiet" onPress={onSignIn} />
        </View>

        <View style={{ gap: 8, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Pressable accessibilityRole="link" onPress={() => onLegal('privacidad')}>
              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Privacidad</Text>
            </Pressable>
            <Pressable accessibilityRole="link" onPress={() => onLegal('condiciones')}>
              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Condiciones</Text>
            </Pressable>
          </View>
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
            Una versión de prueba hecha con cariño por FuFūStudio
          </Text>
        </View>
      </View>
    </Animated.ScrollView>
  );
}

function Section({
  kicker,
  title,
  text,
  children,
}: {
  kicker: string;
  title: string;
  text: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: Spacing.three }}>
      <View style={{ gap: 4 }}>
        <Text style={styles.kicker}>{kicker}</Text>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.lead, { color: theme.textSecondary, fontSize: 17, lineHeight: 24 }]}>
          {text}
        </Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 24 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wordmark: { color: Brand.ink, fontSize: 28, fontWeight: '600', letterSpacing: -0.6 },
  headline: { color: Brand.ink, fontSize: 34, lineHeight: 40, fontWeight: '500' },
  lead: { fontSize: 17, lineHeight: 24 },
  invite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: Radius.medium,
  },
  kicker: { fontFamily: Hand, fontSize: 24, color: Brand.hand },
  sectionTitle: { fontSize: 28, lineHeight: 34, fontWeight: '500' },
  mock: { borderRadius: Radius.inner, padding: 20, gap: 8 },
  mockTitle: { fontSize: 24, lineHeight: 30, fontWeight: '500' },
  fakeButton: {
    alignSelf: 'flex-start',
    height: 44,
    paddingHorizontal: 20,
    borderRadius: Radius.medium,
    justifyContent: 'center',
    marginTop: 8,
  },
  clockRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
