const express = require('express');
const router = express.Router();
const { registrarPagoConPropina, obtenerCierreCaja, obtenerDetallePedidoParaCobro } = require('../controllers/caja.controller');

// Listar pedidos por cobrar (heredado de HU06) - Asegúrate de mantener tu lógica anterior de por-cobrar si la tienes aquí o en otro archivo
// Endpoint para detalle de pedido y propina sugerida (PRU-82)
router.get('/pedidos/:id/detalle', obtenerDetallePedidoParaCobro);

// Endpoint para registrar pagos y propina (PRU-83)
router.post('/pedidos/:id/pagos', registrarPagoConPropina);

// Endpoint para el cierre de caja diario (PRU-79 / PRU-85)
router.get('/cierre', obtenerCierreCaja);

module.exports = router;