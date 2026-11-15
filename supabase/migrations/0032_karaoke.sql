-- Junti · 0032 · Minijuegos en los retos: el karaoke
--
-- Un reto puede llevar un juego. El karaoke guarda la canción (el fragmento
-- gratuito de Apple o una pista subida al almacén del grupo), el tramo que se
-- canta y, si se quiere, la letra. Cada uno graba su vídeo cantando el tramo
-- entero (es una respuesta normal al reto) y la app los junta al verlo.
alter table proposals add column if not exists game jsonb;
