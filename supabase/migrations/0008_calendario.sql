-- Junti · calendario compartido
--
-- Cumpleaños, aniversarios, viajes, reencuentros y celebraciones del grupo.
-- Los cumpleaños y aniversarios se repiten cada año. Además del calendario en
-- la app, se avisa el mismo día y, para lo que se espera con ganas (viajes,
-- reencuentros, celebraciones), también una semana antes y la víspera.

create type event_kind as enum ('birthday', 'anniversary', 'trip', 'reunion', 'celebration', 'other');

create table events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups (id) on delete cascade,
  created_by uuid default auth.uid() references profiles (id) on delete set null,
  kind event_kind not null default 'other',
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 500),
  place text check (char_length(place) <= 120),
  starts_on date not null,
  ends_on date check (ends_on is null or ends_on >= starts_on),
  yearly boolean not null default false,
  -- De quién es el cumpleaños (opcional).
  person_id uuid references profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index on events (group_id, starts_on);

alter table events enable row level security;
create policy events_select on events for select to authenticated using (is_member(group_id));
create policy events_insert on events for insert to authenticated
  with check (is_member(group_id) and created_by = auth.uid()
    and (person_id is null or exists (
      select 1 from memberships m where m.group_id = events.group_id and m.user_id = person_id and m.status = 'active')));
create policy events_update on events for update to authenticated
  using (created_by = auth.uid() or is_admin(group_id))
  with check (is_member(group_id));
create policy events_delete on events for delete to authenticated
  using (created_by = auth.uid() or is_admin(group_id));

-- ───────────── Recordatorios ─────────────

create table event_reminder_log (
  user_id uuid not null references profiles (id) on delete cascade,
  event_id uuid not null references events (id) on delete cascade,
  day date not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, event_id, day)
);
alter table event_reminder_log enable row level security; -- sin políticas: solo el servidor

/** Fecha en la que cae un evento en el año de «d» (o el siguiente si ya pasó). */
create function event_occurrence(e events, d date) returns date
language plpgsql immutable as $$
declare
  y int := extract(year from d)::int;
  occ date;
begin
  if not e.yearly then
    return e.starts_on;
  end if;
  -- Quien nació un 29 de febrero lo celebra el 28 los años no bisiestos.
  occ := make_date(y, extract(month from e.starts_on)::int,
    least(extract(day from e.starts_on)::int,
      extract(day from (make_date(y, extract(month from e.starts_on)::int, 1) + interval '1 month - 1 day'))::int));
  if occ < d then
    occ := make_date(y + 1, extract(month from e.starts_on)::int,
      least(extract(day from e.starts_on)::int,
        extract(day from (make_date(y + 1, extract(month from e.starts_on)::int, 1) + interval '1 month - 1 day'))::int));
  end if;
  return occ;
end;
$$;

-- Devuelve los recordatorios pendientes ahora y los apunta, para no repetirlos.
create function claim_event_reminders()
returns table (
  sub_id uuid, sub_endpoint text, sub_p256dh text, sub_auth text,
  g_id uuid, g_name text, body text
)
language plpgsql security definer set search_path = public as $$
declare
  r record;
  e events;
  local_ts timestamp;
  d date;
  occ date;
  days int;
  who text;
  msg text;
begin
  for r in
    select m.group_id, m.user_id, m.preferred_hour, g.name, p.timezone
    from memberships m
    join groups g on g.id = m.group_id
    join profiles p on p.id = m.user_id
    where m.status = 'active'
      and (m.muted_until is null or m.muted_until < now())
      and exists (select 1 from push_subscriptions s where s.user_id = m.user_id)
  loop
    begin
      local_ts := now() at time zone r.timezone;
    exception when others then
      local_ts := now() at time zone 'UTC';
    end;
    d := local_ts::date;
    -- A media mañana como pronto, o a su hora preferida si es antes.
    continue when extract(hour from local_ts) < least(10, r.preferred_hour);

    for e in select * from events where group_id = r.group_id loop
      occ := event_occurrence(e, d);
      days := occ - d;
      continue when days not in (0, 1, 7);
      continue when days > 0 and e.kind not in ('trip', 'reunion', 'celebration');
      continue when exists (
        select 1 from event_reminder_log l where l.user_id = r.user_id and l.event_id = e.id and l.day = d
      );
      select name into who from profiles where id = e.person_id;
      msg := case
        when e.kind = 'birthday' and e.person_id = r.user_id then '🎂 ¡Feliz cumpleaños! Hoy el grupo piensa en ti.'
        when e.kind = 'birthday' then '🎂 Hoy es el cumpleaños de ' || coalesce(who, e.title) || '. ¡Felicítale!'
        when e.kind = 'anniversary' then '💞 Hoy: ' || e.title
        when days = 7 then '⏳ Falta una semana: ' || e.title
        when days = 1 then '✨ Mañana: ' || e.title
        when e.kind = 'trip' then '✈️ ¡Hoy empieza ' || e.title || '!'
        when e.kind = 'reunion' then '🫂 ¡Hoy es el reencuentro! ' || e.title
        else '🎉 Hoy: ' || e.title
      end;
      insert into event_reminder_log (user_id, event_id, day) values (r.user_id, e.id, d);
      return query
        select s.id, s.endpoint, s.p256dh, s.auth, r.group_id, r.name, msg
        from push_subscriptions s where s.user_id = r.user_id;
    end loop;
  end loop;
end;
$$;
revoke all on function claim_event_reminders() from public, anon, authenticated;
grant execute on function claim_event_reminders() to service_role;
