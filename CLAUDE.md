# Junti: notas para quien trabaje en el código

## Cada minijuego nuevo tiene que tener TODO esto

Un minijuego no está terminado hasta que tiene:

1. **Su pantalla** para jugar (`mobile/src/app/<juego>/[id].tsx`) y la de crearlo (`new-<juego>.tsx`), con su entrada en «Minijuegos» del «+» (`app/add.tsx`).
2. **Su tarjeta propia en «Hoy»** (`components/minijuegos-hoy.tsx`), con identidad visual propia, animación de entrada y la inclinación 3D (`lib/inclinacion.ts`; en iPhone no se usa: nunca pedir el permiso de movimiento).
3. **Comentarios** (`ComentariosJuego`), también mientras está abierto (con un aviso de no destripar si hace falta).
4. **Su versión en las historias de la semana y el mes**: los datos en `lib/juegos-pelicula.ts` (`cargarJuegos`), su tipo en `pelicula/guion.ts` (`JuegoPieza` y `TipoPieza`) y su animación en `pelicula/mesa.ts`. Si sigue abierto, sin desvelar nada.
5. **Su fotograma en el carrete del mes** (`useFotogramasJuegos` y `rutaJuego` en `lib/juegos-pelicula.ts`), sin destripar si sigue abierto.
6. **Contado a la narradora**: `describirJuego` en `supabase/functions/narrate/index.ts` (y su tipo en las ideas «Pensados para vosotros»).
7. **Avisos** en la campanita (`lib/notifications.ts`), su etiqueta en Retos (`app/group/[id]/retos.tsx`) y fuera del resumen de momentos sueltos (`lib/recap.ts`).
8. **Sus sonidos** (`lib/sonidos.ts`, archivos en `mobile/public/sonidos/`, hechos con ElevenLabs): al jugar, acertar, enviar, revelar…
9. Que funcione entre **iPhone y Android** (p. ej., audio grabado en Chrome: Opus, ver `lib/opus.ts`).

## Cuidar las descargas (el plan gratis de Supabase solo da unos 5 GB al mes)

- **Nunca reproducir vídeos solos** en listas, tarjetas o portadas: se enseña la portada y el vídeo se carga al tocarlo.
- **Enlaces a archivos siempre con `firmar` / `firmarUno`** (`lib/firmas.ts`): reutilizan el mismo enlace durante días para que el móvil no vuelva a descargar. Nunca `createSignedUrl(s)` directamente.
- **Subidas con `cacheControl: CACHE_LARGA`**, y las fotos pasadas antes por `comprimirFoto` (`lib/comprimir.ts`).
- Vídeos grabados en la app con poca tasa de bits (~1 Mbps).
