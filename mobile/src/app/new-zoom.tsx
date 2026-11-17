import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, ImageIcon, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Lupa } from '@/components/lupa';
import { Button, Field, Notice, Screen, Tag, Title } from '@/components/ui';
import { MaxContentWidth, Spacing, useTheme } from '@/constants/theme';
import { errorText, useStore } from '@/data/store';
import { NIVELES } from '@/lib/zoom';

const DURATIONS = [
  { days: 1, label: 'Un día' },
  { days: 3, label: '3 días' },
  { days: 7, label: 'Una semana' },
];

/**
 * Preparar un zoom misterioso: una foto, el detalle que se verá ampliado (se
 * toca en la foto), la solución (y otras formas de decirlo) y el plazo.
 */
export default function NewZoom() {
  const params = useLocalSearchParams<{ groupId: string; pista?: string }>();
  const { groupId } = params;
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { group: groupById, addZoom } = useStore();
  const group = groupById(groupId);
  const [foto, setFoto] = useState<{ uri: string; mime?: string; w: number; h: number }>();
  const [punto, setPunto] = useState({ cx: 0.5, cy: 0.5 });
  const [respuesta, setRespuesta] = useState('');
  const [otra, setOtra] = useState('');
  const [alternativas, setAlternativas] = useState<string[]>([]);
  const [days, setDays] = useState(3);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  if (!group) return null;

  const ancho = Math.min(width, MaxContentWidth) - 40;

  const elegir = async (desde: 'camara' | 'galeria') => {
    setNotice('');
    try {
      const r =
        desde === 'camara'
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
      if (r.canceled) return;
      const a = r.assets[0];
      setFoto({ uri: a.uri, mime: a.mimeType ?? 'image/jpeg', w: a.width || 1, h: a.height || 1 });
      setPunto({ cx: 0.5, cy: 0.5 });
    } catch {
      setNotice('No se ha podido abrir la cámara o la galería.');
    }
  };

  // la foto entera, encajada en el ancho; se toca para elegir el detalle
  const alto = foto ? Math.min(ancho * 1.25, (ancho * foto.h) / foto.w) : 0;
  const anchoFoto = foto ? Math.min(ancho, (alto * foto.w) / foto.h) : 0;
  const anadirOtra = () => {
    const v = otra.trim();
    if (v && !alternativas.includes(v) && alternativas.length < 6)
      setAlternativas([...alternativas, v]);
    setOtra('');
  };

  const save = async () => {
    if (!foto) return;
    setBusy(true);
    setNotice('');
    try {
      const id = await addZoom(groupId, foto, punto, respuesta, alternativas, days);
      router.replace({ pathname: '/zoom/[id]', params: { id } });
    } catch (e) {
      setNotice(errorText(e));
      setBusy(false);
    }
  };

  return (
    <Screen
      header={
        <View style={styles.header}>
          <Button compact label="Cancelar" variant="quiet" onPress={() => router.back()} />
          <Button
            compact
            label={busy ? 'Preparando…' : 'Lanzar el zoom'}
            disabled={busy || !foto || !respuesta.trim()}
            onPress={save}
          />
        </View>
      }>
      <View style={{ gap: 12 }}>
        <Tag>Para {group.name}</Tag>
        <Title>Zoom misterioso</Title>
        <Text style={{ color: theme.textSecondary, fontSize: 16, lineHeight: 22 }}>
          {params.pista ? `${params.pista}. ` : ''}
          Haz una foto de algo y toca el detalle que se verá muy de cerca. Los demás tendrán que
          adivinar qué es; cada fallo aleja un poco la imagen.
        </Text>
      </View>

      {!foto ? (
        <View style={styles.fila}>
          <Pressable
            accessibilityRole="button"
            onPress={() => elegir('camara')}
            style={[styles.fuente, { backgroundColor: theme.card, boxShadow: theme.shadow }]}>
            <Icon icon={Camera} size={26} color={theme.text} />
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>Hacer foto</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => elegir('galeria')}
            style={[styles.fuente, { backgroundColor: theme.card, boxShadow: theme.shadow }]}>
            <Icon icon={ImageIcon} size={26} color={theme.text} />
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>Galería</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 10, alignItems: 'center' }}>
          <Text style={{ color: theme.textSecondary, fontSize: 14, alignSelf: 'flex-start' }}>
            Toca el detalle que se verá de cerca
          </Text>
          <div
            onClick={(e) => {
              const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              setPunto({
                cx: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
                cy: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
              });
            }}
            style={{
              position: 'relative',
              width: anchoFoto,
              height: alto,
              borderRadius: 18,
              overflow: 'hidden',
              cursor: 'crosshair',
            }}>
            <img
              src={foto.uri}
              alt=""
              draggable={false}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            {/* el círculo de la lupa sobre el detalle */}
            <div
              style={{
                position: 'absolute',
                left: `${punto.cx * 100}%`,
                top: `${punto.cy * 100}%`,
                width: 54,
                height: 54,
                marginLeft: -27,
                marginTop: -27,
                borderRadius: '50%',
                border: '3px solid #FFFFFF',
                boxShadow: '0 0 0 2000px rgba(0,0,0,.35), 0 4px 14px rgba(0,0,0,.4)',
                pointerEvents: 'none',
                transition: 'left .25s, top .25s',
              }}
            />
          </div>
          <View style={styles.vista}>
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Lupa
                src={foto.uri}
                cx={punto.cx}
                cy={punto.cy}
                zoom={NIVELES[0]}
                size={110}
                redonda
              />
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                Así lo verán al principio
              </Text>
            </View>
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Lupa
                src={foto.uri}
                cx={punto.cx}
                cy={punto.cy}
                zoom={NIVELES[2]}
                size={110}
                redonda
              />
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>…y tras dos fallos</Text>
            </View>
          </View>
          <Button
            compact
            variant="quiet"
            label="Elegir otra foto"
            onPress={() => setFoto(undefined)}
          />
        </View>
      )}

      <Field
        label="¿Qué es? (la solución, solo la ves tú)"
        value={respuesta}
        onChangeText={setRespuesta}
        placeholder="Por ejemplo: la tapa de un bote de mermelada"
        maxLength={80}
      />
      <View style={{ gap: 8 }}>
        <Field
          label="Otras formas de decirlo (opcional)"
          value={otra}
          onChangeText={setOtra}
          onSubmitEditing={anadirOtra}
          onBlur={anadirOtra}
          placeholder="mermelada, bote, tarro…"
          maxLength={80}
          returnKeyType="done"
        />
        {alternativas.length > 0 && (
          <View style={styles.fila}>
            {alternativas.map((a) => (
              <Pressable
                key={a}
                accessibilityRole="button"
                accessibilityLabel={`Quitar ${a}`}
                onPress={() => setAlternativas(alternativas.filter((x) => x !== a))}
                style={[styles.chip, { backgroundColor: theme.soft }]}>
                <Text style={{ color: theme.text, fontSize: 15 }}>{a}</Text>
                <Icon icon={X} size={14} />
              </Pressable>
            ))}
          </View>
        )}
        <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 18 }}>
          No hace falta escribirlo igual: valen sin tildes, con algún fallo de letra y frases que lo
          contengan («es una taza» vale para «taza»).
        </Text>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
          Cuánto tiempo hay para adivinar
        </Text>
        <View style={styles.fila}>
          {DURATIONS.map((d) => {
            const on = d.days === days;
            return (
              <Pressable
                key={d.days}
                accessibilityRole="radio"
                aria-checked={on}
                onPress={() => setDays(d.days)}
                style={[styles.chip, { backgroundColor: on ? theme.accent : theme.card }]}>
                <Text style={{ color: on ? theme.onAccent : theme.text, fontSize: 15 }}>
                  {d.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Notice>{notice}</Notice>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.two },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fuente: {
    flex: 1,
    minWidth: 140,
    height: 120,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  vista: { flexDirection: 'row', gap: 24, justifyContent: 'center', marginTop: 4 },
  chip: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
