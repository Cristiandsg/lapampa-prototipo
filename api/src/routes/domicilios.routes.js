const { Router } = require('express');
const { body, query } = require('express-validator');
const validar = require('../middlewares/validar');
const { verificarToken, permitirRoles } = require('../middlewares/autenticacion');
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

// Reglas de un domicilio, iguales para el formulario del cliente (HU09) y para el cajero
// (HU10). Solo cambia el mensaje de la autorización: el cliente la marca él mismo; el cajero
// confirma que el cliente la dio por teléfono o WhatsApp.
const reglasDomicilio = (mensajeAutorizacion) => [
  // Ley 1581 de 2012: sin la autorización marcada no se recibe el pedido
  body('autorizaDatos')
    .custom((valor) => valor === true)
    .withMessage(mensajeAutorizacion),
  body('items').isArray({ min: 1, max: 100 }).withMessage('Agrega al menos un producto al pedido.'),
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
  body('cliente').isObject().withMessage('Escribe los datos de entrega.'),
  texto('cliente.nombre', {
    min: 2,
    max: 80,
    mensaje: 'Escribe el nombre (de 2 a 80 caracteres).',
  }),
  body('cliente.telefono')
    .customSanitizer(soloDigitos)
    .isString()
    .withMessage('Escribe el número de celular.')
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
    .withMessage('Escoge cómo va a pagar: contra entrega o transferencia.'),
  texto('observaciones', {
    max: 255,
    mensaje: 'Las observaciones pueden tener máximo 255 caracteres.',
  }),
  validar,
];

// ---------- HU09: formulario web de domicilio (público, sin inicio de sesión) ----------

// La carta que se puede pedir hoy, con el valor del envío y los datos de pago
router.get('/publico/carta', domicilios.cartaPublica);

router.post(
  '/publico',
  limitePedidos,
  ...reglasDomicilio(
    'Para enviar el pedido debes autorizar el tratamiento de tus datos personales.',
  ),
  domicilios.crearPublico,
);

// ---------- HU10: el cajero registra los que llegan por llamada o WhatsApp ----------

const internas = [verificarToken, permitirRoles('cajero', 'propietario')];

// Busca un cliente por su celular para no volver a pedirle los datos
router.get(
  '/clientes',
  ...internas,
  query('telefono')
    .customSanitizer(soloDigitos)
    .isString()
    .withMessage('Escribe el celular del cliente.')
    .bail()
    .matches(TELEFONO)
    .withMessage('Escribe un celular de 10 dígitos, por ejemplo 3001234567.'),
  validar,
  domicilios.buscarCliente,
);

// Mismo registro de HU09, con canal 'telefono_whatsapp' y el cajero que lo registró.
// Sin límite de envíos: lo usa el personal con su sesión.
router.post(
  '/',
  ...internas,
  ...reglasDomicilio(
    'Confirma que el cliente autorizó el tratamiento de sus datos personales antes de registrar el domicilio.',
  ),
  domicilios.crearPorTelefono,
);

module.exports = router;
