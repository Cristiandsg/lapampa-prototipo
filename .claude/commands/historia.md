---
description: Implementa una historia del backlog de La Pampa (ej. /historia HU03)
argument-hint: HUxx o HT-xx
---

Vamos a implementar la historia **$ARGUMENTS** del prototipo de La Pampa Gastrobar.

1. Lee la historia **$ARGUMENTS** en `docs/backlog.md`: enunciado, criterio de aceptación clave y subtareas. Revisa en `docs/requisitos.md` los requisitos asociados y en `docs/bd/diccionario.md` las tablas que toca.
2. Verifica que estoy en una rama `feature/$ARGUMENTS-...` creada desde `develop` actualizado. Si no, propón el nombre y créala (`git switch develop && git pull && git switch -c feature/$ARGUMENTS-descripcion`).
3. Antes de escribir código, muéstrame un plan corto: endpoints, archivos de `api/src` y `web/src` que vas a crear o tocar, cambios de base de datos y casos de prueba. Espera mi visto bueno.
4. Implementa por capas, respetando el patrón MVC y las decisiones de `CLAUDE.md`:
   - [BD] cambios en `api/db/schema.sql` (y diccionario + MER si cambia el esquema)
   - [Backend] modelo → controlador → ruta, con validación (express-validator), permisos por rol y transacciones si toca dinero
   - [Frontend] pantallas mobile-first con los estilos y componentes de `web/src/index.css` (`Franja`, `LineaCarta`, `.boton`, `.chip`)
   - [QA] pruebas Jest + Supertest de cada endpoint (incluye un caso de rol sin permiso) y Vitest para la pantalla principal
5. Corre `npm test` y `npm run lint` desde la raíz y corrige hasta que pasen.
6. Haz commits pequeños que empiecen con `$ARGUMENTS:` y, al terminar, dame el resumen para el Pull Request a `develop` siguiendo `.github/pull_request_template.md`, marcando qué criterios de aceptación quedaron cubiertos y cómo probarlos en el celular.
