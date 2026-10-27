# API de La Pampa

Base: `https://lapampa-api.onrender.com/api` en la nube y `http://localhost:3000/api` en local. Todas las respuestas son JSON; los errores traen `{ "error": "mensaje en español" }`.

## Sesión y permisos (HU01)

Las rutas protegidas piden el encabezado `Authorization: Bearer <token>`. El token dura 12 horas (`JWT_EXPIRA`).

| Código | Cuándo |
|---|---|
| 401 | No hay token, el token venció o la cuenta ya no está activa |
| 403 | La cuenta no tiene el rol que pide la ruta |
| 423 | Cuenta bloqueada por 5 intentos fallidos seguidos (10 minutos) |

En el backend, cada ruta nueva se protege así:

```js
const { verificarToken, permitirRoles } = require('../middlewares/autenticacion');
router.post('/', verificarToken, permitirRoles('propietario', 'cajero'), controlador.crear);
// En el controlador, req.usuario = { id, nombre, usuario, rol }: es quien hizo la operación.
```

## Rutas

| Método | Ruta | Quién | Qué hace |
|---|---|---|---|
| GET | `/salud` | Público | Estado de la API y de la base de datos |
| POST | `/auth/login` | Público | `{ usuario, contrasena }` → `{ token, usuario: { id, nombre, usuario, rol } }` |
| GET | `/auth/yo` | Con sesión | Datos actuales de quien tiene la sesión |
| GET | `/usuarios` | Propietario | Lista de cuentas (sin contraseñas) |
| GET | `/usuarios/roles` | Propietario | Roles: propietario, cajero, mesero |
| POST | `/usuarios` | Propietario | `{ nombre, usuario, contrasena, rol }` → crea la cuenta (409 si el usuario ya existe) |
| PUT | `/usuarios/:id` | Propietario | Cualquiera de `{ nombre, rol, contrasena, activo }`. Cambiar la contraseña desbloquea la cuenta. El propietario no puede desactivarse ni quitarse el rol a sí mismo |
| GET | `/categorias` | Con sesión | Categorías en el orden de la carta (`?activas=true` para ocultar las desactivadas) |
| POST | `/categorias` | Propietario | `{ nombre, orden? }` (409 si el nombre ya existe) |
| PATCH | `/categorias/:id` | Propietario | Cualquiera de `{ nombre, orden, activa }`. Una categoría desactivada saca sus productos de los pedidos |
| DELETE | `/categorias/:id` | Propietario | Solo si no tiene productos (si tiene, 409: se desactiva) |
| GET | `/productos` | Con sesión | Carta completa. Filtros: `categoria_id`, `activos=true` y `disponibles=true` (activo, no agotado y de categoría activa: lo que se puede pedir hoy, para HU04 y HU09) |
| GET | `/productos/:id` | Con sesión | Un producto |
| POST | `/productos` | Propietario | `{ categoriaId, nombre, descripcion?, precio }`; precio mayor a cero (409 si el nombre ya existe) |
| PATCH | `/productos/:id` | Propietario; mesero y cajero solo `agotadoHoy` | Cualquiera de `{ categoriaId, nombre, descripcion, precio, activo, agotadoHoy }`. No hay DELETE: los productos se desactivan con `{ "activo": false }` |
| GET | `/mesas` | Con sesión | Mesas activas de la jornada con su estado (`libre`, `ocupada`, `por_cobrar`), quién la creó y el resumen del pedido vigente (`pedido: { id, total, minutos }` o `null`) |
| POST | `/mesas` | Mesero, propietario | `{ nombre }` libre, de 1 a 40 caracteres (409 si ya hay una mesa activa con ese nombre, sin importar mayúsculas ni tildes) |
| PATCH | `/mesas/:id` | Mesero, propietario | `{ nombre }`: renombrar. 409 si tiene pedido abierto o si el nombre ya está en uso |
| DELETE | `/mesas/:id` | Mesero, propietario | Desactiva la mesa (no la borra). 409 si tiene pedido abierto |
| POST | `/mesas/quitar-libres` | Mesero, propietario | Al cerrar la jornada: desactiva todas las mesas libres y responde `{ cantidad }` |
| POST | `/pedidos` | Mesero, propietario | `{ mesaId, items: [{ productoId, cantidad (1-99), nota? }], observaciones? }`. Responde el pedido con número (`id`), hora, mesero, detalle y `comanda`. 409 si la mesa ya tiene pedido o un producto está agotado o desactivado; 400 sin productos |
| GET | `/pedidos/:id` | Con sesión | Pedido con mesa, mesero, detalle (precio guardado en el momento del pedido), total, comanda e `historial` (quién, qué, cuándo y motivo) |
| POST | `/pedidos/:id/items` | Mesero, propietario | `{ items: [{ productoId, cantidad (1-99), nota? }] }`: agrega productos a un pedido abierto. Responde el pedido actualizado y `ajuste` (la tirilla de "ADICIÓN" para cocina). 409 si el pedido no está abierto o un producto está agotado |
| PUT | `/pedidos/:id/items/:itemId` | Mesero, propietario | Cualquiera de `{ cantidad, nota }`, más `motivo` (3 a 150 caracteres), obligatorio si baja la cantidad. Responde el pedido y `ajuste` (`null` si no cambió nada) |
| DELETE | `/pedidos/:id/items/:itemId` | Mesero, propietario | `{ motivo }` obligatorio. Quita la línea; si era la única, el pedido queda `cancelado` y la mesa `libre`. 404 si la línea ya no está en el pedido |
| PATCH | `/pedidos/:id/cerrar` | Mesero, propietario, cajero | Cierra el pedido y genera la cuenta: pedido y mesa pasan a `por_cobrar` y la cuenta queda en la cola de la impresora de caja. Responde el pedido con `cuenta` (texto de la tirilla). 409 si no está abierto |
| PATCH | `/pedidos/:id/reabrir` | Mesero, propietario, cajero | `{ motivo }` obligatorio. Devuelve un pedido `por_cobrar` a `abierto` (el cliente pidió algo más). 409 si no está por cobrar o ya tiene pagos |
| GET | `/caja/por-cobrar` | Propietario, cajero | Bandeja del cajero: `[{ id, mesa, mesero, subtotal, productos, cerrado_en, minutos }]`, la más antigua primero. El mesero recibe 403 |
| POST | `/caja/pedidos/:id/pagos` | Propietario, cajero | `{ propina: { respuesta: 'aceptada' \| 'modificada' \| 'rechazada', valor? }, pagos: [{ medio, valor, referencia? }] }` (1 a 3 pagos, un medio por pago, valores enteros en pesos). Cobra el pedido: responde 201 con el pedido `pagado`, sus `pagos`, `propina` y `comprobante`. 400 si los pagos no suman consumo + propina; 409 si no está por cobrar |
| GET | `/caja/cierre?fecha=AAAA-MM-DD` | Propietario, cajero | Cierre de caja del día (sin fecha: hoy en Colombia): `{ fecha, pedidosPagados, consumo, propinas: { total, porMesero }, porMedio, totalRecaudado, porCobrar }` |
| * | `/reportes/...` | Propietario | Se construye en el Sprint 4 (hoy: 403 para mesero y cajero, 404 para el propietario) |

## Reglas de la carta (HU02)

- Los productos no se borran: se desactivan, para no romper los pedidos ya registrados.
- Un cambio de precio solo aplica a los pedidos nuevos: cada `detalle_pedido` guarda el precio del momento.
- "Agotado hoy" oculta un producto de los pedidos de la jornada sin desactivarlo; lo pueden marcar el propietario, el cajero y el mesero.

## Reglas de las mesas (HU03)

- No hay mesas fijas: el mesero crea las de la jornada con el nombre que quiera. El nombre es único solo entre las mesas activas (columna generada `nombre_activo`), así que "Terraza 1" se puede volver a crear otro día.
- Renombrar y eliminar bloquean la mesa con `SELECT ... FOR UPDATE` y revisan que no tenga un pedido `abierto` o `por_cobrar`: si otro mesero está abriendo un pedido en ese instante (HU04), uno espera al otro.
- Cada creación, cambio de nombre y eliminación queda en `historial_cambio` con quién lo hizo.

## Reglas de los pedidos (HU04)

- Todo va en una sola transacción: se bloquea la mesa (`SELECT ... FOR UPDATE`), se revisa que esté libre, se toma el precio actual de cada producto, se guardan pedido y detalle, la mesa pasa a `ocupada`, la comanda queda en `trabajo_impresion` (cocina) y el registro en `historial_cambio`. Si algo falla, no queda nada a medias.
- Si dos meseros abren la misma mesa a la vez, uno espera al otro y el segundo recibe 409.
- El número del pedido es su `id` (consecutivo). Las líneas con el mismo producto y la misma nota se juntan.
- La conexión a la base trabaja en hora de Colombia (`SET time_zone = '-05:00'` en `api/src/config/db.js`).

## Reglas para modificar un pedido (HU05)

- Solo se modifica un pedido `abierto`. Con la cuenta generada (`por_cobrar`), pagado o anulado responde 409.
- Todo lo que está en el pedido ya se envió a cocina: bajar una cantidad o quitar un producto **exige el motivo**. Subir una cantidad o agregar productos no lo pide.
- Cada cambio deja en la cola de cocina (`trabajo_impresion`, tipo `ajuste_comanda`) una tirilla con **solo lo que cambió**: `ADICIÓN`, `ANULAR`, `CAMBIO` (nota) o `PEDIDO ANULADO`, con quién lo hizo y el motivo.
- Una adición se suma a la línea que tenga el mismo producto, la misma nota y el mismo precio. Si el precio de la carta cambió, va en otra línea con el precio nuevo.
- Quitar el único producto anula el pedido y deja la mesa libre (decisión del PO: el cliente se fue sin consumir).
- Cada cambio queda en `historial_cambio` (`agregar_item`, `cambiar_item`, `quitar_item`, `anular`) con el antes, el después, el motivo y el usuario.
- Bloqueo: mesa y luego pedido con `SELECT ... FOR UPDATE`, en el mismo orden que HU03 y HU04. Si dos celulares cambian el mismo pedido a la vez, el segundo espera y trabaja sobre el pedido ya actualizado (si la línea ya no existe, recibe 404).

## Reglas de la cuenta (HU06)

- Todo pedido trae `cuenta` (el texto de la tirilla de caja) y `propina_sugerida`. En un pedido abierto, la cuenta es la vista previa.
- Al cerrar, el subtotal se recalcula del detalle: la cuenta siempre cuadra con lo que hay en el pedido, incluidos los cambios de HU05.
- La cuenta dice "CUENTA" y "Este documento no es factura" (la facturación electrónica DIAN está fuera del alcance).
- La propina sugerida es el 10 % del subtotal y va **aparte**: la cuenta dice que es voluntaria (Ley 1935 de 2018) y nunca se suma al total. El cliente la decide al pagar (HU08).
- Después de generar la cuenta el pedido no admite cambios. Si el cliente pide algo más, se **reabre** con motivo (queda en el historial), siempre que no tenga pagos.
- Si dos celulares generan la cuenta a la vez, sale una sola (el segundo recibe 409).

## Reglas del cobro y la propina (HU07, HU08)

- Solo se cobra un pedido `por_cobrar`, bloqueado con `SELECT ... FOR UPDATE`: dos cajeros no lo cobran dos veces.
- La propina **nunca se suma sola**: el cajero marca la respuesta del cliente. `aceptada` = 10 % del consumo; `modificada` = el valor que diga el cliente (mayor que 0 y no más que el consumo); `rechazada` = 0. Queda en la tabla `propina` con el mesero que tomó el pedido (a quién se le liquida) y el cajero que la confirmó.
- Los pagos (efectivo, tarjeta, transferencia, combinados) tienen que sumar **exactamente** consumo + propina; si no cuadran, 400 y no se guarda nada. Las vueltas del efectivo se calculan en pantalla y no se registran como pago.
- Todo va en una transacción: propina, pagos, pedido `pagado`, mesa `libre`, historial (`pagar`) y comprobante en la cola de la impresora de caja.
- Quién cobra sale de la sesión (`req.usuario`), nunca del cuerpo de la petición.
- El cierre usa el día de Colombia (la conexión trabaja en `-05:00`) y filtra por rango de fechas para usar los índices. Lo recaudado = consumo + propinas; las propinas son de los meseros, no venta del gastrobar.

## Concurrencia en las transacciones de pedidos

Las transacciones de `pedido.model.js` corren en `READ COMMITTED`: después de esperar el bloqueo de la mesa, cada lectura ve lo último confirmado. En `REPEATABLE READ` (lo normal en MySQL) una transacción que esperó seguía viendo el pedido como estaba antes de esperar (por ejemplo, contaba 0 productos y anulaba un pedido al que otro celular le acababa de agregar algo).

## Reglas de las cuentas

- Usuario: de 3 a 40 caracteres, minúsculas sin tilde, números, punto, guion o guion bajo. Se guarda en minúsculas.
- Contraseña: mínimo 8 caracteres. Se guarda solo como hash bcrypt (RNF02).
- Un usuario que no existe y una contraseña errada responden el mismo mensaje, para no revelar qué cuentas existen.
- Si el propietario desactiva una cuenta o le cambia el rol, aplica de inmediato: la API revisa la cuenta en cada petición.

## Pruebas

`npm test --prefix api` crea una base aparte, `lapampa_test`, con el mismo `schema.sql` y `seed.sql`, y corre las pruebas ahí; la base `lapampa` de desarrollo no se toca. Necesita MySQL prendido (XAMPP) con los datos de `api/.env`.
