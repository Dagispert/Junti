// Lo que llega a Junti desde el menú «Compartir» de otra app (WhatsApp sobre
// todo). Dos caminos:
// - Android (la web instalada): el service worker recibe las fotos y el texto
//   y los deja aquí, en el almacén del navegador (IndexedDB).
// - iPhone: un Atajo los sube al buzón del servidor con el código personal;
//   la app los recoge de ahí.
// Al elegir grupo y tipo, se pasan a «Publicar» ya puestos.

import { Platform } from 'react-native';

import { supabase } from './supabase';

export type SharedItem = {
  /** dirección local (blob:) lista para publicar */
  uri: string;
  kind: 'photo' | 'video';
  mime: string;
  name: string;
};
export type Shared = { items: SharedItem[]; text: string; inboxIds: string[] };

const DB = 'junti-compartir';
const STORE = 'pendiente';

function openDb(): Promise<IDBDatabase> {
  return new Promise((ok, ko) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}

/** Lo que dejó el service worker (Android), y lo borra. */
async function takeLocal(): Promise<{ files: File[]; text: string } | null> {
  if (Platform.OS !== 'web' || typeof indexedDB === 'undefined') return null;
  try {
    const db = await openDb();
    const value = await new Promise<{ files: File[]; text: string } | undefined>((ok) => {
      const tx = db.transaction(STORE, 'readwrite');
      const st = tx.objectStore(STORE);
      const get = st.get('ultimo');
      get.onsuccess = () => {
        st.delete('ultimo');
        ok(get.result);
      };
      get.onerror = () => ok(undefined);
    });
    db.close();
    return value ?? null;
  } catch {
    return null;
  }
}

const FN = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/share-inbox`;
async function session() {
  return (await supabase.auth.getSession()).data.session?.access_token;
}

/** Lo que hay en mi buzón del servidor (iPhone). */
async function takeInbox(): Promise<{ files: File[]; text: string; ids: string[] }> {
  const token = await session();
  if (!token) return { files: [], text: '', ids: [] };
  const res = await fetch(FN, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
  if (!res?.ok) return { files: [], text: '', ids: [] };
  const { items } = (await res.json()) as {
    items: { id: string; url?: string; mime?: string; name?: string; text?: string }[];
  };
  const files: File[] = [];
  const texts: string[] = [];
  for (const it of items ?? []) {
    if (it.text) texts.push(it.text);
    else if (it.url) {
      const blob = await fetch(it.url)
        .then((r) => r.blob())
        .catch(() => null);
      if (blob)
        files.push(new File([blob], it.name ?? 'compartido', { type: it.mime ?? blob.type }));
    }
  }
  return { files, text: texts.join('\n\n'), ids: (items ?? []).map((i) => i.id) };
}

/** Vacía el buzón del servidor (ya está guardado). */
export async function clearInbox() {
  const token = await session();
  if (!token) return;
  await fetch(FN, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(
    () => {},
  );
}

/** Todo lo compartido que espera (de los dos caminos), listo para enseñar. */
export async function loadShared(): Promise<Shared> {
  const [local, inbox] = await Promise.all([takeLocal(), takeInbox()]);
  const files = [...(local?.files ?? []), ...inbox.files];
  const text = [local?.text, inbox.text].filter(Boolean).join('\n\n').trim();
  const items: SharedItem[] = files
    .filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'))
    .slice(0, 10)
    .map((f) => ({
      uri: URL.createObjectURL(f),
      kind: f.type.startsWith('video/') ? 'video' : 'photo',
      mime: f.type,
      name: f.name,
    }));
  return { items, text, inboxIds: inbox.ids };
}

// ── El paso a «Publicar»: lo elegido se deja aquí y Publicar lo recoge ──
let pending: Shared | null = null;
export function handOff(s: Shared) {
  pending = s;
}
export function takeHandOff(): Shared | null {
  const s = pending;
  pending = null;
  return s;
}

/**
 * La fecha que WhatsApp pone en el nombre de sus archivos:
 * «IMG-20140703-WA0003.jpg» (Android) o «00000012-PHOTO-2014-07-03-18-22-11.jpg» (iPhone).
 */
export function dateFromWhatsAppName(name: string): number | null {
  let m = /(?:IMG|VID|PTT|AUD)-(\d{4})(\d{2})(\d{2})-WA/i.exec(name);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], 12).getTime();
  m = /(?:PHOTO|VIDEO)-(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})(?:-(\d{2}))?/i.exec(name);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)).getTime();
  return null;
}

// ── El código personal para el Atajo de iPhone ──
export async function shareToken(): Promise<string> {
  const { data } = await supabase.from('share_tokens').select('token').maybeSingle();
  if (data?.token) return data.token as string;
  const abc = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = 'jtk_' + [...bytes].map((b) => abc[b % abc.length]).join('');
  const { error } = await supabase.from('share_tokens').insert({ token });
  if (error) throw error;
  return token;
}
export async function newShareToken(): Promise<string> {
  await supabase.from('share_tokens').delete().neq('token', '');
  return shareToken();
}
export const INBOX_URL = FN;
