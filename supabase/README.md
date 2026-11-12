# Junti · base de datos

Esquema de PostgreSQL para [Supabase](https://supabase.com), con las reglas de privacidad dentro de la propia base de datos (seguridad a nivel de fila): solo quien pertenece a un grupo puede ver o escribir en él.

- `migrations/0001_esquema_inicial.sql`: tablas del MVP, funciones y políticas.
- `migrations/0002_almacen_de_fotos.sql`: almacén privado de fotos y sus permisos.
- `migrations/0003_borrado_de_cuentas.sql`: permite borrar cuentas que crearon grupos o invitaciones.
- `migrations/0004_ajustes_y_salidas.sql`: fotos de perfil, salir de un grupo de forma ordenada, borrar la cuenta propia y volver a un grupo del que se salió.
- `migrations/0005_avisos.sql`: dispositivos suscritos a avisos, una propuesta por grupo y día, biblioteca inicial de propuestas y la función que decide a quién le toca recibirla (por hora local, frecuencia del grupo, silencios y tope diario).
- `migrations/0006_ciudades.sql`: coordenadas (a nivel de ciudad) de la residencia, para el mapa.
- `migrations/0007_canciones.sql`: la banda sonora del grupo (referencias a canciones del catálogo de iTunes, no archivos de audio).
- `migrations/0008_calendario.sql`: calendario del grupo (cumpleaños y aniversarios anuales, viajes, reencuentros, celebraciones) y los recordatorios: el mismo día y, para lo esperado, una semana antes y la víspera.
- `migrations/0009_video_y_voz.sql`: tipo y forma de onda de los archivos; límite de 50 MB por archivo y solo imágenes, vídeo y audio en el almacén.
- `migrations/0010_narradora.sql`: la narradora (IA) por grupo, desactivada por defecto, con estilo y opción de cada persona de no participar; tabla de narraciones que solo escribe el servidor.
- `migrations/0011_escenas.sql`, `0012_voz_narradora.sql`: la crónica por escenas y su voz (audio en `media/<grupo>/narradora/`).
- `migrations/0013_avisos_de_actividad.sql`: avisos agrupados de momentos nuevos, comentarios en tus momentos y gente nueva; respetan el silencio y las horas de descanso.
- `migrations/0014_mas_propuestas.sql`: biblioteca de 153 propuestas por temas y `daily_prompt()`, con la que la app crea la propuesta del día sin repetir.
- `migrations/0015_recuerdos_y_preguntas.sql`: recuerdos fechados en el pasado (`memory`, `shared_at`), encuestas, quiz y preguntas abiertas (las respuestas ajenas se ven al responder; la solución del quiz, aparte), y sus avisos.
- `functions/narrate/`: escribe la crónica de una semana o un mes con Gemini. Necesita el secreto `GEMINI_API_KEY` en *Edge Functions → Secrets* (opcional `GEMINI_MODEL`). Solo envía textos, nunca fotos, vídeos ni audios.
- `functions/send-proposals/`: programa del servidor que envía esos avisos y los recordatorios del calendario. Genera sus propias claves la primera vez.
- `programar_avisos.sql`: lo ejecuta cada 15 minutos. Se lanza una vez, a mano, tras desplegar la función.
- `tests/`: pruebas que comprueban esas reglas (un ajeno no ve nada, nadie edita lo de otro, nadie ve quién omitió una propuesta, quien sale deja de ver el contenido…).

Las migraciones se aplican a mano, en orden, desde el SQL Editor de Supabase.

## Ejecutar las pruebas

Con un PostgreSQL local y una base de datos vacía:

```bash
DATABASE_URL=postgres://usuario@localhost:5432/junti_test supabase/tests/run.sh
```

`tests/00_simular_supabase.sql` imita lo mínimo de Supabase (`auth.users`, `auth.uid()`, rol `authenticated`) y solo se usa en estas pruebas.

## Pendiente

- Purga definitiva de lo eliminado (`deleted_at`) pasado el plazo de conservación.
