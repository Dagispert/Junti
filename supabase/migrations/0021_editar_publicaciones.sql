-- Editar lo publicado.
-- 1. El tramo del vídeo que se enseña (no hace falta enseñar el vídeo entero).
alter table media_assets add column clip_start real check (clip_start >= 0);
alter table media_assets add column clip_end real;
alter table media_assets add constraint media_assets_clip_check
  check (clip_end is null or clip_start is null or clip_end > clip_start);

-- 2. Quien hizo una pregunta puede corregirla (la app solo lo deja si nadie ha respondido).
create policy questions_update on questions for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid() and is_member(group_id));
