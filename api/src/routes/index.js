const { Router } = require('express');
const { verificarToken, permitirRoles } = require('../middlewares/autenticacion');

const router = Router();

// Cada módulo registra aquí sus rutas a medida que se construye:
//   Sprint 1: /auth, /usuarios, /categorias, /productos, /mesas, /pedidos
//   Sprint 2: /pedidos/:id/items, /pedidos/:id/pagos, /caja
//   Sprint 3: /domicilios, /clientes
//   Sprint 4: /reportes
router.use('/salud', require('./salud.routes'));
router.use('/auth', require('./auth.routes'));
router.use('/usuarios', require('./usuarios.routes'));
router.use('/categorias', require('./categorias.routes'));
router.use('/productos', require('./productos.routes'));
router.use('/mesas', require('./mesas.routes'));

// Permisos de los módulos que vienen en sprints siguientes. Quedan protegidos desde ya:
// un mesero recibe 403 al intentar entrar a caja o a reportes (criterio de HU01).
// Mientras el módulo no exista, los roles con permiso reciben 404.
router.use('/caja', verificarToken, permitirRoles('propietario', 'cajero'));
router.use('/reportes', verificarToken, permitirRoles('propietario'));

module.exports = router;
