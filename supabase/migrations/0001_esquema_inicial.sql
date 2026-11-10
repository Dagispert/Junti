-- Junti · esquema inicial (alcance del MVP)
-- Ver docs/01-analisis-y-definicion-de-producto.md §9.
--
-- Principio: la privacidad se aplica en la base de datos. Toda tabla tiene
-- seguridad a nivel de fila (RLS) y la regla base es «solo quien tiene una
-- pertenencia activa a un grupo ve lo que hay en ese grupo».

-- ───────────────────────── Tipos ─────────────────────────

create type member_role as enum ('admin', 'member');
create type member_status as enum ('active', 'left', 'removed');
create type proposal_kind as enum ('prompt', 'challenge');
create type proposal_state as enum ('sent', 'snoozed', 'skipped', 'answered');
create type media_kind as enum ('photo', 'video', 'audio');

-- ───────────────────────── Tablas ─────────────────────────

-- Perfil público dentro de los grupos. La cuenta (correo, proveedor) vive en auth.users.
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  avatar_path text,
  timezone text not null default 'Europe/Madrid', -- zona IANA
  home_city text,
  home_country text,
  home_visible boolean not null default true,
  locale text not null default 'es',
  created_at timestamptz not null default now()
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  description text,
  cover_path text,
  color text not null default '#D9663F',
  created_by uuid not null default auth.uid() references profiles (id),
  -- Días de la semana con propuesta (1 = lunes … 7 = domingo). Por defecto, 3 por semana.
  cadence_days smallint[] not null default '{1,3,5}',
  created_at timestamptz not null default now()
);

create table memberships (
  group_id uuid not null references groups (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  role member_role not null default 'member',
  status member_status not null default 'active',
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  -- Preferencias personales, siempre en la hora local del usuario.
  preferred_hour smallint not null default 19 check (preferred_hour between 0 and 23),
  quiet_from smallint not null default 22 check (quiet_from between 0 and 23),
  quiet_to smallint not null default 9 check (quiet_to between 0 and 23),
  muted_until timestamptz,
  -- Voto de frecuencia: propuestas por semana que prefiere esta persona.
  frequency_vote smallint check (frequency_vote between 1 and 7),
  primary key (group_id, user_id)
);
create index on memberships (user_id) where status = 'active';

create table invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups (id) on delete cascade,
  code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  created_by uuid not null default auth.uid() references profiles (id),
  expires_at timestamptz not null default now() + interval '14 days',
  max_uses int not null default 20,
  uses int not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references profiles (id) on delete cascade,
  kind media_kind not null,
  storage_path text not null,
  thumb_path text,
  width int,
  height int,
  duration_s numeric,
  bytes bigint,
  blurhash text,
  created_at timestamptz not null default now()
);

create table proposal_library (
  id uuid primary key default gen_random_uuid(),
  locale text not null default 'es',
  category text not null,
  kind proposal_kind not null,
  title text not null,
  body text
);

-- Propuesta del día o reto: mismo objeto, distinta duración.
create table proposals (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups (id) on delete cascade,
  library_id uuid references proposal_library (id) on delete set null,
  created_by uuid default auth.uid() references profiles (id) on delete set null, -- nulo = sistema
  kind proposal_kind not null,
  title text not null check (char_length(title) between 1 and 140),
  body text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
create index on proposals (group_id, starts_at desc);

create table moments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups (id) on delete cascade,
  author_id uuid not null default auth.uid() references profiles (id) on delete cascade,
  text text check (char_length(text) <= 2000),
  proposal_id uuid references proposals (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Zona horaria del autor al publicar: permite mostrar «08:30 en Ciudad de México».
  author_tz text not null,
  -- Ubicación voluntaria (Fase 2). Nunca se rellena automáticamente.
  place_name text,
  lat double precision,
  lng double precision,
  edited_at timestamptz,
  deleted_at timestamptz
);
create index on moments (group_id, created_at desc) where deleted_at is null;
create index on moments (proposal_id) where proposal_id is not null;

create table moment_media (
  moment_id uuid not null references moments (id) on delete cascade,
  media_asset_id uuid not null references media_assets (id) on delete cascade,
  position smallint not null default 0,
  primary key (moment_id, media_asset_id)
);

create table reactions (
  moment_id uuid not null references moments (id) on delete cascade,
  user_id uuid not null default auth.uid() references profiles (id) on delete cascade,
  emoji text not null check (char_length(emoji) <= 16),
  created_at timestamptz not null default now(),
  primary key (moment_id, user_id, emoji)
);

create table comments (
  id uuid primary key default gen_random_uuid(),
  moment_id uuid not null references moments (id) on delete cascade,
  user_id uuid not null default auth.uid() references profiles (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 1000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on comments (moment_id, created_at);

-- Estado de cada propuesta para cada persona. PRIVADO: nadie puede ver
-- quién ha pospuesto u omitido una propuesta.
create table proposal_states (
  proposal_id uuid not null references proposals (id) on delete cascade,
  user_id uuid not null default auth.uid() references profiles (id) on delete cascade,
  state proposal_state not null,
  snoozed_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (proposal_id, user_id)
);

create table devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references profiles (id) on delete cascade,
  push_token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  last_seen_at timestamptz not null default now()
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references profiles (id) on delete cascade,
  moment_id uuid references moments (id) on delete cascade,
  comment_id uuid references comments (id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  check (num_nonnulls(moment_id, comment_id) = 1)
);

-- ───────────────────────── Funciones ─────────────────────────
-- «security definer» para poder consultar memberships desde las políticas
-- sin que la política de memberships se llame a sí misma.

create function is_member(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships
    where group_id = g and user_id = auth.uid() and status = 'active'
  );
$$;

create function is_admin(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships
    where group_id = g and user_id = auth.uid() and status = 'active' and role = 'admin'
  );
$$;

create function shares_group_with(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships mine
    join memberships theirs using (group_id)
    where mine.user_id = auth.uid() and mine.status = 'active'
      and theirs.user_id = other and theirs.status = 'active'
  );
$$;

create function moment_group(m uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select group_id from moments where id = m and deleted_at is null;
$$;

-- Quien crea un grupo pasa a ser su administrador.
create function add_creator_as_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into memberships (group_id, user_id, role) values (new.id, new.created_by, 'admin');
  return new;
end;
$$;
create trigger groups_add_creator after insert on groups
  for each row execute function add_creator_as_admin();

-- Un miembro puede cambiar sus preferencias y salir del grupo, pero no
-- ascenderse a administrador ni readmitirse; eso solo lo hace un administrador.
create function guard_membership_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or is_admin(old.group_id) then
    return new; -- servidor o administrador
  end if;
  if new.role is distinct from old.role then
    raise exception 'Solo un administrador puede cambiar roles';
  end if;
  if new.status is distinct from old.status and not (old.status = 'active' and new.status = 'left') then
    raise exception 'Cambio de estado no permitido';
  end if;
  return new;
end;
$$;
create trigger memberships_guard before update on memberships
  for each row execute function guard_membership_update();

-- Unirse a un grupo con un código de invitación.
create function join_group(invite_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  inv invitations;
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

  insert into memberships (group_id, user_id) values (inv.group_id, auth.uid())
  on conflict (group_id, user_id) do update set status = 'active', left_at = null, joined_at = now()
    where memberships.status = 'left';

  update invitations set uses = uses + 1 where id = inv.id;
  return inv.group_id;
end;
$$;

-- ───────────────────────── Seguridad a nivel de fila ─────────────────────────

alter table profiles enable row level security;
alter table groups enable row level security;
alter table memberships enable row level security;
alter table invitations enable row level security;
alter table media_assets enable row level security;
alter table proposal_library enable row level security;
alter table proposals enable row level security;
alter table moments enable row level security;
alter table moment_media enable row level security;
alter table reactions enable row level security;
alter table comments enable row level security;
alter table proposal_states enable row level security;
alter table devices enable row level security;
alter table reports enable row level security;

-- Perfiles: me veo a mí y a quienes comparten grupo conmigo. No hay directorio.
create policy profiles_select on profiles for select to authenticated
  using (id = auth.uid() or shares_group_with(id));
create policy profiles_insert on profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Grupos
-- «created_by» hace falta para que quien crea el grupo pueda leer la fila recién
-- insertada: en esa misma sentencia su pertenencia todavía no es visible.
create policy groups_select on groups for select to authenticated
  using (is_member(id) or created_by = auth.uid());
create policy groups_insert on groups for insert to authenticated with check (created_by = auth.uid());
create policy groups_update on groups for update to authenticated
  using (is_admin(id)) with check (is_admin(id));
create policy groups_delete on groups for delete to authenticated using (is_admin(id));

-- Pertenencias: se crean al crear un grupo o con join_group(), nunca directamente.
create policy memberships_select on memberships for select to authenticated using (is_member(group_id));
create policy memberships_update on memberships for update to authenticated
  using (user_id = auth.uid() or is_admin(group_id))
  with check (user_id = auth.uid() or is_admin(group_id));

-- Invitaciones: cualquier miembro puede invitar; revocar, quien la creó o un administrador.
create policy invitations_select on invitations for select to authenticated using (is_member(group_id));
create policy invitations_insert on invitations for insert to authenticated
  with check (is_member(group_id) and created_by = auth.uid());
create policy invitations_update on invitations for update to authenticated
  using (created_by = auth.uid() or is_admin(group_id))
  with check (created_by = auth.uid() or is_admin(group_id));

-- Archivos: los gestiona su dueño; los ve quien puede ver un momento que los contiene.
create policy media_owner on media_assets for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy media_select on media_assets for select to authenticated
  using (exists (
    select 1 from moment_media mm
    where mm.media_asset_id = media_assets.id and is_member(moment_group(mm.moment_id))
  ));

-- Biblioteca de propuestas: lectura para cualquiera con sesión.
create policy library_select on proposal_library for select to authenticated using (true);

-- Propuestas y retos: cualquier miembro puede proponer.
create policy proposals_select on proposals for select to authenticated using (is_member(group_id));
create policy proposals_insert on proposals for insert to authenticated
  with check (is_member(group_id) and created_by = auth.uid());
create policy proposals_update on proposals for update to authenticated
  using (created_by = auth.uid() or is_admin(group_id))
  with check (is_member(group_id));
create policy proposals_delete on proposals for delete to authenticated
  using (created_by = auth.uid() or is_admin(group_id));

-- Momentos: los ve el grupo; solo el autor los edita o elimina.
create policy moments_select on moments for select to authenticated
  using (is_member(group_id) and (deleted_at is null or author_id = auth.uid()));
create policy moments_insert on moments for insert to authenticated
  with check (
    is_member(group_id)
    and author_id = auth.uid()
    and (
      proposal_id is null
      or exists (select 1 from proposals p where p.id = proposal_id and p.group_id = moments.group_id)
    )
  );
create policy moments_update on moments for update to authenticated
  using (author_id = auth.uid() and is_member(group_id))
  with check (author_id = auth.uid() and is_member(group_id));
create policy moments_delete on moments for delete to authenticated using (author_id = auth.uid());

create policy moment_media_select on moment_media for select to authenticated
  using (is_member(moment_group(moment_id)));
create policy moment_media_insert on moment_media for insert to authenticated
  with check (
    exists (select 1 from moments m where m.id = moment_id and m.author_id = auth.uid())
    and exists (select 1 from media_assets a where a.id = media_asset_id and a.owner_id = auth.uid())
  );
create policy moment_media_delete on moment_media for delete to authenticated
  using (exists (select 1 from moments m where m.id = moment_id and m.author_id = auth.uid()));

-- Reacciones y comentarios
create policy reactions_select on reactions for select to authenticated
  using (is_member(moment_group(moment_id)));
create policy reactions_insert on reactions for insert to authenticated
  with check (user_id = auth.uid() and is_member(moment_group(moment_id)));
create policy reactions_delete on reactions for delete to authenticated using (user_id = auth.uid());

create policy comments_select on comments for select to authenticated
  using (is_member(moment_group(moment_id)) and (deleted_at is null or user_id = auth.uid()));
create policy comments_insert on comments for insert to authenticated
  with check (user_id = auth.uid() and is_member(moment_group(moment_id)));
create policy comments_update on comments for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Estado de propuestas y dispositivos: estrictamente personales.
create policy proposal_states_own on proposal_states for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from proposals p where p.id = proposal_id and is_member(p.group_id))
  );
create policy devices_own on devices for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Denuncias: se pueden enviar, no consultar (las revisa el equipo desde el servidor).
create policy reports_insert on reports for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and is_member(coalesce(
      moment_group(moment_id),
      (select moment_group(c.moment_id) from comments c where c.id = comment_id)
    ))
  );
