// Junti · envío de la propuesta del día
//
// Se ejecuta cada 15 minutos (ver supabase/programar_avisos.sql). Pregunta a la
// base de datos a quién le toca recibir la propuesta del día o un recordatorio
// del calendario, y envía un aviso a cada uno de sus dispositivos. Toda la lógica de «a quién y cuándo» está en la
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

Deno.serve(async () => {
  try {
    const keys = await vapidKeys();
    const { data: proposals, error } = await supabase.rpc('claim_due_notifications');
    if (error) throw error;
    // Recordatorios del calendario (cumpleaños, viajes, reencuentros…).
    const { data: reminders, error: remindersError } = await supabase.rpc('claim_event_reminders');
    if (remindersError) console.error('recordatorios', remindersError.message);
    const due = [
      ...(proposals ?? []).map((n: any) => ({ ...n, body: n.p_title })),
      ...(reminders ?? []).map((n: any) => ({ ...n, p_id: null })),
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
