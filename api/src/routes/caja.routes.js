const { Router } = require('express');
const { verificarToken, permitirRoles } = require('../middlewares/autenticacion');
const pedidos = require('../controllers/pedidos.controller');

const router = Router();

// La caja es del cajero y del propietario: un mesero recibe 403 (criterio de HU01)
router.use(verificarToken, permitirRoles('propietario', 'cajero'));

// HU06 — Bandeja del cajero: cuentas generadas que faltan por cobrar
router.get('/por-cobrar', pedidos.porCobrar);

// HU07 (pagos y cierre de caja) se agrega aquí.

module.exports = router;
