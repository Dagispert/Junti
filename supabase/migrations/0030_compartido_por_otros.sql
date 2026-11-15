-- Junti · 0030 · Lo que llega de WhatsApp, a nombre de quien lo mandó
--
-- Al guardar en Junti algo compartido desde WhatsApp (una foto de Ana en el
-- chat), se puede poner a nombre de Ana: también en los momentos de ahora,
-- no solo en los recuerdos. Siempre alguien del grupo, y siempre se ve quién
-- lo compartió de verdad («lo compartió Diego»). Quien lo sube sigue siendo
-- el dueño, y la persona a cuyo nombre sale puede quitárselo.

create or replace function check_credited() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.credited_to is null or new.credited_to = new.author_id then
    new.credited_to := null;
    return new;
  end if;
  if not exists (
    select 1 from memberships
    where group_id = new.group_id and user_id = new.credited_to and status = 'active'
  ) then
    raise exception 'Esa persona no está en el grupo';
  end if;
  return new;
end;
$$;
