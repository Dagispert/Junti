-- Junti · 0017 · Un perfil con más contexto
--
-- Para que el grupo (y la narradora) sepan un poco más de cada persona. Todo
-- es opcional y lo ven solo quienes comparten grupo contigo (política de
-- profiles, sin cambios).
--
-- · nickname: tu apodo. En cada grupo puedes tener otro (memberships.nickname).
-- · voice_gender: cómo hablar de ti en español: 'f' femenino, 'm' masculino,
--   'n' neutro (la narradora lo usa para concordar: «contenta», «contento»…).
-- · Cumpleaños: día y mes; el año solo si quieres compartirlo.
-- · hometown: de dónde eres (además de dónde vives, home_city).
-- · bio: una frase sobre ti. interests: lo que te gusta (hasta 8).

alter table profiles
  add column nickname text check (char_length(nickname) between 1 and 40),
  add column voice_gender text check (voice_gender in ('f', 'm', 'n')),
  add column birth_month smallint check (birth_month between 1 and 12),
  add column birth_day smallint check (birth_day between 1 and 31),
  add column birth_year smallint check (birth_year between 1900 and 2100),
  add column hometown text check (char_length(hometown) <= 80),
  add column bio text check (char_length(bio) <= 160),
  add column interests text[] check (
    interests is null or (cardinality(interests) <= 8 and char_length(array_to_string(interests, '')) <= 400)
  ),
  add constraint profiles_cumple_completo check ((birth_month is null) = (birth_day is null)),
  add constraint profiles_anio_con_cumple check (birth_year is null or birth_month is not null);

alter table memberships
  add column nickname text check (char_length(nickname) between 1 and 40);

-- ───────────── Cumpleaños del perfil en los avisos ─────────────
-- El día del cumpleaños de alguien, los demás de cada grupo que comparte
-- reciben un aviso (y la persona, una felicitación). No se duplica si el
-- grupo ya tiene ese cumpleaños apuntado a mano en el calendario.
create table birthday_reminder_log (
  user_id uuid not null references profiles (id) on delete cascade,
  person_id uuid not null references profiles (id) on delete cascade,
  group_id uuid not null references groups (id) on delete cascade,
  day date not null,
  primary key (user_id, person_id, group_id, day)
);
alter table birthday_reminder_log enable row level security; -- sin políticas: solo el servidor

create function claim_profile_birthdays()
returns table (
  sub_id uuid, sub_endpoint text, sub_p256dh text, sub_auth text,
  g_id uuid, g_name text, body text
)
language plpgsql security definer set search_path = public as $$
declare
  r record;
  b record;
  local_ts timestamp;
  d date;
  bday date;
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
    continue when extract(hour from local_ts) < least(10, r.preferred_hour);

    for b in
      select p.id, p.name, coalesce(mm.nickname, p.nickname, split_part(p.name, ' ', 1)) as call,
             p.voice_gender, p.birth_month, p.birth_day
      from memberships mm
      join profiles p on p.id = mm.user_id
      where mm.group_id = r.group_id and mm.status = 'active' and p.birth_month is not null
    loop
      -- El 29 de febrero se celebra el 28 en los años no bisiestos.
      bday := make_date(
        extract(year from d)::int, b.birth_month,
        least(b.birth_day, extract(day from (make_date(extract(year from d)::int, b.birth_month, 1)
          + interval '1 month - 1 day'))::int));
      continue when bday <> d;
      continue when exists (
        select 1 from events e
        where e.group_id = r.group_id and e.kind = 'birthday' and e.person_id = b.id
      );
      continue when exists (
        select 1 from birthday_reminder_log l
        where l.user_id = r.user_id and l.person_id = b.id and l.group_id = r.group_id and l.day = d
      );
      msg := case
        when b.id = r.user_id then '🎂 Feliz cumpleaños. Hoy el grupo piensa en ti'
        else '🎂 Hoy cumple ' || b.call || '. ' ||
          case b.voice_gender when 'f' then 'Felicítala' when 'm' then 'Felicítalo' else 'Felicítale' end
      end;
      insert into birthday_reminder_log (user_id, person_id, group_id, day)
      values (r.user_id, b.id, r.group_id, d);
      return query
        select s.id, s.endpoint, s.p256dh, s.auth, r.group_id, r.name, msg
        from push_subscriptions s where s.user_id = r.user_id;
    end loop;
  end loop;
end;
$$;
revoke all on function claim_profile_birthdays() from public, anon, authenticated;
grant execute on function claim_profile_birthdays() to service_role;
