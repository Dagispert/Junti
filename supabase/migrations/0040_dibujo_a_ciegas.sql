-- Dibujo a ciegas: alguien escribe una frase, el siguiente la dibuja, el
-- siguiente describe el dibujo (sin ver la frase), el siguiente dibuja eso…
-- Cada uno solo ve el paso anterior; al terminar se ve cómo fue cambiando.
--
-- Lo que hay en cada paso es secreto hasta el final (lo guarda esta tabla, con
-- su seguridad); en la propuesta solo se apunta quién hizo cada paso y de qué
-- tipo (para los avisos y la tarjeta de Hoy).

create table if not exists public.dibujo_pasos (
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  orden int not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- 'frase' (los pares: 0, 2, 4…) o 'dibujo' (los impares)
  tipo text not null check (tipo in ('frase', 'dibujo')),
  texto text check (texto is null or char_length(texto) between 1 and 160),
  path text,
  created_at timestamptz not null default now(),
  primary key (proposal_id, orden)
);
alter table public.dibujo_pasos enable row level security;

-- Sin mirar la propia tabla desde su política (evita la recursión).
create or replace function public.dibujo_ultimo(p uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(max(orden), -1) from dibujo_pasos where proposal_id = p;
$$;

create or replace function public.dibujo_terminado(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select ends_at <= now() from proposals where id = p), false);
$$;

-- Se ve: lo tuyo, el último paso (para poder seguirlo) y todo al terminar.
drop policy if exists dp_select on public.dibujo_pasos;
create policy dp_select on public.dibujo_pasos for select to authenticated
  using (
    is_member(proposal_group(proposal_id))
    and (user_id = auth.uid() or orden = dibujo_ultimo(proposal_id) or dibujo_terminado(proposal_id))
  );
-- se escribe solo con crear_dibujo y seguir_dibujo

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'dibujo_pasos') then
    alter publication supabase_realtime add table public.dibujo_pasos;
  end if;
end $$;

/** Empezar: la frase de partida y los días que dura. */
create or replace function public.crear_dibujo(g uuid, frase text, dias int default 7)
returns uuid
language plpgsql security definer set search_path = public as $$
declare pid uuid; f text := trim(coalesce(frase, ''));
begin
  if not is_member(g) then raise exception 'no eres del grupo'; end if;
  if char_length(f) < 3 or char_length(f) > 160 then raise exception 'La frase tiene que tener entre 3 y 160 letras'; end if;
  insert into proposals (group_id, kind, title, body, ends_at, created_by, game)
  values (
    g, 'challenge', 'Dibujo a ciegas', 'Frase, dibujo, frase… y a ver cómo acaba',
    now() + make_interval(days => greatest(1, least(coalesce(dias, 7), 30))),
    auth.uid(),
    jsonb_build_object('type', 'dibujo', 'pasos',
      jsonb_build_array(jsonb_build_object('u', auth.uid(), 't', 'f', 'at', now())))
  )
  returning id into pid;
  insert into dibujo_pasos (proposal_id, orden, user_id, tipo, texto)
  values (pid, 0, auth.uid(), 'frase', f);
  return pid;
end $$;

/**
 * Seguir la cadena. «tras» es el paso que se ha visto: si alguien se ha
 * adelantado, no se guarda (y la app enseña el nuevo).
 */
create or replace function public.seguir_dibujo(p uuid, tras int, texto text default null, ruta text default null)
returns int
language plpgsql security definer set search_path = public as $$
declare
  g uuid; fin timestamptz; ult int; autor uuid; t text; n int;
begin
  select group_id, ends_at into g, fin from proposals where id = p and game->>'type' = 'dibujo' for update;
  if g is null then raise exception 'no es un dibujo a ciegas'; end if;
  if not is_member(g) then raise exception 'no eres del grupo'; end if;
  if fin is not null and fin <= now() then raise exception 'Este dibujo a ciegas ya terminó'; end if;
  select orden, user_id into ult, autor from dibujo_pasos where proposal_id = p order by orden desc limit 1;
  if ult is distinct from tras then raise exception 'Alguien se te ha adelantado: mira cómo va ahora'; end if;
  if autor = auth.uid() then raise exception 'El último paso es tuyo: ahora le toca a otra persona'; end if;
  n := ult + 1;
  t := case when n % 2 = 1 then 'dibujo' else 'frase' end;
  if t = 'dibujo' then
    if ruta is null or ruta not like (g::text || '/' || auth.uid()::text || '/%') then raise exception 'falta el dibujo'; end if;
    insert into dibujo_pasos (proposal_id, orden, user_id, tipo, path) values (p, n, auth.uid(), t, ruta);
  else
    if char_length(trim(coalesce(texto, ''))) < 2 then raise exception 'Escribe qué crees que es'; end if;
    insert into dibujo_pasos (proposal_id, orden, user_id, tipo, texto) values (p, n, auth.uid(), t, left(trim(texto), 160));
  end if;
  update proposals
     set game = jsonb_set(game, '{pasos}', coalesce(game->'pasos', '[]'::jsonb) ||
           jsonb_build_array(jsonb_build_object('u', auth.uid(), 't', left(t, 1), 'at', now())))
   where id = p;
  return n;
end $$;

grant execute on function public.crear_dibujo(uuid, text, int) to authenticated;
grant execute on function public.seguir_dibujo(uuid, int, text, text) to authenticated;
