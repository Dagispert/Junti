# Junti · app móvil

App de iPhone y Android hecha con [Expo](https://expo.dev) (React Native + TypeScript).

**Estado:** prototipo navegable con datos de ejemplo guardados en memoria. Todavía no hay cuentas ni servidor: lo que publiques desaparece al cerrar la app.

## Probarla en tu móvil

1. Instala [Node.js](https://nodejs.org) (versión LTS) en tu ordenador.
2. Instala la app **Expo Go** en tu móvil (App Store o Google Play).
3. En una terminal, dentro de esta carpeta:

   ```bash
   npm install
   npx expo start
   ```

4. Escanea el código QR que aparece (con la cámara en iPhone, o desde Expo Go en Android). El móvil y el ordenador deben estar en la misma wifi.

Para verla en el navegador del ordenador: `npx expo start --web`.

## Qué hay

| Pantalla | Archivo |
|---|---|
| Mis grupos | `src/app/index.tsx` |
| Hoy (propuesta + momentos) | `src/app/group/[id]/index.tsx` |
| Retos | `src/app/group/[id]/retos.tsx` |
| Memoria por meses | `src/app/group/[id]/memoria.tsx` |
| Compartir un momento | `src/app/publish.tsx` |
| Barra inferior del grupo | `src/app/group/[id]/_layout.tsx` |

- `src/data/sample.ts`: personas, grupos y momentos de ejemplo.
- `src/data/store.tsx`: estado en memoria. Es la pieza que se sustituirá por Supabase.
- `src/components/`: tarjeta de momento, cabecera de grupo y piezas básicas.
- `src/constants/theme.ts`: colores (claro y oscuro), espaciado y tipografías.

## Comprobaciones

```bash
npm run typecheck          # tipos
npx expo export -p web     # compila la versión web
```
