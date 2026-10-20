# CLAUDE.md — La Pampa Gastrobar (primer prototipo)

Trabajo de grado de Ingeniería de Sistemas (UNIAJC, Cali): **primer prototipo de sistema de información web** para automatizar pedidos, ventas y domicilios en La Pampa Gastro Bar, un gastrobar de comida del Pacífico colombiano en el barrio La Primavera, Cali.

Equipo: **Cristian David Silva Grueso** (Product Owner, frontend) · **Esteban Antonio Estrada Angulo** (Scrum Master, backend) · **Diana Carolina Dorado Ruano** (base de datos y QA).

**Idioma:** todo en español — código de dominio (tablas, variables, rutas, componentes), commits, comentarios, mensajes al usuario y documentación. Sin anglicismos innecesarios en la interfaz.

## Decisiones de producto (no cambiar sin el PO)

- **Web y mobile-first.** Meseros, cajero y propietario usan el **navegador del celular** (no hay tablets). El propietario también puede usar un computador. No hay app nativa.
- **Publicado en la nube con HTTPS** (Vercel para `/web`, Render para `/api` con `render.yaml`, MySQL en Aiven con SSL; guía en `docs/despliegue.md`): el cliente pide domicilios desde su casa.
- **Mesas con nombre libre.** No hay mesas fijas: el mesero crea las mesas de la jornada con el nombre que quiera ("Terraza 2", "Barra"). Nombre único solo entre mesas activas. Una mesa con pedido abierto no se elimina; eliminar = desactivar.
- **Domicilios por dos vías:** formulario web público (cliente, sin cuenta) o el cajero registra los que llegan por llamada/WhatsApp en el mismo formulario (`canal`: `web` | `telefono_whatsapp`).
- **Pago de domicilios:** contra entrega o **transferencia anticipada**. Si es transferencia, el domicilio queda en `pendiente_pago` y **no pasa a preparación** hasta que el cajero confirma el pago. Estados: `pendiente_pago → recibido → en_preparacion → en_camino → entregado` (+ `cancelado` con motivo). Solo avanzan en orden.
- **Propina** sugerida del 10 %, voluntaria (Ley 1935 de 2018): nunca se suma sin confirmación; va separada de la venta.
- **Dinero en transacciones:** cierre de pedido, pago, propina y confirmación de transferencia van en `beginTransaction / commit / rollback`. Concurrencia de mesas con `SELECT ... FOR UPDATE`.
- **Impresión (HU16):** 2 impresoras térmicas USB conectadas al **PC fijo de la caja** (cocina y caja). Un **agente de impresión** en Node.js (carpeta `agente-impresion/`, Sprint 3) consulta la API cada 3 s y envía tirillas ESC/POS a la impresora compartida de Windows. Cola en la tabla `trabajo_impresion`. Lo de caja es "Cuenta" o "Comprobante de pago", **nunca "factura"**: la facturación electrónica DIAN está fuera del alcance.
- **Datos personales (Ley 1581 de 2012):** sin autorización no se guarda el cliente; los datos se pueden corregir o eliminar desde la interfaz.
- **Fuera del alcance:** inventario, nómina, facturación electrónica DIAN, pasarela de pagos en línea, app nativa, integración con plataformas de domicilios.

## Stack

| Capa | Tecnología |
|---|---|
| Vista | React 18 + Vite 8, React Router 7, Axios (`/web`). Chart.js se agrega en el Sprint 4 |
| Controlador + Modelo | Node.js 20+ + Express 5, patrón MVC (`/api/src/{routes,controllers,models,middlewares}`), CommonJS |
| Datos | MySQL 8 con `mysql2/promise` (pool en `api/src/config/db.js`) |
| Seguridad | bcryptjs, JWT (`jsonwebtoken`), express-validator, HTTPS |
| Pruebas | Jest 30 + Supertest (API), Vitest 5 + Testing Library (web) |
| Gestión | Jira (backlog) · GitHub (ramas por historia) |

En el MVC, **la Vista es el cliente React**; la API Express contiene controladores y modelos. El modelo hace SQL; el controlador valida y responde; la ruta solo conecta.

## Comandos

```bash
npm run instalar                 # raíz + api + web
npm run db:init --prefix api     # BORRA y crea la base 'lapampa' con la carta real (sin mesas)
npm run db:prueba --prefix api   # igual + 3 mesas de ejemplo
npm run db:nube --prefix api     # igual que db:init pero en Aiven (lee api/.env.nube)
npm run dev                      # API :3000 + web :5173 (Vite redirige /api a :3000)
npm test                         # pruebas API y web
npm run lint                     # ESLint en api y web
```

`api/.env` sale de `api/.env.example` (nunca se sube). Usuarios de prueba: `propietario`, `cajero`, `mesero`, contraseña `LaPampa2026*`.

## Base de datos

`api/db/schema.sql` (13 tablas), `seed.sql` (roles, 3 usuarios, **carta real**: 17 categorías y 58 productos), `datos_prueba.sql` (mesas de ejemplo). Detalle en `docs/bd/diccionario.md` y `docs/bd/mer.md`. Si cambias el esquema, actualiza el diccionario y el MER en el mismo commit.

Reglas que ya hace cumplir la base: nombre de mesa único entre activas (columna generada `nombre_activo`), cliente sin autorización rechazado, transferencia sin `pago_confirmado_en` no avanza, pedido de canal `mesa` exige `mesa_id`. El detalle del pedido guarda el **precio del momento**.

Pendiente con el propietario: la Subienda tiene dos precios ($44.000 / $47.000); se asumió pelada = 44.000 y gualajo = 47.000.

## Estilo visual (tomado de la carta de La Pampa)

Variables en `web/src/index.css`; guía viva en `/estilo`. Mostaza `#E8B95E`, crema `#EFE6BD`, papel `#FAF5E1`, café `#4A3418` (texto y botones), hoja `#4E6A2E` (libre/confirmado), dorado `#8A5F14` (ocupada/en proceso), achiote `#A63D25` (por cobrar/error). Títulos **Playfair Display Black** (secciones en mayúsculas espaciadas, como la carta); texto **Montserrat** (servidas con @fontsource). Componentes base: `Franja` (encabezado con el sello del logo) y `LineaCarta` (nombre ....... $23.000 — el sello de la carta; úsalo en toda lista de productos). Precios con formato `$23.000`. Botones de mínimo 48 px, pensados para usar con una mano. Los nombres de los platos son expresiones del Pacífico (Chumblún, Barajo, Oye vevé…): respétalos tal cual.

## Forma de trabajo

- **Backlog completo** con criterios de aceptación y subtareas: `docs/backlog.md`. Requisitos: `docs/requisitos.md`. Flujo de Git: `docs/guia-git.md`.
- **Ramas:** `main` (aceptado en el Review) · `develop` (integración, rama por defecto) · `feature/HUxx-descripcion` desde `develop`. Nunca trabajar directo en `main` ni `develop`.
- **Commits:** empiezan con el ID: `HU03: valida nombre de mesa repetido`. PR a `develop` con la plantilla de `.github/`.
- **Para implementar una historia** usa el comando `/historia HUxx` (en `.claude/commands/historia.md`).
- **Definición de Terminado:** cumple los criterios de aceptación; `npm test` y `npm run lint` pasan; endpoints nuevos con pruebas Jest + Supertest que validan permisos por rol; lo que toca dinero en transacción; probado en tamaño de celular; README o diccionario actualizados si cambió algo.
- Antes de inventar un dato del negocio (precios, horarios, reglas), pregunta: el PO lo confirma con el propietario.

## Estado actual

| Sprint | Historias | Estado |
|---|---|---|
| Sprint 0 (1 semana) | HT-01 repositorio + nube · HT-02 modelo de datos · HT-03 mockups + línea base | HT-02 hecho (falta que Diana corra db:init). HT-01: publicado en https://lapampa-gastrobar.vercel.app (API https://lapampa-api.onrender.com, base en Aiven); falta que Esteban y Diana corran el proyecto local. HT-03: mockups hechos; falta revisarlos con el propietario y medir 3 noches de cierre de caja |
| Sprint 1 | HU01 login por rol · HU02 carta · HU03 mesas · HU04 pedido por mesa | Por hacer |
| Sprint 2 | HU05 modificar pedido · HU06 cuenta · HU07 pago · HU08 propina | Por hacer |
| Sprint 3 | HU09 formulario web · HU10 domicilios por llamada · HU11 seguimiento · HU16 impresión | Por hacer |
| Sprint 4 | HU12 estado de mesas · HU13 reportes · HU14 más vendidos · HU15 comparativo | Por hacer |

**Siguiente paso:** cerrar el Sprint 0 (revisión de mockups y línea base en el local) y empezar el Sprint 1 por HU01. Cada PR fusionado a `develop` se publica solo en Render y Vercel; si cambia `schema.sql` o `seed.sql`, correr `npm run db:nube --prefix api`.

Documentos del proyecto (fuera del repo, versión vigente v4): trabajo de grado `Proyecto_Gastrobar_v4_limpio.docx` y `Scrum_LaPampa_Gastrobar_v4.docx`. Si un cambio de código altera una decisión de arriba, avisa para actualizar esos documentos.
