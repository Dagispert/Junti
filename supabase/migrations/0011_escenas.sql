-- Junti · 0011 · La narradora por escenas
--
-- La crónica se cuenta en voz alta mientras pasan las fotos: cada escena
-- acompaña a un momento (o a ninguno, si es una frase general).
-- Formato: [{"moment_id": uuid | null, "text": "..."}]

alter table narrations add column scenes jsonb;
