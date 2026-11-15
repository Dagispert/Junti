// Junti · el buzón de «Compartir»
//
// POST con el código personal (Authorization: Bearer jtk_…): lo que manda el
// Atajo de iPhone desde el menú de compartir (fotos, vídeos o texto). Se guarda
// en el buzón de esa persona.
// GET con la sesión de la app: lo que hay en mi buzón, con direcciones
// temporales para descargarlo. DELETE ?id=…: quitarlo del buzón (ya guardado).

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

const MAX = 60 * 1024 * 1024; // 60 MB por archivo
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

async function save(user: string, file: Blob, name: string) {
  if (file.size > MAX) throw new Error('El archivo pesa más de 60 MB');
  const type = file.type || 'application/octet-stream';
  // un texto que llega como archivo (el Atajo a veces lo manda así)
  if (type.startsWith('text/')) {
    const text = (await file.text()).trim().slice(0, 4000);
    if (text) await supabase.from('share_inbox').insert({ user_id: user, text });
    return;
  }
  if (!type.startsWith('image/') && !type.startsWith('video/')) return;
  const ext = EXT[type] ?? (name.split('.').pop() || 'bin').toLowerCase().slice(0, 5);
  const path = `buzon/${user}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('media').upload(path, file, { contentType: type });
  if (error) throw error;
  await supabase.from('share_inbox').insert({ user_id: user, storage_path: path, mime: type, name: name.slice(0, 200) });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();

    // ── El Atajo manda algo, con el código personal ──
    if (req.method === 'POST' && token.startsWith('jtk_')) {
      const { data: owner } = await supabase
        .from('share_tokens')
        .select('user_id')
        .eq('token', token)
        .maybeSingle();
      if (!owner) return reply(401, { error: 'Código no válido. Vuelve a copiarlo desde Junti.' });
      const user = owner.user_id as string;
      // como mucho 40 cosas esperando en el buzón
      const { count } = await supabase
        .from('share_inbox')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user);
      if ((count ?? 0) >= 40) return reply(429, { error: 'El buzón está lleno: abre Junti y guarda lo que hay.' });
      const type = req.headers.get('content-type') ?? '';
      let saved = 0;
      if (type.includes('multipart/form-data')) {
        const form = await req.formData();
        for (const [, value] of form.entries()) {
          if (typeof value === 'string') {
            const text = value.trim().slice(0, 4000);
            if (text) {
              await supabase.from('share_inbox').insert({ user_id: user, text });
              saved++;
            }
          } else {
            await save(user, value, value.name || 'archivo');
            saved++;
          }
        }
      } else {
        // el cuerpo entero es el archivo (o el texto)
        const blob = await req.blob();
        await save(user, new Blob([blob], { type: type || blob.type }), 'compartido');
        saved++;
      }
      return reply(200, { ok: true, saved });
    }

    // ── La app, con su sesión ──
    const { data: auth } = await supabase.auth.getUser(token);
    const me = auth?.user?.id;
    if (!me) return reply(401, { error: 'Hay que iniciar sesión' });

    if (req.method === 'GET') {
      const { data: rows } = await supabase
        .from('share_inbox')
        .select('id, storage_path, mime, name, text, created_at')
        .eq('user_id', me)
        .order('created_at');
      const items = await Promise.all(
        (rows ?? []).map(async (r) => {
          if (!r.storage_path) return r;
          const { data } = await supabase.storage.from('media').createSignedUrl(r.storage_path, 3600);
          return { ...r, url: data?.signedUrl ?? null };
        }),
      );
      return reply(200, { items });
    }

    if (req.method === 'DELETE') {
      const id = new URL(req.url).searchParams.get('id');
      const q = supabase.from('share_inbox').select('id, storage_path').eq('user_id', me);
      const { data: rows } = id ? await q.eq('id', id) : await q;
      const paths = (rows ?? []).map((r) => r.storage_path).filter(Boolean) as string[];
      if (paths.length) await supabase.storage.from('media').remove(paths);
      if (rows?.length)
        await supabase
          .from('share_inbox')
          .delete()
          .in(
            'id',
            rows.map((r) => r.id),
          );
      return reply(200, { ok: true });
    }
    return reply(405, { error: 'Método no permitido' });
  } catch (e) {
    return reply(500, { error: e instanceof Error ? e.message : String(e) });
  }
});
