-- El karaoke se queda con su montaje: el vídeo con todas las voces juntas.
-- Al acabarse el tiempo para cantar (o, si no tenía fecha, al acabar el mes),
-- se borran las tomas sueltas y solo queda el montaje.

-- Los karaokes sin fecha se cierran al acabar el mes en que se crearon.
update public.proposals
set ends_at = (date_trunc('month', created_at) + interval '1 month' - interval '1 second')
where game->>'type' = 'karaoke' and ends_at is null;

-- Guardar el montaje (cualquiera del grupo, al verlo entero).
drop function if exists public.guardar_montaje_karaoke(uuid, text, text, text, numeric);
create or replace function public.guardar_montaje_karaoke(
  p uuid, ruta text, portada text, firma text, duracion numeric, voces uuid[] default null
) returns void
language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  select group_id into g from proposals where id = p and game->>'type' = 'karaoke';
  if g is null then raise exception 'no es un karaoke'; end if;
  if not exists (
    select 1 from memberships where group_id = g and user_id = auth.uid() and status = 'active'
  ) then raise exception 'no eres del grupo'; end if;
  -- la ruta tiene que ser del grupo
  if ruta not like g::text || '/%' or (portada is not null and portada not like g::text || '/%') then
    raise exception 'ruta no válida';
  end if;
  update proposals
  set game = jsonb_set(
    game, '{montaje}',
    jsonb_build_object('path', ruta, 'poster', portada, 'firma', firma, 'duracion', duracion,
                       'voces', to_jsonb(coalesce(voces, '{}'::uuid[])), 'at', now(), 'por', auth.uid())
  )
  where id = p and coalesce(game->>'cerrado', 'false') <> 'true';
end $$;
grant execute on function public.guardar_montaje_karaoke(uuid, text, text, text, numeric, uuid[]) to authenticated;
