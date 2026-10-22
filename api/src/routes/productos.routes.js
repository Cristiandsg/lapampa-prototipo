const { Router } = require('express');
const { body, param } = require('express-validator');
const validar = require('../middlewares/validar');
const { verificarToken, permitirRoles } = require('../middlewares/autenticacion');
const productos = require('../controllers/productos.controller');

const router = Router();
router.use(verificarToken);

const PRECIO_MAXIMO = 99999999; // DECIMAL(10,2)

const reglas = {
  id: () => param('id').isInt({ min: 1 }).withMessage('Producto no válido.'),
  categoriaId: () =>
    body('categoriaId')
      .isInt({ min: 1, max: 65535 })
      .withMessage('Selecciona una categoría válida.'),
  nombre: () =>
    body('nombre')
      .isString()
      .trim()
      .isLength({ min: 2, max: 80 })
      .withMessage('El nombre del producto debe tener entre 2 y 80 caracteres.'),
  descripcion: () =>
    body('descripcion')
      .optional({ values: 'null' })
      .isString()
      .trim()
      .isLength({ max: 255 })
      .withMessage('La descripción no puede superar los 255 caracteres.'),
  precio: () =>
    body('precio')
      .isFloat({ gt: 0, max: PRECIO_MAXIMO })
      .withMessage('El precio debe ser un número mayor a cero.')
      .toFloat(),
  booleano: (campo) =>
    body(campo)
      .optional()
      .isBoolean({ strict: true })
      .withMessage(`El campo ${campo} debe ser verdadero o falso.`),
};

// Cualquiera con sesión consulta la carta (mesero y cajero la necesitan para los pedidos)
router.get('/', productos.listar);
router.get('/:id', reglas.id(), validar, productos.obtenerPorId);

// Crear: solo el propietario
router.post(
  '/',
  permitirRoles('propietario'),
  reglas.categoriaId(),
  reglas.nombre(),
  reglas.descripcion(),
  reglas.precio(),
  validar,
  productos.crear,
);

// Editar: el propietario cambia todo; mesero y cajero solo "agotado hoy" (lo valida el controlador).
// No hay DELETE: los productos se desactivan con { "activo": false }.
router.patch(
  '/:id',
  permitirRoles('propietario', 'cajero', 'mesero'),
  reglas.id(),
  reglas.categoriaId().optional(),
  reglas.nombre().optional(),
  reglas.descripcion(),
  reglas.precio().optional(),
  reglas.booleano('activo'),
  reglas.booleano('agotadoHoy'),
  validar,
  productos.actualizar,
);

module.exports = router;
