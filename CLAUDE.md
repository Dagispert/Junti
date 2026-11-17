# Junti: notas para quien trabaje en el código

## Cada minijuego nuevo tiene que tener TODO esto

Un minijuego no está terminado hasta que tiene:

1. **Su pantalla** para jugar (`mobile/src/app/<juego>/[id].tsx`) y la de crearlo (`new-<juego>.tsx`), con su entrada en «Minijuegos» del «+» (`app/add.tsx`).
2. **Su tarjeta propia en «Hoy»** (`components/minijuegos-hoy.tsx`), con identidad visual propia, animación de entrada y la inclinación 3D (`lib/inclinacion.ts`).
3. **Comentarios** (`ComentariosJuego`), también mientras está abierto (con un aviso de no destripar si hace falta).
4. **Su versión en las historias de la semana y el mes**: los datos en `lib/juegos-pelicula.ts` (`cargarJuegos`), su tipo en `pelicula/guion.ts` (`JuegoPieza` y `TipoPieza`) y su animación en `pelicula/mesa.ts`. Si sigue abierto, sin desvelar nada.
5. **Su fotograma en el carrete del mes** (`useFotogramasJuegos` y `rutaJuego` en `lib/juegos-pelicula.ts`), sin destripar si sigue abierto.
6. **Contado a la narradora**: `describirJuego` en `supabase/functions/narrate/index.ts` (y su tipo en las ideas «Pensados para vosotros»).
7. **Avisos** en la campanita (`lib/notifications.ts`), su etiqueta en Retos (`app/group/[id]/retos.tsx`) y fuera del resumen de momentos sueltos (`lib/recap.ts`).
8. Que funcione entre **iPhone y Android** (p. ej., audio grabado en Chrome: Opus, ver `lib/opus.ts`).
