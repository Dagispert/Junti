-- Junti · 0010 · La narradora
--
-- Un texto escrito por IA que cuenta la semana o el mes del grupo a partir de
-- lo que se compartió. Desactivada por defecto: la activa quien administra el
-- grupo, y cada persona puede pedir que sus momentos no se usen.
--
-- Las narraciones las escribe solo el servidor (función «narrate»); los
-- integrantes del grupo pueden leerlas.

alter table groups
  add column narrative_enabled boolean not null default false,
  add column narrative_style text not null default 'emotivo'
    check (narrative_style in
      ('divertido', 'emotivo', 'familiar', 'romantico', 'nostalgico', 'documental', 'ironico', 'diario'));

-- Si es true, mis momentos no se envían a la IA ni aparecen en la narración.
alter table memberships add column narrative_opt_out boolean not null default false;

create table narrations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups (id) on delete cascade,
  kind text not null check (kind in ('week', 'month', 'year')),
  period_start date not null,
  style text not null,
  title text check (char_length(title) <= 120),
  body text not null check (char_length(body) <= 4000),
  -- Con cuántos momentos se escribió: si cambia, se vuelve a escribir.
  moment_count int not null default 0,
  -- Cuántas versiones se han pedido (límite contra abusos).
  generations int not null default 1,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, kind, period_start)
);

alter table narrations enable row level security;
create policy narrations_select on narrations for select to authenticated using (is_member(group_id));
-- Sin políticas de escritura: solo el servidor.

-- Si alguien cambia de opinión sobre usar sus momentos, o se apaga la
-- narradora, lo ya escrito se borra (se reescribirá sin esa persona).
create function forget_narrations() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'memberships' then
    if new.narrative_opt_out and not old.narrative_opt_out then
      delete from narrations where group_id = new.group_id;
    end if;
  elsif not new.narrative_enabled and old.narrative_enabled then
    delete from narrations where group_id = new.id;
  end if;
  return new;
end;
$$;
create trigger memberships_forget_narrations after update of narrative_opt_out on memberships
  for each row execute function forget_narrations();
create trigger groups_forget_narrations after update of narrative_enabled on groups
  for each row execute function forget_narrations();
