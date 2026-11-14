# Skills de terceros

Revisadas antes de instalarlas (son instrucciones y, algunas, scripts locales:
nada se conecta solo a internet ni sube datos). Copiadas de estas versiones:

| Skill | Origen | Versión |
|---|---|---|
| motion-design | github.com/LottieFiles/motion-design-skill (MIT) | f9a8a04 |
| motion | github.com/motiondivision/ai-kit (plugins/motion) | 1e42494 |
| remotion-* (13) | github.com/remotion-dev/skills | 7e541aa |
| hairline-create, hairline-adopt | github.com/lucasmarkes/hairline (MIT) | 034f4bf |
| anatomy | github.com/wheresryan22/anatomy (MIT), sin las páginas compiladas de los ejemplos | 1482e84 |
| anatomy-reveal | github.com/annnguyentt/anatomy-reveal-skill (MIT), sin la demo | dd01e1c |

Notas:
- **motion**: la búsqueda en la documentación y las auditorías usan el servidor MCP
  de Motion (motion.dev), que no está conectado; las buenas prácticas funcionan sin él.
- **hairline-create** instala playwright-core una vez en la caché del usuario para
  mirar las figuras.
- **anatomy**: `scripts/publish.mjs` (enviar una figura a su galería pública, leyendo
  el registro de la sesión) solo se usa si se pide expresamente.
- **anatomy-reveal** usa ffmpeg e ImageMagick para el vídeo.
