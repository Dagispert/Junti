import { router, useLocalSearchParams } from 'expo-router';
import { Check, FileArchive } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Button, Lead, Screen, Title } from '@/components/ui';
import { Hand, HandBold, useTheme } from '@/constants/theme';
import { errorText, useStore } from '@/data/store';
import { type ChatImport, type ChatPhoto, readChat } from '@/lib/whatsapp';

/**
 * Importar las fotos de un chat de WhatsApp a «Nuestra historia»: se sube el
 * .zip de «Exportar chat», salen las fotos por años con quién las mandó, se
 * eligen las que valen y se guardan como recuerdos en su fecha.
 */
export default function Importar() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const theme = useTheme();
  const { group, addMoment, user, me } = useStore();
  const g = group(groupId);
  const [stage, setStage] = useState<'pick' | 'reading' | 'choose' | 'saving' | 'done'>('pick');
  const [chat, setChat] = useState<ChatImport | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [names, setNames] = useState(true);
  // quién es quién: el nombre en WhatsApp → la persona del grupo ('' = nadie de Junti)
  const [who, setWho] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 });
  const input = useRef<HTMLInputElement | null>(null);

  const years = useMemo(() => {
    const m = new Map<number, ChatPhoto[]>();
    for (const p of chat?.photos ?? []) {
      const y = new Date(p.at).getFullYear();
      m.set(y, [...(m.get(y) ?? []), p]);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [chat]);

  if (Platform.OS !== 'web')
    return (
      <Screen>
        <Lead strong="De momento, solo en la versión web.">Ábrela desde el navegador.</Lead>
      </Screen>
    );

  const open = async (file?: File | null) => {
    if (!file) return;
    setNotice('');
    setStage('reading');
    try {
      const c = await readChat(file);
      if (!c.photos.length) {
        setNotice(
          'En ese archivo no hay fotos. Al exportar el chat, elige «Adjuntar archivos» (o «Incluir archivos»).',
        );
        setStage('pick');
        return;
      }
      setChat({ ...c, photos: c.photos.slice(0, 800) });
      // emparejar por nombre (o apodo), sin tildes ni mayúsculas
      const norm = (x: string) =>
        x
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .trim();
      const members = (g?.memberIds ?? []).map((id) => {
        const u = user(id);
        return {
          id,
          keys: [u.name, u.name.split(' ')[0], g?.nicknames[id], u.about?.nickname]
            .filter(Boolean)
            .map((k) => norm(k as string)),
        };
      });
      const guess: Record<string, string> = {};
      for (const sname of c.senders) {
        const n = norm(sname);
        const first = n.split(' ')[0];
        const hit =
          members.find((m) => m.keys.includes(n)) ??
          members.find((m) => m.keys.includes(first)) ??
          (/^(tu|tú|you|yo)$/.test(n) ? members.find((m) => m.id === me) : undefined);
        guess[sname] = hit?.id ?? '';
      }
      setWho(guess);
      setStage('choose');
    } catch {
      setNotice(
        'No se ha podido abrir ese archivo. Tiene que ser el .zip que crea WhatsApp al exportar el chat.',
      );
      setStage('pick');
    }
  };

  const toggle = (name: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return n;
    });
  const toggleYear = (list: ChatPhoto[]) =>
    setPicked((s) => {
      const n = new Set(s);
      const all = list.every((p) => n.has(p.name));
      for (const p of list) {
        if (all) n.delete(p.name);
        else n.add(p.name);
      }
      return n;
    });

  const save = async () => {
    const list = (chat?.photos ?? []).filter((p) => picked.has(p.name));
    setProgress({ done: 0, total: list.length, failed: 0 });
    setStage('saving');
    let failed = 0;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      try {
        const blob = await p.load();
        const uri = URL.createObjectURL(blob);
        // a nombre de quien la mandó (si está en el grupo); si no, su nombre en el texto
        const credited = p.sender ? who[p.sender] || undefined : undefined;
        const text =
          !credited && names && p.sender
            ? p.caption
              ? `${p.caption} — ${p.sender}`
              : `De ${p.sender}`
            : p.caption;
        await addMoment({
          groupId,
          media: { uri, kind: 'photo', mime: blob.type || 'image/jpeg' },
          text: text?.slice(0, 1000),
          rememberedAt: p.at,
          creditedTo: credited,
        });
        URL.revokeObjectURL(uri);
      } catch (e) {
        failed++;
        if (failed === 1) setNotice(errorText(e));
      }
      setProgress({ done: i + 1, total: list.length, failed });
    }
    setStage('done');
  };

  const header = (
    <View style={{ flexDirection: 'row' }}>
      <Button
        compact
        label={stage === 'done' ? 'Cerrar' : 'Cancelar'}
        variant="quiet"
        disabled={stage === 'saving'}
        onPress={() => router.back()}
      />
    </View>
  );

  return (
    <Screen header={header}>
      <input
        ref={(n) => {
          input.current = n;
        }}
        type="file"
        accept=".zip,application/zip"
        style={{ display: 'none' }}
        onChange={(e) => open(e.currentTarget.files?.[0])}
      />
      {stage === 'pick' || stage === 'reading' ? (
        <View style={{ gap: 18 }}>
          <Title>Importar de WhatsApp</Title>
          <Text style={{ color: theme.textSecondary, fontSize: 16, lineHeight: 22 }}>
            Las fotos de un chat de {g?.name ?? 'vuestro grupo'}, a vuestra historia: cada una en su
            fecha y con quién la mandó. Tú eliges cuáles.
          </Text>
          <View style={[styles.box, { backgroundColor: theme.card, boxShadow: theme.shadow }]}>
            <Text style={[styles.h, { color: theme.text }]}>1. Exporta el chat</Text>
            <Text style={[styles.p, { color: theme.text }]}>
              <Text style={styles.b}>iPhone:</Text> abre el chat → toca su nombre arriba →{' '}
              <Text style={styles.b}>Exportar chat</Text> →{' '}
              <Text style={styles.b}>Adjuntar archivos</Text> →{' '}
              <Text style={styles.b}>Guardar en Archivos</Text>.
            </Text>
            <Text style={[styles.p, { color: theme.text }]}>
              <Text style={styles.b}>Android:</Text> abre el chat → <Text style={styles.b}>⋮</Text>{' '}
              → <Text style={styles.b}>Más</Text> → <Text style={styles.b}>Exportar chat</Text> →{' '}
              <Text style={styles.b}>Incluir archivos</Text> → guárdalo en el teléfono.
            </Text>
            <Text style={[styles.h, { color: theme.text, marginTop: 6 }]}>2. Súbelo aquí</Text>
            <Button
              label={stage === 'reading' ? 'Leyendo el chat…' : 'Elegir el archivo .zip'}
              disabled={stage === 'reading'}
              onPress={() => input.current?.click()}
            />
          </View>
          {!!notice && <Text style={{ color: theme.text, fontSize: 15 }}>{notice}</Text>}
          <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 18 }}>
            El chat se lee aquí, en tu teléfono: solo se suben las fotos que elijas. Los mensajes no
            salen de tu dispositivo.
          </Text>
          <Pressable onPress={() => router.push('/compartir-ajustes')}>
            <Text
              style={{ color: theme.textSecondary, fontSize: 14, textDecorationLine: 'underline' }}>
              ¿Solo una foto suelta? Así se comparte desde WhatsApp
            </Text>
          </Pressable>
        </View>
      ) : stage === 'choose' && chat ? (
        <View style={{ gap: 16, paddingBottom: 90 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon icon={FileArchive} size={22} color={theme.text} />
            <Text style={[styles.h, { color: theme.text, flex: 1 }]} numberOfLines={1}>
              {chat.title || 'Chat de WhatsApp'}
            </Text>
          </View>
          <Text style={{ color: theme.textSecondary, fontSize: 15 }}>
            {chat.photos.length} fotos, de {years[0]?.[0]} a {years[years.length - 1]?.[0]}. Toca
            las que quieras guardar.
          </Text>
          {/* quién es quién: cada recuerdo sale a nombre de quien lo mandó */}
          {chat.senders.length > 0 && (
            <View
              style={[
                styles.box,
                { backgroundColor: theme.card, boxShadow: theme.shadow, gap: 12 },
              ]}>
              <Text style={[styles.h, { color: theme.text }]}>¿Quién es quién?</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 14, lineHeight: 19 }}>
                Cada recuerdo saldrá a nombre de quien lo mandó (con «lo importaste tú»).
              </Text>
              {chat.senders.map((sname) => (
                <View key={sname} style={{ gap: 6 }}>
                  <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>
                    «{sname}» en WhatsApp es…
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {[...(g?.memberIds ?? []), ''].map((id) => {
                      const on = (who[sname] ?? '') === id;
                      return (
                        <Pressable
                          key={id || 'nadie'}
                          accessibilityRole="radio"
                          aria-checked={on}
                          onPress={() => setWho((w) => ({ ...w, [sname]: id }))}
                          style={[
                            styles.person,
                            { backgroundColor: on ? theme.accent : theme.soft },
                          ]}>
                          <Text
                            style={{
                              color: on ? theme.onAccent : theme.text,
                              fontSize: 14,
                              fontWeight: '500',
                            }}>
                            {id
                              ? id === me
                                ? 'Yo'
                                : user(id).name.split(' ')[0]
                              : 'No está en Junti'}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
              {chat.senders.some((sname) => !who[sname]) && (
                <Pressable
                  accessibilityRole="switch"
                  aria-checked={names}
                  onPress={() => setNames((v) => !v)}
                  style={[styles.toggle, { backgroundColor: theme.soft }]}>
                  <View
                    style={[
                      styles.check,
                      {
                        backgroundColor: names ? theme.text : 'transparent',
                        borderColor: theme.text,
                      },
                    ]}>
                    {names && <Icon icon={Check} size={14} color={theme.background} />}
                  </View>
                  <Text style={{ color: theme.text, fontSize: 14, flex: 1 }}>
                    A quien no está en Junti, poner su nombre en el texto («De …»)
                  </Text>
                </Pressable>
              )}
            </View>
          )}
          {years.map(([year, list]) => {
            const all = list.every((p) => picked.has(p.name));
            return (
              <View key={year} style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
                  <Text style={{ fontFamily: HandBold, fontSize: 32, color: theme.text }}>
                    {year}
                  </Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 14, flex: 1 }}>
                    {list.length} {list.length === 1 ? 'foto' : 'fotos'}
                  </Text>
                  <Pressable onPress={() => toggleYear(list)}>
                    <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>
                      {all ? 'Quitar todas' : 'Elegir todas'}
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.grid}>
                  {list.map((p) => (
                    <Thumb
                      key={p.name}
                      photo={p}
                      on={picked.has(p.name)}
                      onPress={() => toggle(p.name)}
                    />
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={{ gap: 18, paddingTop: 40, alignItems: 'center' }}>
          <Text
            style={{ fontFamily: HandBold, fontSize: 34, color: theme.text, textAlign: 'center' }}>
            {stage === 'saving'
              ? `Guardando ${progress.done} de ${progress.total}…`
              : `¡Listo! ${progress.done - progress.failed} ${progress.done - progress.failed === 1 ? 'recuerdo' : 'recuerdos'} en vuestra historia`}
          </Text>
          <View style={[styles.bar, { backgroundColor: theme.soft }]}>
            <View
              style={[
                styles.fill,
                {
                  backgroundColor: theme.text,
                  width: `${(progress.done / Math.max(1, progress.total)) * 100}%`,
                },
              ]}
            />
          </View>
          {stage === 'done' && (
            <>
              {progress.failed > 0 && (
                <Text style={{ color: theme.text }}>
                  {progress.failed} no se han podido guardar. {notice}
                </Text>
              )}
              <Button
                label="Ver vuestra historia"
                onPress={() =>
                  router.replace({ pathname: '/group/[id]/memoria', params: { id: groupId } })
                }
              />
            </>
          )}
          {stage === 'saving' && (
            <Text style={{ fontFamily: Hand, fontSize: 20, color: theme.textSecondary }}>
              No cierres la app hasta que termine.
            </Text>
          )}
        </View>
      )}
      {stage === 'choose' && picked.size > 0 && (
        <View style={styles.footer}>
          <Button
            label={`Guardar ${picked.size} ${picked.size === 1 ? 'recuerdo' : 'recuerdos'}`}
            onPress={save}
          />
        </View>
      )}
    </Screen>
  );
}

/** Una miniatura: se descomprime solo cuando se ve. */
function Thumb({ photo, on, onPress }: { photo: ChatPhoto; on: boolean; onPress: () => void }) {
  const theme = useTheme();
  const box = useRef<unknown>(null);
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const el = box.current as unknown as HTMLElement | null;
    if (!el) return;
    let url: string | null = null;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || url) return;
        io.disconnect();
        photo
          .load()
          .then((b) => {
            url = URL.createObjectURL(b);
            setSrc(url);
          })
          .catch(() => {});
      },
      { rootMargin: '300px' },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (url) URL.revokeObjectURL(url);
    };
  }, [photo]);
  return (
    <Pressable
      ref={box as never}
      accessibilityRole="checkbox"
      aria-checked={on}
      accessibilityLabel={`Foto de ${photo.sender ?? 'alguien'}, ${new Date(photo.at).toLocaleDateString('es-ES')}`}
      onPress={onPress}
      style={[styles.thumb, { backgroundColor: theme.soft }]}>
      {src && (
        <img
          src={src}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            opacity: on ? 1 : 0.92,
          }}
        />
      )}
      <View
        style={[
          styles.tick,
          { backgroundColor: on ? theme.accent : 'rgba(0,0,0,.25)', borderColor: '#FFFFFF' },
        ]}>
        {on && <Icon icon={Check} size={14} color="#FFFFFF" />}
      </View>
      {on && (
        <View
          style={[
            StyleSheet.absoluteFill,
            { borderWidth: 3, borderColor: theme.accent, borderRadius: 10 },
          ]}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 20, padding: 18, gap: 10 },
  h: { fontSize: 18, fontWeight: '600' },
  p: { fontSize: 15, lineHeight: 21 },
  b: { fontWeight: '700' },
  person: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  thumb: { width: '31.8%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden' },
  tick: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: { width: '100%', height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 20, alignItems: 'center' },
});
