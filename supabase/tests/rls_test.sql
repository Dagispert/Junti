-- Pruebas de privacidad. Ejecutar con tests/run.sh; cualquier fallo aborta con error.
\set ON_ERROR_STOP on

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'), -- Ana
  ('00000000-0000-0000-0000-00000000000b'), -- Bea
  ('00000000-0000-0000-0000-00000000000c'); -- Carlos (ajeno al grupo)
insert into profiles (id, name) values
  ('00000000-0000-0000-0000-00000000000a', 'Ana'),
  ('00000000-0000-0000-0000-00000000000b', 'Bea'),
  ('00000000-0000-0000-0000-00000000000c', 'Carlos');

create function pg_temp.expect(ok boolean, what text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FALLO: %', what; end if;
  raise notice 'ok: %', what;
end $$;
create function pg_temp.fails(sql text, what text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    raise notice 'ok: % (%)', what, sqlerrm;
    return;
  end;
  raise exception 'FALLO: % debería haber sido rechazado', what;
end $$;

set role authenticated;

-- Ana crea un grupo, publica e invita.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into groups (id, name) values ('10000000-0000-0000-0000-000000000001', 'Los de siempre');
select pg_temp.expect((select role = 'admin' from memberships where user_id = auth.uid()), 'quien crea el grupo es administrador');
insert into proposals (id, group_id, kind, title) values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'prompt', '¿Qué desayunas?');
insert into moments (id, group_id, text, author_tz, proposal_id) values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Empezando el día', 'America/Mexico_City', '30000000-0000-0000-0000-000000000001');
insert into proposal_states (proposal_id, state) values ('30000000-0000-0000-0000-000000000001', 'skipped');
insert into invitations (group_id, code) values ('10000000-0000-0000-0000-000000000001', 'codigo-secreto');

-- Carlos no pertenece: no ve nada y no puede escribir.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select pg_temp.expect((select count(*) = 0 from groups), 'un ajeno no ve el grupo');
select pg_temp.expect((select count(*) = 0 from moments), 'un ajeno no ve los momentos');
select pg_temp.expect((select count(*) = 0 from memberships), 'un ajeno no ve los integrantes');
select pg_temp.expect((select count(*) = 0 from invitations), 'un ajeno no ve las invitaciones');
select pg_temp.expect((select count(*) = 1 from profiles), 'un ajeno solo ve su propio perfil');
select pg_temp.fails($$insert into moments (group_id, text, author_tz) values ('10000000-0000-0000-0000-000000000001', 'hola', 'UTC')$$, 'un ajeno no puede publicar');
select pg_temp.fails($$insert into memberships (group_id, user_id) values ('10000000-0000-0000-0000-000000000001', auth.uid())$$, 'nadie puede añadirse a un grupo sin invitación');
select pg_temp.fails($$insert into reactions (moment_id, emoji) values ('20000000-0000-0000-0000-000000000001', '❤️')$$, 'un ajeno no puede reaccionar');
select pg_temp.fails($$select join_group('codigo-falso')$$, 'un código inventado no sirve');

-- Bea entra con el código.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select join_group('codigo-secreto');
select pg_temp.expect((select count(*) = 1 from moments), 'un miembro ve los momentos');
select pg_temp.expect((select count(*) = 2 from profiles), 'un miembro ve los perfiles de su grupo y no otros');
select pg_temp.expect((select count(*) = 0 from proposal_states), 'nadie ve que otra persona omitió una propuesta');
insert into reactions (moment_id, emoji) values ('20000000-0000-0000-0000-000000000001', '❤️');
insert into comments (moment_id, text) values ('20000000-0000-0000-0000-000000000001', '¡Buenos días!');
update moments set text = 'manipulado' where id = '20000000-0000-0000-0000-000000000001';
reset role;
select pg_temp.expect((select text = 'Empezando el día' from moments), 'no se puede editar el momento de otra persona');
set role authenticated;
select pg_temp.fails($$insert into moments (group_id, author_id, text, author_tz) values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'suplantación', 'UTC')$$, 'no se puede publicar en nombre de otra persona');
select pg_temp.fails($$update memberships set role = 'admin' where user_id = auth.uid()$$, 'un miembro no puede hacerse administrador');
update memberships set preferred_hour = 8 where user_id = auth.uid();
select pg_temp.expect((select preferred_hour = 8 from memberships where user_id = auth.uid()), 'un miembro puede cambiar sus preferencias');

-- Bea sale del grupo y deja de ver su contenido.
update memberships set status = 'left', left_at = now() where user_id = auth.uid();
select pg_temp.expect((select count(*) = 0 from moments), 'quien sale del grupo deja de ver los momentos');
select pg_temp.expect((select count(*) = 0 from comments), 'quien sale del grupo deja de ver los comentarios');

-- Ana elimina su momento.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select pg_temp.expect((select count(*) = 1 from reactions), 'la autora ve las reacciones recibidas');
update moments set deleted_at = now() where id = '20000000-0000-0000-0000-000000000001';
select pg_temp.expect((select count(*) = 0 from reactions), 'al eliminar un momento desaparecen sus reacciones para el grupo');

reset role;
\echo TODAS LAS PRUEBAS DE PRIVACIDAD PASAN
