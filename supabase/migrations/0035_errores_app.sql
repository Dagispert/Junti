-- Errores de la app: cuando a alguien le falla algo, la app lo apunta aquí para
-- que quien la mantiene lo vea (Ajustes → Errores recientes, o en esta tabla).
-- Nadie más puede leerlos.

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.app_admins enable row level security;
-- sin políticas: solo el servidor la lee (a través de las funciones de abajo)

create table if not exists public.app_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  kind text not null default 'error' check (char_length(kind) <= 20),
  message text not null check (char_length(message) <= 500),
  stack text check (char_length(stack) <= 4000),
  screen text check (char_length(screen) <= 200),
  version text check (char_length(version) <= 40),
  device text check (char_length(device) <= 300),
  fingerprint text not null check (char_length(fingerprint) <= 64)
);
create index if not exists app_errors_created on public.app_errors (created_at desc);
create index if not exists app_errors_fp on public.app_errors (fingerprint, created_at desc);
alter table public.app_errors enable row level security;

drop policy if exists "cualquiera apunta sus errores" on public.app_errors;
create policy "cualquiera apunta sus errores" on public.app_errors
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());
grant insert on public.app_errors to anon, authenticated;

create or replace function public.soy_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_admins where user_id = auth.uid());
$$;
grant execute on function public.soy_admin() to authenticated;

-- Los errores de los últimos días, agrupados por fallo (los más recientes antes).
create or replace function public.errores_recientes(dias int default 14)
returns table (
  fingerprint text, message text, kind text, veces bigint, personas bigint,
  primera timestamptz, ultima timestamptz, screen text, version text, device text, stack text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from app_admins where user_id = auth.uid()) then
    raise exception 'solo para quien mantiene la app';
  end if;
  return query
    select e.fingerprint,
           (array_agg(e.message order by e.created_at desc))[1],
           (array_agg(e.kind order by e.created_at desc))[1],
           count(*),
           count(distinct e.user_id),
           min(e.created_at),
           max(e.created_at),
           (array_agg(e.screen order by e.created_at desc))[1],
           (array_agg(e.version order by e.created_at desc))[1],
           (array_agg(e.device order by e.created_at desc))[1],
           (array_agg(e.stack order by e.created_at desc))[1]
    from app_errors e
    where e.created_at > now() - make_interval(days => greatest(1, least(dias, 90)))
    group by e.fingerprint
    order by max(e.created_at) desc
    limit 100;
end $$;
grant execute on function public.errores_recientes(int) to authenticated;

-- Marcar un fallo como resuelto: se borran sus apariciones (si vuelve, reaparece).
create or replace function public.resolver_error(fp text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from app_admins where user_id = auth.uid()) then
    raise exception 'solo para quien mantiene la app';
  end if;
  delete from app_errors where fingerprint = fp;
end $$;
grant execute on function public.resolver_error(text) to authenticated;

-- No se guardan para siempre: lo de hace más de 90 días se borra solo.
create or replace function public.limpiar_errores_viejos() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if random() < 0.02 then
    delete from app_errors where created_at < now() - interval '90 days';
  end if;
  return null;
end $$;
drop trigger if exists limpiar_errores on public.app_errors;
create trigger limpiar_errores after insert on public.app_errors
  for each statement execute function public.limpiar_errores_viejos();
