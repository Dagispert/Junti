# Identidad de Junti (provisional)

![Identidad](identidad.png)

![Animación](logo-animado.gif)

**Idea.** Una «j» minúscula. Su punto es una persona, el final de la curva es otra, y el trazo es lo que las une. Va dentro de un *squircle* (superelipse), como el icono de una app. Solo blanco y negro.

**Archivos**

| Archivo | Uso |
|---|---|
| `icono-negro.svg` | El icono: j blanca sobre negro |
| `icono-blanco.svg` | Invertido, para fondos oscuros |
| `palabra.svg` | «junti» en Fraunces 600, pasado a trazos |
| `logo-horizontal.svg` | Icono y palabra juntos |

En la app: `mobile/src/components/logo.tsx` (`LogoMark`, `Wordmark`, `Logo`). Con `drawn` (0–1) se anima: aparece la forma, cae el punto, se traza la curva, aparece el otro punto y entra la palabra.

**Lema.** *Cerca, aunque estéis lejos.*

**Colores** (`mobile/src/constants/brand.ts`). La marca es tinta `#111111` y blanco. El resto de colores es del planeta y de la interfaz, no del logo: océano `#58C3D6`, prado `#8CCB5B`, atardecer `#FF8A3D` (el hilo que une en el mapa) y letra a mano `#C2477A`.

**Tipografía.** Fraunces solo para la palabra «junti»; la del sistema para la interfaz; Caveat (a mano) para notas y subtítulos de la narradora.

**Movimiento.** Una sola curva suave, sin rebotes. Las animaciones cuentan algo: el planeta que se acerca, el hilo que se dibuja, la j que se traza.

Los iconos de la app (`mobile/public/icon-*.png`, `apple-touch-icon.png`, `logo.svg`, `assets/images/icon.png` y `favicon.png`) salen de `icono-negro.svg`.
