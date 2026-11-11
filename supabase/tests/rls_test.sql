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

-- ── Salidas ordenadas y borrado de cuenta desde la app ──
set role authenticated;
-- Bea vuelve a entrar; Ana (única administradora) sale retirando sus momentos.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select join_group('codigo-secreto');
insert into moments (group_id, text, author_tz) values ('10000000-0000-0000-0000-000000000001', 'De Bea', 'UTC');
select pg_temp.fails($$select leave_group_internal('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', true)$$, 'la función interna no se puede llamar desde la app');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into moments (group_id, text, author_tz) values ('10000000-0000-0000-0000-000000000001', 'De Ana', 'UTC');
select leave_group('10000000-0000-0000-0000-000000000001', true);
select pg_temp.expect((select count(*) = 0 from groups where id = '10000000-0000-0000-0000-000000000001' and is_member(id)), 'quien sale deja de pertenecer');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.expect((select role = 'admin' from memberships where user_id = auth.uid()), 'al salir la única administradora, hereda quien queda');
select pg_temp.expect((select count(*) = 1 and bool_and(text = 'De Bea') from moments), 'quien sale puede retirar sus momentos; los de los demás siguen');
-- Bea borra su cuenta: era la última, así que el grupo desaparece.
select delete_my_account();
reset role;
select pg_temp.expect((select count(*) = 0 from auth.users where id = '00000000-0000-0000-0000-00000000000b'), 'la cuenta se borra desde la app');
select pg_temp.expect((select count(*) = 0 from groups), 'un grupo que se queda sin nadie se elimina');
select pg_temp.expect((select count(*) = 0 from moments), 'con la cuenta desaparecen sus momentos');
\echo SALIDAS Y BORRADO DESDE LA APP CORRECTOS

-- ── Avisos: a quién le toca ──
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000d1'), ('00000000-0000-0000-0000-0000000000d2'),
  ('00000000-0000-0000-0000-0000000000d3'), ('00000000-0000-0000-0000-0000000000d4');
insert into profiles (id, name, timezone) values
  ('00000000-0000-0000-0000-0000000000d1', 'Toca', 'Europe/Madrid'),
  ('00000000-0000-0000-0000-0000000000d2', 'Aún no', 'Europe/Madrid'),
  ('00000000-0000-0000-0000-0000000000d3', 'Silenciado', 'America/Mexico_City'),
  ('00000000-0000-0000-0000-0000000000d4', 'Sin dispositivo', 'Europe/Madrid');
insert into groups (id, name, created_by, cadence_days) values
  ('10000000-0000-0000-0000-0000000000aa', 'Avisos', '00000000-0000-0000-0000-0000000000d1', '{1,2,3,4,5,6,7}');
insert into memberships (group_id, user_id) values
  ('10000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-0000000000d2'),
  ('10000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-0000000000d3'),
  ('10000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-0000000000d4');
-- d1: su hora ya ha llegado. d2: su hora es la siguiente (si no es ya la última del día).
update memberships set preferred_hour = 0 where user_id = '00000000-0000-0000-0000-0000000000d1';
update memberships set preferred_hour = 23 where user_id = '00000000-0000-0000-0000-0000000000d2';
update memberships set preferred_hour = 0, muted_until = now() + interval '1 day' where user_id = '00000000-0000-0000-0000-0000000000d3';
update memberships set preferred_hour = 0 where user_id = '00000000-0000-0000-0000-0000000000d4';
insert into push_subscriptions (user_id, endpoint, p256dh, auth) values
  ('00000000-0000-0000-0000-0000000000d1', 'https://push.example/d1-movil', 'k', 'a'),
  ('00000000-0000-0000-0000-0000000000d1', 'https://push.example/d1-tablet', 'k', 'a'),
  ('00000000-0000-0000-0000-0000000000d2', 'https://push.example/d2', 'k', 'a'),
  ('00000000-0000-0000-0000-0000000000d3', 'https://push.example/d3', 'k', 'a');

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select pg_temp.fails($$select * from claim_due_notifications()$$, 'la app no puede pedir la lista de avisos');
select pg_temp.expect((select count(*) = 2 from push_subscriptions), 'cada persona ve solo sus propios dispositivos');
reset role;

set role service_role;
create temp table primera as select * from claim_due_notifications();
reset role;
select pg_temp.expect(
  (select count(*) = 2 and bool_and(sub_endpoint like '%/d1-%') from primera)
  or extract(hour from now() at time zone 'Europe/Madrid') = 23,
  'se avisa a quien le ha llegado su hora, en todos sus dispositivos, y a nadie más');
select pg_temp.expect((select count(distinct p_id) = 1 and bool_and(p_title <> '') from primera), 'se crea una sola propuesta del día, tomada de la biblioteca');
set role service_role;
select pg_temp.expect((select count(*) = 0 from claim_due_notifications()), 'pedirla otra vez no repite ningún aviso');
reset role;
select pg_temp.expect((select count(*) = 1 from proposals where group_id = '10000000-0000-0000-0000-0000000000aa'), 'no se duplica la propuesta del día');

-- Quien ya respondió antes de su hora no recibe aviso.
delete from notification_log;
insert into moments (group_id, author_id, text, author_tz, proposal_id)
  select group_id, '00000000-0000-0000-0000-0000000000d1', 'ya', 'Europe/Madrid', id from proposals where group_id = '10000000-0000-0000-0000-0000000000aa';
set role service_role;
select pg_temp.expect((select count(*) = 0 from claim_due_notifications() where sub_endpoint like '%/d1-%'), 'quien ya respondió no recibe aviso');
reset role;

-- Tope: como mucho dos grupos al día por persona.
delete from moments where text = 'ya';
delete from notification_log;
insert into groups (id, name, created_by, cadence_days) values
  ('10000000-0000-0000-0000-0000000000ab', 'Avisos 2', '00000000-0000-0000-0000-0000000000d1', '{1,2,3,4,5,6,7}'),
  ('10000000-0000-0000-0000-0000000000ac', 'Avisos 3', '00000000-0000-0000-0000-0000000000d1', '{1,2,3,4,5,6,7}');
update memberships set preferred_hour = 0 where user_id = '00000000-0000-0000-0000-0000000000d1';
set role service_role;
select pg_temp.expect((select count(distinct g_id) = 2 from claim_due_notifications() where sub_endpoint like '%/d1-%'), 'como mucho dos propuestas al día por persona');
reset role;

-- Un grupo cuya frecuencia no incluye hoy no avisa.
delete from notification_log;
update groups set cadence_days = array[(extract(isodow from now() at time zone 'Europe/Madrid')::int % 7) + 1]::smallint[];
set role service_role;
select pg_temp.expect((select count(*) = 0 from claim_due_notifications()), 'los días que no tocan no hay aviso');
reset role;
-- La app también puede crear la propuesta del día; si ya existe, no se duplica.
insert into proposals (group_id, kind, title, day)
  select group_id, 'prompt', 'duplicada', day from proposals where day is not null limit 1
  on conflict (group_id, day) do nothing;
select pg_temp.expect((select count(*) = 0 from proposals where title = 'duplicada'), 'la app no puede duplicar la propuesta de un día');
\echo AVISOS CORRECTOS
