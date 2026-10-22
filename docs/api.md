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
| GET | `/pedidos/:id` | Con sesión | Pedido con mesa, mesero, detalle (precio guardado en el momento del pedido), total y comanda |
| * | `/caja/...` | Propietario, cajero | Se construye en el Sprint 2 (hoy: 403 para el mesero, 404 para los demás) |
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

## Reglas de las cuentas

- Usuario: de 3 a 40 caracteres, minúsculas sin tilde, números, punto, guion o guion bajo. Se guarda en minúsculas.
- Contraseña: mínimo 8 caracteres. Se guarda solo como hash bcrypt (RNF02).
- Un usuario que no existe y una contraseña errada responden el mismo mensaje, para no revelar qué cuentas existen.
- Si el propietario desactiva una cuenta o le cambia el rol, aplica de inmediato: la API revisa la cuenta en cada petición.

## Pruebas

`npm test --prefix api` crea una base aparte, `lapampa_test`, con el mismo `schema.sql` y `seed.sql`, y corre las pruebas ahí; la base `lapampa` de desarrollo no se toca. Necesita MySQL prendido (XAMPP) con los datos de `api/.env`.
