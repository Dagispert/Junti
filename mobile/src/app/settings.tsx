import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import {
  Bug,
  Camera,
  Compass,
  FileText,
  LogOut,
  MessageCircle,
  Shield,
  X,
} from 'lucide-react-native';
import { type ReactNode, useEffect, useState } from 'react';
import { Image as RNImage, Pressable, StyleSheet, Text, View } from 'react-native';

import { FilaEnlace, Lista, Row, SectionTitle } from '@/components/ajustes';
import { AvatarCropper } from '@/components/avatar-cropper';
import { CityPicker } from '@/components/city-picker';
import { DatePick } from '@/components/date-pick';
import { Icon } from '@/components/icon';
import { FamilyTag } from '@/components/family';
import { Avatar, Button, Field, Notice, Screen } from '@/components/ui';
import {
  setFondo,
  setModo,
  setTema,
  type TemaId,
  useEsquema,
  useFondo,
  useModo,
  useTema,
} from '@/lib/appearance';
import { setSonidos, useSonidos } from '@/lib/sonidos';
import { setFamilyColorMode, useFamilyColorMode } from '@/lib/families';
import { Radius, Spacing, TEMAS, useTheme } from '@/constants/theme';
import { errorText, useStore } from '@/data/store';
import type { Place } from '@/lib/geo';
import { soyAdmin } from '@/lib/errores';
import { requestTour } from '@/lib/tour';
import { disablePush, enablePush, pushState, type PushState } from '@/lib/push';

type Seccion =
  | 'nombre'
  | 'sobre'
  | 'tema'
  | 'modo'
  | 'fondo'
  | 'colores'
  | 'sonidos'
  | 'avisos'
  | 'borrar';

/**
 * Tus ajustes, ordenados como los del grupo: arriba, tú de un vistazo; luego
 * tu perfil, la apariencia, los avisos, la ayuda y la cuenta. Cada apartado
 * enseña un resumen y se abre con un toque.
 */
export default function Settings() {
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    soyAdmin().then(setAdmin, () => {});
  }, []);
  const theme = useTheme();
  const colorMode = useFamilyColorMode();
  const apariencia = useModo();
  const temaElegido = useTema();
  const fondoElegido = useFondo();
  const esquema = useEsquema();
  const { me, user, groups, saveProfile, saveAbout, setAvatar, signOut, deleteAccount } =
    useStore();
  const profile = user(me);
  const [name, setName] = useState(profile.name);
  const current: Place | null =
    profile.lat != null && profile.lng != null
      ? { name: profile.city, country: profile.country, lat: profile.lat, lng: profile.lng }
      : null;
  const [place, setPlace] = useState<Place | null>(current);
  const placeChanged = (place?.name ?? '') !== (current?.name ?? '') || place?.lat !== current?.lat;
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [open, setOpen] = useState<Seccion | null>(null);
  const sonidos = useSonidos();
  // Sobre ti
  const about = profile.about;
  const [nickname, setNickname] = useState(about.nickname ?? '');
  const [gender, setGender] = useState(about.voiceGender);
  const [hasBirthday, setHasBirthday] = useState(!!about.birthMonth);
  const [birthday, setBirthday] = useState(
    () => new Date(about.birthYear ?? 2000, (about.birthMonth ?? 1) - 1, about.birthDay ?? 1),
  );
  const [shareYear, setShareYear] = useState(!!about.birthYear);
  const [hometown, setHometown] = useState(about.hometown ?? '');
  const [bio, setBio] = useState(about.bio ?? '');
  const [interests, setInterests] = useState<string[]>(about.interests ?? []);
  const [interest, setInterest] = useState('');
  const addInterest = () => {
    const v = interest.trim().slice(0, 30);
    if (v && !interests.includes(v) && interests.length < 8) setInterests([...interests, v]);
    setInterest('');
  };
  const [push, setPush] = useState<PushState>();
  useEffect(() => {
    pushState().then(setPush);
  }, []);

  const run = async (action: () => Promise<void>, done = '') => {
    setNotice('');
    setBusy(true);
    try {
      await action();
      setNotice(done);
    } catch (error) {
      setNotice(errorText(error));
    }
    setBusy(false);
  };

  // La foto elegida pasa primero por el editor de encuadre; el sistema no lo ofrece en la web.
  const [cropping, setCropping] = useState<{ uri: string; width: number; height: number }>();

  const pickAvatar = async () => {
    setNotice('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      let { width, height } = asset;
      if (!width || !height) {
        ({ width, height } = await new Promise<{ width: number; height: number }>((ok, fail) =>
          RNImage.getSize(asset.uri, (w, h) => ok({ width: w, height: h }), fail),
        ));
      }
      setCropping({ uri: asset.uri, width, height });
    } catch {
      setNotice('No se ha podido abrir la foto. Prueba con otra.');
    }
  };

  if (cropping) {
    return (
      <Screen>
        <View style={{ paddingTop: Spacing.four }}>
          <AvatarCropper
            {...cropping}
            busy={busy}
            onCancel={() => setCropping(undefined)}
            onDone={(uri) =>
              run(async () => {
                await setAvatar(uri);
                setCropping(undefined);
              }, 'Foto actualizada')
            }
          />
          <Notice>{notice}</Notice>
        </View>
      </Screen>
    );
  }

  const row = (id: Seccion, title: string, summary: ReactNode, body: ReactNode) => (
    <Row
      key={id}
      title={title}
      summary={summary}
      open={open === id}
      onToggle={() => setOpen(open === id ? null : id)}>
      {body}
    </Row>
  );

  const chips = <T extends string>(
    opciones: readonly (readonly [T, string])[],
    actual: T | undefined,
    elegir: (v: T) => void,
  ) => (
    <View style={styles.chips}>
      {opciones.map(([value, label]) => {
        const on = actual === value;
        return (
          <Pressable
            key={value}
            accessibilityRole="radio"
            aria-checked={on}
            onPress={() => elegir(value)}
            style={[styles.chip, { backgroundColor: on ? theme.accent : theme.soft }]}>
            <Text style={{ color: on ? theme.onAccent : theme.text, fontSize: 15 }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  const MODOS = [
    ['sistema', 'Automático'],
    ['claro', 'Claro'],
    ['oscuro', 'Oscuro'],
  ] as const;
  const FONDOS = [
    ['liso', 'Liso'],
    ['papel', 'Papel'],
    ['puntos', 'Puntos'],
    ['lineas', 'Líneas'],
  ] as const;
  const COLORES = [
    ['tinted', 'Tarjeta tintada'],
    ['accent', 'Solo un detalle'],
    ['plain', 'Sin color'],
  ] as const;
  const AVISOS: Record<PushState, string> = {
    on: 'Activados',
    off: 'Desactivados',
    'needs-install': 'Falta instalar la app',
    denied: 'Bloqueados',
    unsupported: 'No disponibles',
  };
  const rellenos = [
    about.nickname,
    about.voiceGender,
    about.birthMonth,
    about.hometown,
    about.bio,
    about.interests?.length,
  ].filter(Boolean).length;

  return (
    <Screen
      header={
        <View style={styles.header}>
          <Button compact label="Cerrar" variant="quiet" onPress={() => router.back()} />
        </View>
      }>
      {/* ── Tú, de un vistazo ── */}
      <View style={[styles.hero, { backgroundColor: theme.card, boxShadow: theme.shadow }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cambiar tu foto"
          disabled={busy}
          onPress={pickAvatar}
          style={styles.heroFoto}>
          <Avatar userId={me} size={84} />
          <View style={[styles.heroCamara, { backgroundColor: theme.accent }]}>
            <Icon icon={Camera} size={14} color={theme.onAccent} />
          </View>
        </Pressable>
        <View style={{ flex: 1, gap: 4 }}>
          <Text numberOfLines={2} style={[styles.heroName, { color: theme.text }]}>
            {profile.name}
          </Text>
          {!!(about.nickname || profile.city) && (
            <Text numberOfLines={1} style={{ color: theme.textSecondary, fontSize: 14 }}>
              {[about.nickname && `«${about.nickname}»`, profile.city].filter(Boolean).join(' · ')}
            </Text>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/person/[id]', params: { id: me } })}
            style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
            <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>
              Ver mi ficha →
            </Text>
          </Pressable>
        </View>
      </View>
      <Notice>{notice}</Notice>

      {/* ── Tu perfil ── */}
      <SectionTitle title="Tu perfil" hint="Lo que ven las personas de tus grupos." />
      <Lista>
        {row(
          'nombre',
          'Nombre y ciudad',
          profile.city || 'Sin ciudad',
          <>
            <Field label="Nombre" value={name} onChangeText={setName} />
            <CityPicker value={place} onChange={setPlace} />
            {!current && !!profile.city && !placeChanged && (
              <Notice>
                Tenías puesta «{profile.city}». Búscala en la lista para aparecer en el mapa.
              </Notice>
            )}
            <Button
              compact
              label="Guardar"
              disabled={busy || !name.trim() || (name === profile.name && !placeChanged)}
              onPress={() =>
                run(() => saveProfile(name.trim(), placeChanged ? place : undefined), 'Guardado')
              }
            />
          </>,
        )}
        {row(
          'sobre',
          'Sobre ti',
          rellenos ? `${rellenos} de 6` : 'Sin rellenar',
          <>
            <Small>
              Todo es opcional. Solo lo ven las personas de tus grupos, y la narradora lo usa para
              contar vuestras historias con más cariño.
            </Small>
            <Field
              label="Apodo"
              value={nickname}
              onChangeText={setNickname}
              placeholder="Como te llaman los tuyos"
              maxLength={40}
            />
            <View style={{ gap: 8 }}>
              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Cuando hablen de ti</Text>
              {chips(
                [
                  ['f', 'En femenino'],
                  ['m', 'En masculino'],
                  ['n', 'Sin género'],
                ] as const,
                gender,
                (v) => setGender(gender === v ? undefined : v),
              )}
            </View>
            <View style={{ gap: 8 }}>
              <Check on={hasBirthday} onPress={() => setHasBirthday(!hasBirthday)}>
                Mi cumpleaños
              </Check>
              {hasBirthday && (
                <>
                  <DatePick
                    value={birthday}
                    onChange={setBirthday}
                    label="Día y mes"
                    hideYear={!shareYear}
                  />
                  <Check on={shareYear} onPress={() => setShareYear(!shareYear)} small>
                    Compartir también el año (para saber cuántos cumples)
                  </Check>
                </>
              )}
            </View>
            <Field
              label="De dónde eres"
              value={hometown}
              onChangeText={setHometown}
              placeholder="Valladolid, Cádiz, Bogotá…"
              maxLength={80}
            />
            <Field
              label="Una frase sobre ti"
              value={bio}
              onChangeText={setBio}
              placeholder="Bióloga en Lisboa y fan del café"
              maxLength={160}
              multiline
            />
            <View style={{ gap: 8 }}>
              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                Lo que te gusta (hasta 8)
              </Text>
              {interests.length > 0 && (
                <View style={styles.chips}>
                  {interests.map((i) => (
                    <Pressable
                      key={i}
                      accessibilityRole="button"
                      accessibilityLabel={`Quitar ${i}`}
                      onPress={() => setInterests(interests.filter((x) => x !== i))}
                      style={[styles.chip, { backgroundColor: theme.soft }]}>
                      <Text style={{ color: theme.text, fontSize: 15 }}>{i}</Text>
                      <Icon icon={X} size={14} />
                    </Pressable>
                  ))}
                </View>
              )}
              {interests.length < 8 && (
                <Field
                  label="Añadir"
                  value={interest}
                  onChangeText={setInterest}
                  onSubmitEditing={addInterest}
                  onBlur={addInterest}
                  placeholder="surf, cocinar, fotografía…"
                  maxLength={30}
                  returnKeyType="done"
                />
              )}
            </View>
            <Button
              compact
              label="Guardar"
              disabled={busy}
              onPress={() =>
                run(
                  () =>
                    saveAbout({
                      nickname: nickname.trim(),
                      voiceGender: gender,
                      birthMonth: hasBirthday ? birthday.getMonth() + 1 : undefined,
                      birthDay: hasBirthday ? birthday.getDate() : undefined,
                      birthYear: hasBirthday && shareYear ? birthday.getFullYear() : undefined,
                      hometown: hometown.trim(),
                      bio: bio.trim(),
                      interests,
                    }),
                  'Guardado',
                )
              }
            />
          </>,
        )}
      </Lista>

      {/* ── Apariencia ── */}
      <SectionTitle title="Apariencia" hint="Solo para ti, en este dispositivo." />
      <Lista>
        {row(
          'tema',
          'Tema',
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[styles.dot, { backgroundColor: theme.accent }]} />
            <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
              {TEMAS[temaElegido].nombre}
            </Text>
          </View>,
          <>
            <View style={styles.temas}>
              {(Object.keys(TEMAS) as TemaId[]).map((id) => {
                const t = TEMAS[id];
                const p = t[esquema === 'dark' || id === 'noche' ? 'dark' : 'light'];
                const on = temaElegido === id;
                return (
                  <Pressable
                    key={id}
                    accessibilityRole="radio"
                    aria-checked={on}
                    accessibilityLabel={`Tema ${t.nombre}: ${t.lema}`}
                    onPress={() => setTema(id)}
                    style={[
                      styles.tema,
                      { borderColor: on ? theme.accent : theme.border, borderWidth: on ? 2 : 1 },
                    ]}>
                    {/* una miniatura de la app con esos colores */}
                    <View style={[styles.mini, { backgroundColor: p.background }]}>
                      <View style={[styles.miniCard, { backgroundColor: p.card }]}>
                        <View
                          style={[styles.miniLinea, { backgroundColor: p.text, width: '70%' }]}
                        />
                        <View
                          style={[
                            styles.miniLinea,
                            { backgroundColor: p.textSecondary, width: '45%' },
                          ]}
                        />
                      </View>
                      <View style={[styles.miniBoton, { backgroundColor: p.accent }]} />
                    </View>
                    <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>
                      {t.nombre}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Small>{TEMAS[temaElegido].lema}. El color de cada grupo no cambia.</Small>
          </>,
        )}
        {row(
          'modo',
          'Claro u oscuro',
          temaElegido === 'noche'
            ? 'Oscuro (Noche)'
            : (MODOS.find(([v]) => v === apariencia)?.[1] ?? ''),
          <>
            {chips(MODOS, apariencia, setModo)}
            <Small>
              {temaElegido === 'noche'
                ? 'Con el tema Noche la app siempre es oscura.'
                : apariencia === 'sistema'
                  ? 'Sigue al móvil: clara de día u oscura si lo tienes en modo oscuro.'
                  : apariencia === 'claro'
                    ? 'Siempre clara, aunque el móvil esté en modo oscuro.'
                    : 'Siempre oscura.'}
            </Small>
          </>,
        )}
        {row(
          'fondo',
          'Fondo',
          FONDOS.find(([v]) => v === fondoElegido)?.[1] ?? '',
          <>
            {chips(FONDOS, fondoElegido, setFondo)}
            <Small>Una trama muy suave detrás de las pantallas.</Small>
          </>,
        )}
        {row(
          'colores',
          'Color de las etiquetas',
          COLORES.find(([v]) => v === colorMode)?.[1] ?? '',
          <>
            <Small>
              Cada cosa del grupo (momento, recuerdo, reto, encuesta…) lleva su etiqueta. Elige
              cuánto color quieres ver en «Hoy».
            </Small>
            {chips(COLORES, colorMode, setFamilyColorMode)}
            <View style={[styles.chips, { gap: 6 }]}>
              {(['moment', 'memory', 'challenge', 'poll', 'quiz', 'open', 'prompt'] as const).map(
                (f) => (
                  <FamilyTag key={f} family={f} />
                ),
              )}
            </View>
          </>,
        )}
        {row(
          'sonidos',
          'Sonidos',
          sonidos ? 'Encendidos' : 'Apagados',
          <>
            {chips(
              [
                ['si', 'Encendidos'],
                ['no', 'Apagados'],
              ] as const,
              sonidos ? 'si' : 'no',
              (v) => setSonidos(v === 'si'),
            )}
            <Small>
              Sonidos cortos y bajitos al reaccionar, comentar, acertar en el zoom, encender la tele
              del karaoke… y en la película de la semana.
            </Small>
          </>,
        )}
      </Lista>

      {/* ── Avisos ── */}
      <SectionTitle
        title="Avisos"
        hint="La hora y el descanso se eligen en los ajustes de cada grupo."
      />
      <Lista>
        {row(
          'avisos',
          'Avisos en este dispositivo',
          push ? AVISOS[push] : '',
          <>
            {push === 'on' && (
              <>
                <Small>
                  Este dispositivo recibe la propuesta del día y lo nuevo de tus grupos.
                </Small>
                <Button
                  compact
                  label="Desactivar avisos aquí"
                  variant="quiet"
                  disabled={busy}
                  onPress={() => run(async () => (await disablePush(), setPush(await pushState())))}
                />
              </>
            )}
            {push === 'off' && (
              <>
                <Small>
                  Recibe la propuesta del día a tu hora, aunque no tengas la app abierta. Nada más:
                  ni rachas ni recordatorios insistentes.
                </Small>
                <Button
                  compact
                  label="Activar avisos aquí"
                  disabled={busy}
                  onPress={() => run(async () => (await enablePush(), setPush(await pushState())))}
                />
              </>
            )}
            {push === 'needs-install' && (
              <Small>
                Para recibir avisos en el iPhone, añade Junti a la pantalla de inicio: en Safari,
                pulsa Compartir y luego «Añadir a pantalla de inicio». Ábrela desde ese icono y
                vuelve aquí.
              </Small>
            )}
            {push === 'denied' && (
              <Small>
                Los avisos están bloqueados para Junti en este navegador. Puedes permitirlos en los
                ajustes del navegador o del teléfono.
              </Small>
            )}
            {push === 'unsupported' && (
              <Small>
                Este navegador no admite avisos. Prueba desde el móvil, con la app añadida a la
                pantalla de inicio.
              </Small>
            )}
          </>,
        )}
      </Lista>

      {/* ── Ayuda ── */}
      <SectionTitle title="Ayuda" />
      <Lista>
        <FilaEnlace
          icon={Compass}
          title="Ver la guía de Junti"
          onPress={() => {
            const first = groups[0];
            if (!first) {
              setNotice('Crea un grupo o únete a uno para ver la guía dentro de él');
              return;
            }
            requestTour();
            router.dismissAll();
            router.push({ pathname: '/group/[id]', params: { id: first.id } });
          }}
        />
        <FilaEnlace
          icon={MessageCircle}
          title="Guardar desde WhatsApp"
          onPress={() => router.push('/compartir-ajustes')}
        />
        {/* solo lo ve quien mantiene la app */}
        {admin && (
          <FilaEnlace
            icon={Bug}
            title="Errores recientes"
            onPress={() => router.push('/errores')}
          />
        )}
      </Lista>

      {/* ── Privacidad y cuenta ── */}
      <SectionTitle title="Privacidad y cuenta" />
      <Lista>
        <FilaEnlace
          icon={Shield}
          title="Política de privacidad"
          onPress={() => router.push({ pathname: '/legal', params: { doc: 'privacidad' } })}
        />
        <FilaEnlace
          icon={FileText}
          title="Condiciones de uso"
          onPress={() => router.push({ pathname: '/legal', params: { doc: 'condiciones' } })}
        />
        <FilaEnlace icon={LogOut} title="Cerrar sesión" onPress={signOut} />
        {row(
          'borrar',
          'Borrar mi cuenta',
          '',
          <>
            <Small>
              Borrar tu cuenta elimina tu perfil, tus momentos, tus fotos, tus comentarios y tus
              reacciones en todos los grupos. No se puede deshacer.
            </Small>
            {confirming ? (
              <View style={styles.confirm}>
                <Button
                  compact
                  label="Sí, borrar todo"
                  disabled={busy}
                  onPress={() => run(deleteAccount)}
                />
                <Button
                  compact
                  label="Cancelar"
                  variant="quiet"
                  onPress={() => setConfirming(false)}
                />
              </View>
            ) : (
              <Button
                compact
                label="Borrar mi cuenta"
                variant="quiet"
                onPress={() => setConfirming(true)}
              />
            )}
          </>,
        )}
      </Lista>
    </Screen>
  );
}

function Small({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text style={{ color: theme.textSecondary, fontSize: 14, lineHeight: 19 }}>{children}</Text>
  );
}

/** Una casilla con su texto. */
function Check({
  on,
  onPress,
  small,
  children,
}: {
  on: boolean;
  onPress: () => void;
  small?: boolean;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      aria-checked={on}
      onPress={onPress}
      style={styles.checkRow}>
      <View
        style={[
          styles.box,
          { borderColor: on ? theme.accent : theme.textSecondary },
          on && { backgroundColor: theme.accent },
        ]}
      />
      <Text style={{ color: theme.text, fontSize: small ? 15 : 17, flex: 1 }}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'flex-start', paddingVertical: Spacing.two },
  hero: {
    borderRadius: Radius.frame,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  heroFoto: { position: 'relative' },
  heroCamara: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroName: { fontSize: 26, lineHeight: 31, fontWeight: '500', letterSpacing: -0.5 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  temas: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tema: { width: '31%', flexGrow: 1, borderRadius: 16, padding: 8, gap: 6, alignItems: 'center' },
  mini: { width: '100%', height: 64, borderRadius: 10, padding: 7, gap: 6 },
  miniCard: { borderRadius: 6, padding: 6, gap: 4 },
  miniLinea: { height: 4, borderRadius: 2 },
  miniBoton: { width: 22, height: 8, borderRadius: 4, alignSelf: 'flex-end' },
  chip: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 32 },
  box: { width: 20, height: 20, borderRadius: 6, borderWidth: 2 },
  confirm: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
