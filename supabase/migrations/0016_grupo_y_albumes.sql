-- Junti · 0016 · Personalizar el grupo y álbumes
--
-- · El grupo puede tener una foto de portada (en el almacén «media», en su
--   carpeta) y una pegatina (un emoji) que lo representa en las historias.
--   El color ya existía. Solo quien administra lo cambia (política de groups).
-- · Álbumes temáticos dentro del grupo («Viaje a Roma»): cualquiera del grupo
--   crea un álbum y añade momentos del grupo; quien lo creó o quien administra
--   lo borra.

-- (cover_path ya existía desde el esquema inicial.)
alter table groups add column sticker text check (char_length(sticker) <= 16);

create table albums (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups (id) on delete cascade,
  created_by uuid default auth.uid() references profiles (id) on delete set null,
  title text not null check (char_length(title) between 1 and 80),
  description text check (char_length(description) <= 300),
  created_at timestamptz not null default now()
);
create index albums_grupo on albums (group_id, created_at desc);

create table album_moments (
  album_id uuid not null references albums (id) on delete cascade,
  moment_id uuid not null references moments (id) on delete cascade,
  added_by uuid default auth.uid() references profiles (id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (album_id, moment_id)
);

create function album_group(a uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select group_id from albums where id = a;
$$;

alter table albums enable row level security;
alter table album_moments enable row level security;

create policy albums_select on albums for select to authenticated using (is_member(group_id));
create policy albums_insert on albums for insert to authenticated
  with check (is_member(group_id) and created_by = auth.uid());
create policy albums_update on albums for update to authenticated
  using (created_by = auth.uid() or is_admin(group_id))
  with check (is_member(group_id));
create policy albums_delete on albums for delete to authenticated
  using (created_by = auth.uid() or is_admin(group_id));

create policy album_moments_select on album_moments for select to authenticated
  using (is_member(album_group(album_id)));
-- Solo momentos del mismo grupo que el álbum.
create policy album_moments_insert on album_moments for insert to authenticated
  with check (
    added_by = auth.uid()
    and is_member(album_group(album_id))
    and moment_group(moment_id) = album_group(album_id)
  );
create policy album_moments_delete on album_moments for delete to authenticated
  using (is_member(album_group(album_id)));
