-- Junti · 0013 · Avisos de actividad
--
-- Además de la propuesta del día y del calendario, avisos tranquilos de lo
-- que pasa en el grupo:
--   · momentos nuevos (agrupados: un solo aviso por grupo con todos los que haya),
--   · comentarios en tus momentos,
--   · alguien nuevo en el grupo.
-- Nunca te avisa de lo tuyo; respeta el silencio del grupo y tus horas de
-- descanso (lo que llega de noche espera a la mañana, en un solo aviso).
--
-- Los disparadores apuntan cada cosa en una cola; la función send-proposals
-- (cada 5 minutos) recoge lo pendiente con claim_activity() y lo envía.

create table activity_queue (
  id bigserial primary key,
  user_id uuid not null references profiles (id) on delete cascade, -- a quién avisar
  group_id uuid not null references groups (id) on delete cascade,
  kind text not null check (kind in ('moment', 'comment', 'member')),
  actor_id uuid references profiles (id) on delete cascade,
  ref_id uuid, -- el momento o el comentario
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index activity_queue_pendientes on activity_queue (user_id, group_id) where sent_at is null;
alter table activity_queue enable row level security; -- sin políticas: solo el servidor

-- Momento nuevo: a los demás integrantes activos.
create function queue_moment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into activity_queue (user_id, group_id, kind, actor_id, ref_id)
  select m.user_id, new.group_id, 'moment', new.author_id, new.id
  from memberships m
  where m.group_id = new.group_id and m.status = 'active' and m.user_id <> new.author_id;
  return new;
end;
$$;
create trigger moments_queue after insert on moments
  for each row execute function queue_moment();

-- Comentario: a quien publicó el momento (si no es quien comenta y sigue en el grupo).
create function queue_comment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into activity_queue (user_id, group_id, kind, actor_id, ref_id)
  select mo.author_id, mo.group_id, 'comment', new.user_id, new.id
  from moments mo
  join memberships m on m.group_id = mo.group_id and m.user_id = mo.author_id and m.status = 'active'
  where mo.id = new.moment_id and mo.author_id <> new.user_id and mo.deleted_at is null;
  return new;
end;
$$;
create trigger comments_queue after insert on comments
  for each row execute function queue_comment();

-- Alguien entra (o vuelve) al grupo: a los demás. Quien crea el grupo no avisa a nadie.
create function queue_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status <> 'active') then
    insert into activity_queue (user_id, group_id, kind, actor_id)
    select m.user_id, new.group_id, 'member', new.user_id
    from memberships m
    where m.group_id = new.group_id and m.status = 'active' and m.user_id <> new.user_id;
  end if;
  return new;
end;
$$;
create trigger memberships_queue after insert or update of status on memberships
  for each row execute function queue_member();

-- Lo pendiente, ya redactado: un aviso por persona y grupo.
create function claim_activity()
returns table (
  sub_id uuid, sub_endpoint text, sub_p256dh text, sub_auth text,
  g_id uuid, g_name text, body text
)
language plpgsql security definer set search_path = public as $$
declare
  r record;
  local_hour int;
  quiet boolean;
  parts text[];
  n int;
  who text;
  c record;
begin
  -- Lo muy antiguo que nunca se envió (sin dispositivo, o silenciado) se olvida.
  delete from activity_queue where created_at < now() - interval '3 days';

  for r in
    select q.user_id, q.group_id, g.name, p.timezone, m.muted_until, m.quiet_from, m.quiet_to,
           m.status
    from activity_queue q
    join groups g on g.id = q.group_id
    join profiles p on p.id = q.user_id
    left join memberships m on m.group_id = q.group_id and m.user_id = q.user_id
    where q.sent_at is null
      -- un minuto de margen: que el momento termine de subir sus fotos
      and q.created_at < now() - interval '1 minute'
    group by q.user_id, q.group_id, g.name, p.timezone, m.muted_until, m.quiet_from, m.quiet_to,
             m.status
  loop
    -- Ya no está en el grupo, o lo tiene silenciado: no se avisa.
    if r.status is distinct from 'active' or (r.muted_until is not null and r.muted_until > now()) then
      update activity_queue set sent_at = now()
      where user_id = r.user_id and group_id = r.group_id and sent_at is null;
      continue;
    end if;

    -- Horas de descanso: espera a la mañana.
    begin
      local_hour := extract(hour from now() at time zone r.timezone)::int;
    exception when others then
      local_hour := extract(hour from now() at time zone 'UTC')::int;
    end;
    quiet := case
      when r.quiet_from > r.quiet_to then local_hour >= r.quiet_from or local_hour < r.quiet_to
      when r.quiet_from < r.quiet_to then local_hour >= r.quiet_from and local_hour < r.quiet_to
      else false
    end;
    continue when quiet;

    parts := '{}';

    -- Momentos nuevos (de momentos que sigan existiendo).
    select count(*), string_agg(distinct split_part(pr.name, ' ', 1), ', ')
      into n, who
    from activity_queue q
    join moments mo on mo.id = q.ref_id and mo.deleted_at is null
    join profiles pr on pr.id = q.actor_id
    where q.user_id = r.user_id and q.group_id = r.group_id and q.sent_at is null and q.kind = 'moment'
      and q.created_at < now() - interval '1 minute';
    if n > 0 then
      who := regexp_replace(who, ', ([^,]*)$', ' y \1');
      parts := parts || case
        when n = 1 then who || ' ha compartido un momento'
        when position(' y ' in who) = 0 then who || ' ha compartido ' || n || ' momentos'
        else who || ' han compartido ' || n || ' momentos'
      end;
    end if;

    -- Comentarios en tus momentos.
    select count(*), string_agg(distinct split_part(pr.name, ' ', 1), ', ')
      into n, who
    from activity_queue q
    join comments co on co.id = q.ref_id and co.deleted_at is null
    join profiles pr on pr.id = q.actor_id
    where q.user_id = r.user_id and q.group_id = r.group_id and q.sent_at is null and q.kind = 'comment'
      and q.created_at < now() - interval '1 minute';
    if n = 1 then
      select split_part(pr.name, ' ', 1) as name, co.text into c
      from activity_queue q
      join comments co on co.id = q.ref_id
      join profiles pr on pr.id = q.actor_id
      where q.user_id = r.user_id and q.group_id = r.group_id and q.sent_at is null and q.kind = 'comment'
        and q.created_at < now() - interval '1 minute' and co.deleted_at is null
      limit 1;
      parts := parts || (c.name || ' ha comentado tu momento: «' ||
        case when char_length(c.text) > 80 then left(c.text, 79) || '…' else c.text end || '»');
    elsif n > 1 then
      who := regexp_replace(who, ', ([^,]*)$', ' y \1');
      parts := parts || (n || ' comentarios nuevos en tus momentos (' || who || ')');
    end if;

    -- Gente nueva.
    select string_agg(distinct split_part(pr.name, ' ', 1), ', ') into who
    from activity_queue q
    join profiles pr on pr.id = q.actor_id
    join memberships m on m.group_id = q.group_id and m.user_id = q.actor_id and m.status = 'active'
    where q.user_id = r.user_id and q.group_id = r.group_id and q.sent_at is null and q.kind = 'member'
      and q.created_at < now() - interval '1 minute';
    if who is not null then
      parts := parts || (regexp_replace(who, ', ([^,]*)$', ' y \1') ||
        case when position(',' in who) > 0 or position(' y ' in regexp_replace(who, ', ([^,]*)$', ' y \1')) > 0
          then ' se han unido al grupo 👋' else ' se ha unido al grupo 👋' end);
    end if;

    update activity_queue set sent_at = now()
    where user_id = r.user_id and group_id = r.group_id and sent_at is null
      and created_at < now() - interval '1 minute';

    continue when coalesce(array_length(parts, 1), 0) = 0;

    return query
      select s.id, s.endpoint, s.p256dh, s.auth, r.group_id, r.name, array_to_string(parts, ' · ')
      from push_subscriptions s where s.user_id = r.user_id;
  end loop;
end;
$$;
revoke execute on function claim_activity() from public, anon, authenticated;
revoke execute on function queue_moment() from public, anon, authenticated;
revoke execute on function queue_comment() from public, anon, authenticated;
revoke execute on function queue_member() from public, anon, authenticated;
grant execute on function claim_activity() to service_role;
