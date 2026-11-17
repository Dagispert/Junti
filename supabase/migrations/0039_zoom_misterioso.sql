-- El zoom misterioso: alguien sube una foto y marca un detalle; los demás lo
-- ven muy ampliado y adivinan qué es. Cada fallo aleja la imagen (5 niveles);
-- cuanto antes se acierta, más puntos. La solución es secreta: solo la
-- comprueba el servidor.

create extension if not exists fuzzystrmatch with schema extensions;

-- La solución (y otras formas de decirlo). Nadie la lee directamente.
create table if not exists public.juego_secretos (
  proposal_id uuid primary key references public.proposals (id) on delete cascade,
  respuesta text not null check (char_length(respuesta) between 1 and 80),
  alternativas text[] not null default '{}'
);
alter table public.juego_secretos enable row level security;
drop policy if exists js_insert on public.juego_secretos;
create policy js_insert on public.juego_secretos for insert to authenticated
  with check (exists (select 1 from proposals p where p.id = proposal_id and p.created_by = auth.uid()));
drop policy if exists js_update on public.juego_secretos;
create policy js_update on public.juego_secretos for update to authenticated
  using (exists (select 1 from proposals p where p.id = proposal_id and p.created_by = auth.uid()));

-- Cómo le va a cada uno (sin lo que escribió: solo si acertó y en qué nivel).
create table if not exists public.juego_respuestas (
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  nivel int not null default 0,
  terminado boolean not null default false,
  acierto boolean not null default false,
  puntos int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (proposal_id, user_id)
);
alter table public.juego_respuestas enable row level security;
drop policy if exists jr_select on public.juego_respuestas;
create policy jr_select on public.juego_respuestas for select to authenticated
  using (is_member(proposal_group(proposal_id)));
-- se escribe solo a través de adivinar_zoom

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'juego_respuestas') then
    alter publication supabase_realtime add table public.juego_respuestas;
  end if;
end $$;

-- Para comparar sin tildes, mayúsculas, signos ni artículos.
create or replace function public.normalizar_respuesta(t text) returns text
language sql immutable as $$
  select trim(regexp_replace(
    regexp_replace(
      translate(lower(coalesce(t, '')), 'áàäâéèëêíìïîóòöôúùüûñç', 'aaaaeeeeiiiioooouuuunc'),
      '[^a-z0-9 ]', ' ', 'g'),
    '^(el|la|los|las|un|una|unos|unas|mi|mis|tu|tus) +', '', 'g'));
$$;

create or replace function public.respuesta_vale(intento text, buena text) returns boolean
language plpgsql immutable set search_path = public, extensions as $$
declare a text := normalizar_respuesta(intento); b text := normalizar_respuesta(buena); tol int;
begin
  a := regexp_replace(a, ' +', ' ', 'g');
  b := regexp_replace(b, ' +', ' ', 'g');
  if a = '' or b = '' then return false; end if;
  if a = b then return true; end if;
  -- que la respuesta esté dentro de lo escrito («es una taza de cafe» vale para «taza»)
  if (' ' || a || ' ') like ('% ' || b || ' %') then return true; end if;
  tol := case when length(b) >= 8 then 2 when length(b) >= 4 then 1 else 0 end;
  return levenshtein(a, b) <= tol;
end $$;

/** Un intento. Devuelve cómo va (y la solución, si ya terminó). */
create or replace function public.adivinar_zoom(p uuid, intento text, rendirse boolean default false)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  g uuid; fin timestamptz; autor uuid; sec juego_secretos; r juego_respuestas; ok boolean := false; alt text;
begin
  select group_id, ends_at, created_by into g, fin, autor from proposals where id = p and game->>'type' = 'zoom';
  if g is null then raise exception 'no es un zoom'; end if;
  if not is_member(g) then raise exception 'no eres del grupo'; end if;
  if autor = auth.uid() then raise exception 'es tu zoom'; end if;
  select * into sec from juego_secretos where proposal_id = p;
  insert into juego_respuestas (proposal_id, user_id) values (p, auth.uid()) on conflict do nothing;
  select * into r from juego_respuestas where proposal_id = p and user_id = auth.uid() for update;
  if not r.terminado and (fin is null or fin > now()) then
    if rendirse then
      update juego_respuestas set terminado = true, nivel = 5, updated_at = now()
        where proposal_id = p and user_id = auth.uid();
    else
      ok := respuesta_vale(intento, sec.respuesta);
      if not ok then
        foreach alt in array sec.alternativas loop
          if respuesta_vale(intento, alt) then ok := true; end if;
        end loop;
      end if;
      if ok then
        update juego_respuestas set terminado = true, acierto = true, puntos = 5 - r.nivel, updated_at = now()
          where proposal_id = p and user_id = auth.uid();
      else
        update juego_respuestas
          set nivel = least(r.nivel + 1, 5), terminado = r.nivel + 1 >= 5, updated_at = now()
          where proposal_id = p and user_id = auth.uid();
      end if;
    end if;
    select * into r from juego_respuestas where proposal_id = p and user_id = auth.uid();
  end if;
  return jsonb_build_object(
    'acierto', ok, 'nivel', r.nivel, 'terminado', r.terminado, 'puntos', r.puntos,
    'respuesta', case when r.terminado or (fin is not null and fin <= now()) then sec.respuesta end
  );
end $$;
grant execute on function public.adivinar_zoom(uuid, text, boolean) to authenticated;

/** La solución: para quien ya terminó, para quien lo creó o cuando se acabó el plazo. */
create or replace function public.solucion_zoom(p uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare g uuid; fin timestamptz; autor uuid; listo boolean;
begin
  select group_id, ends_at, created_by into g, fin, autor from proposals where id = p and game->>'type' = 'zoom';
  if g is null or not is_member(g) then return null; end if;
  select terminado into listo from juego_respuestas where proposal_id = p and user_id = auth.uid();
  if autor = auth.uid() or coalesce(listo, false) or (fin is not null and fin <= now()) then
    return (select respuesta from juego_secretos where proposal_id = p);
  end if;
  return null;
end $$;
grant execute on function public.solucion_zoom(uuid) to authenticated;
