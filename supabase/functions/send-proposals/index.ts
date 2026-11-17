// Junti · envío de la propuesta del día
//
// Se ejecuta cada 5 minutos (ver supabase/programar_avisos.sql). Pregunta a la
// base de datos a quién le toca recibir la propuesta del día o un recordatorio
// del calendario, y envía un aviso a cada uno de sus dispositivos. También envía, agrupados, los
// avisos de actividad (momentos nuevos, comentarios, gente nueva). Toda la lógica de «a quién y cuándo» está en la
// función SQL claim_due_notifications(); aquí solo se envía.
//
// Llamarla de más no hace daño: la base de datos apunta cada aviso y no lo repite.

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// Identifica al remitente ante los servicios de avisos de Apple, Google y Mozilla.
const SUBJECT = 'https://dagispert.github.io/Junti/';

/**
 * Las claves con las que se firman los avisos. Se generan solas la primera vez:
 * la pública queda en app_config (la app la necesita para suscribirse) y la
 * privada en app_secrets, que solo el servidor puede leer.
 */
async function vapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const read = async () => {
    const [pub, priv] = await Promise.all([
      supabase.from('app_config').select('value').eq('key', 'vapid_public').limit(1),
      supabase.from('app_secrets').select('value').eq('key', 'vapid_private').limit(1),
    ]);
    if (pub.error) throw pub.error;
    if (priv.error) throw priv.error;
    return pub.data?.[0] && priv.data?.[0]
      ? { publicKey: pub.data[0].value as string, privateKey: priv.data[0].value as string }
      : null;
  };

  const existing = await read();
  if (existing) return existing;

  const fresh = webpush.generateVAPIDKeys();
  const saved = await supabase
    .from('app_secrets')
    .insert({ key: 'vapid_private', value: fresh.privateKey });
  if (saved.error) {
    // Otra ejecución se adelantó: se usan sus claves.
    const other = await read();
    if (other) return other;
    throw saved.error;
  }
  const published = await supabase
    .from('app_config')
    .upsert({ key: 'vapid_public', value: fresh.publicKey });
  if (published.error) throw published.error;
  return fresh;
}

/** Qué tomas tiene un montaje (igual que en la app: lib/montaje.ts). */
function firmaTomas(ids: string[]): string {
  const txt = [...ids].sort().join(',');
  let h = 5381;
  for (let i = 0; i < txt.length; i++) h = ((h << 5) + h + txt.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

/**
 * Karaokes que ya terminaron: si su montaje (el vídeo con todas las voces)
 * está guardado y tiene todas las tomas, se borran las tomas sueltas y el
 * karaoke se cierra. Si aún no hay montaje, se espera a que alguien lo vea.
 */
async function cerrarKaraokes() {
  const { data: props } = await supabase
    .from('proposals')
    .select('id, game')
    .eq('game->>type', 'karaoke')
    .lt('ends_at', new Date().toISOString())
    .limit(50);
  for (const p of props ?? []) {
    const game = p.game as { cerrado?: boolean; montaje?: { firma: string } };
    if (game.cerrado) continue;
    const { data: tomas } = await supabase
      .from('moments')
      .select('id, author_id, shared_at, moment_media(media_asset_id, media_assets(storage_path, thumb_path))')
      .eq('proposal_id', p.id)
      .is('deleted_at', null);
    // las que cuentan en el montaje: la última de cada persona
    const ultima = new Map<string, { id: string; shared_at: string }>();
    for (const t of tomas ?? []) {
      const prev = ultima.get(t.author_id);
      if (!prev || prev.shared_at < t.shared_at) ultima.set(t.author_id, t);
    }
    const firma = firmaTomas([...ultima.values()].map((t) => t.id));
    if ((tomas ?? []).length && game.montaje?.firma !== firma) continue; // falta grabar el montaje
    const rutas: string[] = [];
    const assets: string[] = [];
    for (const t of tomas ?? [])
      for (const mm of (t.moment_media ?? []) as unknown as {
        media_asset_id: string;
        media_assets: { storage_path: string; thumb_path: string | null } | null;
      }[]) {
        assets.push(mm.media_asset_id);
        if (mm.media_assets?.storage_path) rutas.push(mm.media_assets.storage_path);
        if (mm.media_assets?.thumb_path) rutas.push(mm.media_assets.thumb_path);
      }
    // y la voz en WAV de cada toma (la que se usa para que suene en el iPhone)
    const { data: voces } = await supabase
      .from('voces_tomas')
      .select('path')
      .in('moment_id', (tomas ?? []).map((t) => t.id));
    for (const v of voces ?? []) rutas.push(v.path);
    if (rutas.length) {
      const { error } = await supabase.storage.from('media').remove(rutas);
      if (error) {
        console.error('karaoke: no se borraron los archivos', p.id, error.message);
        continue;
      }
    }
    const ids = (tomas ?? []).map((t) => t.id);
    if (ids.length) {
      await supabase.from('moments').update({ deleted_at: new Date().toISOString() }).in('id', ids);
      await supabase.from('moment_media').delete().in('moment_id', ids);
      await supabase.from('voces_tomas').delete().in('moment_id', ids);
    }
    if (assets.length) await supabase.from('media_assets').delete().in('id', assets);
    await supabase.from('proposals').update({ game: { ...game, cerrado: true } }).eq('id', p.id);
    console.log('karaoke cerrado', p.id, ids.length, 'tomas');
  }
}

Deno.serve(async () => {
  try {
    try {
      await cerrarKaraokes();
    } catch (e) {
      console.error('karaokes', e);
    }
    const keys = await vapidKeys();
    const { data: proposals, error } = await supabase.rpc('claim_due_notifications');
    if (error) throw error;
    // Recordatorios del calendario (cumpleaños, viajes, reencuentros…).
    const { data: reminders, error: remindersError } = await supabase.rpc('claim_event_reminders');
    if (remindersError) console.error('recordatorios', remindersError.message);
    // Actividad del grupo: momentos nuevos, comentarios y gente nueva (agrupados).
    const { data: activity, error: activityError } = await supabase.rpc('claim_activity');
    if (activityError) console.error('actividad', activityError.message);
    // Cumpleaños apuntados en los perfiles.
    const { data: birthdays, error: birthdaysError } = await supabase.rpc('claim_profile_birthdays');
    if (birthdaysError) console.error('cumpleaños', birthdaysError.message);
    const due = [
      ...(proposals ?? []).map((n: any) => ({ ...n, body: n.p_title })),
      ...(reminders ?? []).map((n: any) => ({ ...n, p_id: null })),
      ...(activity ?? []).map((n: any) => ({ ...n, p_id: null })),
      ...(birthdays ?? []).map((n: any) => ({ ...n, p_id: null })),
    ];

    let sent = 0;
    let gone = 0;
    let failed = 0;
    for (const n of due) {
      try {
        await webpush.sendNotification(
          { endpoint: n.sub_endpoint, keys: { p256dh: n.sub_p256dh, auth: n.sub_auth } },
          JSON.stringify({ title: n.g_name, body: n.body, groupId: n.g_id, proposalId: n.p_id }),
          { vapidDetails: { subject: SUBJECT, ...keys }, TTL: 6 * 60 * 60 },
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // El dispositivo ya no existe o retiró el permiso: se olvida.
          await supabase.from('push_subscriptions').delete().eq('id', n.sub_id);
          gone++;
        } else {
          failed++;
          console.error('aviso no enviado', status ?? String(err));
        }
      }
    }
    return Response.json({ sent, gone, failed });
  } catch (err) {
    console.error(err);
    return Response.json({ error: String((err as Error).message ?? err) }, { status: 500 });
  }
});
