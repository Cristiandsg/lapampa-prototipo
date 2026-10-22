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
| * | `/caja/...` | Propietario, cajero | Se construye en el Sprint 2 (hoy: 403 para el mesero, 404 para los demás) |
| * | `/reportes/...` | Propietario | Se construye en el Sprint 4 (hoy: 403 para mesero y cajero, 404 para el propietario) |

## Reglas de la carta (HU02)

- Los productos no se borran: se desactivan, para no romper los pedidos ya registrados.
- Un cambio de precio solo aplica a los pedidos nuevos: cada `detalle_pedido` guarda el precio del momento.
- "Agotado hoy" oculta un producto de los pedidos de la jornada sin desactivarlo; lo pueden marcar el propietario, el cajero y el mesero.

## Reglas de las cuentas

- Usuario: de 3 a 40 caracteres, minúsculas sin tilde, números, punto, guion o guion bajo. Se guarda en minúsculas.
- Contraseña: mínimo 8 caracteres. Se guarda solo como hash bcrypt (RNF02).
- Un usuario que no existe y una contraseña errada responden el mismo mensaje, para no revelar qué cuentas existen.
- Si el propietario desactiva una cuenta o le cambia el rol, aplica de inmediato: la API revisa la cuenta en cada petición.

## Pruebas

`npm test --prefix api` crea una base aparte, `lapampa_test`, con el mismo `schema.sql` y `seed.sql`, y corre las pruebas ahí; la base `lapampa` de desarrollo no se toca. Necesita MySQL prendido (XAMPP) con los datos de `api/.env`.
