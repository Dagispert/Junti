-- Junti · 0019 · Comentarios que se pueden corregir o retirar
--
-- Quien escribió un comentario puede editarlo o eliminarlo (la política
-- comments_update ya lo limita a su autor). Al eliminarlo se marca
-- deleted_at y deja de verse para los demás. edited_at dice si se corrigió.

alter table comments add column edited_at timestamptz;
