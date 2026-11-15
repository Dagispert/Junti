import { router, useLocalSearchParams } from 'expo-router';
import { Check, FileArchive, Plus, Scissors } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

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
  const { group, addMoment, addPlan, user, me } = useStore();
  const g = group(groupId);
  const [stage, setStage] = useState<'pick' | 'reading' | 'choose' | 'saving' | 'done'>('pick');
  const [chat, setChat] = useState<ChatImport | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [names, setNames] = useState(true);
  // las publicaciones que saldrán (se pueden unir, separar y juntar en planes)
  const [posts, setPosts] = useState<Post[]>([]);
  const [planTitles, setPlanTitles] = useState<Record<string, string>>({});
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
      const photos = c.photos.slice(0, 800);
      setChat({ ...c, photos });
      setPosts(autoPosts(photos));
      setPlanTitles({});
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

  // ── Unir y separar ──
  const sameDay = (a: number, b: number) =>
    new Date(a).toDateString() === new Date(b).toDateString();
  const fmtDay = (at: number) =>
    new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(at);
  /** Une la publicación i con la siguiente (misma persona: una sola publicación). */
  const mergePosts = (i: number) =>
    setPosts((list) => {
      const a = list[i],
        b = list[i + 1];
      if (!a || !b) return list;
      const merged = { ...a, photos: [...a.photos, ...b.photos].slice(0, 10) };
      return [...list.slice(0, i), merged, ...list.slice(i + 2)];
    });
  /** Junta la publicación i y la siguiente en un mismo plan (de personas distintas). */
  const joinPlan = (i: number) =>
    setPosts((list) => {
      const a = list[i],
        b = list[i + 1];
      if (!a || !b) return list;
      const key = a.plan ?? b.plan ?? `plan-${a.key}`;
      if (!planTitles[key])
        setPlanTitles((t) => ({ ...t, [key]: `El plan del ${fmtDay(a.photos[0].at)}` }));
      return list.map((p) =>
        p === a || p === b || (a.plan && p.plan === a.plan) || (b.plan && p.plan === b.plan)
          ? { ...p, plan: key }
          : p,
      );
    });
  /** Saca del plan las publicaciones desde i+1 (el plan se corta en dos). */
  const splitPlan = (i: number) =>
    setPosts((list) => {
      const key = list[i]?.plan;
      if (!key) return list;
      const fresh = `plan-${list[i + 1].key}`;
      let out = list.map((p, k) => (k > i && p.plan === key ? { ...p, plan: fresh } : p));
      // un plan de una sola publicación ya no es un plan
      for (const k of [key, fresh])
        if (out.filter((p) => p.plan === k).length < 2)
          out = out.map((p) => (p.plan === k ? { ...p, plan: undefined } : p));
      return out;
    });
  /** Corta la publicación i antes de su foto j. */
  const splitPost = (i: number, j: number) =>
    setPosts((list) => {
      const a = list[i];
      if (!a || j <= 0 || j >= a.photos.length) return list;
      const first = { ...a, photos: a.photos.slice(0, j) };
      const second = { ...a, key: `${a.key}-${j}`, photos: a.photos.slice(j) };
      return [...list.slice(0, i), first, second, ...list.slice(i + 1)];
    });
  const togglePost = (post: Post) =>
    setPicked((s) => {
      const n = new Set(s);
      const all = post.photos.every((p) => n.has(p.name));
      for (const p of post.photos) {
        if (all) n.delete(p.name);
        else n.add(p.name);
      }
      return n;
    });

  // lo que se va a guardar: las publicaciones con alguna foto elegida
  const toSave = posts
    .map((p) => ({ ...p, photos: p.photos.filter((x) => picked.has(x.name)) }))
    .filter((p) => p.photos.length);
  const planCount = (key?: string) => (key ? toSave.filter((p) => p.plan === key).length : 0);
  const plansToSave = new Set(toSave.filter((p) => planCount(p.plan) > 1).map((p) => p.plan));

  const save = async () => {
    const list = toSave;
    setProgress({ done: 0, total: list.length, failed: 0 });
    setStage('saving');
    let failed = 0;
    const planIds = new Map<string, string>();
    for (let i = 0; i < list.length; i++) {
      const post = list[i];
      const first = post.photos[0];
      const urls: string[] = [];
      try {
        // el plan (contenedor) se crea con su primera publicación
        let proposalId: string | undefined;
        if (post.plan && plansToSave.has(post.plan)) {
          proposalId = planIds.get(post.plan);
          if (!proposalId) {
            proposalId = await addPlan(
              groupId,
              (planTitles[post.plan] || `El plan del ${fmtDay(first.at)}`).trim(),
              first.at,
            );
            planIds.set(post.plan, proposalId);
          }
        }
        const blobs = await Promise.all(post.photos.map((p) => p.load()));
        const media = blobs.map((b) => {
          const uri = URL.createObjectURL(b);
          urls.push(uri);
          return { uri, kind: 'photo' as const, mime: b.type || 'image/jpeg' };
        });
        // a nombre de quien la mandó (si está en el grupo); si no, su nombre en el texto
        const credited = first.sender ? who[first.sender] || undefined : undefined;
        const caption = post.photos
          .map((p) => p.caption)
          .filter(Boolean)
          .join('\n');
        const text =
          !credited && names && first.sender
            ? caption
              ? `${caption} — ${first.sender}`
              : `De ${first.sender}`
            : caption || undefined;
        await addMoment({
          groupId,
          proposalId,
          media: media[0],
          more: media.slice(1),
          text: text?.slice(0, 1000),
          rememberedAt: first.at,
          creditedTo: credited,
        });
      } catch (e) {
        failed++;
        if (failed === 1) setNotice(errorText(e));
      }
      urls.forEach((u) => URL.revokeObjectURL(u));
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
          <Text style={{ color: theme.textSecondary, fontSize: 14, lineHeight: 19 }}>
            Cada bloque es una publicación. Usa «Unir» para juntar las de la misma persona, o para
            juntar las de varias en un plan; y las tijeras para separar.
          </Text>
          {years.map(([year, list]) => {
            const all = list.every((p) => picked.has(p.name));
            const yearPosts = posts
              .map((post, index) => ({ post, index }))
              .filter(({ post }) => new Date(post.photos[0].at).getFullYear() === year);
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
                {yearPosts.map(({ post, index }, k) => {
                  const next = yearPosts[k + 1]?.post;
                  const prev = yearPosts[k - 1]?.post;
                  const startsPlan = !!post.plan && prev?.plan !== post.plan;
                  const inPlan = !!post.plan;
                  const samePlanNext = !!post.plan && next?.plan === post.plan;
                  const sender = post.photos[0].sender;
                  const credited = sender ? who[sender] : '';
                  const name = credited
                    ? credited === me
                      ? 'Tú'
                      : user(credited).name.split(' ')[0]
                    : (sender ?? 'Alguien');
                  return (
                    <View key={post.key}>
                      {startsPlan && (
                        <View style={[styles.planHead, { borderColor: theme.text }]}>
                          <Text
                            style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '600' }}>
                            PLAN
                          </Text>
                          <TextInput
                            value={planTitles[post.plan!] ?? ''}
                            onChangeText={(t) => setPlanTitles((x) => ({ ...x, [post.plan!]: t }))}
                            placeholder="Ponle nombre: «Viaje a Cádiz»"
                            placeholderTextColor={theme.textSecondary}
                            maxLength={140}
                            style={[styles.planTitle, { color: theme.text }]}
                          />
                        </View>
                      )}
                      <View
                        style={[
                          styles.post,
                          { backgroundColor: theme.card },
                          inPlan && [styles.inPlan, { borderColor: theme.text }],
                          inPlan && !samePlanNext && styles.planEnd,
                        ]}>
                        <Pressable
                          onPress={() => togglePost(post)}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text
                            style={{ color: theme.text, fontSize: 15, fontWeight: '600', flex: 1 }}>
                            {name} ·{' '}
                            {new Date(post.photos[0].at).toLocaleDateString('es-ES', {
                              day: 'numeric',
                              month: 'short',
                            })}{' '}
                            · {post.photos.length} {post.photos.length === 1 ? 'foto' : 'fotos'}
                          </Text>
                          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                            {post.photos.every((p) => picked.has(p.name)) ? 'Quitar' : 'Elegir'}
                          </Text>
                        </Pressable>
                        <View style={styles.grid}>
                          {post.photos.map((p, j) => (
                            <View key={p.name} style={styles.cell}>
                              <Thumb
                                photo={p}
                                on={picked.has(p.name)}
                                onPress={() => toggle(p.name)}
                              />
                              {j > 0 && (
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel="Separar aquí"
                                  onPress={() => splitPost(index, j)}
                                  style={[styles.cut, { backgroundColor: theme.card }]}>
                                  <Icon icon={Scissors} size={13} color={theme.text} />
                                </Pressable>
                              )}
                            </View>
                          ))}
                        </View>
                      </View>
                      {/* entre esta publicación y la siguiente: unir, juntar en un plan o separar */}
                      {next && (
                        <View
                          style={[
                            styles.joint,
                            inPlan &&
                              samePlanNext && [styles.jointInPlan, { borderColor: theme.text }],
                          ]}>
                          {samePlanNext ? (
                            <Pressable
                              onPress={() => splitPlan(index)}
                              style={[styles.pill, { backgroundColor: theme.soft }]}>
                              <Icon icon={Scissors} size={13} color={theme.text} />
                              <Text style={{ color: theme.text, fontSize: 13 }}>
                                Separar del plan
                              </Text>
                            </Pressable>
                          ) : next.photos[0].sender === sender &&
                            sameDay(next.photos[0].at, post.photos[0].at) &&
                            !post.plan &&
                            !next.plan ? (
                            <Pressable
                              onPress={() => mergePosts(index)}
                              style={[styles.pill, { backgroundColor: theme.soft }]}>
                              <Icon icon={Plus} size={13} color={theme.text} />
                              <Text style={{ color: theme.text, fontSize: 13 }}>Unir</Text>
                            </Pressable>
                          ) : (
                            <Pressable
                              onPress={() => joinPlan(index)}
                              style={[styles.pill, { backgroundColor: theme.soft }]}>
                              <Icon icon={Plus} size={13} color={theme.text} />
                              <Text style={{ color: theme.text, fontSize: 13 }}>
                                {next.photos[0].sender === sender
                                  ? 'Unir en un plan'
                                  : 'Juntar en un plan'}
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
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
      {stage === 'choose' && toSave.length > 0 && (
        <View style={styles.footer}>
          <Button
            label={`Guardar ${picked.size} ${picked.size === 1 ? 'foto' : 'fotos'} en ${toSave.length} ${toSave.length === 1 ? 'publicación' : 'publicaciones'}${plansToSave.size ? ` (${plansToSave.size} ${plansToSave.size === 1 ? 'plan' : 'planes'})` : ''}`}
            onPress={save}
          />
        </View>
      )}
    </Screen>
  );
}

type Post = { key: string; photos: ChatPhoto[]; plan?: string };

/**
 * Cómo se agrupan solas: la misma persona, sin que nadie escriba en medio, el
 * mismo día y como mucho una hora entre una foto y la siguiente (hasta 10).
 */
function autoPosts(photos: ChatPhoto[]): Post[] {
  const out: Post[] = [];
  for (const p of photos) {
    const last = out[out.length - 1];
    const prev = last?.photos[last.photos.length - 1];
    if (
      prev &&
      prev.sender === p.sender &&
      prev.run === p.run &&
      new Date(prev.at).toDateString() === new Date(p.at).toDateString() &&
      p.at - prev.at <= 60 * 60_000 &&
      last.photos.length < 10
    )
      last.photos.push(p);
    else out.push({ key: p.name, photos: [p] });
  }
  return out;
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
  cell: { width: '31.8%', aspectRatio: 1 },
  thumb: { width: '100%', height: '100%', borderRadius: 10, overflow: 'hidden' },
  cut: {
    position: 'absolute',
    left: -9,
    top: '50%',
    marginTop: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(0,0,0,.2)',
    zIndex: 2,
  },
  post: { borderRadius: 16, padding: 10, gap: 8 },
  inPlan: { borderLeftWidth: 2, borderRightWidth: 2, borderStyle: 'dashed', borderRadius: 0 },
  planEnd: { borderBottomWidth: 2, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  planHead: {
    borderWidth: 2,
    borderBottomWidth: 0,
    borderStyle: 'dashed',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 10,
    paddingBottom: 4,
    gap: 2,
  },
  planTitle: { fontFamily: Hand, fontSize: 22, padding: 0 },
  joint: { alignItems: 'center', paddingVertical: 6 },
  jointInPlan: { borderLeftWidth: 2, borderRightWidth: 2, borderStyle: 'dashed' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
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
