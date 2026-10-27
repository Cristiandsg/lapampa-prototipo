# Sprint 1 — Acceso, carta, mesas y pedidos (v0.2)

**Objetivo:** que un mesero inicie sesión desde su celular, cree las mesas de la jornada y registre pedidos con productos de la carta digital.

**Resultado:** objetivo cumplido. Las 4 historias (21 puntos) están publicadas en https://lapampa-gastrobar.vercel.app y el propietario aprobó el incremento en la revisión del sprint.

## Historias entregadas

| Historia | Jira | Puntos | Pull Request | Criterio de aceptación clave |
|---|---|---|---|---|
| HU01 Inicio de sesión y permisos por rol | PRU-10 | 8 | #9 | Un mesero recibe 403 en caja y reportes; 5 intentos fallidos bloquean la cuenta 10 minutos |
| HU02 Gestión de la carta digital | PRU-11 | 5 | #10 | Un cambio de precio no altera los pedidos ya registrados; "agotado hoy" saca el producto de los pedidos |
| HU03 Crear y administrar las mesas de la jornada | PRU-12 | 3 | #11 | Nombre libre, único entre las mesas activas; una mesa con pedido abierto no se elimina |
| HU04 Registrar pedido por mesa | PRU-13 | 5 | #12 | Dos meseros que abren la misma mesa a la vez: uno registra el pedido y el otro recibe "la mesa ya tiene un pedido abierto" |

## Evidencia técnica

- **Pruebas automáticas:** 108 de la API (Jest + Supertest, base aparte `lapampa_test`) y 48 de la web (Vitest + Testing Library). Todas pasan y el lint queda sin errores.
- **Permisos:** cada ruta tiene una prueba con un rol sin permiso (403) y otra sin sesión (401).
- **Concurrencia (HU04):** se probó con dos navegadores enviando pedido a la misma mesa al mismo tiempo. Solo uno entra, gracias a la transacción con `SELECT ... FOR UPDATE`. Con tres pedidos simultáneos en mesas distintas no se pierde ninguno.
- **Hora:** la conexión a la base trabaja en hora de Colombia, aunque Aiven esté en otro huso horario.

## Revisión del sprint (Sprint Review)

- **Participantes:** propietario de La Pampa y equipo de desarrollo.
- **Demostración:** desde un celular, en la versión publicada, se mostraron el ingreso por rol, la carta con agotados, la creación de mesas y el registro de un pedido con su comanda de cocina.
- **Decisión:** el propietario **aprobó** el incremento. Delegó en el Product Owner los criterios de detalle de la operación, que el PO conoce por haber trabajado como mesero en el local.
- **Sugerencia ya prevista en el backlog:** agregar productos a una mesa que ya tiene pedido abierto. Es la HU05 del Sprint 2.

## Retrospectiva

**Qué salió bien**
- El despliegue automático (Vercel + Render + Aiven) permitió probar cada historia desde el celular apenas se fusionaba.
- Las pruebas automáticas atraparon errores antes de llegar a la nube, por ejemplo un dato fuera de rango que respondía 500.
- La plantilla de Pull Request y la Definición de Terminado hicieron que cada historia llegara completa: código, pruebas y documentación.

**Qué salió mal**
- La primera versión de HU02 no siguió las convenciones del proyecto: una URL a `localhost` escrita a mano, un mesero que podía cambiar precios y un borrado que respondía 500. Se corrigió en la revisión del PR.
- Los servicios gratuitos se apagan por inactividad: la base de Aiven hubo que prenderla a mano y Render tarda hasta un minuto en despertar.
- Algunos pasos de Git se hicieron en la rama equivocada y hubo que deshacerlos.

**Qué vamos a mejorar en el Sprint 2**
- Todo el equipo trabaja con el mismo contexto (`CLAUDE.md` y el documento de forma de trabajo) para que cada PR siga las reglas desde el principio.
- Antes de una demostración se revisa que la base de Aiven esté prendida y se abre la API para despertarla.
- Los comandos de Git se ejecutan de a uno, revisando la rama con `git branch --show-current` antes de aplicar cambios.

## Siguiente sprint

Sprint 2 — Caja y control de ventas: HU05 modificar pedido (Cristian), HU06 cerrar pedido y cuenta (Esteban), HU07 registrar el pago (Esteban) y HU08 propina (Diana).
