-- Versiones de un recuerdo: cada persona del grupo puede añadir a un recuerdo
-- (aunque no lo publicara) cómo lo recuerda ella y sus propias fotos o vídeos.
create table memory_additions (
  id uuid primary key default gen_random_uuid(),
  moment_id uuid not null references moments (id) on delete cascade,
  author_id uuid not null default auth.uid() references profiles (id) on delete cascade,
  text text check (char_length(text) <= 2000),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index memory_additions_moment on memory_additions (moment_id);
alter table memory_additions enable row level security;

create policy memory_additions_select on memory_additions for select to authenticated
  using (is_member(moment_group(moment_id)));
-- Solo en recuerdos (no en los momentos del día a día).
create policy memory_additions_insert on memory_additions for insert to authenticated
  with check (
    author_id = auth.uid()
    and is_member(moment_group(moment_id))
    and exists (select 1 from moments m where m.id = moment_id and m.memory and m.deleted_at is null)
  );
create policy memory_additions_update on memory_additions for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy memory_additions_delete on memory_additions for delete to authenticated
  using (author_id = auth.uid());

-- Las fotos y vídeos de cada versión cuelgan del recuerdo, marcadas con su versión.
alter table moment_media add column addition_id uuid references memory_additions (id) on delete cascade;

drop policy moment_media_insert on moment_media;
create policy moment_media_insert on moment_media for insert to authenticated
  with check (
    exists (select 1 from media_assets a where a.id = media_asset_id and a.owner_id = auth.uid())
    and (
      (addition_id is null
        and exists (select 1 from moments m where m.id = moment_id and m.author_id = auth.uid()))
      or exists (
        select 1 from memory_additions x
        where x.id = addition_id and x.moment_id = moment_media.moment_id and x.author_id = auth.uid()
      )
    )
  );
drop policy moment_media_delete on moment_media;
create policy moment_media_delete on moment_media for delete to authenticated
  using (
    exists (select 1 from moments m where m.id = moment_id and m.author_id = auth.uid())
    or exists (select 1 from memory_additions x where x.id = addition_id and x.author_id = auth.uid())
  );
