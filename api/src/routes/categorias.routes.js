const { Router } = require('express');
const { body } = require('express-validator');
const validar = require('../middlewares/validar');
const { verificarToken, permitirRoles } = require('../middlewares/autenticacion');
const categorias = require('../controllers/categorias.controller');

const router = Router();

// Cualquiera con sesión iniciada puede consultar categorías (útil para la carta digital/meseros/caja)
router.get('/', verificarToken, categorias.listar);

// Solo el propietario puede crear y modificar categorías
router.post(
  '/',
  verificarToken,
  permitirRoles('propietario'),
  [
    body('nombre')
      .isString()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('El nombre de la categoría debe tener entre 2 y 50 caracteres.'),
    body('orden')
      .optional()
      .isInt({ min: 0 })
      .withMessage('El orden debe ser un número entero mayor o igual a cero.'),
  ],
  validar,
  categorias.crear
);

router.patch(
  '/:id',
  verificarToken,
  permitirRoles('propietario'),
  [
    body('nombre')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('El nombre de la categoría debe tener entre 2 y 50 caracteres.'),
    body('orden')
      .optional()
      .isInt({ min: 0 })
      .withMessage('El orden debe ser un número entero mayor o igual a cero.'),
    body('activa')
      .optional()
      .isBoolean()
      .withMessage('El campo activa debe ser un valor booleano.'),
  ],
  validar,
  categorias.actualizar
);

router.delete(
  '/:id',
  verificarToken,
  permitirRoles('propietario'),
  categorias.eliminar
);

module.exports = router;