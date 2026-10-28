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
router.use('/pedidos', require('./pedidos.routes'));

// La caja protege sus rutas en caja.routes.js (propietario y cajero).
// Reportes viene en el Sprint 4, pero queda protegido desde ya: un mesero o un cajero
// reciben 403 (criterio de HU01); mientras no exista, el propietario recibe 404.
router.use('/caja', require('./caja.routes'));
router.use('/reportes', verificarToken, permitirRoles('propietario'));

module.exports = router;
