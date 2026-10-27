const { Router } = require('express');
const { body } = require('express-validator');
const validar = require('../middlewares/validar');
const { verificarToken } = require('../middlewares/autenticacion');
const auth = require('../controllers/auth.controller');

const router = Router();

router.post(
  '/login',
  body('usuario').isString().trim().toLowerCase().notEmpty().withMessage('Escribe tu usuario.'),
  body('contrasena').isString().notEmpty().withMessage('Escribe tu contraseña.'),
  validar,
  auth.iniciarSesion,
);

router.get('/yo', verificarToken, auth.quienSoy);

module.exports = router;
