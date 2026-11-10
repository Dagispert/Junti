# Junti · base de datos

Esquema de PostgreSQL para [Supabase](https://supabase.com), con las reglas de privacidad dentro de la propia base de datos (seguridad a nivel de fila): solo quien pertenece a un grupo puede ver o escribir en él.

- `migrations/0001_esquema_inicial.sql`: tablas del MVP, funciones y políticas.
- `migrations/0002_almacen_de_fotos.sql`: almacén privado de fotos y sus permisos.
- `tests/`: pruebas que comprueban esas reglas (un ajeno no ve nada, nadie edita lo de otro, nadie ve quién omitió una propuesta, quien sale deja de ver el contenido…).

Las migraciones se aplican a mano, en orden, desde el SQL Editor de Supabase.

## Ejecutar las pruebas

Con un PostgreSQL local y una base de datos vacía:

```bash
DATABASE_URL=postgres://usuario@localhost:5432/junti_test supabase/tests/run.sh
```

`tests/00_simular_supabase.sql` imita lo mínimo de Supabase (`auth.users`, `auth.uid()`, rol `authenticated`) y solo se usa en estas pruebas.

## Pendiente

- Impedir que un grupo se quede sin administrador cuando el único que hay lo abandona.
- Purga definitiva de lo eliminado (`deleted_at`) pasado el plazo de conservación.
