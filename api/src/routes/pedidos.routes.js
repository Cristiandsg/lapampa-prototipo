const { Router } = require('express');
const { body, param } = require('express-validator');
const validar = require('../middlewares/validar');
const { verificarToken, permitirRoles } = require('../middlewares/autenticacion');
const pedidos = require('../controllers/pedidos.controller');

const router = Router();
router.use(verificarToken);

// Toman y modifican pedidos en mesa el mesero y el propietario (HU04, HU05)
const enMesa = permitirRoles('mesero', 'propietario');

const MAX_ID = 4294967295; // INT UNSIGNED
const idPedido = () =>
  param('id').isInt({ min: 1, max: MAX_ID }).withMessage('Pedido no válido.').toInt();
const idItem = () =>
  param('itemId').isInt({ min: 1, max: MAX_ID }).withMessage('Producto no válido.').toInt();

const nota = (campo) =>
  body(campo)
    .optional({ values: 'null' })
    .isString()
    .isLength({ max: 120 })
    .withMessage('La nota de un producto puede tener máximo 120 caracteres.');

const cantidad = (campo) =>
  body(campo)
    .isInt({ min: 1, max: 99 })
    .withMessage('La cantidad de cada producto debe ser de 1 a 99.')
    .toInt();

// Lista de productos: la usan el pedido nuevo (HU04) y la adición (HU05)
const reglasItems = [
  body('items')
    .isArray({ min: 1, max: 100 })
    .withMessage('El pedido debe tener al menos un producto.'),
  body('items.*.productoId')
    .isInt({ min: 1, max: MAX_ID })
    .withMessage('Producto no válido.')
    .toInt(),
  cantidad('items.*.cantidad'),
  nota('items.*.nota'),
];

const motivo = () =>
  body('motivo')
    .isString()
    .withMessage('Escribe el motivo: ese producto ya se envió a cocina.')
    .bail()
    .trim()
    .isLength({ min: 3, max: 150 })
    .withMessage('El motivo debe tener entre 3 y 150 caracteres.');

router.post(
  '/',
  enMesa,
  body('mesaId').isInt({ min: 1, max: MAX_ID }).withMessage('Selecciona la mesa.').toInt(),
  ...reglasItems,
  body('observaciones')
    .optional({ values: 'null' })
    .isString()
    .isLength({ max: 255 })
    .withMessage('Las observaciones pueden tener máximo 255 caracteres.'),
  validar,
  pedidos.crear,
);

// Ver un pedido: todos los roles (el cajero lo cobra en el Sprint 2)
router.get('/:id', idPedido(), validar, pedidos.obtener);

// HU05 — Modificar un pedido abierto
router.post('/:id/items', enMesa, idPedido(), ...reglasItems, validar, pedidos.agregarItems);

router.put(
  '/:id/items/:itemId',
  enMesa,
  idPedido(),
  idItem(),
  cantidad('cantidad').optional(),
  nota('nota'),
  motivo().optional({ values: 'null' }),
  validar,
  pedidos.cambiarItem,
);

router.delete(
  '/:id/items/:itemId',
  enMesa,
  idPedido(),
  idItem(),
  motivo(),
  validar,
  pedidos.quitarItem,
);

module.exports = router;
