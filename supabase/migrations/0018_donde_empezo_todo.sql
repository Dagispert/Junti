-- Junti · 0018 · Dónde empezó todo
--
-- El punto de partida del grupo: dónde os conocisteis. No todos tienen por qué
-- haberse conocido igual, así que un grupo puede tener varios comienzos
-- («En el colegio, en Valladolid, 2003»; «Rey llegó de Erasmus en 2012»), y
-- cada uno dice a quién incluye (vacío = a todo el grupo). Cualquiera del
-- grupo puede añadir el suyo.
--
-- groups.roots: de dónde sois, si compartís origen («Todos somos de
-- Valladolid»). Opcional.
--
-- La narradora lo usa para contar la historia desde el principio.

alter table groups add column roots text check (char_length(roots) <= 80);

create table group_origins (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups (id) on delete cascade,
  created_by uuid default auth.uid() references profiles (id) on delete set null,
  place_name text not null check (char_length(place_name) between 1 and 120),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  year smallint check (year between 1900 and 2100),
  story text check (char_length(story) <= 280),
  -- Quiénes se conocieron así. Vacío = todo el grupo.
  member_ids uuid[] not null default '{}' check (cardinality(member_ids) <= 50),
  created_at timestamptz not null default now()
);
create index group_origins_group on group_origins (group_id);
alter table group_origins enable row level security;

create policy group_origins_select on group_origins for select to authenticated
  using (is_member(group_id));
create policy group_origins_insert on group_origins for insert to authenticated
  with check (is_member(group_id) and created_by = auth.uid());
-- Cualquiera del grupo puede corregirlo: es una historia compartida.
create policy group_origins_update on group_origins for update to authenticated
  using (is_member(group_id)) with check (is_member(group_id));
create policy group_origins_delete on group_origins for delete to authenticated
  using (is_member(group_id) and (created_by = auth.uid() or is_admin(group_id)));

grant select, insert, update, delete on group_origins to authenticated;
