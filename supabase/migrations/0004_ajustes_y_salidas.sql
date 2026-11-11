-- Junti · ajustes personales y de grupo
--
-- 1. Almacén privado para las fotos de perfil.
-- 2. Salir de un grupo de forma ordenada (el grupo nunca se queda sin administrador).
-- 3. Borrar la cuenta propia desde la app.

-- ───────────── 1. Fotos de perfil ─────────────
-- Ruta: avatars/<id del usuario>/<archivo>. La ve su dueño y quien comparte grupo con él.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

create policy avatars_leer on storage.objects for select to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.shares_group_with(((storage.foldername(name))[1])::uuid)
    )
  );

create policy avatars_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ───────────── 2. Salir de un grupo ─────────────

-- Uso interno: no se puede llamar desde la app (ver «revoke» más abajo).
create function leave_group_internal(g uuid, u uuid, remove_moments boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from memberships where group_id = g and user_id = u and status = 'active'
  ) then
    return;
  end if;

  -- La persona decide si sus momentos se quedan en la memoria del grupo o se retiran.
  if remove_moments then
    update moments set deleted_at = now()
    where group_id = g and author_id = u and deleted_at is null;
  end if;

  -- Si era la única administradora, hereda el cargo quien lleve más tiempo en el grupo.
  if not exists (
    select 1 from memberships
    where group_id = g and status = 'active' and role = 'admin' and user_id <> u
  ) then
    update memberships set role = 'admin'
    where group_id = g
      and user_id = (
        select user_id from memberships
        where group_id = g and status = 'active' and user_id <> u
        order by joined_at
        limit 1
      );
  end if;

  update memberships set status = 'left', left_at = now()
  where group_id = g and user_id = u;

  -- Un grupo sin nadie no puede verlo nadie: se elimina.
  if not exists (select 1 from memberships where group_id = g and status = 'active') then
    delete from groups where id = g;
  end if;
end;
$$;
revoke all on function leave_group_internal(uuid, uuid, boolean) from public, anon, authenticated;

create function leave_group(g uuid, remove_moments boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Hay que iniciar sesión';
  end if;
  perform leave_group_internal(g, auth.uid(), remove_moments);
end;
$$;

-- ───────────── 3. Borrar mi cuenta ─────────────
-- Sale de todos sus grupos (traspasando la administración si hace falta) y elimina
-- la cuenta; con ella desaparecen su perfil, sus momentos, comentarios y reacciones.

create function delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  g uuid;
begin
  if me is null then
    raise exception 'Hay que iniciar sesión';
  end if;
  for g in select group_id from memberships where user_id = me and status = 'active' loop
    perform leave_group_internal(g, me, false);
  end loop;
  delete from auth.users where id = me;
end;
$$;
revoke all on function delete_my_account() from public, anon;
grant execute on function delete_my_account() to authenticated;
revoke all on function leave_group(uuid, boolean) from public, anon;
grant execute on function leave_group(uuid, boolean) to authenticated;

-- ───────────── 4. Volver a un grupo del que se salió ─────────────
-- Corrige join_group: quien había salido no podía volver a entrar con una invitación.

create or replace function join_group(invite_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  inv invitations;
  added int;
begin
  if auth.uid() is null then
    raise exception 'Hay que iniciar sesión';
  end if;

  select * into inv from invitations where code = invite_code for update;
  if inv.id is null or inv.revoked_at is not null or inv.expires_at < now() or inv.uses >= inv.max_uses then
    raise exception 'Invitación no válida o caducada';
  end if;

  if exists (
    select 1 from memberships
    where group_id = inv.group_id and user_id = auth.uid() and status = 'removed'
  ) then
    raise exception 'No puedes volver a unirte a este grupo';
  end if;

  delete from memberships
  where group_id = inv.group_id and user_id = auth.uid() and status = 'left';

  insert into memberships (group_id, user_id) values (inv.group_id, auth.uid())
  on conflict (group_id, user_id) do nothing;
  get diagnostics added = row_count;

  if added > 0 then
    update invitations set uses = uses + 1 where id = inv.id;
  end if;
  return inv.group_id;
end;
$$;
