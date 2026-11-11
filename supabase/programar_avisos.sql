-- Junti · ejecutar el envío de avisos cada 15 minutos
--
-- Se ejecuta UNA vez, a mano, en el SQL Editor, después de desplegar la función
-- «send-proposals». No es una migración: depende de extensiones propias de Supabase.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('junti-propuestas')
where exists (select 1 from cron.job where jobname = 'junti-propuestas');

select cron.schedule(
  'junti-propuestas',
  '*/5 * * * *',
  $$
    select net.http_post(
      url := 'https://ktyagcmczbklsjahgfxx.supabase.co/functions/v1/send-proposals',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);
