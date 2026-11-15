-- La personalidad de la narradora de cada grupo: siempre la misma voz, su
-- acento, cuánto vacila, si usa dichos, cómo se llama y algo más de ella.
-- La escribe quien administra (la política de groups ya lo exige).
alter table groups add column narrator jsonb
  check (narrator is null or (jsonb_typeof(narrator) = 'object' and length(narrator::text) <= 2000));

-- Si cambia su forma de ser, lo ya contado se vuelve a contar con ella.
create function forget_narrations_persona() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.narrator is distinct from old.narrator then
    delete from narrations where group_id = new.id;
  end if;
  return new;
end;
$$;
create trigger groups_forget_persona after update of narrator on groups
  for each row execute function forget_narrations_persona();
