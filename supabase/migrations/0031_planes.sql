-- Junti · 0031 · Planes: varias publicaciones en un mismo contenedor
--
-- Al importar de WhatsApp, las fotos de varias personas de un mismo plan (un
-- viaje, una cena) se pueden juntar: cada una es su publicación, a nombre de
-- quien la mandó, y todas van en un contenedor con nombre, como los retos.
-- Es una propuesta de tipo «plan», ya cerrada (no pide participar ni avisa).
alter type proposal_kind add value if not exists 'plan';
