-- Comentarios en los minijuegos (el karaoke, el cuento a trozos…): lo que
-- piensa cada uno cuando ya está terminado.
create table if not exists public.juego_comentarios (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 1000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create index if not exists juego_comentarios_prop on public.juego_comentarios (proposal_id, created_at);
alter table public.juego_comentarios enable row level security;

create or replace function public.proposal_group(p uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select group_id from proposals where id = p;
$$;

drop policy if exists jc_select on public.juego_comentarios;
create policy jc_select on public.juego_comentarios for select to authenticated
  using (is_member(proposal_group(proposal_id)) and (deleted_at is null or user_id = auth.uid()));
drop policy if exists jc_insert on public.juego_comentarios;
create policy jc_insert on public.juego_comentarios for insert to authenticated
  with check (user_id = auth.uid() and is_member(proposal_group(proposal_id)));
drop policy if exists jc_update on public.juego_comentarios;
create policy jc_update on public.juego_comentarios for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- que llegue al momento a los demás (tiempo real)
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'juego_comentarios') then
    alter publication supabase_realtime add table public.juego_comentarios;
  end if;
end $$;
