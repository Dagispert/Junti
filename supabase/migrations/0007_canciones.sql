-- Junti · la banda sonora del grupo
--
-- Canciones que el grupo quiere recordar. No se suben archivos de audio (tienen
-- derechos de autor): se guarda la referencia a la canción, su portada, un
-- fragmento de 30 segundos que ofrece el catálogo de iTunes y por qué importa.

create table songs (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups (id) on delete cascade,
  added_by uuid not null default auth.uid() references profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  artist text not null check (char_length(artist) between 1 and 200),
  artwork_url text,
  preview_url text,
  external_url text,
  note text check (char_length(note) <= 280),
  created_at timestamptz not null default now()
);
create index on songs (group_id, created_at desc);

alter table songs enable row level security;
create policy songs_select on songs for select to authenticated using (is_member(group_id));
create policy songs_insert on songs for insert to authenticated
  with check (is_member(group_id) and added_by = auth.uid());
create policy songs_update on songs for update to authenticated
  using (added_by = auth.uid()) with check (added_by = auth.uid() and is_member(group_id));
create policy songs_delete on songs for delete to authenticated
  using (added_by = auth.uid() or is_admin(group_id));
