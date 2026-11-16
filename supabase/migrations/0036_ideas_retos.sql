-- Retos pensados para cada grupo: la narradora los propone a partir de lo que
-- el grupo va compartiendo. Se guardan unos días para no pedirlos cada vez.
create table if not exists public.reto_ideas (
  group_id uuid primary key references public.groups (id) on delete cascade,
  ideas jsonb not null default '[]',
  generated_at timestamptz not null default now(),
  day date not null default current_date,
  generations_today int not null default 0
);
alter table public.reto_ideas enable row level security;
drop policy if exists "el grupo ve sus ideas" on public.reto_ideas;
create policy "el grupo ve sus ideas" on public.reto_ideas
  for select to authenticated
  using (exists (
    select 1 from public.memberships m
    where m.group_id = reto_ideas.group_id and m.user_id = auth.uid() and m.status = 'active'
  ));
-- solo el servidor (la narradora) las escribe
