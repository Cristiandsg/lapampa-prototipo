const { Router } = require('express');
const { body, param } = require('express-validator');
const validar = require('../middlewares/validar');
const { verificarToken, permitirRoles } = require('../middlewares/autenticacion');
const usuarios = require('../controllers/usuarios.controller');

const ROLES = ['propietario', 'cajero', 'mesero'];
const router = Router();

// Solo el propietario administra las cuentas (HU01)
router.use(verificarToken, permitirRoles('propietario'));

const reglas = {
  nombre: () =>
    body('nombre')
      .isString()
      .trim()
      .isLength({ min: 2, max: 80 })
      .withMessage('El nombre debe tener entre 2 y 80 caracteres.'),
  usuario: () =>
    body('usuario')
      .isString()
      .trim()
      .toLowerCase()
      .matches(/^[a-z0-9._-]{3,40}$/)
      .withMessage(
        'El usuario debe tener de 3 a 40 caracteres: letras sin tilde, números, punto, guion o guion bajo.',
      ),
  contrasena: () =>
    body('contrasena')
      .isString()
      .isLength({ min: 8, max: 72 })
      .withMessage('La contraseña debe tener al menos 8 caracteres.'),
  rol: () => body('rol').isIn(ROLES).withMessage('El rol debe ser propietario, cajero o mesero.'),
};

router.get('/', usuarios.listar);
router.get('/roles', usuarios.listarRoles);

router.post(
  '/',
  reglas.nombre(),
  reglas.usuario(),
  reglas.contrasena(),
  reglas.rol(),
  validar,
  usuarios.crear,
);

router.put(
  '/:id',
  param('id').isInt({ min: 1 }).withMessage('Cuenta no válida.'),
  reglas.nombre().optional(),
  reglas.contrasena().optional(),
  reglas.rol().optional(),
  body('activo')
    .optional()
    .isBoolean({ strict: true })
    .withMessage('Activo debe ser verdadero o falso.'),
  validar,
  usuarios.actualizar,
);

module.exports = router;
