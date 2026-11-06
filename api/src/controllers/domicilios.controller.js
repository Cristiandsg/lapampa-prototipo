const domicilioModel = require('../models/domicilio.model');
const productoModel = require('../models/producto.model');

// Texto opcional: vacío o con solo espacios se guarda como NULL
const opcional = (texto) => (typeof texto === 'string' && texto.trim()) || null;

// GET /api/domicilios/publico/carta — HU09: lo que el cliente ve para armar su pedido.
// Sin sesión. Solo productos que se pueden pedir hoy (activos, no agotados, categoría activa).
async function cartaPublica(_req, res) {
  const productos = await productoModel.listar({ soloDisponibles: true });
  res.json(domicilioModel.cartaPublica(productos));
}

// POST /api/domicilios/publico — HU09: el cliente envía su pedido desde el formulario web.
// Sin sesión: no hay req.usuario, el pedido queda con registrado_por = NULL y canal 'web'.
// La ruta ya validó cada campo y que la autorización de datos venga marcada.
async function crearPublico(req, res) {
  const { cliente, items, metodoPago, observaciones } = req.body;
  try {
    const domicilio = await domicilioModel.crear({
      canal: 'web',
      cliente: {
        nombre: cliente.nombre,
        telefono: cliente.telefono,
        direccion: cliente.direccion,
        barrio: opcional(cliente.barrio),
        referencia: opcional(cliente.referencia),
      },
      items,
      metodoPago,
      observaciones: opcional(observaciones),
    });
    res.status(201).json(domicilio);
  } catch (err) {
    // Errores esperados del modelo: producto agotado o fuera de la carta (409), no existe (400)
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  }
}

module.exports = { cartaPublica, crearPublico };
