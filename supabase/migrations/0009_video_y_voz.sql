-- Junti · vídeo corto y notas de voz
--
-- Un momento puede llevar una foto o un vídeo (posición 0) y, además, una nota
-- de voz (posición 1). Del vídeo se guarda también un fotograma de portada; de
-- la voz, su forma de onda para dibujarla sin descargar el audio.

alter table media_assets
  add column mime text,
  add column waveform smallint[] check (waveform is null or array_length(waveform, 1) <= 96);

-- Límite por archivo (el del plan gratuito de Supabase) y solo imágenes, vídeo y audio.
update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['image/*', 'video/*', 'audio/*']
where id = 'media';
