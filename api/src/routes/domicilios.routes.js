const { Router } = require('express');
const { body } = require('express-validator');
const validar = require('../middlewares/validar');
const limitePedidos = require('../middlewares/limitePedidos');
const domicilios = require('../controllers/domicilios.controller');

const router = Router();

const MAX_ID = 4294967295; // INT UNSIGNED

// Celular de 10 dígitos (3xx) o fijo con el indicativo nuevo (60x + 7 dígitos).
// Se aceptan espacios, guiones o el +57 al escribirlo: se guardan solo los 10 dígitos.
const TELEFONO = /^(3\d{9}|60\d{8})$/;
const soloDigitos = (valor) =>
  typeof valor === 'string'
    ? valor.replace(/[\s\-().]/g, '').replace(/^\+?57(?=\d{10}$)/, '')
    : valor;

const texto = (campo, { min = 0, max, mensaje }) => {
  const regla = body(campo);
  return (min ? regla : regla.optional({ values: 'falsy' }))
    .isString()
    .withMessage(mensaje)
    .bail()
    .trim()
    .isLength({ min, max })
    .withMessage(mensaje);
};

// ---------- HU09: formulario web de domicilio (público, sin inicio de sesión) ----------

// La carta que se puede pedir hoy, con el valor del envío y los datos de pago
router.get('/publico/carta', domicilios.cartaPublica);

router.post(
  '/publico',
  limitePedidos,
  // Ley 1581 de 2012: sin la autorización marcada no se recibe el pedido
  body('autorizaDatos')
    .custom((valor) => valor === true)
    .withMessage('Para enviar el pedido debes autorizar el tratamiento de tus datos personales.'),
  body('items')
    .isArray({ min: 1, max: 100 })
    .withMessage('Agrega al menos un producto a tu pedido.'),
  body('items.*.productoId')
    .isInt({ min: 1, max: MAX_ID })
    .withMessage('Uno de los productos no es válido.')
    .toInt(),
  body('items.*.cantidad')
    .isInt({ min: 1, max: 99 })
    .withMessage('La cantidad de cada producto debe ser de 1 a 99.')
    .toInt(),
  body('items.*.nota')
    .optional({ values: 'null' })
    .isString()
    .isLength({ max: 120 })
    .withMessage('La nota de un producto puede tener máximo 120 caracteres.'),
  body('cliente').isObject().withMessage('Escribe tus datos de entrega.'),
  texto('cliente.nombre', {
    min: 2,
    max: 80,
    mensaje: 'Escribe tu nombre (de 2 a 80 caracteres).',
  }),
  body('cliente.telefono')
    .customSanitizer(soloDigitos)
    .isString()
    .withMessage('Escribe tu número de celular.')
    .bail()
    .matches(TELEFONO)
    .withMessage('Escribe un celular de 10 dígitos, por ejemplo 3001234567.'),
  texto('cliente.direccion', {
    min: 5,
    max: 150,
    mensaje: 'Escribe la dirección de entrega (de 5 a 150 caracteres).',
  }),
  texto('cliente.barrio', { max: 60, mensaje: 'El barrio puede tener máximo 60 caracteres.' }),
  texto('cliente.referencia', {
    max: 150,
    mensaje: 'La referencia puede tener máximo 150 caracteres.',
  }),
  body('metodoPago')
    .isIn(['contra_entrega', 'transferencia'])
    .withMessage('Escoge cómo vas a pagar: contra entrega o transferencia.'),
  texto('observaciones', {
    max: 255,
    mensaje: 'Las observaciones pueden tener máximo 255 caracteres.',
  }),
  validar,
  domicilios.crearPublico,
);

module.exports = router;
