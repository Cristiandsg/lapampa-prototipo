# Forma de trabajo del equipo (contexto para Claude)

> **Para Claude:** este documento explica cómo trabaja el equipo en el repositorio `Cristiandsg/lapampa-prototipo`. Síguelo con cualquier integrante del equipo. Si algo de aquí choca con `CLAUDE.md` del repositorio, manda `CLAUDE.md` (es la versión viva). Háblale a la persona en español, claro y sin tecnicismos innecesarios, y dale los comandos de uno en uno.

## 1. El proyecto y el equipo

- Trabajo de grado (UNIAJC, Cali): primer prototipo web, mobile-first y en la nube, de pedidos, ventas y domicilios para **La Pampa Gastrobar**.
- **Cristian** (Product Owner, frontend): revisa y fusiona los Pull Request y confirma con el propietario los datos del negocio.
- **Esteban** (Scrum Master, backend).
- **Karolina / Diana Carolina** (base de datos y QA).
- En línea:
  - Web: https://lapampa-gastrobar.vercel.app
  - API: https://lapampa-api.onrender.com
  - Base MySQL en Aiven.
- Gestión: **Jira** (espacio "Prueba LaPampa", claves PRU-…) y **GitHub**.

## 2. Cómo usar Claude con el proyecto

- **Con Claude Code** (recomendado): abre Claude Code dentro de la carpeta del repositorio.
  - Claude lee solo `CLAUDE.md`, que tiene las decisiones, el stack y las reglas.
  - Para trabajar una historia, usa el comando **`/historia HUxx`**. Este comando lee la historia en `docs/backlog.md`, crea la rama, propone un plan, espera el visto bueno, implementa por capas, corre las pruebas y deja listo el resumen del PR.
- **Con Claude en el chat** (claude.ai): crea un Proyecto, pega este documento en las instrucciones y sube como archivos los que vayas a tocar.
  - Siempre: `CLAUDE.md`, `docs/api.md`, `docs/backlog.md` y `docs/bd/diccionario.md`.
  - Además, los archivos reales que vas a cambiar.
  - Claude no debe inventar cómo está hecho el código: si no ve un archivo, lo pide.

Antes de pedirle algo a Claude, Karolina siempre trae lo último:

```bash
git switch develop
git pull
npm run instalar
```

## 3. Flujo de Git (no saltárselo)

1. **Nunca se trabaja directo en `main` ni en `develop`.**
   - `main` = lo aceptado en la Review del sprint.
   - `develop` = integración. Es la rama por defecto y la que se publica sola en Vercel y Render.
2. Cada historia lleva su rama, que sale de `develop` actualizado:
   ```bash
   git switch -c feature/HU08-propina
   ```
3. Los commits empiezan con el ID de la historia: `HU08: calcula la propina sugerida del 10 %`.
4. Antes de subir, desde la raíz: `npm test` y `npm run lint`. **Las dos tienen que pasar.**
5. Para subir la rama: `git push -u origin feature/HU08-propina`.
6. En GitHub se abre el **Pull Request hacia `develop`**, nunca hacia `main`.
   - Se llena la plantilla que aparece sola (`.github/pull_request_template.md`): historia, qué cambia, cómo probarlo y el checklist.
7. **Cristian revisa y fusiona.** Al fusionar, Render y Vercel publican solos en 2 o 3 minutos.
   - Si la historia cambió `api/db/schema.sql` o `seed.sql`, hay que avisarle a Cristian: él corre `npm run db:nube` para actualizar la base en la nube.
8. Después de fusionar se puede borrar la rama. Para la siguiente historia se vuelve al paso 2, con `git pull` en `develop`.

**Si Claude no puede hacer push** (por ejemplo, en el chat o en una sesión sin GitHub conectado), entrega el trabajo como **parche**:
- Claude genera el parche con `git format-patch`.
- Karolina lo aplica en su rama con `git am archivo.patch` y luego hace `git push`.
- Cuando ya está aplicado, borra el `.patch` de la carpeta para no subirlo por error.

**Prohibido:**
- Subir `api/.env` o `api/.env.nube`: tienen claves y están en `.gitignore`.
- Hacer `git push --force` sobre `main` o `develop`.
- Pegar contraseñas reales en el chat.
- El repositorio es **público**: nada de claves en el código.

## 4. Reglas técnicas (lo que Cristian revisa en cada PR)

Varias salieron de la revisión de HU02.

### Web (React, `web/src`)
- **Toda llamada a la API pasa por `web/src/services/api.js`.**
  - Si falta una función, se agrega ahí, siguiendo las que ya existen (`listarProductos`, `crearPedido`…).
  - **Nunca** se escribe `http://localhost:3000` ni otra URL en una pantalla: en la nube eso se rompe.
- Los errores se muestran con `mensajeDeError(err)` del mismo archivo, que ya trae el mensaje en español.
- Las pantallas internas van dentro de `<RequiereSesion roles={[...]}>`, con `<Encabezado titulo="..." volver />`.
  - El usuario sale de `useSesion()`.
  - Cuando un módulo queda listo, en `web/src/sesion/menu.js` se le pone `disponible: true`.
- Estilo:
  - Variables y clases de `web/src/index.css`: `.boton`, `.chip`, `.bloque`, `.alerta`, `.aviso-ok`.
  - `LineaCarta` en toda lista de productos.
  - Precios con el formato `$23.000`; se usa `pesos` de `LineaCarta`.
  - Botones de mínimo 48 px, pensados para el celular. La guía viva está en `/estilo`.
- Se prueba en **tamaño de celular**. Todo el texto de la interfaz va en español.

### API (Express, `api/src`, patrón MVC)
- **La ruta** conecta y valida, **el controlador** decide y responde, **el modelo** hace el SQL.
- Cada ruta se protege con `verificarToken` y `permitirRoles('propietario', 'cajero', …)`.
  - Quién hizo la operación está en `req.usuario`. De ahí salen `mesero_id`, `cajero_id` y `usuario_id` del historial.
  - **Ningún dato de quién es se toma del body.**
- Validación con `express-validator` y mensajes en español:
  - Booleanos con `isBoolean({ strict: true })`.
  - Enteros con un `max` que quepa en la columna: SMALLINT ≤ 65535.
  - Textos con `isLength({ max })` igual al de la tabla.
- **Un dato mal escrito nunca puede dar 500.** Códigos:
  - 400: dato inválido.
  - 403: rol sin permiso.
  - 404: no existe.
  - 409: choca con el estado, por ejemplo una mesa ocupada o un nombre repetido.
- Lo que tiene historia **no se borra**: se desactiva (`activo = FALSE`). Ejemplos: productos, mesas, cuentas.
- **Dinero y cambios de estado van en transacción**: `beginTransaction / commit / rollback`, con `SELECT … FOR UPDATE` cuando dos personas pueden tocar lo mismo. Ejemplo: `api/src/models/pedido.model.js`.
- Cada cambio importante se registra en `historial_cambio`, con quién lo hizo.
- El detalle del pedido guarda el **precio del momento**, así que un cambio de precio no toca pedidos viejos.
- La base trabaja en **hora de Colombia**: no se usan conversiones de zona horaria a mano.

### Pruebas (Definición de Terminado)
- Cada endpoint nuevo lleva pruebas **Jest + Supertest** en `api/tests/`. Siempre incluyen:
  - El caso feliz.
  - Datos inválidos (400).
  - **Un rol sin permiso (403).**
  - Sin sesión (401).
- Usan las ayudas de `api/tests/apoyo/ayudas.js` (`crearCuenta`, `tokenDe`).
- Corren en una base aparte, `lapampa_test`, que se crea sola. Necesitan MySQL prendido (XAMPP) y `api/.env` configurado. La base de desarrollo no se toca.
- La pantalla principal de la historia lleva una prueba **Vitest + Testing Library** en `web/src/pages/`, al lado del archivo.
- Si cambia el esquema se actualizan, en el mismo commit, `docs/bd/diccionario.md` y `docs/bd/mer.md`.
- Si hay rutas nuevas se actualiza `docs/api.md`.

### Datos del negocio
- **No se inventan** precios, horarios ni reglas del gastrobar: se le preguntan a Cristian, que lo confirma con el propietario.
- Decisiones que no se cambian sin el PO:
  - Todos los meseros ven todas las mesas.
  - La propina es sugerida del 10 % y voluntaria.
  - Lo que sale por la caja dice "Cuenta" o "Comprobante", nunca "factura".

## 5. Antes de abrir el PR, Claude revisa con Karolina

- [ ] La rama es `feature/HUxx-…` y sale de `develop` actualizado.
- [ ] Cumple el **criterio de aceptación** de la historia, en `docs/backlog.md` y en Jira.
- [ ] `npm test` y `npm run lint` pasan.
- [ ] No hay URLs escritas a mano ni `console.log` de prueba.
- [ ] No se suben `.env` ni archivos `.patch`.
- [ ] Hay una prueba de rol sin permiso.
- [ ] Lo de dinero va en transacción.
- [ ] Se probó en el navegador en tamaño de celular.
- [ ] La documentación está al día si cambió algo.

## 6. Lo que le toca a Karolina

- **Sprint 1 (cerrando):** subtareas de **QA** de HU01 a HU04 en Jira.
  - Probar desde el celular en la URL oficial: login por rol, carta y agotados, mesas, y pedido por mesa.
  - Incluye la prueba de dos celulares enviando pedido a la misma mesa: uno entra y el otro recibe "ya tiene un pedido abierto".
- **Sprint 2: HU08, calcular y registrar la propina** (3 SP).
  - Propina sugerida del 10 % sobre el subtotal (Ley 1935 de 2018).
  - El cliente la acepta, la cambia o la rechaza.
  - Se guarda por pedido y con el mesero que atendió.
  - **Siempre va separada del valor consumido y nunca se suma sin que el cajero confirme.**
  - Depende del cobro (HU06 y HU07, de Esteban), así que conviene arrancar después de que esas estén en `develop`. Mientras tanto se puede preparar la parte de base de datos y las pruebas.
- **Más adelante:** HU10 (domicilios por llamada o WhatsApp), HU16 (impresión, con Esteban), HU13 (reportes, con Esteban) y HU14 (más vendidos).

## 7. Cosas de la nube que ya nos pasaron

- **Se usa siempre** https://lapampa-gastrobar.vercel.app. Los enlaces de vista previa de Vercel (con letras raras en el nombre) fallan por CORS.
- Render gratis se duerme después de 15 minutos sin uso: la primera carga puede tardar hasta un minuto. No es un error.
- Aiven gratis apaga la base si no se usa. Si la API dice "sin conexión", Cristian la prende con **Power on** en Aiven.
- Después de fusionar un PR hay que esperar a que Render diga **Live** antes de probar. Si no, la web nueva le habla a la API vieja.
