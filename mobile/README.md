# Junti · app móvil

App de iPhone y Android hecha con [Expo](https://expo.dev) (React Native + TypeScript).

**Estado:** conectada a Supabase: cuentas con correo y contraseña, grupos, invitaciones por código, momentos con foto, reacciones, comentarios, propuesta del día y retos. La conexión se configura en `.env` (solo datos públicos del proyecto).

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
| Entrar, crear cuenta y perfil | `src/components/auth-screen.tsx` |
| Mis grupos | `src/app/index.tsx` |
| Crear grupo / unirse con código | `src/app/new-group.tsx`, `src/app/join.tsx` |
| Hoy (propuesta + momentos) | `src/app/group/[id]/index.tsx` |
| Retos | `src/app/group/[id]/retos.tsx` |
| Memoria por meses | `src/app/group/[id]/memoria.tsx` |
| Compartir un momento | `src/app/publish.tsx` |
| Barra inferior del grupo | `src/app/group/[id]/_layout.tsx` |

- `src/data/store.tsx`: todo lo que la app lee y escribe en Supabase.
- `src/data/library.ts`: propuestas del día y retos sugeridos.
- `src/lib/supabase.ts`: conexión con el proyecto.
- `src/lib/push.ts`, `public/sw.js`, `public/manifest.json`: avisos y "añadir a pantalla de inicio" en la versión web.
- `src/components/`: tarjeta de momento, cabecera de grupo y piezas básicas.
- `src/constants/theme.ts`: colores (claro y oscuro), espaciado y tipografías.

## Comprobaciones

```bash
npm run typecheck          # tipos
npx expo export -p web     # compila la versión web
```
