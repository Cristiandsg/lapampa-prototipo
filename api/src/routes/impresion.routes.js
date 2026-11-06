const { Router } = require('express');
const { body, param, query } = require('express-validator');
const validar = require('../middlewares/validar');
const verificarClaveAgente = require('../middlewares/claveAgente');
const { verificarToken, permitirRoles } = require('../middlewares/autenticacion');
const impresion = require('../controllers/impresion.controller');

const router = Router();

const MAX_ID = 4294967295; // INT UNSIGNED
const MAX_TRABAJO = Number.MAX_SAFE_INTEGER; // BIGINT UNSIGNED, hasta donde JS es exacto

// ---------- HU16: el agente de impresión del PC de la caja ----------

router.get(
  '/pendientes',
  verificarClaveAgente,
  query('impresora')
    .optional()
    .isIn(['cocina', 'caja'])
    .withMessage('La impresora debe ser cocina o caja.'),
  validar,
  impresion.pendientes,
);

router.patch(
  '/:id',
  verificarClaveAgente,
  param('id').isInt({ min: 1, max: MAX_TRABAJO }).withMessage('Trabajo inválido.'),
  body('estado').isIn(['impreso', 'error']).withMessage('El estado debe ser impreso o error.'),
  body('error')
    .if(body('estado').equals('error'))
    .isString()
    .withMessage('Describe el error de la impresora.')
    .bail()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Describe el error de la impresora (máximo 255 caracteres).'),
  validar,
  impresion.actualizar,
);

// ---------- HU16: el personal ve si la impresión falla y reimprime ----------

router.get(
  '/estado',
  verificarToken,
  permitirRoles('mesero', 'cajero', 'propietario'),
  impresion.estado,
);

// La comanda la reimprime quien atiende las mesas o la caja; la cuenta, quien la puede
// generar (HU06); el comprobante, solo quien cobra (HU07).
const ROLES_REIMPRIMIR = {
  comanda: ['mesero', 'cajero', 'propietario'],
  cuenta: ['mesero', 'cajero', 'propietario'],
  comprobante: ['cajero', 'propietario'],
};

router.post(
  '/reimprimir',
  verificarToken,
  body('tipo')
    .isIn(Object.keys(ROLES_REIMPRIMIR))
    .withMessage('Escoge qué reimprimir: comanda, cuenta o comprobante.'),
  body('pedidoId').isInt({ min: 1, max: MAX_ID }).withMessage('Pedido inválido.').toInt(),
  validar,
  (req, res, next) => permitirRoles(...ROLES_REIMPRIMIR[req.body.tipo])(req, res, next),
  impresion.reimprimir,
);

module.exports = router;
