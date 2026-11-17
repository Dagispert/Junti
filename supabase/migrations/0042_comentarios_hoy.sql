-- Todo lo que sale en «Hoy» se puede comentar: además de los retos y
-- minijuegos, las canciones de la banda sonora y las preguntas (encuestas,
-- quizzes y preguntas abiertas). Usan la misma tabla de comentarios.

alter table public.juego_comentarios alter column proposal_id drop not null;
alter table public.juego_comentarios
  add column if not exists song_id uuid references public.songs (id) on delete cascade,
  add column if not exists question_id uuid references public.questions (id) on delete cascade;

alter table public.juego_comentarios drop constraint if exists jc_una_cosa;
alter table public.juego_comentarios
  add constraint jc_una_cosa check (num_nonnulls(proposal_id, song_id, question_id) = 1);

create index if not exists juego_comentarios_song on public.juego_comentarios (song_id, created_at);
create index if not exists juego_comentarios_question on public.juego_comentarios (question_id, created_at);

/** El grupo de lo que se comenta (un reto, una canción o una pregunta). */
create or replace function public.comentario_grupo(p uuid, s uuid, q uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select group_id from proposals where id = p),
    (select group_id from songs where id = s),
    (select group_id from questions where id = q)
  );
$$;

drop policy if exists jc_select on public.juego_comentarios;
create policy jc_select on public.juego_comentarios for select to authenticated
  using (is_member(comentario_grupo(proposal_id, song_id, question_id))
         and (deleted_at is null or user_id = auth.uid()));
drop policy if exists jc_insert on public.juego_comentarios;
create policy jc_insert on public.juego_comentarios for insert to authenticated
  with check (user_id = auth.uid() and is_member(comentario_grupo(proposal_id, song_id, question_id)));
