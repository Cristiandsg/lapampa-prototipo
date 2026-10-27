const { Router } = require('express');
const { body, param, query } = require('express-validator');
const validar = require('../middlewares/validar');
const { verificarToken, permitirRoles } = require('../middlewares/autenticacion');
const caja = require('../controllers/caja.controller');
const { MEDIOS } = require('../models/caja.model');

const router = Router();

// La caja es del cajero y del propietario: un mesero recibe 403 (criterio de HU01)
router.use(verificarToken, permitirRoles('propietario', 'cajero'));

const VALOR_MAXIMO = 99999999; // DECIMAL(12,2) con margen; un pago real no llega ni cerca

// HU06 — Bandeja del cajero: cuentas generadas que faltan por cobrar
router.get('/por-cobrar', caja.porCobrar);

// HU07 + HU08 — Cobrar: propina confirmada por el cajero y uno o varios pagos
router.post(
  '/pedidos/:id/pagos',
  param('id').isInt({ min: 1, max: 4294967295 }).withMessage('Pedido no válido.').toInt(),
  body('propina.respuesta')
    .isIn(['aceptada', 'modificada', 'rechazada'])
    .withMessage('Confirma qué dijo el cliente de la propina: la acepta, da otro valor o no da.'),
  body('propina.valor')
    .optional({ values: 'null' })
    .isInt({ min: 0, max: VALOR_MAXIMO })
    .withMessage('La propina debe ser un valor en pesos, sin decimales.')
    .toInt(),
  body('pagos')
    .isArray({ min: 1, max: 3 })
    .withMessage('Registra entre uno y tres pagos.')
    .bail()
    .custom((pagos) => new Set(pagos.map((p) => p?.medio)).size === pagos.length)
    .withMessage('Cada medio de pago va una sola vez: suma los valores del mismo medio.'),
  body('pagos.*.medio')
    .isIn(MEDIOS)
    .withMessage('El medio de pago debe ser efectivo, tarjeta o transferencia.'),
  body('pagos.*.valor')
    .isInt({ min: 1, max: VALOR_MAXIMO })
    .withMessage('Cada pago debe ser un valor en pesos mayor que cero, sin decimales.')
    .toInt(),
  body('pagos.*.referencia')
    .optional({ values: 'null' })
    .isString()
    .isLength({ max: 60 })
    .withMessage('La referencia puede tener máximo 60 caracteres.'),
  validar,
  caja.registrarPago,
);

// HU07 — Cierre de caja del día (por defecto, hoy en Colombia)
router.get(
  '/cierre',
  query('fecha')
    .optional()
    .isISO8601({ strict: true, strictSeparator: true })
    .withMessage('La fecha debe tener el formato AAAA-MM-DD.')
    .bail()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('La fecha debe tener el formato AAAA-MM-DD.'),
  validar,
  caja.obtenerCierreCaja,
);

module.exports = router;
