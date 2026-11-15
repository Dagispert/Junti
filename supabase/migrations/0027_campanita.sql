-- Junti · 0027 · La campanita
--
-- En lo que pide la participación de los demás (retos, propuestas, encuestas,
-- quiz y preguntas abiertas) hay una campanita: avisa a quienes aún no han
-- participado («Diego te recuerda el reto «…» 🔔»). Nunca a quien la toca;
-- una vez cada 12 horas por persona y publicación; con las mismas reglas que
-- el resto de avisos (silencio y horas de descanso).

alter table activity_queue drop constraint activity_queue_kind_check;
alter table activity_queue add constraint activity_queue_kind_check
  check (kind in ('moment', 'memory', 'comment', 'member', 'challenge', 'question', 'version', 'reply', 'nudge'));

-- Toca la campanita: devuelve a cuántas personas se avisa.
create or replace function nudge(target uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  gid uuid;
  is_open boolean;
  sent int;
  owner uuid;
begin
  if me is null then raise exception 'Hay que iniciar sesión'; end if;
  select p.group_id, (p.ends_at is null or p.ends_at > now()), p.created_by into gid, is_open, owner
  from proposals p where p.id = target;
  if gid is null then
    select q.group_id, (q.closes_at is null or q.closes_at > now()), q.created_by into gid, is_open, owner
    from questions q where q.id = target;
  end if;
  if gid is null or not is_member(gid) then raise exception 'No encontrado'; end if;
  if not is_open then raise exception 'Ya ha terminado'; end if;
  if exists (
    select 1 from activity_queue
    where kind = 'nudge' and actor_id = me and ref_id = target and created_at > now() - interval '12 hours'
  ) then
    raise exception 'Ya lo has recordado hace poco';
  end if;
  -- solo a quien aún no ha participado (nunca a quien toca la campanita ni a quien lo creó)
  insert into activity_queue (user_id, group_id, kind, actor_id, ref_id)
  select m.user_id, gid, 'nudge', me, target
  from memberships m
  where m.group_id = gid and m.status = 'active' and m.user_id <> me
    and m.user_id is distinct from owner
    and not exists (select 1 from moments mo where mo.proposal_id = target and mo.author_id = m.user_id and mo.deleted_at is null)
    and not exists (select 1 from question_answers a where a.question_id = target and a.user_id = m.user_id);
  get diagnostics sent = row_count;
  return sent;
end;
$$;
revoke execute on function nudge(uuid) from public, anon;
grant execute on function nudge(uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.claim_activity()
 RETURNS TABLE(sub_id uuid, sub_endpoint text, sub_p256dh text, sub_auth text, g_id uuid, g_name text, body text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    -- Versiones nuevas de tus recuerdos (de quien añadió la suya).
    select count(*), names_list(string_agg(distinct split_part(pr.name, ' ', 1), ', '))
      into n, who
    from activity_queue q
    join memory_additions ad on ad.id = q.ref_id
    join profiles pr on pr.id = q.actor_id
    where q.user_id = r.user_id and q.group_id = r.group_id and q.sent_at is null and q.kind = 'version'
      and q.created_at < cutoff;
    if n = 1 then
      select split_part(pr.name, ' ', 1) as name, mo.text into c
      from activity_queue q
      join memory_additions ad on ad.id = q.ref_id
      join moments mo on mo.id = ad.moment_id
      join profiles pr on pr.id = q.actor_id
      where q.user_id = r.user_id and q.group_id = r.group_id and q.sent_at is null and q.kind = 'version'
        and q.created_at < cutoff
      limit 1;
      parts := parts || (c.name || ' ha añadido su versión de tu recuerdo' ||
        case when coalesce(c.text, '') = '' then ''
          else ' «' || case when char_length(c.text) > 60 then left(c.text, 59) || '…' else c.text end || '»'
        end);
    elsif n > 1 then
      parts := parts || (who || case when position(' y ' in who) > 0 then ' han' else ' ha' end ||
        ' añadido su versión de ' || n || ' de tus recuerdos');
    end if;

    -- Respuestas a tus comentarios.
    select count(*), names_list(string_agg(distinct split_part(pr.name, ' ', 1), ', '))
      into n, who
    from activity_queue q
    join comments co on co.id = q.ref_id and co.deleted_at is null
    join profiles pr on pr.id = q.actor_id
    where q.user_id = r.user_id and q.group_id = r.group_id and q.sent_at is null and q.kind = 'reply'
      and q.created_at < cutoff;
    if n = 1 then
      select split_part(pr.name, ' ', 1) as name, co.text into c
      from activity_queue q
      join comments co on co.id = q.ref_id
      join profiles pr on pr.id = q.actor_id
      where q.user_id = r.user_id and q.group_id = r.group_id and q.sent_at is null and q.kind = 'reply'
        and q.created_at < cutoff and co.deleted_at is null
      limit 1;
      parts := parts || (c.name || ' ha respondido a tu comentario: «' ||
        case when char_length(c.text) > 80 then left(c.text, 79) || '…' else c.text end || '»');
    elsif n > 1 then
      parts := parts || (n || ' respuestas a tus comentarios (' || who || ')');
    end if;

    -- Recordatorios con la campanita: «Diego te recuerda el reto «…» 🔔».
    for c in
      select split_part(pr.name, ' ', 1) as name,
             coalesce(pp.title, qq.title) as title,
             case when pp.id is not null then (case pp.kind when 'challenge' then 'el reto' else 'la propuesta' end)
                  else (case qq.kind when 'poll' then 'la encuesta' when 'quiz' then 'el quiz' else 'la pregunta' end) end as what
      from activity_queue q
      join profiles pr on pr.id = q.actor_id
      left join proposals pp on pp.id = q.ref_id
      left join questions qq on qq.id = q.ref_id
      where q.user_id = r.user_id and q.group_id = r.group_id and q.sent_at is null and q.kind = 'nudge'
        and q.created_at < cutoff and (pp.id is not null or qq.id is not null)
      order by q.created_at
      limit 2
    loop
      parts := parts || (c.name || ' te recuerda ' || c.what || ' «' ||
        case when char_length(c.title) > 70 then left(c.title, 69) || '…' else c.title end || '» 🔔');
    end loop;

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
$function$;
