-- Junti · almacén privado de fotos y vídeos
--
-- Cada archivo se guarda en  media/<id del grupo>/<id del autor>/<archivo>.
-- La propia ruta decide el permiso: solo los integrantes del grupo pueden leerlo
-- y solo se puede subir a la carpeta de uno mismo dentro de un grupo propio.

insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

create policy media_leer on storage.objects for select to authenticated
  using (
    bucket_id = 'media'
    and public.is_member(((storage.foldername(name))[1])::uuid)
  );

create policy media_subir on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media'
    and public.is_member(((storage.foldername(name))[1])::uuid)
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy media_borrar on storage.objects for delete to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
