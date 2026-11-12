-- Junti · 0014 · Más propuestas
--
-- La biblioteca pasa de 20 a unas 150 propuestas en español, repartidas por
-- temas, para que tarden en repetirse, y la app las toma de aquí (daily_prompt).
-- Sencillas, cálidas y sin obligar a nada:
-- ninguna pide rendir cuentas ni compara a nadie.

insert into proposal_library (locale, category, kind, title) values
  ('es', 'ahora', 'prompt', '¿Qué suena a tu alrededor ahora mismo?'),
  ('es', 'ahora', 'prompt', 'Enséñanos tus pies ahora mismo (con zapatos o sin ellos)'),
  ('es', 'ahora', 'prompt', '¿Qué tiempo hace donde estás?'),
  ('es', 'ahora', 'prompt', 'La luz que tienes ahora mismo, en una foto'),
  ('es', 'ahora', 'prompt', '¿Qué es lo último que has apuntado o escrito a mano?'),
  ('es', 'ahora', 'prompt', 'Enséñanos el bolsillo o el bolso: ¿qué llevas hoy?'),
  ('es', 'ahora', 'prompt', '¿En qué estás pensando justo ahora?'),
  ('es', 'ahora', 'prompt', 'Lo que tienes a la izquierda, sin moverte del sitio'),
  ('es', 'ahora', 'prompt', '¿Cómo vas de energía hoy, del 1 al 10?'),
  ('es', 'ahora', 'prompt', 'Una foto de tus manos haciendo lo que estés haciendo'),
  ('es', 'comida', 'prompt', '¿Qué hay hoy para cenar?'),
  ('es', 'comida', 'prompt', 'Tu café, té o lo que estés bebiendo ahora'),
  ('es', 'comida', 'prompt', 'Algo que hayas cocinado tú esta semana'),
  ('es', 'comida', 'prompt', '¿Cuál es tu antojo de hoy?'),
  ('es', 'comida', 'prompt', 'Enséñanos tu nevera por dentro (sin vergüenza)'),
  ('es', 'comida', 'prompt', 'Una comida que te recuerde a casa'),
  ('es', 'comida', 'prompt', '¿Qué has probado por primera vez últimamente?'),
  ('es', 'comida', 'prompt', 'El mercado, súper o tienda donde compras'),
  ('es', 'comida', 'prompt', 'Tu merienda de hoy'),
  ('es', 'comida', 'prompt', 'Una receta que te gustaría que probáramos todos'),
  ('es', 'lugar', 'prompt', 'Tu rincón favorito de casa'),
  ('es', 'lugar', 'prompt', 'El camino que haces cada día, en una foto'),
  ('es', 'lugar', 'prompt', 'Una calle de tu barrio que te guste'),
  ('es', 'lugar', 'prompt', 'El sitio donde mejor piensas'),
  ('es', 'lugar', 'prompt', 'Lo que ves al salir por la puerta de casa'),
  ('es', 'lugar', 'prompt', 'Un banco, una plaza o un parque donde te sentarías con nosotros'),
  ('es', 'lugar', 'prompt', 'La foto más bonita de tu ciudad que puedas hacer hoy'),
  ('es', 'lugar', 'prompt', 'Un sitio al que irías con nosotros si estuviéramos ahí'),
  ('es', 'lugar', 'prompt', 'Tu ventana de noche'),
  ('es', 'lugar', 'prompt', 'Un lugar de tu ciudad que nadie conoce'),
  ('es', 'musica', 'prompt', 'La canción que no te sacas de la cabeza'),
  ('es', 'musica', 'prompt', 'Una canción que te recuerde a alguien de este grupo'),
  ('es', 'musica', 'prompt', '¿Qué pondrías ahora para animar el día?'),
  ('es', 'musica', 'prompt', 'Una canción para escuchar mirando por la ventana'),
  ('es', 'musica', 'prompt', 'La última canción que has cantado en voz alta'),
  ('es', 'musica', 'prompt', 'Una canción de cuando éramos más jóvenes'),
  ('es', 'semana', 'prompt', 'Lo más raro que te ha pasado esta semana'),
  ('es', 'semana', 'prompt', 'Algo que hayas aprendido estos días'),
  ('es', 'semana', 'prompt', '¿Qué momento de esta semana repetirías?'),
  ('es', 'semana', 'prompt', 'Una conversación bonita de esta semana'),
  ('es', 'semana', 'prompt', 'Algo que te haya costado y has conseguido'),
  ('es', 'semana', 'prompt', '¿Cómo resumirías tu semana en tres palabras?'),
  ('es', 'semana', 'prompt', 'Lo mejor de hoy, aunque sea pequeñito'),
  ('es', 'semana', 'prompt', 'Algo que hayas hecho hoy por primera vez'),
  ('es', 'animo', 'prompt', '¿Qué te ha hecho reír hoy?'),
  ('es', 'animo', 'prompt', 'Algo que te haya dado paz esta semana'),
  ('es', 'animo', 'prompt', '¿Qué necesitas hoy? A lo mejor podemos ayudar'),
  ('es', 'animo', 'prompt', 'Algo bonito que hayas visto por la calle'),
  ('es', 'animo', 'prompt', 'Una cosa que agradeces hoy'),
  ('es', 'animo', 'prompt', '¿Qué te ha sorprendido para bien últimamente?'),
  ('es', 'animo', 'prompt', 'Algo de lo que te sientas orgulloso u orgullosa'),
  ('es', 'animo', 'prompt', 'Una frase que te ronde estos días'),
  ('es', 'cultura', 'prompt', 'La última foto que has hecho a algo bonito'),
  ('es', 'cultura', 'prompt', 'Un libro que nos regalarías'),
  ('es', 'cultura', 'prompt', 'La peli que verías esta noche con nosotros'),
  ('es', 'cultura', 'prompt', 'Un podcast, canal o cuenta que te guste'),
  ('es', 'cultura', 'prompt', 'Algo que hayas visto en un museo, en la calle o en un escaparate'),
  ('es', 'cultura', 'prompt', 'Una serie que estés viendo y por qué'),
  ('es', 'planes', 'prompt', '¿Qué te apetece hacer este domingo?'),
  ('es', 'planes', 'prompt', 'Un plan que te gustaría hacer con nosotros algún día'),
  ('es', 'planes', 'prompt', '¿Qué tienes ganas de que llegue?'),
  ('es', 'planes', 'prompt', 'Un viaje que tengas en mente'),
  ('es', 'planes', 'prompt', 'Lo próximo que vas a estrenar'),
  ('es', 'planes', 'prompt', 'Algo que quieras hacer antes de que acabe el mes'),
  ('es', 'personal', 'prompt', '¿Cómo estás de verdad hoy?'),
  ('es', 'personal', 'prompt', 'Algo que te esté preocupando un poco'),
  ('es', 'personal', 'prompt', 'Un pequeño hábito nuevo que estés probando'),
  ('es', 'personal', 'prompt', 'Algo que hayas cambiado de opinión hace poco'),
  ('es', 'personal', 'prompt', '¿Qué te gustaría que te preguntáramos más a menudo?'),
  ('es', 'personal', 'prompt', 'Un sueño que hayas tenido esta semana (si te acuerdas)'),
  ('es', 'personal', 'prompt', 'Algo que se te dé bien y que no sepamos'),
  ('es', 'personal', 'prompt', '¿Qué estás esperando con ilusión?'),
  ('es', 'recuerdo', 'prompt', 'Una foto de hace un año'),
  ('es', 'recuerdo', 'prompt', 'Un recuerdo con alguien de este grupo'),
  ('es', 'recuerdo', 'prompt', 'La primera vez que nos conocimos, ¿te acuerdas?'),
  ('es', 'recuerdo', 'prompt', 'Un objeto que guardas por algo especial'),
  ('es', 'recuerdo', 'prompt', 'Una foto de cuando eras pequeño o pequeña'),
  ('es', 'recuerdo', 'prompt', 'Un olor que te devuelve a la infancia'),
  ('es', 'recuerdo', 'prompt', 'Una foto de un viaje que no olvidas'),
  ('es', 'recuerdo', 'prompt', 'Algo que echas de menos de cuando vivíamos más cerca'),
  ('es', 'casa', 'prompt', 'Tu planta, tu mascota o lo que más vida tenga en casa'),
  ('es', 'casa', 'prompt', 'La mesa donde trabajas o estudias'),
  ('es', 'casa', 'prompt', 'Lo que tienes en la mesilla de noche'),
  ('es', 'casa', 'prompt', 'Un objeto de casa con historia'),
  ('es', 'casa', 'prompt', 'Tu taza favorita'),
  ('es', 'casa', 'prompt', 'Cómo está tu cama ahora mismo (sin juzgar)'),
  ('es', 'casa', 'prompt', 'Lo último que has comprado para casa'),
  ('es', 'casa', 'prompt', 'El rincón más desordenado de casa'),
  ('es', 'naturaleza', 'prompt', 'Un árbol que veas a menudo'),
  ('es', 'naturaleza', 'prompt', 'El cielo al atardecer, si lo pillas'),
  ('es', 'naturaleza', 'prompt', 'Algo verde que tengas cerca'),
  ('es', 'naturaleza', 'prompt', 'Una flor, una hoja o una piedra que te encuentres hoy'),
  ('es', 'naturaleza', 'prompt', 'El agua más cercana: un río, el mar, una fuente'),
  ('es', 'naturaleza', 'prompt', 'Cómo se ve hoy la estación del año donde vives'),
  ('es', 'gente', 'prompt', 'Alguien que te haya ayudado esta semana'),
  ('es', 'gente', 'prompt', 'Una persona de tu día a día que te caiga bien'),
  ('es', 'gente', 'prompt', '¿Con quién has hablado hoy que no fuera del trabajo?'),
  ('es', 'gente', 'prompt', 'Algo que te haya dicho alguien y te haya gustado'),
  ('es', 'gente', 'prompt', 'Un desconocido que te haya alegrado el día'),
  ('es', 'rutina', 'prompt', 'Tu desayuno de un día normal'),
  ('es', 'rutina', 'prompt', 'Cómo vas al trabajo, a clase o a donde vayas'),
  ('es', 'rutina', 'prompt', 'Tu pausa favorita del día'),
  ('es', 'rutina', 'prompt', 'Lo primero que haces al llegar a casa'),
  ('es', 'rutina', 'prompt', 'Tu ritual antes de dormir'),
  ('es', 'rutina', 'prompt', 'La hora del día que más te gusta y por qué'),
  ('es', 'rutina', 'prompt', 'Tu sitio para comer entre semana'),
  ('es', 'preguntas', 'prompt', 'Si pudieras teletransportarte a casa de alguien del grupo ahora, ¿a la de quién?'),
  ('es', 'preguntas', 'prompt', '¿Qué superpoder te vendría bien esta semana?'),
  ('es', 'preguntas', 'prompt', '¿Qué harías con un día libre sorpresa mañana?'),
  ('es', 'preguntas', 'prompt', 'Si este grupo fuera una comida, ¿cuál sería?'),
  ('es', 'preguntas', 'prompt', '¿Qué le dirías a tu yo de hace cinco años?'),
  ('es', 'preguntas', 'prompt', '¿Qué es algo que todos deberíamos probar al menos una vez?'),
  ('es', 'preguntas', 'prompt', '¿Montaña o playa esta semana?'),
  ('es', 'preguntas', 'prompt', 'Si pudiéramos quedar todos mañana, ¿dónde sería?'),
  ('es', 'preguntas', 'prompt', '¿Qué palabra te gusta mucho?'),
  ('es', 'preguntas', 'prompt', '¿Qué canción pondrías en nuestra boda, cumpleaños o reencuentro?'),
  ('es', 'humor', 'prompt', 'La foto más absurda que tengas en el móvil de esta semana'),
  ('es', 'humor', 'prompt', 'Algo que te haya salido fatal (y te dé risa)'),
  ('es', 'humor', 'prompt', 'Tu cara ahora mismo, sin filtros'),
  ('es', 'humor', 'prompt', 'Un cartel, letrero o anuncio curioso que hayas visto'),
  ('es', 'humor', 'prompt', 'Lo más raro que hay en tu bolso, mochila o bolsillos'),
  ('es', 'futuro', 'prompt', 'Algo que te gustaría aprender este año'),
  ('es', 'futuro', 'prompt', '¿Dónde te ves dentro de un año?'),
  ('es', 'futuro', 'prompt', 'Una pequeña meta para esta semana'),
  ('es', 'futuro', 'prompt', 'Un deseo para el próximo reencuentro'),
  ('es', 'futuro', 'prompt', 'Algo que quieras celebrar pronto con nosotros'),
  ('es', 'distancia', 'prompt', '¿Qué hora es donde estás y qué estás haciendo?'),
  ('es', 'distancia', 'prompt', 'Algo de tu ciudad que nos encantaría'),
  ('es', 'distancia', 'prompt', 'Una costumbre de donde vives que no hay en casa'),
  ('es', 'distancia', 'prompt', 'Algo que te recuerde a nosotros por ahí'),
  ('es', 'distancia', 'prompt', '¿Qué echas de menos de casa hoy?'),
  ('es', 'distancia', 'prompt', 'Lo que más te gusta de vivir donde vives'),
  ('es', 'distancia', 'prompt', 'Una palabra o expresión local que hayas aprendido');

-- La propuesta del día de un grupo: si aún no existe, se elige de la biblioteca,
-- prefiriendo las que el grupo todavía no ha tenido. La llama la app al abrirse
-- (el servidor hace lo mismo al enviar los avisos). Solo para miembros.
create function daily_prompt(g uuid, d date) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  pid uuid;
begin
  if not is_member(g) then
    raise exception 'Sin acceso';
  end if;
  select id into pid from proposals where group_id = g and kind = 'prompt' and day = d;
  if pid is not null then
    return pid;
  end if;
  insert into proposals (group_id, kind, title, day, library_id, created_by)
  select g, 'prompt', lib.title, d, lib.id, null
  from proposal_library lib
  where lib.kind = 'prompt' and lib.locale = 'es'
  order by exists (
    select 1 from proposals used where used.group_id = g and used.library_id = lib.id
  ), random()
  limit 1
  on conflict do nothing
  returning id into pid;
  return pid;
end;
$$;
revoke all on function daily_prompt(uuid, date) from public, anon;
grant execute on function daily_prompt(uuid, date) to authenticated;
