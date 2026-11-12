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

-- ── Canciones del grupo ──
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
insert into songs (group_id, title, artist, note) values ('10000000-0000-0000-0000-0000000000aa', 'Sailing', 'Christopher Cross', 'La del viaje');
select pg_temp.expect((select count(*) = 1 from songs), 'un miembro añade y ve una canción del grupo');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select pg_temp.expect((select count(*) = 0 from songs), 'alguien ajeno no ve las canciones del grupo');
select pg_temp.fails($$insert into songs (group_id, title, artist) values ('10000000-0000-0000-0000-0000000000aa', 'x', 'y')$$, 'alguien ajeno no puede añadir canciones');
reset role;
\echo CANCIONES CORRECTAS

-- ── Calendario ──
-- (usuarios del bloque de avisos: d1 está en el grupo «Avisos», el ajeno «c» no)
update groups set cadence_days = '{1,2,3,4,5,6,7}' where id = '10000000-0000-0000-0000-0000000000aa';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
insert into events (group_id, kind, title, starts_on, yearly, person_id) values
  ('10000000-0000-0000-0000-0000000000aa', 'birthday', 'Cumpleaños de Aún no', (now() at time zone 'Europe/Madrid')::date - interval '30 years', true, '00000000-0000-0000-0000-0000000000d2'),
  ('10000000-0000-0000-0000-0000000000aa', 'reunion', 'Reencuentro en Madrid', (now() at time zone 'Europe/Madrid')::date + 7, false, null),
  ('10000000-0000-0000-0000-0000000000aa', 'other', 'Dentro de tres días', (now() at time zone 'Europe/Madrid')::date + 3, false, null);
select pg_temp.expect((select count(*) = 3 from events), 'un miembro crea eventos del grupo');
select pg_temp.fails($$insert into events (group_id, kind, title, starts_on, person_id) values ('10000000-0000-0000-0000-0000000000aa', 'birthday', 'x', now()::date, '00000000-0000-0000-0000-00000000000c')$$, 'no se puede crear el cumpleaños de alguien que no es del grupo');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select pg_temp.expect((select count(*) = 0 from events), 'alguien ajeno no ve el calendario del grupo');
reset role;
update memberships set preferred_hour = 0, muted_until = null where group_id = '10000000-0000-0000-0000-0000000000aa';
set role service_role;
create temp table recordatorios as select * from claim_event_reminders();
reset role;
select pg_temp.expect(
  (select count(*) from recordatorios where body like '🎂 Hoy es el cumpleaños de Aún no%') >= 1
  or extract(hour from now() at time zone 'Europe/Madrid') < 0,
  'aviso de cumpleaños el mismo día a los demás');
select pg_temp.expect((select count(*) from recordatorios where body = '⏳ Falta una semana: Reencuentro en Madrid') >= 1, 'aviso una semana antes de un reencuentro');
select pg_temp.expect((select count(*) = 0 from recordatorios where body like '%tres días%'), 'no se avisa en días sin recordatorio');
set role service_role;
select pg_temp.expect((select count(*) = 0 from claim_event_reminders()), 'los recordatorios no se repiten');
reset role;
select pg_temp.expect(
  event_occurrence(row(null, null, null, 'birthday', 'x', null, null, '2000-02-29', null, true, null, now())::events, '2027-01-10') = '2027-02-28',
  'quien nació el 29 de febrero lo celebra el 28 en años no bisiestos');
\echo CALENDARIO CORRECTO

-- ── Avisos de actividad ──
reset role;
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000e1'), ('00000000-0000-0000-0000-0000000000e2'), ('00000000-0000-0000-0000-0000000000e3');
insert into profiles (id, name) values
  ('00000000-0000-0000-0000-0000000000e1', 'Eva'),
  ('00000000-0000-0000-0000-0000000000e2', 'Félix Gómez'),
  ('00000000-0000-0000-0000-0000000000e3', 'Gema');
insert into push_subscriptions (user_id, endpoint, p256dh, auth) values
  ('00000000-0000-0000-0000-0000000000e1', 'https://push.example/e1', 'k', 'a'),
  ('00000000-0000-0000-0000-0000000000e2', 'https://push.example/e2', 'k', 'a'),
  ('00000000-0000-0000-0000-0000000000e3', 'https://push.example/e3', 'k', 'a');
insert into groups (id, name, created_by) values ('10000000-0000-0000-0000-0000000000ae', 'Actividad', '00000000-0000-0000-0000-0000000000e1');
insert into memberships (group_id, user_id) values ('10000000-0000-0000-0000-0000000000ae', '00000000-0000-0000-0000-0000000000e2');
insert into memberships (group_id, user_id) values ('10000000-0000-0000-0000-0000000000ae', '00000000-0000-0000-0000-0000000000e3');
update memberships set quiet_from = 0, quiet_to = 0 where group_id = '10000000-0000-0000-0000-0000000000ae';
insert into moments (id, group_id, author_id, text, author_tz) values
  ('20000000-0000-0000-0000-0000000000e1', '10000000-0000-0000-0000-0000000000ae', '00000000-0000-0000-0000-0000000000e2', 'Uno', 'Europe/Madrid'),
  ('20000000-0000-0000-0000-0000000000e2', '10000000-0000-0000-0000-0000000000ae', '00000000-0000-0000-0000-0000000000e2', 'Dos', 'Europe/Madrid'),
  ('20000000-0000-0000-0000-0000000000e3', '10000000-0000-0000-0000-0000000000ae', '00000000-0000-0000-0000-0000000000e3', 'Tres', 'Europe/Madrid');
insert into comments (moment_id, user_id, text) values
  ('20000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e1', '¡Qué bonito!'),
  ('20000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2', 'Gracias');
select pg_temp.expect((select count(*) = 0 from activity_queue where user_id = actor_id), 'nunca se avisa a alguien de lo suyo');
update activity_queue set created_at = now() - interval '2 minutes';
set role service_role;
create temp table actividad as select * from claim_activity() where g_name = 'Actividad';
reset role;
select pg_temp.expect((select count(*) = 3 from actividad), 'un solo aviso por persona y grupo, con todo agrupado');
select pg_temp.expect((select body from actividad where sub_endpoint = 'https://push.example/e1') =
  'Félix y Gema han compartido 3 momentos · Félix y Gema se han unido al grupo 👋', 'Eva: momentos agrupados y gente nueva');
select pg_temp.expect((select body from actividad where sub_endpoint = 'https://push.example/e2') =
  'Gema ha compartido un momento · Eva ha comentado tu momento: «¡Qué bonito!» · Gema se ha unido al grupo 👋', 'Félix: el comentario en su momento');
select pg_temp.expect((select body from actividad where sub_endpoint = 'https://push.example/e3') =
  'Félix ha compartido 2 momentos', 'Gema: solo lo de los demás');
set role service_role;
select pg_temp.expect((select count(*) = 0 from claim_activity()), 'los avisos no se repiten');
reset role;
-- Silenciado: no se avisa. En horas de descanso: espera.
update memberships set muted_until = now() + interval '1 day'
  where group_id = '10000000-0000-0000-0000-0000000000ae' and user_id = '00000000-0000-0000-0000-0000000000e3';
update memberships set quiet_from = extract(hour from now() at time zone 'Europe/Madrid')::int,
  quiet_to = (extract(hour from now() at time zone 'Europe/Madrid')::int + 1) % 24
  where group_id = '10000000-0000-0000-0000-0000000000ae' and user_id = '00000000-0000-0000-0000-0000000000e2';
insert into moments (group_id, author_id, text, author_tz) values
  ('10000000-0000-0000-0000-0000000000ae', '00000000-0000-0000-0000-0000000000e1', 'Cuatro', 'Europe/Madrid');
update activity_queue set created_at = now() - interval '2 minutes' where sent_at is null;
set role service_role;
select pg_temp.expect((select count(*) = 0 from claim_activity()), 'ni a quien silenció el grupo ni a quien está descansando');
reset role;
select pg_temp.expect((select sent_at is not null from activity_queue where user_id = '00000000-0000-0000-0000-0000000000e3' order by id desc limit 1), 'lo silenciado se descarta');
select pg_temp.expect((select sent_at is null from activity_queue where user_id = '00000000-0000-0000-0000-0000000000e2' order by id desc limit 1), 'lo de las horas de descanso espera a la mañana');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
select pg_temp.expect((select count(*) = 0 from activity_queue), 'la cola de avisos no se ve desde la app');
select pg_temp.fails($$select claim_activity()$$, 'la app no puede reclamar avisos');
reset role;
\echo ACTIVIDAD CORRECTA

-- ── Propuesta del día desde la biblioteca ──
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
select pg_temp.expect((select daily_prompt('10000000-0000-0000-0000-0000000000ae', '2030-01-01') is not null), 'un miembro obtiene la propuesta del día de la biblioteca');
select pg_temp.expect((select daily_prompt('10000000-0000-0000-0000-0000000000ae', '2030-01-01')) =
  (select id from proposals where group_id = '10000000-0000-0000-0000-0000000000ae' and day = '2030-01-01'), 'la propuesta del día es una sola');
select pg_temp.expect((select library_id is not null from proposals where group_id = '10000000-0000-0000-0000-0000000000ae' and day = '2030-01-01'), 'viene de la biblioteca');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select pg_temp.fails($$select daily_prompt('10000000-0000-0000-0000-0000000000ae', '2030-01-02')$$, 'alguien ajeno no puede crear propuestas en el grupo');
reset role;
\echo PROPUESTAS DE LA BIBLIOTECA CORRECTAS

-- ── Preguntas, quiz y recuerdos ──
-- (grupo «Actividad»: Eva e1, Félix e2, Gema e3; Carlos «c» es ajeno)
reset role;
update memberships set muted_until = null, quiet_from = 0, quiet_to = 0 where group_id = '10000000-0000-0000-0000-0000000000ae';
update activity_queue set sent_at = now() where sent_at is null;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
insert into questions (id, group_id, kind, title, options) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000ae', 'poll', '¿Dónde quedamos en verano?', '{Lisboa,Roma}'),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-0000000000ae', 'quiz', '¿Quién vivió en Berlín?', '{Eva,Félix,Gema}');
insert into questions (id, group_id, kind, title) values
  ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-0000000000ae', 'open', '¿Qué recuerdas de nuestro primer viaje?');
insert into question_keys (question_id, correct) values ('40000000-0000-0000-0000-000000000002', 2);
select pg_temp.fails($$insert into question_answers (question_id, choice) values ('40000000-0000-0000-0000-000000000002', 1)$$, 'quien crea el quiz no juega');
insert into question_answers (question_id, choice) values ('40000000-0000-0000-0000-000000000001', 0);
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e2';
select pg_temp.expect((select count(*) = 3 from questions), 'el grupo ve sus preguntas');
select pg_temp.expect((select count(*) = 0 from question_answers), 'no se ven las respuestas ajenas antes de responder');
select pg_temp.expect((select count(*) = 0 from question_keys), 'la solución del quiz no se ve antes de responder');
select pg_temp.fails($$insert into question_answers (question_id, choice) values ('40000000-0000-0000-0000-000000000001', 5)$$, 'no se puede votar una opción que no existe');
select pg_temp.fails($$insert into question_answers (question_id, text) values ('40000000-0000-0000-0000-000000000001', 'hola')$$, 'en una encuesta no se responde con texto');
insert into question_answers (question_id, choice) values ('40000000-0000-0000-0000-000000000001', 1);
select pg_temp.expect((select count(*) = 2 from question_answers where question_id = '40000000-0000-0000-0000-000000000001'), 'tras votar se ven los votos de los demás');
update question_answers set choice = 0 where question_id = '40000000-0000-0000-0000-000000000001' and user_id = auth.uid();
select pg_temp.expect((select choice = 0 from question_answers where question_id = '40000000-0000-0000-0000-000000000001' and user_id = auth.uid()), 'se puede cambiar el voto');
insert into question_answers (question_id, choice) values ('40000000-0000-0000-0000-000000000002', 1);
select pg_temp.expect((select correct = 2 from question_keys where question_id = '40000000-0000-0000-0000-000000000002'), 'tras responder el quiz se ve la solución');
update question_answers set choice = 2 where question_id = '40000000-0000-0000-0000-000000000002' and user_id = auth.uid();
select pg_temp.expect((select choice = 1 from question_answers where question_id = '40000000-0000-0000-0000-000000000002' and user_id = auth.uid()), 'en el quiz no se puede cambiar la respuesta después de ver la solución');
insert into question_answers (question_id, text) values ('40000000-0000-0000-0000-000000000003', 'La tormenta en la playa');
select pg_temp.fails($$insert into question_keys (question_id, correct) values ('40000000-0000-0000-0000-000000000001', 0)$$, 'solo quien crea un quiz pone su solución');
-- Un recuerdo de hace años: se guarda en su fecha.
insert into moments (group_id, text, author_tz, memory, created_at) values
  ('10000000-0000-0000-0000-0000000000ae', 'Aquel verano', 'Europe/Madrid', true, now() - interval '5 years');
select pg_temp.fails($$insert into moments (group_id, text, author_tz, created_at) values ('10000000-0000-0000-0000-0000000000ae', 'del futuro', 'Europe/Madrid', now() + interval '5 days')$$, 'nada fechado en el futuro');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select pg_temp.expect((select count(*) = 0 from questions), 'alguien ajeno no ve las preguntas');
select pg_temp.fails($$insert into question_answers (question_id, choice) values ('40000000-0000-0000-0000-000000000001', 0)$$, 'alguien ajeno no puede votar');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
insert into proposals (group_id, kind, title, body) values ('10000000-0000-0000-0000-0000000000ae', 'challenge', 'El cielo de cada uno', 'Una foto del cielo');
reset role;
update activity_queue set created_at = now() - interval '2 minutes' where sent_at is null;
set role service_role;
create temp table actividad2 as select * from claim_activity() where g_name = 'Actividad';
reset role;
select pg_temp.expect((select body from actividad2 where sub_endpoint = 'https://push.example/e3') =
  'Félix ha añadido un recuerdo 📼 · Eva propone un reto: «El cielo de cada uno» · 3 preguntas nuevas (Eva)', 'avisos de recuerdos, retos y preguntas');
\echo PREGUNTAS Y RECUERDOS CORRECTOS

-- ── Álbumes y personalización del grupo ──
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e2';
insert into albums (id, group_id, title) values ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000ae', 'Viaje a Roma');
insert into album_moments (album_id, moment_id) values ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-0000000000e1');
select pg_temp.expect((select count(*) = 1 from album_moments), 'un miembro crea un álbum y añade un momento del grupo');
select pg_temp.fails($$insert into album_moments (album_id, moment_id) values ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001')$$, 'no se pueden añadir momentos de otro grupo');
update groups set sticker = '🌻' where id = '10000000-0000-0000-0000-0000000000ae';
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
select pg_temp.expect((select sticker is null from groups where id = '10000000-0000-0000-0000-0000000000ae'), 'quien no administra no cambia la pegatina del grupo');
update groups set sticker = '🌻', color = '#4E8D7C' where id = '10000000-0000-0000-0000-0000000000ae';
select pg_temp.expect((select sticker = '🌻' from groups where id = '10000000-0000-0000-0000-0000000000ae'), 'quien administra personaliza el grupo');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select pg_temp.expect((select count(*) = 0 from albums), 'alguien ajeno no ve los álbumes');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e3';
delete from albums where id = '50000000-0000-0000-0000-000000000001';
select pg_temp.expect((select count(*) = 1 from albums), 'quien no creó el álbum (ni administra) no lo borra');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e2';
update moments set text = 'Uno (editado)', edited_at = now() where id = '20000000-0000-0000-0000-0000000000e1';
select pg_temp.expect((select text = 'Uno (editado)' from moments where id = '20000000-0000-0000-0000-0000000000e1'), 'el autor edita el texto de su momento');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e3';
update moments set text = 'hackeado' where id = '20000000-0000-0000-0000-0000000000e1';
select pg_temp.expect((select text = 'Uno (editado)' from moments where id = '20000000-0000-0000-0000-0000000000e1'), 'nadie más edita un momento ajeno');
update memberships set quiet_from = 23, quiet_to = 8 where group_id = '10000000-0000-0000-0000-0000000000ae' and user_id = auth.uid();
select pg_temp.expect((select quiet_from = 23 from memberships where group_id = '10000000-0000-0000-0000-0000000000ae' and user_id = auth.uid()), 'cada uno elige sus horas de descanso');
reset role;
\echo ALBUMES Y GRUPO CORRECTOS

-- ── Perfil con más contexto ──
reset role;
update memberships set muted_until = null, preferred_hour = 0 where group_id = '10000000-0000-0000-0000-0000000000ae';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e2';
update profiles set nickname = 'Fe', voice_gender = 'm', bio = 'Fotógrafo en Lisboa', interests = '{surf,cocinar}', hometown = 'Valladolid',
  birth_month = extract(month from now() at time zone 'Europe/Madrid'), birth_day = extract(day from now() at time zone 'Europe/Madrid')
  where id = auth.uid();
update memberships set nickname = 'Felipín' where group_id = '10000000-0000-0000-0000-0000000000ae' and user_id = auth.uid();
select pg_temp.fails($$update profiles set birth_year = 1990, birth_month = null, birth_day = null where id = auth.uid()$$, 'no hay año de nacimiento sin día y mes');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
select pg_temp.expect((select nickname = 'Fe' and bio = 'Fotógrafo en Lisboa' from profiles where id = '00000000-0000-0000-0000-0000000000e2'), 'quien comparte grupo ve el apodo y la frase');
update profiles set nickname = 'hackeado' where id = '00000000-0000-0000-0000-0000000000e2';
select pg_temp.expect((select nickname = 'Fe' from profiles where id = '00000000-0000-0000-0000-0000000000e2'), 'nadie cambia el perfil de otro');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select pg_temp.expect((select count(*) = 0 from profiles where id = '00000000-0000-0000-0000-0000000000e2'), 'alguien ajeno no ve el perfil');
reset role;
set role service_role;
create temp table cumples as select * from claim_profile_birthdays();
reset role;
select pg_temp.expect((select body from cumples where g_name = 'Actividad' and sub_endpoint = 'https://push.example/e1') = '🎂 Hoy cumple Felipín. Felicítalo', 'aviso del cumpleaños del perfil, con el apodo del grupo y en masculino');
select pg_temp.expect((select body from cumples where g_name = 'Actividad' and sub_endpoint = 'https://push.example/e2') = '🎂 Feliz cumpleaños. Hoy el grupo piensa en ti', 'felicitación a quien cumple');
set role service_role;
select pg_temp.expect((select count(*) = 0 from claim_profile_birthdays()), 'el aviso de cumpleaños no se repite');
reset role;
\echo PERFIL CORRECTO
