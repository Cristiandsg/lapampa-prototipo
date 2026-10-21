const { Router } = require('express');
const { body } = require('express-validator');
const validar = require('../middlewares/validar');
const { verificarToken, permitirRoles } = require('../middlewares/autenticacion');
const productos = require('../controllers/productos.controller');

const router = Router();

// Consulta pública o interna de productos
router.get('/', verificarToken, productos.listar);
router.get('/:id', verificarToken, productos.obtenerPorId);

// Creación de producto (solo propietario)
router.post(
  '/',
  verificarToken,
  permitirRoles('propietario'),
  [
    body('categoriaId')
      .isInt({ min: 1 })
      .withMessage('Debe seleccionar una categoría válida.'),
    body('nombre')
      .isString()
      .trim()
      .isLength({ min: 2, max: 80 })
      .withMessage('El nombre del producto debe tener entre 2 y 80 caracteres.'),
    body('descripcion')
      .optional({ nullable: true })
      .isString()
      .trim()
      .isLength({ max: 255 })
      .withMessage('La descripción no puede superar los 255 caracteres.'),
    body('precio')
      .isFloat({ gt: 0 })
      .withMessage('El precio debe ser un número mayor a cero.'),
  ],
  validar,
  productos.crear
);

// Edición de producto (solo propietario, excepto el cambio de 'agotado_hoy' que también permite cajero/mesero)
router.patch(
  '/:id',
  verificarToken,
  permitirRoles('propietario', 'cajero', 'mesero'),
  [
    body('categoriaId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Debe seleccionar una categoría válida.'),
    body('nombre')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 2, max: 80 })
      .withMessage('El nombre del producto debe tener entre 2 y 80 caracteres.'),
    body('descripcion')
      .optional({ nullable: true })
      .isString()
      .trim()
      .isLength({ max: 255 })
      .withMessage('La descripción no puede superar los 255 caracteres.'),
    body('precio')
      .optional()
      .isFloat({ gt: 0 })
      .withMessage('El precio debe ser un número mayor a cero.'),
    body('activo')
      .optional()
      .isBoolean()
      .withMessage('El campo activo debe ser booleano.'),
    body('agotadoHoy')
      .optional()
      .isBoolean()
      .withMessage('El campo agotadoHoy debe ser booleano.'),
  ],
  validar,
  productos.actualizar
);

// Eliminación de producto (solo propietario)
router.delete(
  '/:id',
  verificarToken,
  permitirRoles('propietario'),
  productos.eliminar
);

module.exports = router;