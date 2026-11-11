-- Junti · avisos con la propuesta del día
--
-- La decisión de «a quién le toca recibir la propuesta ahora» vive aquí, en la
-- base de datos, y un programa del servidor (functions/send-proposals) se limita
-- a enviar lo que esta función le devuelve.

-- ───────────── Propuesta «del día» ─────────────
-- Cada propuesta diaria pertenece a una fecha, para que quien vive en Madrid y
-- quien vive en México reciban la misma aunque su día empiece a horas distintas.

alter table proposals add column day date;

update proposals p set day = d.day
from (
  select id, (starts_at at time zone 'Europe/Madrid')::date as day,
         row_number() over (
           partition by group_id, (starts_at at time zone 'Europe/Madrid')::date order by starts_at
         ) as n
  from proposals where kind = 'prompt'
) d
where d.id = p.id and d.n = 1;

-- Los retos no tienen día (queda vacío), así que esta regla solo afecta a las propuestas diarias.
create unique index proposals_una_por_dia on proposals (group_id, day);

-- ───────────── Dispositivos suscritos ─────────────

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table push_subscriptions enable row level security;
create policy push_subscriptions_own on push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Registro de avisos enviados: como mucho uno por persona, grupo y día.
create table notification_log (
  user_id uuid not null references profiles (id) on delete cascade,
  group_id uuid not null references groups (id) on delete cascade,
  day date not null,
  proposal_id uuid references proposals (id) on delete set null,
  sent_at timestamptz not null default now(),
  primary key (user_id, group_id, day)
);
alter table notification_log enable row level security; -- sin políticas: solo el servidor

-- Configuración pública (la app la lee) y secretos (solo el servidor).
create table app_config (key text primary key, value text not null);
alter table app_config enable row level security;
create policy app_config_select on app_config for select to authenticated using (true);

create table app_secrets (key text primary key, value text not null);
alter table app_secrets enable row level security; -- sin políticas: solo el servidor

-- ───────────── Biblioteca inicial de propuestas ─────────────

insert into proposal_library (locale, category, kind, title) values
  ('es', 'ahora', 'prompt', '¿Qué estás haciendo ahora mismo?'),
  ('es', 'comida', 'prompt', 'Enséñanos qué estás desayunando'),
  ('es', 'lugar', 'prompt', 'Comparte una foto del lugar donde estás'),
  ('es', 'musica', 'prompt', '¿Qué canción estás escuchando hoy?'),
  ('es', 'semana', 'prompt', '¿Qué ha sido lo mejor de tu semana?'),
  ('es', 'animo', 'prompt', 'Enséñanos algo que te haya hecho sonreír'),
  ('es', 'cultura', 'prompt', '¿Qué estás leyendo o viendo estos días?'),
  ('es', 'lugar', 'prompt', 'Una foto de tu lugar favorito de la ciudad'),
  ('es', 'planes', 'prompt', '¿Qué planes tienes para este fin de semana?'),
  ('es', 'personal', 'prompt', 'Cuéntanos algo que no nos hayas contado todavía'),
  ('es', 'lugar', 'prompt', 'Enséñanos la vista desde tu ventana'),
  ('es', 'comida', 'prompt', '¿Qué has comido hoy?'),
  ('es', 'animo', 'prompt', 'Algo pequeño que te haya alegrado el día'),
  ('es', 'ahora', 'prompt', '¿Qué tienes ahora mismo encima de la mesa?'),
  ('es', 'ahora', 'prompt', 'Una foto de lo que ves justo delante de ti'),
  ('es', 'personal', 'prompt', '¿Qué te ronda la cabeza esta semana?'),
  ('es', 'lugar', 'prompt', 'El cielo desde donde estás ahora'),
  ('es', 'recuerdo', 'prompt', 'Una foto antigua que te guste, y por qué'),
  ('es', 'cultura', 'prompt', 'Recomiéndanos algo: una serie, un libro, un sitio'),
  ('es', 'animo', 'prompt', '¿Qué te apetece muchísimo ahora mismo?');

-- ───────────── ¿A quién le toca ahora? ─────────────
-- Devuelve los avisos pendientes y los deja apuntados como enviados, de modo que
-- llamarla dos veces seguidas no repite nada. Reglas:
--   · solo los días de la frecuencia del grupo, según el día LOCAL de cada persona;
--   · a partir de su hora preferida, en SU zona horaria;
--   · no si tiene el grupo silenciado, ni si ya respondió o apartó la propuesta;
--   · como mucho 2 propuestas al día por persona entre todos sus grupos.

create function claim_due_notifications()
returns table (
  sub_id uuid, sub_endpoint text, sub_p256dh text, sub_auth text,
  g_id uuid, g_name text, p_id uuid, p_title text
)
language plpgsql security definer set search_path = public as $$
declare
  r record;
  local_ts timestamp;
  d date;
  pid uuid;
  ptitle text;
begin
  for r in
    select m.group_id, m.user_id, m.preferred_hour, g.name, g.cadence_days, p.timezone
    from memberships m
    join groups g on g.id = m.group_id
    join profiles p on p.id = m.user_id
    where m.status = 'active'
      and (m.muted_until is null or m.muted_until < now())
      and exists (select 1 from push_subscriptions s where s.user_id = m.user_id)
    order by m.joined_at
  loop
    begin
      local_ts := now() at time zone r.timezone;
    exception when others then
      local_ts := now() at time zone 'UTC'; -- zona horaria desconocida
    end;
    d := local_ts::date;

    continue when not (extract(isodow from local_ts)::int = any (r.cadence_days));
    continue when extract(hour from local_ts) < r.preferred_hour;
    continue when exists (
      select 1 from notification_log l
      where l.user_id = r.user_id and l.group_id = r.group_id and l.day = d
    );
    continue when (
      select count(*) from notification_log l where l.user_id = r.user_id and l.day = d
    ) >= 2;

    -- La propuesta de ese día para el grupo; si aún no existe, se elige una de la
    -- biblioteca, prefiriendo las que el grupo todavía no ha tenido.
    pid := null;
    select pr.id, pr.title into pid, ptitle
    from proposals pr where pr.group_id = r.group_id and pr.kind = 'prompt' and pr.day = d;
    if pid is null then
      insert into proposals (group_id, kind, title, day, library_id, created_by)
      select r.group_id, 'prompt', lib.title, d, lib.id, null
      from proposal_library lib
      where lib.kind = 'prompt' and lib.locale = 'es'
      order by exists (
        select 1 from proposals used where used.group_id = r.group_id and used.library_id = lib.id
      ), random()
      limit 1
      on conflict do nothing
      returning id, title into pid, ptitle;
    end if;
    continue when pid is null;

    insert into notification_log (user_id, group_id, day, proposal_id)
    values (r.user_id, r.group_id, d, pid);

    -- Si ya respondió o la apartó, queda apuntado pero no se le molesta.
    continue when exists (
      select 1 from moments mo where mo.proposal_id = pid and mo.author_id = r.user_id
    ) or exists (
      select 1 from proposal_states st where st.proposal_id = pid and st.user_id = r.user_id
    );

    return query
      select s.id, s.endpoint, s.p256dh, s.auth, r.group_id, r.name, pid, ptitle
      from push_subscriptions s where s.user_id = r.user_id;
  end loop;
end;
$$;
revoke all on function claim_due_notifications() from public, anon, authenticated;
grant execute on function claim_due_notifications() to service_role;
