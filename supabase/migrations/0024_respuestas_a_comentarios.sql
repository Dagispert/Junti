-- Responder a un comentario: la respuesta guarda a qué comentario contesta.
-- Las respuestas cuelgan de un comentario «raíz» (un solo nivel, como en
-- las redes): si se responde a una respuesta, cuelga del mismo comentario.

alter table comments add column reply_to uuid references comments (id) on delete set null;
create index on comments (reply_to);

-- La respuesta tiene que ser al mismo momento, y se aplana a un nivel.
create function comments_reply_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare parent comments;
begin
  if new.reply_to is null then return new; end if;
  select * into parent from comments where id = new.reply_to;
  if parent.id is null or parent.moment_id <> new.moment_id then
    raise exception 'La respuesta no es de este momento';
  end if;
  if parent.reply_to is not null then new.reply_to := parent.reply_to; end if;
  return new;
end;
$$;
create trigger comments_reply_check before insert on comments
  for each row execute function comments_reply_check();
revoke execute on function comments_reply_check() from public, anon, authenticated;
