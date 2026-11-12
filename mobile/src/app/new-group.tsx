import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Check, Copy, Play, Share2, Volume2, VolumeX } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import { CityPicker } from '@/components/city-picker';
import { Icon } from '@/components/icon';
import { LogoMark } from '@/components/logo';
import { EASE } from '@/components/motion';
import { Button, Field, Notice, Screen } from '@/components/ui';
import { Radius, SerifItalic, useTheme } from '@/constants/theme';
import { frequencies } from '@/data/library';
import { STICKERS } from '@/data/look';
import { errorText, PALETTE, useStore } from '@/data/store';
import type { Place } from '@/lib/geo';
import { copyText, inviteLink } from '@/lib/invite';
import { NARRATIVE_STYLES } from '@/lib/narrative';
import { playTone, useVoiceClip } from '@/lib/voice-clip';

type Kind = 'amigos' | 'familia' | 'pareja';

/** Lo que dice la narradora en cada tarjeta (sus audios están en public/voz/crear). */
const CARDS = [
  {
    id: 'nombre',
    title: '¿Cómo se llama vuestro grupo?',
    text: 'Vamos a crear vuestro grupo, y lo hacemos juntos, paso a paso. Lo primero: ¿cómo se llama? Puede ser el nombre de siempre, un mote, o esa broma que solo entendéis vosotros.',
  },
  {
    id: 'origen',
    title: '¿Dónde empezó todo?',
    text: 'Ahora, lo más bonito: ¿dónde empezó todo? Dime dónde os conocisteis y, si te acuerdas, en qué año. Será el punto de partida de vuestra historia.',
  },
  {
    id: 'raices',
    title: '¿De dónde sois?',
    text: '¿Y de dónde sois? ¿Todos del mismo sitio, o cada uno de un lugar distinto? Así sabré de dónde venís, aunque hoy viváis lejos.',
  },
  {
    id: 'aspecto',
    title: 'Vuestra cara',
    text: 'Ahora, dadle vuestra cara: un color, una pegatina y, si quieres, una foto de portada. Saldrán en vuestras historias.',
  },
  {
    id: 'propuestas',
    title: 'Algo pequeño para compartir',
    text: 'De vez en cuando os propondré algo pequeño para compartir: qué ves por tu ventana, qué estás escuchando. ¿Cuántas veces a la semana os apetece?',
  },
  {
    id: 'narradora',
    title: '¿Os cuento vuestra historia?',
    text: 'Y por último, yo. Si queréis, cada semana y cada mes os cuento vuestra historia en voz alta, con vuestras fotos y vuestra música. ¿Me activáis? Elegid también el tono.',
  },
  {
    id: 'invitar',
    title: 'Ya existe vuestro grupo',
    text: '¡Ya está! Vuestro grupo ya existe. Ahora falta lo más importante: que entren los tuyos. Mándales el enlace, y aquí os espero.',
  },
] as const;

/**
 * Crear un grupo, con la narradora guiando: una tarjeta por paso, cada una con
 * lo que ella cuenta y lo que hay que rellenar. No se avanza sin responder,
 * así el grupo nace completo.
 */
export default function NewGroup() {
  const theme = useTheme();
  const store = useStore();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  // Lo que se va rellenando
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<Kind>('amigos');
  const [place, setPlace] = useState<Place | null>(null);
  const [year, setYear] = useState('');
  const [story, setStory] = useState('');
  const [sameRoots, setSameRoots] = useState<boolean | null>(null);
  const [roots, setRoots] = useState('');
  const [color, setColor] = useState<string>(PALETTE[0]);
  const [sticker, setSticker] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [perWeek, setPerWeek] = useState<number | null>(null);
  const [narrator, setNarrator] = useState<boolean | null>(null);
  const [style, setStyle] = useState<string>('emotivo');
  // Al final
  const [groupId, setGroupId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);

  const card = CARDS[step];
  const voice = useVoiceClip(`voz/crear/${card.id}.mp3`);
  const visible =
    voice.muted || voice.needsTap
      ? card.text.length
      : Math.ceil(card.text.length * Math.min(1, voice.progress * 1.05 + 0.03));

  const yearNum = Number(year);
  const yearOk = !year || (yearNum >= 1900 && yearNum <= new Date().getFullYear());
  const ready: Record<(typeof CARDS)[number]['id'], boolean> = {
    nombre: !!name.trim(),
    origen: !!place && yearOk,
    raices: sameRoots === false || (sameRoots === true && !!roots.trim()),
    aspecto: true,
    propuestas: perWeek !== null,
    narradora: narrator !== null,
    invitar: true,
  };

  // Al terminar las preguntas se crea el grupo con todo, y luego se invita.
  const create = async () => {
    setBusy(true);
    setNotice('');
    try {
      const id = await store.createGroup(name.trim(), description.trim());
      await Promise.all([
        store.saveOrigin(id, {
          place: place!.name,
          lat: place!.lat,
          lng: place!.lng,
          year: year ? yearNum : undefined,
          story: story.trim() || (kind === 'familia' ? 'La familia' : undefined),
          memberIds: [],
        }),
        sameRoots && roots.trim() ? store.setRoots(id, roots) : null,
        store.styleGroup(id, { color, sticker, ...(cover ? { coverUri: cover } : {}) }),
        store.setCadence(id, frequencies.find((f) => f.perWeek === perWeek)!.days),
        narrator ? store.setNarrative(id, true, style) : null,
      ]);
      setGroupId(id);
      setCode(await store.createInvite(id).catch(() => ''));
      setStep(step + 1);
    } catch (error) {
      setNotice(errorText(error));
    }
    setBusy(false);
  };

  const next = () => {
    if (card.id === 'narradora') create();
    else if (card.id === 'invitar' && groupId)
      router.replace({ pathname: '/group/[id]', params: { id: groupId } });
    else setStep(step + 1);
  };

  const originLabel = kind === 'familia' ? '¿De dónde es la familia?' : 'Dónde os conocisteis';
  const link = code ? inviteLink(code) : '';

  return (
    <Screen
      header={
        <View style={styles.header}>
          {!groupId ? (
            <Button compact label="Cancelar" variant="quiet" onPress={() => router.back()} />
          ) : (
            <View />
          )}
          <View style={styles.dots}>
            {CARDS.map((c, i) => (
              <View
                key={c.id}
                style={[
                  styles.dot,
                  { backgroundColor: i <= step ? theme.text : theme.border },
                  i === step && { width: 18 },
                ]}
              />
            ))}
          </View>
        </View>
      }>
      <Animated.View
        key={card.id}
        entering={FadeInDown.duration(450).easing(EASE)}
        exiting={FadeOut.duration(150)}
        style={[styles.card, { backgroundColor: theme.card, boxShadow: theme.shadow }]}>
        {/* La narradora: quién habla y lo que dice */}
        <View style={styles.speakerRow}>
          <View style={styles.speaker}>
            <LogoMark size={28} />
            <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '500' }}>
              La narradora · {step + 1} de {CARDS.length}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={voice.muted ? 'Activar la voz' : 'Silenciar la voz'}
            onPress={() => voice.setMuted(!voice.muted)}
            style={[styles.round, { backgroundColor: theme.soft }]}>
            <Icon icon={voice.muted ? VolumeX : Volume2} size={16} color={theme.text} />
          </Pressable>
        </View>
        <Text style={[styles.title, { color: theme.text }]}>{card.title}</Text>
        <Text style={[styles.said, { color: theme.textSecondary }]}>
          {card.text.slice(0, visible)}
          <Text style={{ color: 'transparent' }}>{card.text.slice(visible)}</Text>
        </Text>
        {voice.needsTap && !voice.muted && (
          <Pressable accessibilityRole="button" onPress={voice.play} style={styles.listen}>
            <Icon icon={Play} size={14} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '500' }}>
              Escuchar a la narradora
            </Text>
          </Pressable>
        )}

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        {/* Lo que se rellena */}
        {card.id === 'nombre' && (
          <View style={styles.fields}>
            <Field
              label="Nombre del grupo"
              value={name}
              onChangeText={setName}
              placeholder="Los de siempre"
              autoFocus
              maxLength={60}
            />
            <Field
              label="Una frase sobre vosotros (opcional)"
              value={description}
              onChangeText={setDescription}
              placeholder="Desde el colegio, ahora repartidos por el mundo"
              maxLength={140}
            />
          </View>
        )}

        {card.id === 'origen' && (
          <View style={styles.fields}>
            <Choices
              label="Sois…"
              value={kind}
              onChange={(k) => setKind(k as Kind)}
              options={[
                { id: 'amigos', label: 'Amigos' },
                { id: 'familia', label: 'Familia' },
                { id: 'pareja', label: 'Pareja' },
              ]}
            />
            <CityPicker
              label={originLabel}
              empty="Elige la ciudad o el pueblo"
              hint={
                kind === 'familia'
                  ? 'El sitio de donde viene la familia.'
                  : 'La ciudad. El sitio concreto, en la historia.'
              }
              clear="Quitar el lugar"
              value={place}
              onChange={setPlace}
            />
            <Field
              label={kind === 'familia' ? 'Desde qué año (opcional)' : 'Año (opcional)'}
              value={year}
              onChangeText={(v) => setYear(v.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              placeholder="2008"
            />
            {!yearOk && <Notice>Ese año no parece correcto.</Notice>}
            <Field
              label="Cómo fue (opcional)"
              value={story}
              onChangeText={setStory}
              maxLength={280}
              multiline
              placeholder={
                kind === 'pareja'
                  ? 'En un concierto, cuando se fue la luz…'
                  : kind === 'familia'
                    ? 'La casa de la abuela, los veranos en el pueblo…'
                    : 'En el colegio, en 3.º B. Nos sentaron juntos el primer día…'
              }
              style={{ minHeight: 88, paddingTop: 12, textAlignVertical: 'top' }}
            />
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              Si no todos os conocisteis igual, luego cada uno podrá contar cómo llegó.
            </Text>
          </View>
        )}

        {card.id === 'raices' && (
          <View style={styles.fields}>
            <Choices
              value={sameRoots === null ? '' : sameRoots ? 'si' : 'no'}
              onChange={(v) => {
                setSameRoots(v === 'si');
                if (v === 'si' && !roots && place) setRoots(`Todos somos de ${place.name}`);
              }}
              options={[
                { id: 'si', label: 'Del mismo sitio' },
                { id: 'no', label: 'Cada uno de un sitio' },
              ]}
            />
            {sameRoots && (
              <Field
                label="De dónde sois"
                value={roots}
                onChangeText={setRoots}
                maxLength={80}
                placeholder="Todos somos de Valladolid"
              />
            )}
          </View>
        )}

        {card.id === 'aspecto' && (
          <View style={styles.fields}>
            <View style={styles.coverRow}>
              <View style={[styles.cover, { backgroundColor: color }]}>
                {cover && (
                  <Image
                    source={{ uri: cover }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                  />
                )}
                {!!sticker && <Text style={styles.coverSticker}>{sticker}</Text>}
              </View>
              <View style={{ flex: 1, gap: 8 }}>
                <Text style={{ color: theme.text, fontSize: 17 }}>{name.trim()}</Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <Button
                    compact
                    label={cover ? 'Cambiar foto' : 'Elegir portada'}
                    onPress={async () => {
                      const result = await ImagePicker.launchImageLibraryAsync({
                        mediaTypes: ['images'],
                        quality: 0.8,
                      }).catch(() => null);
                      if (result && !result.canceled) setCover(result.assets[0].uri);
                    }}
                  />
                  {cover && (
                    <Button compact variant="quiet" label="Quitar" onPress={() => setCover(null)} />
                  )}
                </View>
              </View>
            </View>
            <Label>Color</Label>
            <View style={styles.swatches}>
              {PALETTE.map((c) => (
                <Pressable
                  key={c}
                  accessibilityRole="radio"
                  accessibilityLabel={`Color ${c}`}
                  accessibilityState={{ checked: color === c }}
                  onPress={() => setColor(c)}
                  style={[
                    styles.swatch,
                    { backgroundColor: c },
                    color === c && { borderColor: theme.text },
                  ]}
                />
              ))}
            </View>
            <Label>Pegatina</Label>
            <View style={styles.swatches}>
              {STICKERS.map((e) => (
                <Pressable
                  key={e}
                  accessibilityRole="radio"
                  accessibilityLabel={`Pegatina ${e}`}
                  accessibilityState={{ checked: sticker === e }}
                  onPress={() => setSticker(sticker === e ? null : e)}
                  style={[
                    styles.sticker,
                    { backgroundColor: sticker === e ? theme.soft : 'transparent' },
                  ]}>
                  <Text style={{ fontSize: 24 }}>{e}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {card.id === 'propuestas' && (
          <View style={styles.fields}>
            {frequencies.map((f) => (
              <Option
                key={f.perWeek}
                selected={perWeek === f.perWeek}
                onPress={() => setPerWeek(f.perWeek)}
                label={f.label}
              />
            ))}
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              Luego cada uno puede votar otra frecuencia, y elegir a qué hora le llega.
            </Text>
          </View>
        )}

        {card.id === 'narradora' && (
          <View style={styles.fields}>
            <Choices
              value={narrator === null ? '' : narrator ? 'si' : 'no'}
              onChange={(v) => {
                setNarrator(v === 'si');
                if (v === 'si') playTone(style);
              }}
              options={[
                { id: 'si', label: 'Sí, contadla' },
                { id: 'no', label: 'Ahora no' },
              ]}
            />
            {narrator && (
              <>
                <Label>Tono</Label>
                <View style={styles.styleGrid}>
                  {NARRATIVE_STYLES.map((s) => (
                    <Pressable
                      key={s.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: style === s.id }}
                      onPress={() => {
                        setStyle(s.id);
                        playTone(s.id);
                      }}
                      style={[
                        styles.styleCard,
                        {
                          backgroundColor: style === s.id ? theme.accent : theme.soft,
                        },
                      ]}>
                      <Text
                        style={{
                          color: style === s.id ? theme.onAccent : theme.text,
                          fontSize: 15,
                          fontWeight: '500',
                        }}>
                        {s.label}
                      </Text>
                      <Text
                        style={{
                          color: style === s.id ? theme.onAccent : theme.textSecondary,
                          fontSize: 13,
                          opacity: 0.85,
                        }}>
                        {s.hint}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              Solo uso lo que compartís, y cada uno puede pedirme que no use lo suyo. Podéis
              cambiarlo cuando queráis en los ajustes.
            </Text>
          </View>
        )}

        {card.id === 'invitar' && (
          <View style={styles.fields}>
            {link ? (
              <>
                <View style={[styles.linkBox, { backgroundColor: theme.soft }]}>
                  <TextInput
                    value={link}
                    editable={false}
                    selectTextOnFocus
                    accessibilityLabel="Enlace de invitación"
                    style={{ color: theme.text, fontSize: 15, flex: 1 }}
                  />
                </View>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <Button
                    compact
                    label="Compartir"
                    onPress={() =>
                      Share.share({ message: `Únete a «${name.trim()}» en Junti: ${link}` }).catch(
                        () => {},
                      )
                    }
                  />
                  <Pressable
                    accessibilityRole="button"
                    onPress={async () => setCopied(await copyText(link))}
                    style={[styles.copy, { backgroundColor: theme.soft }]}>
                    <Icon icon={copied ? Check : Copy} size={16} color={theme.text} />
                    <Text style={{ color: theme.text, fontSize: 14, fontWeight: '500' }}>
                      {copied ? 'Copiado' : 'Copiar'}
                    </Text>
                  </Pressable>
                </View>
                <Text style={[styles.hint, { color: theme.textSecondary }]}>
                  El enlace caduca en 14 días. Siempre podrás crear otro desde «Invitar».
                </Text>
              </>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Icon icon={Share2} />
                <Text style={{ color: theme.textSecondary, fontSize: 15, flex: 1 }}>
                  Podrás invitar desde «Invitar», arriba en el grupo.
                </Text>
              </View>
            )}
          </View>
        )}

        <Notice>{notice}</Notice>

        <View style={styles.actions}>
          {step > 0 && !groupId ? (
            <Button compact variant="quiet" label="Atrás" onPress={() => setStep(step - 1)} />
          ) : (
            <View />
          )}
          <Button
            label={
              card.id === 'narradora'
                ? busy
                  ? 'Creando…'
                  : 'Crear el grupo'
                : card.id === 'invitar'
                  ? 'Entrar al grupo'
                  : 'Siguiente'
            }
            disabled={busy || !ready[card.id]}
            onPress={next}
          />
        </View>
      </Animated.View>
    </Screen>
  );
}

function Label({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{children}</Text>;
}

function Choices({
  label,
  value,
  onChange,
  options,
}: {
  label?: string;
  value: string;
  onChange: (id: string) => void;
  options: { id: string; label: string }[];
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {!!label && <Label>{label}</Label>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => (
          <Pressable
            key={o.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: value === o.id }}
            onPress={() => onChange(o.id)}
            style={[
              styles.choice,
              { backgroundColor: value === o.id ? theme.accent : theme.soft },
            ]}>
            <Text
              style={{
                color: value === o.id ? theme.onAccent : theme.text,
                fontSize: 15,
                fontWeight: '500',
              }}>
              {o.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Option({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.option, { backgroundColor: selected ? theme.accent : theme.soft }]}>
      <Text style={{ color: selected ? theme.onAccent : theme.text, fontSize: 16, flex: 1 }}>
        {label}
      </Text>
      {selected && <Icon icon={Check} size={18} color={theme.onAccent} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  dots: { flexDirection: 'row', gap: 6, paddingRight: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  card: { borderRadius: 28, padding: 20, gap: 12 },
  speakerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  speaker: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  round: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '500', letterSpacing: -0.4 },
  said: { fontFamily: SerifItalic, fontSize: 17, lineHeight: 25 },
  listen: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: Radius.medium,
    backgroundColor: '#FF8A3D',
  },
  divider: { height: 1, marginVertical: 4 },
  fields: { gap: 14 },
  hint: { fontSize: 13, lineHeight: 18 },
  coverRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  cover: {
    width: 88,
    height: 88,
    borderRadius: Radius.medium,
    overflow: 'hidden',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  coverSticker: { fontSize: 30, margin: 4 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 3, borderColor: 'transparent' },
  sticker: {
    width: 44,
    height: 44,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choice: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: Radius.pill,
    justifyContent: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 18,
    borderRadius: Radius.medium,
  },
  styleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  styleCard: { width: '48%', flexGrow: 1, padding: 12, borderRadius: Radius.medium, gap: 2 },
  linkBox: {
    height: 48,
    borderRadius: Radius.small,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  copy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: Radius.medium,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
});
