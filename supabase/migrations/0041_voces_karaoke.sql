-- Karaoke entre Android y iPhone: Chrome graba la voz en Opus, que el iPhone
-- no sabe decodificar (la voz se quedaba muda en el montaje). Cada toma tiene
-- además su voz en WAV (lo lee cualquier móvil): la sube quien la graba o,
-- para las tomas antiguas, el primer móvil que sí sabe leerla.

create table if not exists public.voces_tomas (
  moment_id uuid primary key references public.moments (id) on delete cascade,
  path text not null,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.voces_tomas enable row level security;

drop policy if exists vt_select on public.voces_tomas;
create policy vt_select on public.voces_tomas for select to authenticated
  using (exists (select 1 from moments m where m.id = moment_id and is_member(m.group_id)));

drop policy if exists vt_insert on public.voces_tomas;
create policy vt_insert on public.voces_tomas for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from moments m
      where m.id = moment_id and is_member(m.group_id)
        and path like m.group_id::text || '/' || auth.uid()::text || '/%'
    )
  );

-- El montaje apunta en qué va su sonido ('aac' lo oye todo el mundo; 'opus', el
-- iPhone no): así un iPhone sabe que tiene que volver a grabarlo.
drop function if exists public.guardar_montaje_karaoke(uuid, text, text, text, numeric, uuid[]);
create or replace function public.guardar_montaje_karaoke(
  p uuid, ruta text, portada text, firma text, duracion numeric, voces uuid[] default null,
  audio text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  select group_id into g from proposals where id = p and game->>'type' = 'karaoke';
  if g is null then raise exception 'no es un karaoke'; end if;
  if not exists (
    select 1 from memberships where group_id = g and user_id = auth.uid() and status = 'active'
  ) then raise exception 'no eres del grupo'; end if;
  if ruta not like g::text || '/%' or (portada is not null and portada not like g::text || '/%') then
    raise exception 'ruta no válida';
  end if;
  update proposals
  set game = jsonb_set(
    game, '{montaje}',
    jsonb_strip_nulls(jsonb_build_object('path', ruta, 'poster', portada, 'firma', firma, 'duracion', duracion,
                       'voces', to_jsonb(coalesce(voces, '{}'::uuid[])), 'at', now(), 'por', auth.uid(),
                       'audio', audio))
  )
  where id = p and coalesce(game->>'cerrado', 'false') <> 'true';
end $$;
grant execute on function public.guardar_montaje_karaoke(uuid, text, text, text, numeric, uuid[], text) to authenticated;
