-- Junti · 0015 · Recuerdos, retos propios y preguntas
--
-- · Recuerdos: momentos de antes (fotos de hace meses o años) que se guardan
--   en su fecha real. «created_at» es la fecha del recuerdo y «shared_at»
--   cuándo se compartió (para ponerlo en «Hoy» como novedad).
-- · Preguntas para el grupo: encuestas (votar), quiz (adivinar; la respuesta
--   se revela al contestar, sin puntos) y preguntas abiertas (cada uno con su
--   texto). Las respuestas de los demás se ven después de responder tú.
-- · Avisos: recuerdos, retos y preguntas nuevas entran en los avisos de actividad.

alter table moments
  add column memory boolean not null default false,
  add column shared_at timestamptz;
update moments set shared_at = created_at;
alter table moments alter column shared_at set default now(), alter column shared_at set not null;
-- Nada fechado en el futuro.
alter table moments add constraint moments_no_futuro
  check (created_at <= shared_at + interval '1 day');

create type question_kind as enum ('poll', 'quiz', 'open');

create table questions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups (id) on delete cascade,
  created_by uuid not null default auth.uid() references profiles (id) on delete cascade,
  kind question_kind not null,
  title text not null check (char_length(title) between 1 and 200),
  options text[] check (options is null or (cardinality(options) between 2 and 8)),
  closes_at timestamptz,
  created_at timestamptz not null default now(),
  check ((kind = 'open') = (options is null))
);
create index questions_grupo on questions (group_id, created_at desc);

create table question_answers (
  question_id uuid not null references questions (id) on delete cascade,
  user_id uuid not null default auth.uid() references profiles (id) on delete cascade,
  choice smallint,
  text text check (char_length(text) between 1 and 1000),
  created_at timestamptz not null default now(),
  primary key (question_id, user_id),
  check ((choice is null) <> (text is null))
);

-- La respuesta correcta de un quiz, aparte: solo la ve quien lo creó o quien ya respondió.
create table question_keys (
  question_id uuid primary key references questions (id) on delete cascade,
  correct smallint not null
);

create function question_group(q uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select group_id from questions where id = q;
$$;
create function answered(q uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from question_answers where question_id = q and user_id = auth.uid());
$$;
create function asked(q uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from questions where id = q and created_by = auth.uid());
$$;

alter table questions enable row level security;
alter table question_answers enable row level security;
alter table question_keys enable row level security;

create policy questions_select on questions for select to authenticated using (is_member(group_id));
create policy questions_insert on questions for insert to authenticated
  with check (is_member(group_id) and created_by = auth.uid());
create policy questions_delete on questions for delete to authenticated
  using (created_by = auth.uid() or is_admin(group_id));

-- Las respuestas de los demás, solo tras responder (o si la pregunta es tuya).
create policy answers_select on question_answers for select to authenticated
  using (
    is_member(question_group(question_id))
    and (user_id = auth.uid() or answered(question_id) or asked(question_id))
  );
create policy answers_insert on question_answers for insert to authenticated
  with check (
    user_id = auth.uid()
    and is_member(question_group(question_id))
    and exists (
      select 1 from questions q
      where q.id = question_id
        and (q.closes_at is null or q.closes_at > now())
        and (q.kind = 'open') = (text is not null)
        and (q.kind = 'open' or choice between 0 and cardinality(q.options) - 1)
        and not (q.kind = 'quiz' and q.created_by = auth.uid()) -- quien crea el quiz no juega
    )
  );
-- Se puede cambiar el voto o el texto, salvo en un quiz (ya se vio la solución).
create policy answers_update on question_answers for update to authenticated
  using (user_id = auth.uid() and exists (select 1 from questions q where q.id = question_id and q.kind <> 'quiz'))
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from questions q
      where q.id = question_id and q.kind <> 'quiz'
        and (q.kind = 'open') = (text is not null)
        and (q.kind = 'open' or choice between 0 and cardinality(q.options) - 1)
    )
  );

create policy keys_select on question_keys for select to authenticated
  using (is_member(question_group(question_id)) and (asked(question_id) or answered(question_id)));
create policy keys_insert on question_keys for insert to authenticated
  with check (
    asked(question_id)
    and exists (
      select 1 from questions q
      where q.id = question_id and q.kind = 'quiz' and correct between 0 and cardinality(q.options) - 1
    )
  );

-- ───────────── Avisos de actividad ─────────────
alter table activity_queue drop constraint activity_queue_kind_check;
alter table activity_queue add constraint activity_queue_kind_check
  check (kind in ('moment', 'memory', 'comment', 'member', 'challenge', 'question'));

create or replace function queue_moment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into activity_queue (user_id, group_id, kind, actor_id, ref_id)
  select m.user_id, new.group_id, case when new.memory then 'memory' else 'moment' end,
         new.author_id, new.id
  from memberships m
  where m.group_id = new.group_id and m.status = 'active' and m.user_id <> new.author_id;
  return new;
end;
$$;

create function queue_challenge() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'challenge' and new.created_by is not null then
    insert into activity_queue (user_id, group_id, kind, actor_id, ref_id)
    select m.user_id, new.group_id, 'challenge', new.created_by, new.id
    from memberships m
    where m.group_id = new.group_id and m.status = 'active' and m.user_id <> new.created_by;
  end if;
  return new;
end;
$$;
create trigger proposals_queue after insert on proposals
  for each row execute function queue_challenge();

create function queue_question() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into activity_queue (user_id, group_id, kind, actor_id, ref_id)
  select m.user_id, new.group_id, 'question', new.created_by, new.id
  from memberships m
  where m.group_id = new.group_id and m.status = 'active' and m.user_id <> new.created_by;
  return new;
end;
$$;
create trigger questions_queue after insert on questions
  for each row execute function queue_question();

revoke execute on function queue_challenge() from public, anon, authenticated;
revoke execute on function queue_question() from public, anon, authenticated;

-- Lo pendiente, ya redactado: un aviso por persona y grupo (ahora también con
-- recuerdos, retos y preguntas).
create or replace function names_list(names text) returns text
language sql immutable as $$
  select regexp_replace(names, ', ([^,]*)$', ' y \1');
$$;

create or replace function claim_activity()
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
  many boolean;
  first_title text;
  c record;
  cutoff timestamptz := now() - interval '1 minute';
begin
  delete from activity_queue where created_at < now() - interval '3 days';

  for r in
    select q.user_id, q.group_id, g.name, p.timezone, m.muted_until, m.quiet_from, m.quiet_to,
           m.status
    from activity_queue q
    join groups g on g.id = q.group_id
    join profiles p on p.id = q.user_id
    left join memberships m on m.group_id = q.group_id and m.user_id = q.user_id
    where q.sent_at is null and q.created_at < cutoff
    group by q.user_id, q.group_id, g.name, p.timezone, m.muted_until, m.quiet_from, m.quiet_to,
             m.status
  loop
    if r.status is distinct from 'active' or (r.muted_until is not null and r.muted_until > now()) then
      update activity_queue set sent_at = now()
      where user_id = r.user_id and group_id = r.group_id and sent_at is null;
      continue;
    end if;

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

    -- Momentos y recuerdos nuevos (que sigan existiendo).
    for c in select unnest(array['moment', 'memory']) as k loop
      select count(*), names_list(string_agg(distinct split_part(pr.name, ' ', 1), ', '))
        into n, who
      from activity_queue q
      join moments mo on mo.id = q.ref_id and mo.deleted_at is null
      join profiles pr on pr.id = q.actor_id
      where q.user_id = r.user_id and q.group_id = r.group_id and q.sent_at is null
        and q.kind = c.k and q.created_at < cutoff;
      if n > 0 then
        many := position(' y ' in who) > 0;
        parts := parts || (who || case when many then ' han ' else ' ha ' end ||
          case c.k
            when 'moment' then case when n = 1 then 'compartido un momento' else 'compartido ' || n || ' momentos' end
            else case when n = 1 then 'añadido un recuerdo 📼' else 'añadido ' || n || ' recuerdos 📼' end
          end);
      end if;
    end loop;

    -- Retos y preguntas nuevas.
    for c in select unnest(array['challenge', 'question']) as k loop
      select count(*), names_list(string_agg(distinct split_part(pr.name, ' ', 1), ', ')),
             min(coalesce(pp.title, qq.title))
        into n, who, first_title
      from activity_queue q
      join profiles pr on pr.id = q.actor_id
      left join proposals pp on c.k = 'challenge' and pp.id = q.ref_id
      left join questions qq on c.k = 'question' and qq.id = q.ref_id
      where q.user_id = r.user_id and q.group_id = r.group_id and q.sent_at is null
        and q.kind = c.k and q.created_at < cutoff
        and (pp.id is not null or qq.id is not null);
      if n = 1 then
        parts := parts || (who || case c.k when 'challenge' then ' propone un reto: «' else ' pregunta: «' end ||
          case when char_length(first_title) > 70 then left(first_title, 69) || '…' else first_title end || '»');
      elsif n > 1 then
        parts := parts || (n || case c.k when 'challenge' then ' retos nuevos' else ' preguntas nuevas' end || ' (' || who || ')');
      end if;
    end loop;

    -- Comentarios en tus momentos.
    select count(*), names_list(string_agg(distinct split_part(pr.name, ' ', 1), ', '))
      into n, who
    from activity_queue q
    join comments co on co.id = q.ref_id and co.deleted_at is null
    join profiles pr on pr.id = q.actor_id
    where q.user_id = r.user_id and q.group_id = r.group_id and q.sent_at is null and q.kind = 'comment'
      and q.created_at < cutoff;
    if n = 1 then
      select split_part(pr.name, ' ', 1) as name, co.text into c
      from activity_queue q
      join comments co on co.id = q.ref_id
      join profiles pr on pr.id = q.actor_id
      where q.user_id = r.user_id and q.group_id = r.group_id and q.sent_at is null and q.kind = 'comment'
        and q.created_at < cutoff and co.deleted_at is null
      limit 1;
      parts := parts || (c.name || ' ha comentado tu momento: «' ||
        case when char_length(c.text) > 80 then left(c.text, 79) || '…' else c.text end || '»');
    elsif n > 1 then
      parts := parts || (n || ' comentarios nuevos en tus momentos (' || who || ')');
    end if;

    -- Gente nueva.
    select names_list(string_agg(distinct split_part(pr.name, ' ', 1), ', ')) into who
    from activity_queue q
    join profiles pr on pr.id = q.actor_id
    join memberships m on m.group_id = q.group_id and m.user_id = q.actor_id and m.status = 'active'
    where q.user_id = r.user_id and q.group_id = r.group_id and q.sent_at is null and q.kind = 'member'
      and q.created_at < cutoff;
    if who is not null then
      parts := parts || (who || case when position(' y ' in who) > 0
        then ' se han unido al grupo 👋' else ' se ha unido al grupo 👋' end);
    end if;

    update activity_queue set sent_at = now()
    where user_id = r.user_id and group_id = r.group_id and sent_at is null and created_at < cutoff;

    continue when coalesce(array_length(parts, 1), 0) = 0;

    return query
      select s.id, s.endpoint, s.p256dh, s.auth, r.group_id, r.name, array_to_string(parts, ' · ')
      from push_subscriptions s where s.user_id = r.user_id;
  end loop;
end;
$$;
revoke execute on function claim_activity() from public, anon, authenticated;
grant execute on function claim_activity() to service_role;
