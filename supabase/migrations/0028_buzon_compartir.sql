-- Junti · 0028 · El buzón de «Compartir»
--
-- Desde WhatsApp (o cualquier app) se puede mandar una foto o un texto a
-- Junti. En Android, la web instalada aparece en el menú de compartir y lo
-- recibe directamente. En iPhone, un Atajo lo sube aquí con el código personal
-- de cada uno y la app lo recoge al abrirse para guardarlo donde toque.

create table share_tokens (
  user_id uuid primary key references profiles (id) on delete cascade default auth.uid(),
  token text not null unique check (token ~ '^jtk_[A-Za-z0-9]{32}$'),
  created_at timestamptz not null default now()
);
alter table share_tokens enable row level security;
create policy share_tokens_select on share_tokens for select to authenticated using (user_id = auth.uid());
create policy share_tokens_insert on share_tokens for insert to authenticated with check (user_id = auth.uid());
create policy share_tokens_update on share_tokens for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy share_tokens_delete on share_tokens for delete to authenticated using (user_id = auth.uid());

create table share_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  -- un archivo (foto o vídeo) o un texto
  storage_path text,
  mime text,
  name text,
  text text check (char_length(text) <= 4000),
  created_at timestamptz not null default now(),
  check ((storage_path is null) <> (text is null))
);
create index share_inbox_user on share_inbox (user_id, created_at desc);
alter table share_inbox enable row level security;
-- se lee y se borra lo propio; solo el servidor escribe
create policy share_inbox_select on share_inbox for select to authenticated using (user_id = auth.uid());
create policy share_inbox_delete on share_inbox for delete to authenticated using (user_id = auth.uid());
