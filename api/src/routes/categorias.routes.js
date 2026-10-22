const { Router } = require('express');
const { body, param } = require('express-validator');
const validar = require('../middlewares/validar');
const { verificarToken, permitirRoles } = require('../middlewares/autenticacion');
const categorias = require('../controllers/categorias.controller');

const router = Router();
router.use(verificarToken);

const reglas = {
  id: () => param('id').isInt({ min: 1 }).withMessage('Categoría no válida.'),
  nombre: () =>
    body('nombre')
      .isString()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('El nombre de la categoría debe tener entre 2 y 50 caracteres.'),
  orden: () =>
    body('orden')
      .optional()
      .isInt({ min: 0, max: 65535 })
      .withMessage('El orden debe ser un número entero mayor o igual a cero.')
      .toInt(),
};

// Cualquiera con sesión consulta las categorías (carta, pedidos, caja)
router.get('/', categorias.listar);

// Crear, editar y eliminar: solo el propietario
router.post(
  '/',
  permitirRoles('propietario'),
  reglas.nombre(),
  reglas.orden(),
  validar,
  categorias.crear,
);

router.patch(
  '/:id',
  permitirRoles('propietario'),
  reglas.id(),
  reglas.nombre().optional(),
  reglas.orden(),
  body('activa')
    .optional()
    .isBoolean({ strict: true })
    .withMessage('El campo activa debe ser verdadero o falso.'),
  validar,
  categorias.actualizar,
);

router.delete('/:id', permitirRoles('propietario'), reglas.id(), validar, categorias.eliminar);

module.exports = router;
