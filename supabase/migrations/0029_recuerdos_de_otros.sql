-- Junti · 0029 · Recuerdos importados, a nombre de quien los mandó
--
-- Al importar un chat de WhatsApp, cada foto se puede poner a nombre de quien
-- la mandó (si está en el grupo). Quien la sube sigue siendo el dueño (la puede
-- editar o borrar) y se ve «importado de WhatsApp por …». Solo en recuerdos y
-- solo con personas del grupo.

alter table moments add column credited_to uuid references profiles (id) on delete set null;

create function check_credited() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.credited_to is null or new.credited_to = new.author_id then
    new.credited_to := null;
    return new;
  end if;
  if not new.memory then
    raise exception 'Solo los recuerdos se pueden poner a nombre de otra persona';
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
create trigger moments_check_credited before insert or update of credited_to, memory on moments
  for each row execute function check_credited();

-- La persona a cuyo nombre está puede quitarse el nombre (si no lo reconoce).
create function uncredit_me(target uuid) returns void
language sql security definer set search_path = public as $$
  update moments set credited_to = null where id = target and credited_to = auth.uid();
$$;
revoke execute on function uncredit_me(uuid) from public, anon;
grant execute on function uncredit_me(uuid) to authenticated;
