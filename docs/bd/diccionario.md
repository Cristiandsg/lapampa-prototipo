# Diccionario de datos — La Pampa Gastrobar

Base de datos: `lapampa` (MySQL 8, InnoDB, `utf8mb4_unicode_ci`). Script: [`api/db/schema.sql`](../../api/db/schema.sql). Diagrama: [MER](mer.md).

Son 12 tablas: las 11 entidades del documento de Scrum más `historial_cambio`, que se agregó para cumplir la trazabilidad (RNF-06).

**Convenciones:** PK = llave primaria · FK = llave foránea · UK = valor único · todas las fechas en hora de Colombia (UTC-5), guardadas por el servidor.

## rol
Perfiles de acceso al sistema (HU01).

| Campo | Tipo | Nulo | Llave | Descripción |
|---|---|---|---|---|
| id | TINYINT UNSIGNED | No | PK | Identificador |
| nombre | VARCHAR(20) | No | UK | `propietario`, `cajero` o `mesero` |

## usuario
Personal que entra al sistema (HU01). El cliente de domicilios **no** es usuario: pide sin cuenta.

| Campo | Tipo | Nulo | Llave | Descripción |
|---|---|---|---|---|
| id | INT UNSIGNED | No | PK | Identificador |
| nombre | VARCHAR(80) | No | | Nombre de la persona |
| usuario | VARCHAR(40) | No | UK | Nombre con el que inicia sesión |
| contrasena_hash | CHAR(60) | No | | Hash bcrypt de la contraseña; nunca se guarda en texto plano (RNF-01) |
| rol_id | TINYINT UNSIGNED | No | FK → rol | Rol del usuario |
| activo | BOOLEAN | No | | `FALSE` = cuenta desactivada por el propietario |
| intentos_fallidos | TINYINT UNSIGNED | No | | Contador de intentos seguidos fallidos |
| bloqueado_hasta | DATETIME | Sí | | Tras 5 intentos fallidos se bloquea 10 minutos |
| creado_en | DATETIME | No | | Fecha de creación |

## categoria
Secciones de la carta (HU02).

| Campo | Tipo | Nulo | Llave | Descripción |
|---|---|---|---|---|
| id | SMALLINT UNSIGNED | No | PK | Identificador |
| nombre | VARCHAR(50) | No | UK | Entradas, Bebidas, etc. |
| orden | SMALLINT UNSIGNED | No | | Orden en que aparece en la carta |
| activa | BOOLEAN | No | | Si se muestra en la carta |

## producto
Productos de la carta (HU02). No se borran: se desactivan, para no romper pedidos viejos.

| Campo | Tipo | Nulo | Llave | Descripción |
|---|---|---|---|---|
| id | INT UNSIGNED | No | PK | Identificador |
| categoria_id | SMALLINT UNSIGNED | No | FK → categoria | Categoría del producto |
| nombre | VARCHAR(80) | No | UK | Nombre en la carta |
| descripcion | VARCHAR(255) | Sí | | Descripción corta |
| precio | DECIMAL(10,2) | No | | Precio vigente en pesos; debe ser mayor que 0 |
| activo | BOOLEAN | No | | `FALSE` = no aparece al tomar pedidos ni en el formulario de domicilio |
| agotado_hoy | BOOLEAN | No | | Oculta el producto por hoy sin desactivarlo |
| creado_en / actualizado_en | DATETIME | No | | Fechas de creación y último cambio |

## mesa
Mesas de la jornada (HU03). **No hay mesas fijas**: el mesero las crea con el nombre que quiera.

| Campo | Tipo | Nulo | Llave | Descripción |
|---|---|---|---|---|
| id | INT UNSIGNED | No | PK | Identificador |
| nombre | VARCHAR(40) | No | | Nombre libre: "Terraza 2", "Barra", "Cumpleaños Andrea" |
| estado | ENUM | No | | `libre`, `ocupada` o `por_cobrar` |
| activa | BOOLEAN | No | | Eliminar una mesa = desactivarla (se conserva su historial) |
| creada_por | INT UNSIGNED | No | FK → usuario | Mesero que la creó |
| creada_en | DATETIME | No | | Fecha de creación |
| nombre_activo | VARCHAR(40) | Sí | UK | Columna calculada: el nombre si la mesa está activa, `NULL` si no. Garantiza que no haya dos mesas **activas** con el mismo nombre |

## pedido
Pedido de mesa o de domicilio (HU04 a HU06). `id` es el número consecutivo del pedido.

| Campo | Tipo | Nulo | Llave | Descripción |
|---|---|---|---|---|
| id | INT UNSIGNED | No | PK | Número consecutivo |
| canal | ENUM | No | | `mesa` o `domicilio` |
| mesa_id | INT UNSIGNED | Sí | FK → mesa | Obligatorio si el canal es `mesa`; vacío si es `domicilio` |
| mesero_id | INT UNSIGNED | Sí | FK → usuario | Mesero que tomó el pedido |
| estado | ENUM | No | | `abierto`, `por_cobrar`, `pagado` o `cancelado` |
| subtotal | DECIMAL(12,2) | No | | Suma del detalle, se calcula al cerrar |
| observaciones | VARCHAR(255) | Sí | | Nota general del pedido |
| creado_en / cerrado_en / pagado_en | DATETIME | — | | Momentos del pedido |

## detalle_pedido
Productos de cada pedido (HU04, HU05).

| Campo | Tipo | Nulo | Llave | Descripción |
|---|---|---|---|---|
| id | INT UNSIGNED | No | PK | Identificador |
| pedido_id | INT UNSIGNED | No | FK → pedido | Pedido al que pertenece |
| producto_id | INT UNSIGNED | No | FK → producto | Producto pedido |
| cantidad | SMALLINT UNSIGNED | No | | Mayor que 0 |
| precio_unitario | DECIMAL(10,2) | No | | Precio **del momento**: si luego cambia la carta, el pedido no cambia |
| nota | VARCHAR(120) | Sí | | "Término medio", "sin cebolla" |

## pago
Pagos de un pedido (HU07). Un pedido admite varios pagos (pago mixto).

| Campo | Tipo | Nulo | Llave | Descripción |
|---|---|---|---|---|
| id | INT UNSIGNED | No | PK | Identificador |
| pedido_id | INT UNSIGNED | No | FK → pedido | Pedido pagado |
| medio | ENUM | No | | `efectivo`, `tarjeta` o `transferencia` |
| valor | DECIMAL(12,2) | No | | Mayor que 0 |
| referencia | VARCHAR(60) | Sí | | N.° de comprobante de la transferencia |
| cajero_id | INT UNSIGNED | No | FK → usuario | Cajero que registró el pago |
| creado_en | DATETIME | No | | Fecha del pago (base del cierre de caja) |

## propina
Propina del pedido (HU08). Voluntaria, sugerida en 10 % (Ley 1935 de 2018).

| Campo | Tipo | Nulo | Llave | Descripción |
|---|---|---|---|---|
| id | INT UNSIGNED | No | PK | Identificador |
| pedido_id | INT UNSIGNED | No | FK, UK | Una propina por pedido |
| valor_sugerido | DECIMAL(12,2) | No | | 10 % del subtotal |
| valor | DECIMAL(12,2) | No | | Lo que el cliente decidió dar; 0 si la rechazó |
| respuesta | ENUM | No | | `aceptada`, `modificada` o `rechazada` |
| mesero_id | INT UNSIGNED | Sí | FK → usuario | A quién se le liquida |
| cajero_id | INT UNSIGNED | No | FK → usuario | Quién confirmó la respuesta del cliente |

## cliente
Clientes de domicilio (HU09, HU10). Sin autorización de datos no se guarda nada (Ley 1581 de 2012).

| Campo | Tipo | Nulo | Llave | Descripción |
|---|---|---|---|---|
| id | INT UNSIGNED | No | PK | Identificador |
| nombre | VARCHAR(80) | No | | Nombre |
| telefono | VARCHAR(20) | No | UK | Se usa para buscarlo y no volver a pedir los datos |
| direccion | VARCHAR(150) | No | | Dirección habitual |
| barrio / referencia | VARCHAR | Sí | | Ayudas para el domiciliario |
| autoriza_datos | BOOLEAN | No | | Debe ser `TRUE` (restricción) |
| autorizacion_fecha | DATETIME | No | | Cuándo autorizó |
| autorizacion_medio | ENUM | No | | `formulario_web` o `telefono_whatsapp` |

Si el titular pide que se borren o corrijan sus datos (RNF-07), se hace desde la interfaz (HU11).

## domicilio
Datos de entrega de un pedido con canal `domicilio` (HU09 a HU11).

| Campo | Tipo | Nulo | Llave | Descripción |
|---|---|---|---|---|
| id | INT UNSIGNED | No | PK | Identificador |
| pedido_id | INT UNSIGNED | No | FK, UK | Pedido asociado |
| cliente_id | INT UNSIGNED | No | FK → cliente | Quién pidió |
| canal | ENUM | No | | `web` (formulario del cliente) o `telefono_whatsapp` (lo registró el cajero) |
| metodo_pago | ENUM | No | | `contra_entrega` o `transferencia` (anticipada) |
| estado | ENUM | No | | `pendiente_pago` → `recibido` → `en_preparacion` → `en_camino` → `entregado`, o `cancelado` |
| direccion_entrega | VARCHAR(150) | No | | Dirección usada en este pedido |
| valor_envio | DECIMAL(10,2) | No | | Costo del domicilio |
| registrado_por | INT UNSIGNED | Sí | FK → usuario | Cajero que lo registró; vacío si lo hizo el cliente |
| pago_confirmado_por / pago_confirmado_en | INT / DATETIME | Sí | FK → usuario | Quién y cuándo verificó la transferencia |
| motivo_cancelacion | VARCHAR(150) | Sí | | Obligatorio si se cancela |

**Reglas que la base de datos hace cumplir:**
- `pendiente_pago` solo existe para transferencias.
- Una transferencia no pasa de `pendiente_pago` (salvo a `cancelado`) sin `pago_confirmado_en`.
- Un domicilio cancelado debe tener motivo.

El orden de los estados (no saltarse pasos) lo valida la API (HU11).

## historial_cambio
Trazabilidad (RNF-06): quién cambió qué y cuándo.

| Campo | Tipo | Nulo | Llave | Descripción |
|---|---|---|---|---|
| id | BIGINT UNSIGNED | No | PK | Identificador |
| entidad | ENUM | No | | `pedido`, `mesa`, `domicilio` o `producto` |
| entidad_id | INT UNSIGNED | No | | Id del registro cambiado |
| accion | VARCHAR(40) | No | | `agregar_item`, `quitar_item`, `cambiar_estado`, `confirmar_pago`… |
| valor_anterior / valor_nuevo | VARCHAR(255) | Sí | | Antes y después |
| motivo | VARCHAR(150) | Sí | | Obligatorio al quitar un producto ya enviado a cocina |
| usuario_id | INT UNSIGNED | Sí | FK → usuario | Quién lo hizo; vacío si fue el cliente desde la web |
| creado_en | DATETIME | No | | Cuándo |
