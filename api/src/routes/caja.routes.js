const { Router } = require('express');
const { verificarToken, permitirRoles } = require('../middlewares/autenticacion');
const pedidos = require('../controllers/pedidos.controller');
const caja = require('../controllers/caja.controller'); // Controlador donde pondremos la lógica de pagos

const router = Router();

// La caja es del cajero y del propietario: un mesero recibe 403
router.use(verificarToken, permitirRoles('propietario', 'cajero'));

// HU06 — Bandeja del cajero: cuentas generadas que faltan por cobrar
router.get('/por-cobrar', pedidos.porCobrar);

// HU07 — Registrar pago de un pedido
router.post('/pedidos/:id/pagos', caja.registrarPago);

// HU07 / PRU-79 — Consultar el cierre de caja por fecha
router.get('/cierre', caja.obtenerCierreCaja);

module.exports = router;