# Junti · base de datos

Esquema de PostgreSQL para [Supabase](https://supabase.com), con las reglas de privacidad dentro de la propia base de datos (seguridad a nivel de fila): solo quien pertenece a un grupo puede ver o escribir en él.

- `migrations/0001_esquema_inicial.sql`: tablas del MVP, funciones y políticas.
- `migrations/0002_almacen_de_fotos.sql`: almacén privado de fotos y sus permisos.
- `migrations/0003_borrado_de_cuentas.sql`: permite borrar cuentas que crearon grupos o invitaciones.
- `migrations/0004_ajustes_y_salidas.sql`: fotos de perfil, salir de un grupo de forma ordenada, borrar la cuenta propia y volver a un grupo del que se salió.
- `migrations/0005_avisos.sql`: dispositivos suscritos a avisos, una propuesta por grupo y día, biblioteca inicial de propuestas y la función que decide a quién le toca recibirla (por hora local, frecuencia del grupo, silencios y tope diario).
- `migrations/0006_ciudades.sql`: coordenadas (a nivel de ciudad) de la residencia, para el mapa.
- `migrations/0007_canciones.sql`: la banda sonora del grupo (referencias a canciones del catálogo de iTunes, no archivos de audio).
- `functions/send-proposals/`: programa del servidor que envía esos avisos. Genera sus propias claves la primera vez.
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
