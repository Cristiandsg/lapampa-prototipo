const { Router } = require('express');
const { body, param } = require('express-validator');
const validar = require('../middlewares/validar');
const { verificarToken, permitirRoles } = require('../middlewares/autenticacion');
const pedidos = require('../controllers/pedidos.controller');

const router = Router();
router.use(verificarToken);

// Toman pedidos en mesa el mesero y el propietario (HU04)
router.post(
  '/',
  permitirRoles('mesero', 'propietario'),
  body('mesaId').isInt({ min: 1 }).withMessage('Selecciona la mesa.').toInt(),
  body('items')
    .isArray({ min: 1, max: 100 })
    .withMessage('El pedido debe tener al menos un producto.'),
  body('items.*.productoId').isInt({ min: 1 }).withMessage('Producto no válido.').toInt(),
  body('items.*.cantidad')
    .isInt({ min: 1, max: 99 })
    .withMessage('La cantidad de cada producto debe ser de 1 a 99.')
    .toInt(),
  body('items.*.nota')
    .optional({ values: 'null' })
    .isString()
    .isLength({ max: 120 })
    .withMessage('La nota de un producto puede tener máximo 120 caracteres.'),
  body('observaciones')
    .optional({ values: 'null' })
    .isString()
    .isLength({ max: 255 })
    .withMessage('Las observaciones pueden tener máximo 255 caracteres.'),
  validar,
  pedidos.crear,
);

// Ver un pedido: todos los roles (el cajero lo cobra en el Sprint 2)
router.get(
  '/:id',
  param('id').isInt({ min: 1 }).withMessage('Pedido no válido.'),
  validar,
  pedidos.obtener,
);

module.exports = router;
