const { Router } = require('express');

const router = Router();

// Cada módulo registra aquí sus rutas a medida que se construye:
//   Sprint 1: /auth, /usuarios, /categorias, /productos, /mesas, /pedidos
//   Sprint 2: /pedidos/:id/items, /pedidos/:id/pagos, /caja
//   Sprint 3: /domicilios, /clientes
//   Sprint 4: /reportes
router.use('/salud', require('./salud.routes'));

module.exports = router;
