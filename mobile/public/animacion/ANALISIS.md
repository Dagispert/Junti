# Rumbo a ti: análisis de la referencia y plan

Animación dibujada a mano en HTML, CSS, SVG y JS. Reproduce el lenguaje visual
del vídeo de referencia (1280×720, 24 fps, 21,5 s). El estilo es el de la
referencia, pero la historia es nuestra: un viaje para volver a ver a alguien
que vive lejos, contado en recuerdos.

Se ve en `/Junti/animacion/`. Parámetros de URL:

- `?t=12.5` empieza en ese segundo.
- `?pausa=1` abre la animación quieta.

## 1. Análisis de la referencia

**Paleta.** Medida en píxeles de los fotogramas:

| Uso | Color |
|---|---|
| Fondo de noche | negro puro `#000` |
| Papel / tinta clara | crema `#FDFDD4` |
| Papel a la sombra | `#F1F0C6` |
| Único acento | magenta de rotulador `#E3065F` |
| Foco de la cabina | oliva oscuro `#25261E` |
| Tinta de día | casi negro `#0B0B09` |

No hay más colores. El rosa sale siempre en detalles pequeños (piloto, cinta,
vaso, punto, X, botón, cursor), nunca en superficies grandes, salvo la
cabecera del calendario.

**Trazo.**

- Rotulador de 2–3 px a 1280, con el pulso visible: las rectas tiemblan, las
  curvas se desvían y los contornos cerrados no cierran exacto.
- Muchos contornos llevan una segunda pasada más fina y desplazada (boceto).
- Las cifras grandes son trazos gruesos con vetas: el rotulador no cubre del todo.
- La línea hierve (*line boil*): cambia ligeramente unas 8 veces por segundo.
  Se nota al restar fotogramas seguidos de un plano quieto (diferencia media ≈ 10).

**Tipo de ilustración.**

- Objetos cotidianos convertidos en iconos de app: todo cabe en un cuadrado
  redondeado de lados algo abombados (superelipse), de ≈ 304 px, centrado.
- Planos, sin sombras ni degradados en el dibujo. La profundidad la ponen el
  fondo y la cámara.
- Detalle fino en pocas zonas: celosía de la torre, motas del papel, renglones.

**Composición.**

- Un solo objeto en el centro (centro en 640, 362) y un rótulo-hashtag pequeño
  debajo (y ≈ 578), en letra de mano.
- Fondo negro con esquirlas grises desenfocadas que flotan a distintas
  profundidades, más un viñeteado.
- En la segunda mitad el fondo pasa a crema y todo se invierte (tinta negra).

**Ritmo.**

- Unos 2–3 s por recuerdo. Las transiciones se solapan 0,3–0,6 s; nunca hay
  un plano vacío.
- Los movimientos arrancan rápido y frenan al llegar (salida cúbica), con un
  pequeño rebote cuando algo se posa (vaso, cinta, hojas).

**Cámara.**

- Un acercamiento lento y constante en cada plano.
- Dos alejamientos que cuentan algo:
  - la ventanilla resulta estar en un vehículo (aparecen los asientos dentro
    de un foco);
  - la foto resulta ser un mosaico entre muchos (rejilla final).
- Al final, paneos suaves siguiendo al cursor.

**Transiciones.** Siempre son transformaciones de un objeto en otro, nunca
fundidos sin más:

1. El reloj de paletas se tapa con una persiana que se desenrolla.
2. La persiana sube y descubre la ventanilla.
3. La ventanilla se apaga y su contorno se convierte en la tapa de la libreta.
4. La tapa se abre girando sobre el lomo.
5. La hoja se levanta y debajo hay un calendario de taco.
6. Las hojas del calendario se arrancan hacia arriba.
7. El taco se levanta y debajo hay una cámara instantánea.
8. El flash inunda la pantalla y pasa de la noche al día.
9. La cámara escupe la foto, que salta y se despliega encima.
10. La cámara se aleja y descubre la rejilla.

**Técnicas de dibujo y revelado.**

- Contornos que se dibujan solos (revelado por trazo).
- Ruta discontinua que avanza detrás de la punta de la pluma.
- Rótulos que se escriben de izquierda a derecha.
- Objetos que caen y rebotan.
- Hilo y pluma en péndulo.
- Goma elástica que vibra.
- Rayas rosas de tensión o velocidad junto a lo que se mueve deprisa.

**Constantes que no se pueden romper.**

- El mosaico central (forma, tamaño, posición).
- Una sola tinta por fase: crema de noche, negra de día.
- El rosa como único acento.
- El rótulo bajo el mosaico.
- El hervor de la línea.
- Las esquirlas al fondo.
- Ningún elemento sin trazo a mano.

## 2. La historia (original)

| s | Recuerdo | Rótulo |
|---|---|---|
| 0–1,2 | Reloj de paletas: 58 → 59, la alarma parpadea | #horadeirse |
| 1,2–2,6 | La persiana baja, el cordón se balancea | #cincominutosmás |
| 2,6–6,3 | Ventanilla del avión: nubes, haz de sol, vaso en la bandeja | #rumboati |
| 6,3–9,5 | La libreta: cinta, goma elástica, la tapa se abre | #nuestrodiario |
| 9,5–12,4 | La pluma colgada dibuja la ruta de mi punto a tu X | #larutahastati |
| 12,4–13,8 | Calendario 14 → 15 → 16 de agosto | #cuentaatrás |
| 13,8–17,2 | Cámara, flash, foto: el faro frente al mar y dos tazas | #porfinjuntos |
| 17,2–21 | Rejilla de recuerdos: mapa, corazón, mensaje, el tiempo de allí | — |

## 3. Arquitectura

| Ruta | Qué hay |
|---|---|
| `index.html` | El escenario SVG y los controles |
| `css/paleta.css` | Colores |
| `css/escenario.css` | Encuadre, fuentes, controles |
| `css/movimientos.css` | Animaciones CSS independientes: esquirlas, piloto, vapor, grano, hervor del texto |
| `js/config.js` | **Ritmo y color**: tiempos de cada escena y sus golpes, cámara, rótulos, paleta |
| `js/motor/tiempo.js` | Curvas, tramos, oscilaciones amortiguadas, reproductor |
| `js/motor/trazo.js` | El trazo a mano (temblor, solape, tres variantes para el hervor), formas base, revelado por trazo |
| `js/motor/letras.js` | Cifras de rotulador (trazados propios), cifras de paleta, texto áspero |
| `js/transiciones.js` | Mover/escalar/girar, volteos con perspectiva, brotar, iris, revelar en cadena |
| `js/fondo.js` | Fondo, esquirlas con paralaje, flash noche → día, viñeteado, grano |
| `js/camara.js` | Pista de cámara con respiración |
| `js/rotulos.js` | Hashtags que se escriben |
| `js/ilustraciones/` | **Solo dibujo**: cada objeto es una función que devuelve sus partes |
| `js/escenas/` | **Solo movimiento**: una escena por archivo, anima las partes de su ilustración |
| `js/main.js` | Montaje y bucle |

La película es una función pura del tiempo: `pintar(t)` siempre da el mismo
fotograma. Por eso se puede pausar, arrastrar la barra o saltar a una escena.

Fuentes (OFL, en `fuentes/`):

- Patrick Hand para los rótulos.
- Jost para fechas y textos finos. El texto pasa por un filtro áspero que
  también hierve.

Todo lo demás son trazados SVG propios: sin iconos ni emojis.

## 4. Verificación

- Capturas en los mismos instantes que la referencia y comparación lado a lado.
- Ajustes hechos tras comparar:
  - grosor y vetas de las cifras;
  - lamas de la persiana más rectas y gruesas;
  - asientos más finos;
  - entrada de la goma y volteo de la hoja más tarde, como en la referencia;
  - la foto asoma más (se ven la mesa y las tazas).
- Rendimiento: unos 60 fps reproduciendo en Chromium. Sin errores de consola.
- En el móvil, en vertical, el encuadre se ciñe al mosaico central.
