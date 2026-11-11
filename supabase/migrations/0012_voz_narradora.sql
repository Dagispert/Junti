-- Junti · 0012 · La voz de la narradora
--
-- El audio de cada crónica (leído por una voz de Gemini) se guarda en el
-- almacén «media», en <grupo>/narradora/, y se genera una sola vez.
-- scene_times: segundo en que empieza cada escena, para sincronizar las fotos
-- y los subtítulos con la voz.

alter table narrations
  add column audio_path text,
  add column scene_times jsonb,
  add column audio_duration real;
