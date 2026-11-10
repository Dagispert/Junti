# Junti — Análisis y definición de producto

> Documento de trabajo v0.1 · Respuesta al briefing «Aplicación de conexión y memoria compartida».
> Cubre los 11 puntos pedidos en la sección 19 del briefing. Todavía no hay código: las decisiones marcadas como **[DECISIÓN]** están pendientes de validar (ver §12).
> «Junti» es el nombre del repositorio; lo uso como nombre provisional del producto.

---

## 0. Resumen ejecutivo

- **El concepto es viable** técnica y económicamente. Ninguna pieza del MVP requiere tecnología nueva; el riesgo no es técnico sino de **hábito**: que un grupo de 4–8 personas siga respondiendo a las propuestas en la semana 6.
- **El MVP debe validar una sola hipótesis:** *«si un grupo recibe una propuesta sugerente a una hora razonable, comparte algo, y le gusta ver lo que comparten los demás»*. Todo lo que no sirva para probar eso sale del MVP.
- **Tres simplificaciones estructurales** que propongo (detalladas en §3):
  1. *Propuesta* y *Reto* son el mismo objeto con distinta duración; una *Participación* es simplemente un *Momento* vinculado a una propuesta.
  2. *Feed*, *Archivo cronológico*, *Diario* y *Memoria* son vistas de los mismos datos; se reducen a dos: **Hoy** (lo reciente) y **Memoria** (el tiempo).
  3. *Inicio* y *Momentos* de la navegación propuesta se solapan; la navegación pasa a ser de dos niveles (lista de grupos → espacio del grupo).
- **Stack recomendado:** React Native + Expo (TypeScript) en cliente; Supabase (PostgreSQL, Auth, seguridad a nivel de fila, funciones) alojado en la UE; almacenamiento multimedia compatible con S3 sin coste de salida; Claude API para la narración en Fase 3.
- **Monetización recomendada:** premium **por grupo** (uno paga, todos disfrutan), con la regla de producto *«los recuerdos nunca son rehenes»*: la versión gratuita jamás borra ni oculta contenido ya compartido.

---

## 1. Viabilidad técnica y económica

### 1.1 Técnica

| Área | Dificultad | Comentario |
|---|---|---|
| Auth, grupos, invitaciones | Baja | Resuelto con servicios gestionados. |
| Momentos (foto + texto), feed, reacciones, comentarios | Baja | CRUD con subida de archivos. Lo delicado es que publicar sea *instantáneo* (subida en segundo plano, cola sin conexión). |
| Vídeo corto | Media | Compresión en el dispositivo, miniatura, reproducción en streaming. Es el mayor coste de almacenamiento. |
| Notificaciones programadas por zona horaria | Media | Es el corazón diferencial y la parte con más casos límite (ver §5.4). |
| Votación de frecuencia | Baja | Pero es fricción en el alta; propongo simplificarla (§2). |
| Mapa | Media | Marcadores a nivel de ciudad, agrupación (*clustering*), filtros. Coste de teselas a vigilar. |
| Resúmenes semanales/mensuales (sin IA) | Baja-media | Selección por reglas de variedad. |
| Narración con IA, hitos, propuestas personalizadas | Media | Técnicamente sencillo; lo difícil es el consentimiento y no inventar hechos. |
| Búsqueda semántica | Media | *Embeddings* en la propia base de datos (pgvector), filtrados siempre por pertenencia al grupo. |
| Vídeo anual con música y narración | **Alta** | Renderizado en servidor, licencias musicales, coste de cómputo. Propongo un paso intermedio (§4.6). |

### 1.2 Económica (órdenes de magnitud, a confirmar con precios vigentes)

- **Coste dominante: almacenamiento y entrega de vídeo.** Una foto comprimida ronda 300–500 KB; un vídeo de 15–30 s a 720p, 5–15 MB. Un grupo de 5 personas activo, con fotos y algún vídeo, genera del orden de 1–3 GB al año. Con almacenamiento de objetos sin coste de salida, eso son **céntimos por grupo y año**. Sin límite de duración de vídeo, la cifra se multiplica por 10 o más: de ahí el límite de 30 s en la versión gratuita.
- **Costes fijos de arranque:** backend gestionado (decenas de €/mes), cuentas de desarrollador de Apple (99 USD/año) y Google (25 USD, pago único), dominio y correo transaccional. Un MVP con unos cientos de grupos puede operar por debajo de 100 €/mes.
- **SMS:** el alta por teléfono cuesta varios céntimos por verificación y atrae fraude. Recomiendo **no incluirlo en el MVP** (ver §12).
- **IA de texto:** un resumen semanal por grupo consume pocos miles de *tokens* → fracciones de céntimo a pocos céntimos. Asumible incluso en la versión gratuita con cadencia limitada. El análisis de imágenes y, sobre todo, la generación de vídeo sí justifican el premium.
- **Ingresos:** el valor crece con los años (cuanto más archivo, más difícil irse), lo que favorece la retención de suscripciones, pero la conversión inicial será baja: el producto debe poder sobrevivir con costes mínimos durante la fase de validación.

**Riesgos principales**

1. **Arranque en frío del grupo.** Un grupo vacío no dice nada. Mitigación: la primera propuesta se lanza en el mismo momento de crear el grupo.
2. **Efecto «solo publica uno».** Si en 2 semanas solo participa una persona, el grupo muere. Mitigación: propuestas colectivas muy fáciles («el cielo de hoy») y grupos pequeños.
3. **Competencia por atención** con WhatsApp (ya tienen un grupo allí). El diferencial debe sentirse en la primera semana: la propuesta y el primer resumen semanal.
4. **Normativa y tiendas de aplicaciones** (§10): borrado de cuenta dentro de la app, mecanismo de denuncia de contenido incluso en grupos privados, edad mínima.

---

## 2. Problemas de experiencia de usuario detectados

| # | Problema | Propuesta |
|---|---|---|
| 1 | **La votación de frecuencia al crear el grupo bloquea el arranque**: hay que esperar a que todos voten antes de que pase nada. | El creador elige una frecuencia inicial (por defecto, 3 veces por semana). Cada miembro, al unirse, indica su preferencia en una sola pantalla. Cuando ha respondido la mayoría, la app propone el ajuste si difiere. La votación formal queda disponible en Ajustes. En empate decide el administrador. |
| 2 | **«Una propuesta diaria» no significa lo mismo en Valladolid y en Ciudad de México.** | La propuesta pertenece a un *día del grupo* y cada persona la recibe **a su hora local preferida**. Permanece abierta hasta que llega la siguiente; nunca «caduca» con mensaje de fallo. |
| 3 | **Responder desde la notificación** es limitado: iOS y Android permiten respuesta rápida de texto, no hacer una foto. | Dos acciones en la notificación: «Responder» (texto) y «Abrir cámara» (enlace directo a la cámara con la propuesta ya asociada). |
| 4 | **Publicar en varios grupos a la vez** es el error de privacidad más probable (la foto para la pareja acaba en el grupo familiar). | Por defecto se publica en el grupo en el que estás. Añadir más grupos es un paso explícito, con los destinos visibles antes de confirmar. Técnicamente son momentos independientes (reacciones y comentarios separados). |
| 5 | **Mostrar «quién ha participado» puede generar culpa**, que el briefing quiere evitar. | Se muestra quién *sí* ha participado (avatares), nunca una lista de ausentes, porcentajes ni rachas. Sin «visto por». |
| 6 | **Comentarios que derivan en chat.** | Un solo nivel (sin hilos), sin indicador de «escribiendo», sin notificación por cada comentario (se agrupan). Se muestran 2–3 y el resto se pliega. |
| 7 | **Fatiga de notificaciones** al pertenecer a varios grupos. | Tope global por usuario (p. ej. máximo 2 propuestas al día sumando todos los grupos) y agrupación del resto de avisos en un resumen. Silenciar por grupo: 1 día / 1 semana / hasta que yo vuelva. |
| 8 | **Quien se une tarde**: ¿ve todo el historial? | Sí por defecto (es la gracia del archivo), avisando al grupo de que el nuevo miembro lo verá. **[DECISIÓN]** |
| 9 | **Salida de un miembro**: conflicto entre «mi contenido es mío» y «el recuerdo es del grupo». | Al salir, la persona elige: dejar sus momentos, o retirarlos. Los comentarios en momentos ajenos se conservan con el nombre. El borrado de cuenta elimina todo su contenido (RGPD). **[DECISIÓN]** |
| 10 | **La hora mostrada en un momento.** | Se guarda el instante en UTC *y* la zona horaria del autor. Se muestra «hace 2 h» en el feed y «08:30 en Ciudad de México» en la Memoria: saber que era su mañana forma parte del recuerdo. |
| 11 | **El «botón principal de publicar» compite con cinco pestañas.** | El botón «+» ocupa el centro de la barra inferior (§6). |
| 12 | **Edición de momentos**: editar un recuerdo meses después altera el archivo. | Texto editable siempre (con marca «editado»); foto/vídeo no reemplazable, solo eliminable. |

---

## 3. Funcionalidades redundantes o a reordenar

No elimino ninguna funcionalidad importante; fusiono o aplazo las siguientes, con su motivo:

1. **Propuestas de participación (§5.2) + Retos (§6) → un solo objeto «Propuesta».**
   Ambos son «una invitación a compartir algo, con respuestas». Difieren en duración (un día frente a una semana o un mes) y en origen (biblioteca, administrador, IA). Un solo modelo reduce a la mitad el trabajo y evita que el usuario tenga que entender dos conceptos. En la interfaz se mantienen los nombres: «Propuesta de hoy» y «Retos».
2. **Participación (entidad) → un Momento con `proposal_id`.**
   La respuesta a un reto *es* un momento. Así entra sola en el feed, en la Memoria y en el mapa, sin duplicar lógica.
3. **Feed cronológico (§4.2) + Archivo (Fase 1) + Diario (§8.1) → dos vistas: «Hoy» y «Memoria».**
   Son los mismos datos. «Hoy» es lo reciente en orden inverso; «Memoria» es la navegación por semanas, meses y años. El MVP incluye una Memoria mínima (vista por meses), no un tercer listado.
4. **Pestañas «Inicio» y «Momentos» → se fusionan** (ver §6).
5. **Álbumes en el perfil (§10)** → se aplazan a Fase 2 y pasan a ser del grupo, no de la persona: un álbum personal dentro de un grupo se parece demasiado a un perfil de red social. En el MVP el perfil muestra «sus momentos» filtrados.
6. **«Reacciones personalizadas»** → fuera del MVP. Cualquier emoji del teclado es suficiente y más expresivo que un conjunto cerrado.
7. **Nota de voz** → figura en §4 pero no en la lista de Fase 1 del briefing. Propongo Fase 2 (el modelo de datos ya la contempla).
8. **Ubicación en el momento** → la interfaz llega con el mapa (Fase 2), como indica el briefing; los campos existen desde el MVP para no migrar.
9. **Frecuencia «cada quince días»** → la mantengo, pero aviso: con una propuesta quincenal el hábito difícilmente se forma. No será el valor por defecto.
10. **Vídeo anual con música y narración** → se mantiene en Fase 3, precedido de una versión intermedia más barata (§4.6).

---

## 4. Mejoras propuestas (respetando la filosofía)

1. **«Tal día como hoy».** Una vez el grupo tiene historia, la pantalla Hoy puede abrir con un momento de hace un año. Es barato, no requiere IA y materializa la promesa del producto. Fase 2.
2. **Widget de pantalla de inicio** con el último momento del grupo. Es literalmente «una ventana a la vida de quienes quieres» y no exige abrir la app. Fase 2.
3. **Primera propuesta inmediata.** Al crear el grupo, antes incluso de invitar: «Enséñales desde dónde estás creando este grupo». Los invitados llegan a un espacio que ya tiene vida.
4. **Invitación con contexto.** El enlace muestra el nombre y la imagen del grupo y quién invita, antes de pedir el registro.
5. **Cápsula de reencuentro.** Tipo de evento «nos vemos en persona»: los momentos de esos días se agrupan automáticamente. Encaja con «mantener viva la relación entre un encuentro y el siguiente». Fase 2.
6. **Recopilación como «historia» dentro de la app antes que como archivo de vídeo.** Una secuencia a pantalla completa (fotos, textos, narración, transiciones) se construye en el cliente, sin coste de renderizado ni licencias. El vídeo exportable llega después como función premium.
7. **Exportación completa del grupo** (fotos + textos en un archivo). Genera confianza: «esto es vuestro». También es obligación de portabilidad del RGPD para los datos propios.
8. **Publicación sin conexión.** El momento se guarda y se sube cuando hay red; quien publica nunca espera.
9. **Sin contadores.** Ni número de reacciones destacado, ni «visto por», ni rachas, ni estadísticas de actividad por persona.
10. **Álbum impreso** (a futuro, Fase 4): vía de ingresos coherente con «memoria» y sin suscripción.

---

## 5. Arquitectura técnica

### 5.1 Stack recomendado **[DECISIÓN]**

| Capa | Elección | Motivo |
|---|---|---|
| App móvil | **React Native + Expo**, TypeScript | Una base de código para iOS y Android, actualizaciones sin pasar por la tienda, buen soporte de cámara, notificaciones y enlaces profundos. |
| Backend | **Supabase** (PostgreSQL + Auth + funciones + tiempo real), región UE | El modelo es claramente relacional. La **seguridad a nivel de fila** expresa «solo los miembros del grupo ven su contenido» en la propia base de datos, no en cada pantalla. SQL estándar, sin atarse a un proveedor. |
| Multimedia | Almacenamiento de objetos compatible con S3, URLs firmadas de corta duración | Coste de salida nulo o bajo; el acceso se autoriza siempre comprobando la pertenencia al grupo. |
| Notificaciones | Servicio de notificaciones de Expo (APNs / FCM) | Sencillo; reemplazable más adelante. |
| Tareas programadas | Planificador en la base de datos + funciones | Envío de propuestas, generación de resúmenes. |
| Mapa (F2) | MapLibre + proveedor de teselas | Sin dependencia de un único proveedor; coste controlable. |
| IA (F3) | Claude API (narración, hitos, propuestas) + pgvector (búsqueda) | Con acuerdo de tratamiento de datos y sin uso del contenido para entrenar. |
| Vídeo (F3) | Renderizado en servidor bajo demanda | Solo para la exportación premium. |

Alternativa razonable: Flutter + Firebase. La descarto como primera opción porque el modelo de permisos por grupo y las consultas de la Memoria (por periodo, persona, lugar) son más naturales y auditables en SQL.

### 5.2 Módulos

```
App móvil (Expo)
 ├─ auth · grupos · momentos · propuestas · memoria · [mapa] · [calendario] · ajustes
 └─ cola local de subidas + caché sin conexión
        │  HTTPS
Backend
 ├─ Auth ................ sesiones, proveedores de identidad
 ├─ API de datos ........ PostgreSQL + políticas por fila (permisos = pertenencia)
 ├─ Multimedia .......... subida directa con URL firmada → miniaturas → acceso firmado
 ├─ Planificador ........ propuestas por zona horaria, resúmenes, recordatorios
 ├─ Notificaciones ...... push, agrupación, topes por usuario
 └─ [IA] ................ narración, hitos, embeddings — aislada tras una interfaz propia
```

Los módulos entre corchetes llegan en fases posteriores, pero el modelo de datos ya los prevé.

### 5.3 Multimedia

- Compresión **en el dispositivo** antes de subir (foto: lado largo ~2048 px; vídeo: 720p, máximo 30 s en gratuito).
- Subida directa al almacenamiento con URL firmada; el momento aparece al instante en el dispositivo del autor con estado «subiendo».
- Se eliminan los metadatos EXIF de localización al subir: **la ubicación solo existe si el usuario la añade a mano**.
- Miniaturas y *blurhash* para que el feed cargue sin saltos.
- Copias de seguridad de base de datos y versionado en el almacenamiento.

### 5.4 Motor de propuestas (la pieza crítica)

- El **grupo** define una cadencia (qué días) y un catálogo de categorías permitidas.
- Cada **miembro** define su hora preferida y su franja de descanso, en su zona horaria (tomada del dispositivo, editable).
- Un proceso periódico (cada 15 min) calcula a quién le toca recibir la propuesta vigente según *su* hora local y envía.
- La propuesta se elige de la biblioteca evitando repetir categoría y texto recientes; el administrador puede fijar una propia.
- Acciones del usuario: **responder, posponer (más tarde hoy / mañana), omitir**. Omitir no deja rastro visible para los demás.
- Tope global de avisos por usuario y día entre todos sus grupos.
- Cambios de zona horaria (viajes) y de hora de verano se resuelven recalculando en cada pasada, no guardando horas absolutas.

---

## 6. Estructura de navegación

La propuesta del briefing (Inicio · Momentos · Retos · Mapa · Memoria) mezcla dos niveles: lo que es de *todos mis grupos* y lo que es de *un grupo*. Un mapa o una memoria «global» mezclaría a la familia con los amigos de la universidad, y cada grupo debe ser «un universo independiente». Propongo dos niveles:

```
NIVEL 0 — Mis grupos (pantalla principal, §14.3 del briefing)
  Cabecera: perfil · ajustes · avisos
  Tarjetas de grupo: imagen, nombre, integrantes, últimos momentos, propuesta pendiente
  Acciones: crear grupo · unirse con código

NIVEL 1 — Dentro de un grupo (barra inferior)
  [ Hoy ]  [ Retos ]  [  +  ]  [ Mapa ]  [ Memoria ]
  Cabecera: nombre del grupo (toca para cambiar de grupo) · integrantes · ajustes del grupo
```

- **Hoy**: propuesta vigente arriba + momentos recientes. Sustituye a «Inicio» y «Momentos».
- **Retos**: activos, biblioteca y finalizados.
- **+**: publicar un momento (el botón principal que pide §4.1).
- **Mapa**: Fase 2. En el MVP la barra tiene cuatro elementos.
- **Memoria**: en el MVP, archivo por meses; después, resúmenes, búsqueda, álbumes y calendario.

Quien solo tiene un grupo entra directamente en él. Como pide el briefing, esto es una propuesta a validar con prototipo y pruebas de usabilidad.

---

## 7. Flujos de usuario

1. **Alta.** Abrir → correo (código de un solo uso) o Apple/Google → nombre y foto → permiso de notificaciones explicado *después* de ver su valor → pantalla «Mis grupos» vacía con dos acciones: crear o unirse.
2. **Crear grupo.** Nombre + imagen → frecuencia inicial → primera propuesta inmediata (publicar o saltar) → compartir enlace de invitación.
3. **Unirse.** Abrir enlace → vista previa del grupo y de quién invita → alta si hace falta → preferencia de frecuencia y hora (una pantalla) → entra en «Hoy» con lo ya publicado.
4. **Responder a una propuesta.** Notificación a su hora local → «Abrir cámara» → foto → texto opcional → publicar. Objetivo: **menos de 10 segundos y 3 toques**.
5. **Momento espontáneo.** «+» → cámara por defecto (galería, vídeo y texto a un gesto) → publicar en el grupo actual.
6. **Asomarse.** Abrir la app → «Hoy» → reaccionar con un toque, comentar si apetece.
7. **Reto.** Administrador elige de la biblioteca o crea uno → aviso al grupo → cada respuesta es un momento → al finalizar, el reto queda como colección en la Memoria.
8. **Recordar.** Memoria → mes → momento. (F2: búsqueda, resúmenes, mapa.)
9. **Pausar.** Ajustes del grupo → silenciar durante un tiempo. Nadie más lo ve.
10. **Salir / borrar cuenta.** Elegir qué pasa con mis momentos → confirmación. Si era el único administrador, se traspasa el rol antes.

---

## 8. Pantallas principales

| Pantalla | Contenido esencial | Fase |
|---|---|---|
| Bienvenida y alta | Una frase, una imagen, acceso. Sin carrusel largo. | 1 |
| Mis grupos | Tarjetas grandes con mosaico de momentos recientes; punto discreto si hay propuesta pendiente. | 1 |
| Hoy (grupo) | Tarjeta de propuesta (responder · posponer · omitir) + momentos a ancho completo, autor y hora en pequeño, reacciones bajo la foto. | 1 |
| Publicar | Cámara a pantalla completa; modos foto · vídeo · texto · galería; después, texto y destino. | 1 |
| Detalle de momento | Contenido, texto, reacciones, comentarios en un nivel; menú: editar texto, eliminar, denunciar. | 1 |
| Retos | Activos (con avatares de quienes han respondido), biblioteca por categorías, finalizados. | 1 |
| Ficha de reto | Título, descripción, fechas, cuadrícula de respuestas. | 1 |
| Memoria | Línea de tiempo por meses → cuadrícula. Después: resúmenes, «tal día como hoy», búsqueda, álbumes. | 1 → 2 |
| Integrantes y perfil en el grupo | Foto, nombre, ciudad (si la comparte), hora local actual, sus momentos. | 1 |
| Ajustes del grupo | Identidad, color, frecuencia y votación, invitaciones, roles, salir. | 1 |
| Ajustes personales | Perfil, zona horaria, horario de avisos, silencios, privacidad, exportar, borrar cuenta. | 1 |
| Mapa | Residencias y momentos con ubicación; filtros por persona, fecha y categoría. | 2 |
| Calendario | Cumpleaños, aniversarios, reencuentros; recordatorios. | 2 |
| Resumen / recopilación | Historia a pantalla completa con narración; revisar y aprobar antes de exportar. | 2 → 3 |

**Línea visual:** fondo cálido y neutro, la fotografía como protagonista, una tipografía con carácter para titulares y otra muy legible para texto, color de acento propio de cada grupo, movimiento sutil. Detalle distintivo: mostrar la **hora local de cada persona** junto a su nombre («Ana · 08:30 en CDMX»), que convierte la distancia en algo tangible y amable.

---

## 9. Modelo de datos

Parte de las entidades del briefing (§15), con los cambios razonados en §3 y las entidades que faltaban.

```
users            id, name, avatar_url, email, timezone, home_city, home_country,
                 home_visible, locale, created_at, deleted_at

devices          id, user_id, push_token, platform, last_seen_at

groups           id, name, description, cover_url, color, created_by, created_at,
                 cadence (días), narration_style, ai_enabled, settings (json)

memberships      group_id, user_id, role (admin|member), status (active|left|removed),
                 joined_at, left_at, preferred_hour, quiet_from, quiet_to,
                 muted_until, frequency_vote

invitations      id, group_id, code, created_by, expires_at, max_uses, uses, revoked_at

media_assets     id, owner_id, kind (photo|video|audio), storage_key, thumb_key,
                 width, height, duration_s, bytes, blurhash, status

moments          id, group_id, author_id, text, proposal_id (nulo si es espontáneo),
                 created_at (UTC), author_tz, place_name, lat, lng (precisión de ciudad),
                 edited_at, deleted_at
moment_media     moment_id, media_asset_id, position

reactions        moment_id, user_id, emoji, created_at       (única por usuario+emoji)
comments         id, moment_id, user_id, text, created_at, deleted_at

proposal_library id, locale, category, kind (prompt|challenge), title, body, suggested_days
proposals        id, group_id, library_id (nulo si es propia), created_by,
                 kind (prompt|challenge), scope (individual|collective),
                 title, body, image_url, starts_at, ends_at, status
proposal_states  proposal_id, user_id, state (sent|snoozed|skipped|answered), snoozed_until
                 -- privado: solo lo ve el propio usuario y el planificador

notifications    id, user_id, group_id, type, payload, scheduled_for, sent_at, status

events      (F2) id, group_id, title, description, date, recurrence, kind, created_by
albums      (F2) id, group_id, title, cover_moment_id, created_by   + album_moments
memories    (F2) id, group_id, period_type (week|month|year|custom), period_start,
                 period_end, narration, style, status (draft|approved), media_url
                 + memory_moments (memory_id, moment_id, position)
milestones  (F3) id, group_id, moment_id, kind, title, date,
                 status (suggested|confirmed|dismissed), confirmed_by
embeddings  (F3) moment_id, vector

consents         user_id, group_id, type (ai_processing|…), granted_at, revoked_at
reports          id, reporter_id, moment_id | comment_id, reason, created_at, status
subscriptions (F4) id, group_id, payer_id, plan, status, period_end
```

Notas de diseño:

- **Publicar en varios grupos** crea un `moment` por grupo que comparte `media_assets` (el archivo no se duplica; se borra cuando ningún momento lo referencia).
- **Borrado lógico** (`deleted_at`) con purga definitiva del contenido y los archivos tras un plazo corto (propuesta: 30 días), documentado en la política de privacidad.
- **Toda tabla con `group_id`** lleva una política: «el usuario tiene una pertenencia activa a ese grupo». Las tablas hijas la heredan a través del momento.
- `proposal_states` separado y privado garantiza técnicamente que nadie pueda ver quién omitió o pospuso.

---

## 10. Privacidad, seguridad y cumplimiento

- **Privacidad desde el diseño:** sin perfiles públicos, sin búsqueda de usuarios, sin directorio. A un grupo solo se entra por invitación; los enlaces caducan y son revocables.
- **Cifrado** en tránsito (TLS) y en reposo. **No propongo cifrado de extremo a extremo**: es incompatible con resúmenes, búsqueda y narración en servidor, que son el diferencial del producto. Debe decirse con claridad al usuario. **[DECISIÓN]**
- **IA con consentimiento:** activación a nivel de grupo y explicación clara de qué se procesa y para qué; cualquier miembro puede excluir sus momentos de la narración. Proveedor con acuerdo de encargo de tratamiento y sin entrenamiento con el contenido. La IA narra **solo** a partir de lo compartido y los hitos se presentan como sugerencias a confirmar.
- **RGPD / LOPDGDD:** base jurídica y finalidad por tratamiento, registro de actividades, encargados de tratamiento con contrato, alojamiento en la UE, derechos de acceso, rectificación, supresión y portabilidad accesibles desde la app, plazos de conservación definidos. Dado el volumen de imágenes y ubicaciones conviene una evaluación de impacto antes del lanzamiento público. *Esto es un análisis de producto, no asesoría legal: hará falta revisión de un profesional antes de publicar.*
- **Edad mínima:** en España el consentimiento digital es válido desde los 14 años; en otros países de la UE llega a 16. **[DECISIÓN]**
- **Requisitos de las tiendas:** borrado de cuenta desde la app; si se ofrece acceso con Google, ofrecer también una alternativa equivalente centrada en privacidad (Apple); las apps con contenido de usuarios deben permitir **denunciar contenido y bloquear**, aunque los grupos sean privados; declaración de datos recogidos.
- **Terceras personas:** las fotos incluirán a gente ajena al grupo (y menores). Se cubre en condiciones de uso y con la posibilidad de que cualquier miembro pida retirar un momento.
- **Descarga:** cualquier miembro puede guardar una foto con una captura de pantalla; es más honesto dar control sobre la *exportación masiva* (configurable por grupo) que prometer algo que no se puede garantizar.

---

## 11. Alcance exacto del MVP y plan por etapas

### 11.1 MVP — dentro

1. Alta e inicio de sesión: correo con código + Apple + Google.
2. Perfil: nombre, foto, zona horaria (automática, editable), ciudad opcional.
3. Grupos privados: crear, editar (nombre, imagen, color, descripción), roles administrador/miembro, traspaso de administración.
4. Invitación por enlace y código, con caducidad y revocación.
5. Momentos: foto (cámara o galería, hasta varias), vídeo ≤ 30 s, texto; editar texto y eliminar.
6. «Hoy»: feed cronológico con carga fluida y publicación sin conexión.
7. Reacciones con emoji y comentarios de un nivel.
8. Motor de propuestas: frecuencia del grupo, hora local por miembro, biblioteca inicial (~150 propuestas en español, por categorías), posponer / omitir / silenciar.
9. Preferencia de frecuencia por miembro con propuesta de consenso (versión simplificada de la votación).
10. Retos básicos: biblioteca + personalizados, con fecha límite opcional y ficha de respuestas.
11. Memoria mínima: archivo por meses.
12. Notificaciones: propuesta, nuevo momento (agrupadas), comentario en tu momento, nuevo miembro.
13. Privacidad y cumplimiento mínimos: salir de un grupo, borrar cuenta, denunciar contenido, política de privacidad y condiciones.

### 11.2 MVP — fuera (y por qué)

| Fuera | Motivo | Fase |
|---|---|---|
| Mapa, ubicación en momentos | No es necesario para validar el hábito. | 2 |
| Nota de voz | Añade complejidad de grabación y reproducción; no estaba en la Fase 1 del briefing. | 2 |
| Resúmenes, álbumes, búsqueda, calendario | Necesitan semanas de contenido para tener sentido. | 2 |
| Toda la IA | Sin contenido no hay nada que narrar; además requiere el marco de consentimiento. | 3 |
| Alta por teléfono | Coste y fraude por SMS. | A decidir |
| Premium | No se monetiza antes de validar. | 4 |
| Versión web | El producto es de cámara y notificaciones. | — |

### 11.3 Cómo sabremos que funciona (métricas internas, nunca visibles para los usuarios)

- % de grupos con **≥ 3 personas publicando** en su cuarta semana.
- % de propuestas recibidas que obtienen respuesta, por frecuencia elegida.
- % de usuarios que abren la app sin haber recibido notificación (*curiosidad*, el objetivo del §18).
- Entrevistas con los grupos de la beta: ¿os habéis enterado de algo que no habríais sabido por WhatsApp?

### 11.4 Plan por etapas

Estimaciones orientativas para un equipo pequeño (1–2 personas de desarrollo y una de diseño); dependen de la respuesta a §12.1.

| Etapa | Contenido | Duración |
|---|---|---|
| **0 · Definición** | Cerrar decisiones de §12 · identidad y nombre · prototipo navegable de 8–10 pantallas · prueba con 3–5 grupos reales · textos legales en borrador | 2–3 sem |
| **1a · Cimientos** | Proyecto, esquema y políticas de acceso, alta, perfil, grupos, invitaciones | 3 sem |
| **1b · Momentos** | Cámara, compresión, subida, feed, reacciones, comentarios, sin conexión | 3–4 sem |
| **1c · Propuestas** | Planificador por zona horaria, biblioteca, notificaciones, retos, preferencias | 3 sem |
| **1d · Cierre de MVP** | Memoria mínima, ajustes, denuncias, borrado de cuenta, pulido, analítica respetuosa | 2 sem |
| **Beta cerrada** | 10–20 grupos reales durante 4–6 semanas; iterar sobre propuestas y avisos | 4–6 sem |
| **2 · Memoria y lugar** | Mapa, ubicación voluntaria, nota de voz, álbumes, resúmenes semanales/mensuales por reglas, búsqueda, calendario, «tal día como hoy», widget, exportación | 8–10 sem |
| **3 · IA** | Consentimiento, narración con estilos, hitos sugeridos, propuestas personalizadas, búsqueda semántica, recopilación anual como historia y después vídeo exportable | 8–10 sem |
| **4 · Expansión** | Premium por grupo, más capacidad, personalización avanzada, álbum impreso, integraciones | continuo |

Los resúmenes semanales **por reglas** llegan en la Fase 2 y la IA los mejora en la Fase 3: así el valor de «memoria» aparece antes y la IA no es un punto único de fallo.

---

## 12. Decisiones abiertas

Ordenadas por cuánto condicionan el trabajo siguiente. Entre paréntesis, mi recomendación.

**Condicionan el arranque**

1. **Equipo y presupuesto.** ¿Quién va a construirlo (tú con ayuda de IA, un equipo, una agencia) y con qué horizonte? Determina el stack y los plazos.
2. **Stack.** ¿Conforme con React Native/Expo + Supabase en la UE? (Sí, salvo que haya experiencia previa en otra tecnología.)
3. **Nombre.** ¿«Junti» es el nombre del producto o solo del repositorio?
4. **Idiomas de lanzamiento.** (Español primero, con la app preparada para traducir; inglés en Fase 2.)
5. **Métodos de acceso.** (Correo con código + Apple + Google; teléfono más adelante.)

**Condicionan el diseño**

6. **Tamaño de grupo.** (De 2 a 20 personas; por encima deja de ser íntimo.)
7. **Quién puede invitar y crear retos.** (Invitar: cualquiera, con opción de restringirlo a administradores. Retos: cualquiera.)
8. **Historial para quien llega tarde.** (Visible, avisando al grupo.)
9. **Salida de un miembro.** (La persona elige entre dejar o retirar sus momentos.)
10. **Duración máxima de vídeo.** (30 s gratuito; 2 min premium.)
11. **Edad mínima.** (16 años, para simplificar el lanzamiento internacional.)

**Condicionan fases posteriores**

12. **Sin cifrado de extremo a extremo**, a cambio de memoria e IA en servidor. (Aceptarlo y comunicarlo con transparencia.)
13. **Premium por grupo o individual.** (Por grupo.)
14. **Límites de la versión gratuita.** (Limitar calidad y duración de vídeo y funciones avanzadas; nunca la antigüedad del archivo.)
15. **Mercado inicial.** (España y Latinoamérica: es exactamente el caso de emigración que motiva el producto.)

---

## 13. Siguiente paso propuesto

Con las cinco primeras decisiones cerradas se puede empezar la Etapa 0 en paralelo por dos vías: prototipo navegable de las pantallas clave (Mis grupos, Hoy, Publicar, Propuesta, Memoria) y esqueleto técnico del proyecto con el esquema de datos y las políticas de acceso de §9.
