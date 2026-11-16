-- Tiempo real: la app se entera al momento de lo nuevo (momentos, comentarios,
-- reacciones, preguntas…) sin tener que cerrarla y abrirla. Cada persona solo
-- recibe los cambios de filas que puede ver (las mismas reglas de acceso).
do $$
declare t text;
begin
  foreach t in array array[
    'moments', 'moment_media', 'comments', 'reactions', 'questions',
    'question_answers', 'events', 'songs', 'memberships', 'memory_additions',
    'albums', 'album_moments', 'proposals', 'proposal_states', 'groups',
    'group_origins', 'profiles', 'notif_reads'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
