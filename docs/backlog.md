# Product Backlog — La Pampa Gastrobar

Fuente única del backlog (igual al documento de Scrum v4 y a Jira). 19 historias (3 técnicas + 16 de usuario), 99 puntos. Estimación en Fibonacci tomando HU08 (propina) = 3 puntos.

## Épicas

| ID | Épica | Descripción |
|---|---|---|
| EP-01 | Acceso y catálogo | Lo mínimo para que el sistema arranque: usuarios con rol (propietario, cajero, mesero), inicio de sesión y la carta digital con categorías y precios. Sin esto no se puede registrar ningún pedido. |
| EP-02 | Pedidos por mesa | Mesas que el mesero crea con el nombre que quiera según la jornada, registro de la orden asociada a cada mesa, ajustes mientras la mesa está abierta y vista general del estado de las mesas para el propietario. |
| EP-03 | Caja y control de ventas | Cierre de la cuenta, registro del pago (efectivo, tarjeta o transferencia) y de la propina voluntaria, todo dentro de una transacción para que ningún cobro quede a medias, y la impresión de comandas y cuentas en las impresoras térmicas del local. |
| EP-04 | Domicilios | Canal de domicilios propio que hoy no existe: formulario web para que el cliente pida desde su casa, registro por el cajero de los pedidos que llegan por llamada o WhatsApp, autorización de tratamiento de datos, pago contra entrega o por transferencia anticipada y seguimiento por estados. |
| EP-05 | Reportes financieros | Información para que el propietario decida con datos y no de memoria: ventas por día, semana y mes, productos más vendidos y comparación entre el canal de mesa y el de domicilio. |

## Sprints

| Sprint | Duración | Objetivo | Historias | Puntos |
|---|---|---|---|---|
| Sprint 0 — Preparación del proyecto | 1 semana | Dejar listo el repositorio con el despliegue en la nube, el modelo de datos y los mockups para empezar el Sprint 1 programando. | HT-01, HT-02, HT-03 | 11 |
| Sprint 1 — Acceso, carta, mesas y pedidos | 3 semanas | Que un mesero inicie sesión desde su celular, cree las mesas de la jornada y registre pedidos con productos de la carta digital. | HU01, HU02, HU03, HU04 | 21 |
| Sprint 2 — Caja y control de ventas | 3 semanas | Cerrar la cuenta de una mesa, registrar el pago y la propina, y que la venta quede lista para el cierre de caja. | HU05, HU06, HU07, HU08 | 21 |
| Sprint 3 — Domicilios e impresión | 3 semanas | Abrir el canal de domicilios del gastrobar, con pedidos desde la casa del cliente, e imprimir comandas y cuentas en las impresoras del local. | HU09, HU10, HU11, HU16 | 23 |
| Sprint 4 — Reportes, estado de mesas y validación | 3 semanas | Entregar los reportes y la vista de mesas que el propietario necesita, y validar el prototipo completo con él en el local. | HU12, HU13, HU14, HU15 | 23 |

## Sprint 0: Preparación del proyecto

**Objetivo:** Dejar listo el repositorio con el despliegue en la nube, el modelo de datos y los mockups para empezar el Sprint 1 programando.

Como el proyecto todavía no tiene código, este sprint no entrega nada que el propietario pueda usar. Lo que se busca es que los tres podamos clonar el proyecto y correrlo el mismo día, que el entorno en la nube quede listo para publicar cada incremento, que la base de datos refleje lo que vimos en el gastrobar y que las pantallas estén dibujadas antes de construirlas. Las historias de este sprint son técnicas, por eso se identifican con HT y no con HU.

### HT-01 — Repositorio, entorno y despliegue en la nube

*Como equipo de desarrollo, queremos un repositorio con la estructura del frontend y del backend ya creada y publicada en la nube, para que cada integrante pueda ejecutar el proyecto en su equipo sin configuraciones manuales y cada incremento se pueda probar desde un celular.*

- **Épica:** — · **Puntos:** 3 · **Prioridad:** Alta · **Responsable:** Esteban
- **Criterio de aceptación clave:** Los tres integrantes ejecutan npm run dev y ven la pantalla inicial de React y la respuesta GET /api/salud. La misma respuesta se obtiene desde la URL pública con HTTPS, abierta en un celular con datos móviles.

**Subtareas**

- [ ] Crear el repositorio en GitHub con las ramas main, develop y feature/HUxx-descripcion
- [ ] Crear la carpeta /api con Express (estructura models / controllers / routes) y la carpeta /web con React + Vite
- [ ] Configurar .gitignore, .env.example y los scripts npm run dev para levantar ambos proyectos
- [ ] Configurar ESLint y Prettier con las mismas reglas para los tres
- [ ] Configurar el despliegue en la nube con HTTPS: /web en Vercel, /api en Render o Railway y MySQL en la nube (Railway o Aiven)
- [ ] Escribir el README con los pasos de instalación, la URL pública y las convenciones de commits
- [ ] Verificar que los tres integrantes clonan y ejecutan el proyecto en sus equipos

### HT-02 — Arquitectura y modelo de datos

*Como equipo de desarrollo, queremos documentar la arquitectura y construir el Modelo Entidad-Relación con su script de MySQL, para que todos los módulos trabajen sobre las mismas tablas desde el primer sprint.*

- **Épica:** — · **Puntos:** 5 · **Prioridad:** Alta · **Responsable:** Diana
- **Criterio de aceptación clave:** El script corre sin errores en una base vacía y deja creadas las categorías y los tres usuarios de prueba; la tabla mesa queda lista para que el mesero cree sus mesas.

**Subtareas**

- [ ] Dibujar el diagrama de arquitectura: navegador del celular (cliente React) → API Express (MVC) → MySQL, todo publicado en la nube
- [ ] Construir el MER con las entidades usuario, rol, mesa, categoria, producto, pedido, detalle_pedido, pago, propina, cliente y domicilio
- [ ] Modelar la mesa con nombre libre y estado (sin mesas fijas) y el domicilio con canal (web o teléfono/WhatsApp), método de pago (contra entrega o transferencia) y estado
- [ ] Elaborar el diccionario de datos con tipos, llaves y restricciones
- [ ] Escribir el script de creación de la base de datos y el script de datos iniciales: categorías de la carta y un usuario por rol (las mesas no se precargan: las crea el mesero)
- [ ] Definir la Definición de Terminado (DoD) del equipo

### HT-03 — Mockups y flujo de navegación

*Como equipo de desarrollo, queremos tener los mockups de las pantallas principales validados con el propietario, para no construir interfaces que después haya que rehacer.*

- **Épica:** — · **Puntos:** 3 · **Prioridad:** Media · **Responsable:** Cristian
- **Criterio de aceptación clave:** Cristian, como PO, aprueba el flujo de toma de pedido, de cierre de cuenta y del formulario de domicilio después de revisarlo con el propietario, y queda documentada la línea base de la operación actual.

**Subtareas**

- [ ] Diseñar los mockups, pensados primero para el celular (mobile-first), las pantallas de login, mesas, toma de pedido, caja, formulario público de domicilio, tablero de domicilios y reportes
- [ ] Definir el flujo de navegación según el rol (qué ve el mesero, el cajero y el propietario) y el del cliente, que entra sin cuenta
- [ ] Revisar los mockups con el propietario en el local y anotar los cambios que pida
- [ ] Documentar la línea base: observación participante en el local (pedidos por jornada, errores de comanda y cobro, tiempo y forma del cierre de caja), confirmada con el propietario
- [ ] Definir la paleta, la tipografía y el tamaño mínimo de botones para usar el sistema con una mano desde el celular

## Sprint 1: Acceso, carta, mesas y pedidos

**Objetivo:** Que un mesero inicie sesión desde su celular, cree las mesas de la jornada y registre pedidos con productos de la carta digital.

Este sprint ataca el problema que más errores le genera hoy al gastrobar: los pedidos en papel sin un identificador de mesa. Antes de eso hay que tener usuarios y carta, por eso se trabajan primero HU01 y HU02 (EP-01) y luego HU03 y HU04 (EP-02). Las mesas no son fijas: el mesero crea las que necesite en cada jornada y les pone el nombre que quiera. Al terminar, en la revisión del sprint se registrará desde un celular un pedido real del gastrobar.

### HU01 — Inicio de sesión y permisos por rol

*Como usuario del sistema (propietario, cajero o mesero), quiero iniciar sesión con mis credenciales y ver solo las opciones de mi rol, para que cada persona opere únicamente lo que le corresponde y quede registrado quién hizo cada operación.*

- **Épica:** EP-01 · **Puntos:** 8 · **Prioridad:** Alta · **Responsable:** Esteban
- **Criterio de aceptación clave:** Un mesero no ve ni puede llamar las rutas de caja ni de reportes (la API responde 403). Tras 5 intentos fallidos seguidos la cuenta se bloquea 10 minutos.

**Subtareas**

- [ ] [BD] Tablas usuario y rol con la contraseña guardada como hash (bcrypt)
- [ ] [Backend] Endpoint POST /api/auth/login que valida credenciales y devuelve un JWT con el rol
- [ ] [Backend] Middleware verificarToken y middleware permitirRoles('propietario', 'cajero', ...) para las rutas
- [ ] [Backend] Endpoints /api/usuarios para que el propietario cree, edite y desactive cuentas
- [ ] [Frontend] Pantalla de login y menú adaptado al celular que cambia según el rol
- [ ] [Frontend] Cierre de sesión y redirección al login cuando el token vence
- [ ] [Backend] Publicar el incremento en la nube para que la revisión del sprint se haga desde los celulares del personal
- [ ] [QA] Probar login correcto, contraseña errada, usuario desactivado y un mesero intentando entrar a /reportes

### HU02 — Gestión de la carta digital

*Como propietario, quiero crear, modificar y desactivar los productos de la carta con su categoría y precio, para que los pedidos se registren siempre con la oferta y los precios vigentes.*

- **Épica:** EP-01 · **Puntos:** 5 · **Prioridad:** Alta · **Responsable:** Cristian
- **Criterio de aceptación clave:** Un cambio de precio solo afecta a los pedidos nuevos; los pedidos ya registrados conservan el precio con el que se hicieron.

**Subtareas**

- [ ] [Backend] CRUD /api/categorias y /api/productos (nombre, categoría, precio, disponible)
- [ ] [Backend] Los productos no se borran: se desactivan para no romper pedidos ya registrados
- [ ] [Frontend] Pantalla de carta con filtro por categoría y formulario de producto
- [ ] [Frontend] Interruptor de 'agotado hoy' para ocultar un producto sin desactivarlo
- [ ] [QA] Probar precio en cero o negativo, nombre duplicado y producto desactivado que no aparece al tomar pedido ni en el formulario de domicilio

### HU03 — Crear y administrar las mesas de la jornada

*Como mesero, quiero crear las mesas con el nombre que yo elija (por ejemplo, "Terraza 2", "Barra" o "Cumpleaños Andrea"), para organizar la atención según cómo esté dispuesto el local ese día.*

- **Épica:** EP-02 · **Puntos:** 3 · **Prioridad:** Alta · **Responsable:** Cristian
- **Criterio de aceptación clave:** No hay mesas fijas: el mesero crea las que necesite. No pueden existir dos mesas activas con el mismo nombre y una mesa con pedido abierto no se puede eliminar.

**Subtareas**

- [ ] [BD] Tabla mesa (nombre, estado, creada por, fecha) con nombre único entre las mesas activas
- [ ] [Backend] Endpoints POST, PATCH y DELETE /api/mesas para crear, renombrar y eliminar mesas
- [ ] [Backend] No permitir renombrar ni eliminar una mesa que tenga un pedido abierto
- [ ] [Frontend] Pantalla de mesas con botón 'Nueva mesa' y una tarjeta por mesa con su nombre y estado
- [ ] [QA] Probar nombre repetido, nombre vacío y eliminación de una mesa ocupada

### HU04 — Registrar pedido por mesa

*Como mesero, quiero registrar desde mi celular un pedido asociado a una mesa, para que la orden quede identificada sin confusión y la cocina la reciba con la mesa correcta.*

- **Épica:** EP-02 · **Puntos:** 5 · **Prioridad:** Alta · **Responsable:** Esteban / Cristian
- **Criterio de aceptación clave:** No se puede abrir un segundo pedido en una mesa ocupada. El pedido queda con número consecutivo, hora y mesero responsable.

**Subtareas**

- [ ] [BD] Tablas pedido y detalle_pedido; el detalle guarda el precio unitario del momento
- [ ] [Backend] Endpoint POST /api/pedidos (mesa, mesero, productos, cantidades, observaciones)
- [ ] [Backend] Guardar el pedido y su detalle en una sola transacción, bloqueando la mesa (SELECT ... FOR UPDATE) y marcándola como ocupada
- [ ] [Frontend] Al tocar una mesa libre se abre el pedido
- [ ] [Frontend] Selector de productos por categoría con cantidades y nota (ej.: 'término medio', 'sin cebolla')
- [ ] [Frontend] Comanda con el nombre de la mesa, la hora y el mesero, lista para enviarse a la impresora de cocina (HU16)
- [ ] [QA] Probar dos meseros abriendo la misma mesa al mismo tiempo desde dos celulares y un pedido sin productos (debe fallar)

## Sprint 2: Caja y control de ventas

**Objetivo:** Cerrar la cuenta de una mesa, registrar el pago y la propina, y que la venta quede lista para el cierre de caja.

Hoy el cierre de caja toma unos 30 minutos cuando se hace: se cuenta el dinero y las propinas se cuadran a mano, y en las últimas jornadas ni siquiera se ha hecho (línea base del Sprint 0). Con este sprint cada venta queda registrada en el momento del cobro, así que el cierre de caja pasa a ser una consulta. Corresponde a EP-03, más HU05 de EP-02, que se trabaja aquí porque modificar un pedido abierto y cerrarlo tocan la misma lógica.

### HU05 — Modificar un pedido activo

*Como mesero, quiero agregar, quitar o cambiar productos de un pedido que sigue abierto, para ajustar la orden cuando el cliente pide algo más o cambia de opinión.*

- **Épica:** EP-02 · **Puntos:** 5 · **Prioridad:** Alta · **Responsable:** Cristian
- **Criterio de aceptación clave:** Quitar un producto ya enviado a cocina exige escribir el motivo. Un pedido cerrado no admite cambios.

**Subtareas**

- [ ] [Backend] Endpoints POST, PUT y DELETE /api/pedidos/:id/items
- [ ] [Backend] Rechazar cambios si el pedido ya fue cerrado o pagado
- [ ] [Backend] Guardar quién hizo cada cambio y a qué hora (historial del pedido)
- [ ] [Frontend] Edición del pedido desde la mesa, con total que se recalcula al instante
- [ ] [QA] Probar quitar el único producto, editar un pedido cerrado y cambios simultáneos desde dos celulares

### HU06 — Cerrar pedido y generar la cuenta

*Como mesero, quiero cerrar el pedido de la mesa y generar la cuenta, para entregarle al cliente el detalle de lo consumido y pasar el cobro a caja.*

- **Épica:** EP-03 · **Puntos:** 5 · **Prioridad:** Alta · **Responsable:** Esteban
- **Criterio de aceptación clave:** Al cerrar, la mesa pasa a 'por cobrar' y aparece en la bandeja del cajero.

**Subtareas**

- [ ] [Backend] Endpoint PATCH /api/pedidos/:id/cerrar que calcula subtotal y deja el pedido 'por cobrar'
- [ ] [Frontend] Vista previa de la cuenta con productos, cantidades, valores y total
- [ ] [Frontend] Mostrar la cuenta en pantalla; la impresión en la impresora de caja llega con HU16
- [ ] [QA] Verificar que el total coincide con la suma del detalle, incluidos productos modificados

### HU07 — Registrar el pago

*Como cajero, quiero registrar el pago de un pedido en efectivo, tarjeta o transferencia, incluso combinando dos medios, para finalizar la venta y que quede lista para el cierre de caja.*

- **Épica:** EP-03 · **Puntos:** 8 · **Prioridad:** Alta · **Responsable:** Esteban
- **Criterio de aceptación clave:** La suma de los pagos debe ser igual al total más la propina; si no cuadra no se deja guardar. El cierre del día se consulta en menos de 5 segundos.

**Subtareas**

- [ ] [BD] Tabla pago (pedido, medio, valor, cajero, fecha) que admite varios pagos por pedido
- [ ] [Backend] Endpoint POST /api/pedidos/:id/pagos ejecutado como transacción: guarda los pagos, marca el pedido como pagado y libera la mesa
- [ ] [Backend] Endpoint GET /api/caja/cierre?fecha= con totales por medio de pago
- [ ] [Frontend] Pantalla de caja con pedidos por cobrar, cálculo de vueltas en efectivo y pago mixto
- [ ] [QA] Simular una caída de la conexión en mitad del pago y comprobar que no queda nada registrado a medias

### HU08 — Calcular y registrar la propina

*Como cajero, quiero que el sistema sugiera la propina y registre si el cliente la acepta, la cambia o la rechaza, para liquidarla al personal al final de la jornada.*

- **Épica:** EP-03 · **Puntos:** 3 · **Prioridad:** Media · **Responsable:** Diana
- **Criterio de aceptación clave:** La propina siempre aparece separada del valor consumido y nunca se suma sin que el cajero confirme la respuesta del cliente.

**Subtareas**

- [ ] [Backend] Calcular la propina sugerida del 10 % sobre el subtotal (tope de la Ley 1935 de 2018)
- [ ] [Backend] Guardar la propina por pedido y el mesero que atendió la mesa
- [ ] [Frontend] Al cobrar, preguntar si el cliente acepta la propina sugerida, otro valor o ninguna
- [ ] [QA] Probar propina rechazada, propina mayor a la sugerida y el total de propinas por mesero en el día

## Sprint 3: Domicilios e impresión

**Objetivo:** Abrir el canal de domicilios del gastrobar, con pedidos desde la casa del cliente, e imprimir comandas y cuentas en las impresoras del local.

La Pampa no tiene hoy ninguna herramienta para domicilios. Los pedidos entran por dos vías: el cliente lo hace desde su casa en un formulario web público del sistema, que abre en su celular desde un enlace compartido por WhatsApp o Instagram, o lo pide por llamada o WhatsApp y el cajero lo registra en ese mismo formulario. Por eso el sistema tiene que estar publicado en internet. El pago es contra entrega o por transferencia anticipada; si el cliente escoge transferencia, el pedido no entra a preparación hasta que el cajero confirma el pago, para no preparar pedidos que después nadie paga. Como se guardan nombre, dirección y teléfono, el registro incluye la autorización de tratamiento de datos que pide la Ley 1581 de 2012. En este sprint también entra HU16: las comandas y las cuentas salen por las dos impresoras térmicas que el local tiene conectadas al PC de la caja, mediante un agente de impresión.

### HU09 — Formulario web de domicilio para el cliente

*Como cliente, quiero hacer mi pedido a domicilio desde mi celular en un formulario del sistema, escogiendo los productos de la carta y dejando mis datos de entrega, para pedir sin tener que llamar ni ir al local.*

- **Épica:** EP-04 · **Puntos:** 8 · **Prioridad:** Alta · **Responsable:** Cristian / Esteban
- **Criterio de aceptación clave:** Ningún pedido se envía sin la autorización de datos. Un pedido por transferencia queda en 'pendiente de pago' y no aparece para preparar hasta que se confirme el pago.

**Subtareas**

- [ ] [BD] Tabla cliente (nombre, teléfono, dirección, barrio, referencia) con la autorización de tratamiento de datos (fecha y medio)
- [ ] [BD] Tabla domicilio ligada al pedido, con canal, método de pago, estado y valor del envío
- [ ] [Backend] Endpoint público POST /api/domicilios/publico, sin inicio de sesión, con validaciones (express-validator) y límite de envíos por dispositivo
- [ ] [Backend] Si el método de pago es transferencia, el domicilio se crea en 'pendiente de pago'; si es contra entrega, en 'recibido'
- [ ] [Frontend] Formulario público mobile-first: carta por categorías, carrito, datos de entrega, método de pago y casilla de autorización con el texto de la política de datos
- [ ] [Frontend] Pantalla de confirmación con el número de pedido y, si escogió transferencia, los datos de la cuenta y la instrucción de enviar el comprobante por WhatsApp
- [ ] [QA] Probar envío sin autorización, sin productos, contra entrega y por transferencia desde un celular con datos móviles, fuera de la red del local

### HU10 — Registrar domicilios que llegan por llamada o WhatsApp

*Como cajero, quiero registrar en el mismo formulario los domicilios que los clientes piden por llamada o WhatsApp, para que todos los domicilios queden en el sistema sin importar por dónde lleguen.*

- **Épica:** EP-04 · **Puntos:** 2 · **Prioridad:** Alta · **Responsable:** Diana
- **Criterio de aceptación clave:** Cada domicilio queda marcado con su canal (web o teléfono/WhatsApp). Al buscar un teléfono ya registrado se cargan los datos del cliente.

**Subtareas**

- [ ] [Backend] Reutilizar el registro de HU09 con canal 'teléfono/WhatsApp' y el cajero que lo registró
- [ ] [Backend] Búsqueda de cliente por teléfono para no volver a pedir los datos
- [ ] [Frontend] Acceso al formulario desde el rol cajero, con autocompletado por teléfono y la casilla 'el cliente autorizó el tratamiento de sus datos'
- [ ] [QA] Probar cliente nuevo, cliente ya registrado y registro sin autorización

### HU11 — Seguimiento de domicilios por estado

*Como cajero, quiero ver los domicilios activos agrupados por estado y avanzarlos (pendiente de pago, recibido, en preparación, en camino, entregado), para saber en qué va cada entrega y responderle al cliente cuando pregunte.*

- **Épica:** EP-04 · **Puntos:** 8 · **Prioridad:** Alta · **Responsable:** Esteban / Cristian
- **Criterio de aceptación clave:** Un domicilio por transferencia no pasa a 'en preparación' sin el pago confirmado, y ningún domicilio llega a 'entregado' sin haber estado 'en camino'. Cada cambio de estado guarda la hora.

**Subtareas**

- [ ] [Backend] Endpoint PATCH /api/domicilios/:id/estado que solo permite avanzar en orden y guarda la hora y el usuario de cada cambio
- [ ] [Backend] Endpoint PATCH /api/domicilios/:id/confirmar-pago para transferencias: registra el pago y pasa el domicilio a 'recibido'
- [ ] [Backend] Al marcar 'entregado' un domicilio contra entrega, registrar el pago con la misma transacción de HU07
- [ ] [Frontend] Tablero con una columna por estado, actualización automática cada 15 segundos y domicilios con más de 45 minutos resaltados en rojo
- [ ] [Frontend] Opción para corregir o eliminar los datos de un cliente que lo solicite (Ley 1581 de 2012)
- [ ] [QA] Probar saltos de estado no permitidos, transferencia sin confirmar y cancelación con motivo

### HU16 — Imprimir comandas y cuentas en las impresoras del local

*Como cajero, quiero que las comandas salgan solas por la impresora de cocina cuando se envía un pedido y que la cuenta y el comprobante de pago se impriman en la impresora de caja, para que el local siga trabajando con sus impresoras térmicas.*

- **Épica:** EP-03 · **Puntos:** 5 · **Prioridad:** Alta · **Responsable:** Esteban / Diana
- **Criterio de aceptación clave:** Una comanda sale por la impresora de cocina en menos de 5 segundos después de enviar el pedido. Si una impresora está apagada, el trabajo queda pendiente y sale al prenderla, sin perderse ni duplicarse. La tirilla de caja dice 'Cuenta' o 'Comprobante de pago', no factura electrónica.

**Subtareas**

- [ ] [BD] Tabla trabajo_impresion (tipo, pedido, impresora destino, estado pendiente/impreso/error, intentos, fecha)
- [ ] [Backend] Crear un trabajo de impresión al enviar un pedido o un ajuste a cocina (HU04, HU05), al confirmar un domicilio (HU11) y al cerrar la cuenta o registrar el pago (HU06, HU07)
- [ ] [Backend] Endpoints para el agente: GET /api/impresion/pendientes y PATCH /api/impresion/:id, protegidos con una clave propia del agente
- [ ] [Backend] Agente de impresión en Node.js para el PC de la caja: consulta los trabajos pendientes cada 3 segundos, arma la tirilla en ESC/POS y la envía a la impresora compartida de cocina o de caja
- [ ] [Frontend] Botón 'Reimprimir' en la mesa y en la caja, y aviso cuando una impresión falla
- [ ] [QA] Probar en el local con las dos impresoras: comanda, ajuste de pedido, comanda de domicilio, cuenta, comprobante e impresora apagada

## Sprint 4: Reportes, estado de mesas y validación

**Objetivo:** Entregar los reportes y la vista de mesas que el propietario necesita, y validar el prototipo completo con él en el local.

Aquí se cierra EP-05, que es lo que convierte los registros diarios en información para decidir, y entra HU12, la vista del estado de las mesas para el propietario. Como es el último sprint, también se reserva tiempo para la prueba de aceptación del prototipo completo con el propietario, para corregir lo que salga de esa prueba y para dejar publicada en la nube la versión final con la carta y los usuarios reales del local.

### HU12 — Estado de las mesas en tiempo real

*Como propietario, quiero ver el estado de todas las mesas (libre, ocupada, por cobrar), para coordinar el servicio en las horas de más movimiento.*

- **Épica:** EP-02 · **Puntos:** 5 · **Prioridad:** Media · **Responsable:** Cristian
- **Criterio de aceptación clave:** Un cambio hecho en el celular del mesero se ve en la pantalla del propietario en máximo 15 segundos.

**Subtareas**

- [ ] [Backend] Endpoint GET /api/mesas/estado con mesa, estado, mesero, total parcial y minutos abierta
- [ ] [Frontend] Vista de mesas con actualización automática cada 15 segundos
- [ ] [Frontend] Al tocar una mesa se ve el detalle del pedido sin poder editarlo
- [ ] [QA] Abrir, cerrar y cobrar desde otra sesión y verificar que la vista refleja el cambio

### HU13 — Reporte de ventas por período

*Como propietario, quiero generar reportes de ventas y propinas por día, semana o mes, para ver cómo se comporta el negocio sin tener que sumar a mano.*

- **Épica:** EP-05 · **Puntos:** 8 · **Prioridad:** Alta · **Responsable:** Diana / Esteban
- **Criterio de aceptación clave:** El total del reporte de un día coincide exactamente con el cierre de caja. Un mes de datos responde en menos de 3 segundos.

**Subtareas**

- [ ] [BD] Índices sobre la fecha del pago y el estado del pedido para que las consultas respondan rápido
- [ ] [Backend] Endpoint GET /api/reportes/ventas?desde=&hasta=&agrupar=dia|semana|mes
- [ ] [Frontend] Filtro de fechas, gráfica de barras (Chart.js) y tabla con totales, legible en el celular
- [ ] [Frontend] Exportar el reporte a Excel o PDF
- [ ] [QA] Cuadrar el reporte de un día contra el cierre de caja de ese mismo día

### HU14 — Productos más vendidos

*Como propietario, quiero consultar los productos más vendidos en un período, para decidir qué promocionar y qué sacar de la carta.*

- **Épica:** EP-05 · **Puntos:** 5 · **Prioridad:** Media · **Responsable:** Diana
- **Criterio de aceptación clave:** El ranking muestra unidades e ingresos, y los productos desactivados siguen apareciendo si se vendieron en el período.

**Subtareas**

- [ ] [Backend] Endpoint GET /api/reportes/top-productos?desde=&hasta=&limite=10
- [ ] [Backend] Calcular unidades vendidas e ingresos por producto y por categoría, sumando mesa y domicilio
- [ ] [Frontend] Ranking con barras horizontales y opción de ver también los menos vendidos
- [ ] [QA] Probar períodos sin ventas y productos desactivados que sí tuvieron ventas

### HU15 — Comparativo mesa vs. domicilio

*Como propietario, quiero comparar las ventas del canal en mesa con las del canal domicilio, para saber cuánto está aportando el canal nuevo.*

- **Épica:** EP-05 · **Puntos:** 5 · **Prioridad:** Media · **Responsable:** Esteban
- **Criterio de aceptación clave:** Los porcentajes de los dos canales suman 100 % y el ticket promedio se calcula solo con pedidos pagados.

**Subtareas**

- [ ] [Backend] Endpoint GET /api/reportes/canales con ventas, número de pedidos y ticket promedio por canal
- [ ] [Frontend] Gráfica comparativa y porcentaje de participación de cada canal
- [ ] [QA] Verificar que los domicilios cancelados o sin pago confirmado no se cuentan como venta
- [ ] [Backend] Publicar la versión v1.0 en la nube con la carta real y los usuarios del local
- [ ] [QA] Prueba de aceptación del prototipo completo con el propietario en el local
- [ ] [QA] Volver a cronometrar el cierre de caja con el sistema y compararlo con la línea base del Sprint 0
