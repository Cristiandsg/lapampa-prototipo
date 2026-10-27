const { Router } = require('express');
const { body, param } = require('express-validator');
const validar = require('../middlewares/validar');
const { verificarToken, permitirRoles } = require('../middlewares/autenticacion');
const mesas = require('../controllers/mesas.controller');

const router = Router();
router.use(verificarToken);

const reglaNombre = () =>
  body('nombre')
    .isString()
    .withMessage('Escribe el nombre de la mesa.')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Escribe el nombre de la mesa.')
    .bail()
    .isLength({ max: 40 })
    .withMessage('El nombre de la mesa puede tener máximo 40 caracteres.');

const reglaId = () => param('id').isInt({ min: 1 }).withMessage('Mesa no válida.');

// Todos ven las mesas (el cajero las necesita para cobrar en el Sprint 2)
router.get('/', mesas.listar);

// Crean, renombran y eliminan mesas el mesero y el propietario (HU03)
const puedeAdministrar = permitirRoles('mesero', 'propietario');

router.post('/', puedeAdministrar, reglaNombre(), validar, mesas.crear);
router.post('/quitar-libres', puedeAdministrar, mesas.quitarLibres);
router.patch('/:id', puedeAdministrar, reglaId(), reglaNombre(), validar, mesas.renombrar);
router.delete('/:id', puedeAdministrar, reglaId(), validar, mesas.eliminar);

module.exports = router;
