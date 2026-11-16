-- Junti · 0033 · Centro de notificaciones
--
-- Las notificaciones se calculan en la app a partir de lo que ya carga (nuevas
-- publicaciones, comentarios, reacciones, retos, preguntas, canciones…). Aquí
-- solo se guarda lo que cada persona ya ha visto, para que valga en todos sus
-- dispositivos:
--   · notif_state: cuándo abrió el centro por última vez (el globo de «nuevas»)
--     y cuándo marcó todo como leído.
--   · notif_reads: lo que ya ha abierto (una publicación, un reto, una
--     pregunta…), con la hora: lo que pase después vuelve a contar como nuevo.
create table if not exists notif_state (
  user_id uuid primary key default auth.uid() references profiles (id) on delete cascade,
  seen_at timestamptz,
  read_all_at timestamptz
);
alter table notif_state enable row level security;
create policy notif_state_own on notif_state for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists notif_reads (
  user_id uuid not null default auth.uid() references profiles (id) on delete cascade,
  scope text not null check (char_length(scope) <= 80),
  read_at timestamptz not null default now(),
  primary key (user_id, scope)
);
alter table notif_reads enable row level security;
create policy notif_reads_own on notif_reads for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
