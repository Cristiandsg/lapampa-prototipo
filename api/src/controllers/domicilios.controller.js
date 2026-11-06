const { matchedData } = require('express-validator');
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

// Los datos del cliente como llegan del formulario, ya validados por la ruta
const datosCliente = (cliente) => ({
  nombre: cliente.nombre,
  telefono: cliente.telefono,
  direccion: cliente.direccion,
  barrio: opcional(cliente.barrio),
  referencia: opcional(cliente.referencia),
});

// Registra el domicilio y responde 201, o el error esperado del modelo: producto agotado o
// fuera de la carta (409), producto que no existe (400)
async function registrar(req, res, { canal, registradoPor }) {
  const { cliente, items, metodoPago, observaciones } = req.body;
  try {
    const domicilio = await domicilioModel.crear({
      canal,
      cliente: datosCliente(cliente),
      items,
      metodoPago,
      observaciones: opcional(observaciones),
      registradoPor,
    });
    res.status(201).json(domicilio);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  }
}

// POST /api/domicilios/publico — HU09: el cliente envía su pedido desde el formulario web.
// Sin sesión: no hay req.usuario, el pedido queda con registrado_por = NULL y canal 'web'.
// La ruta ya validó cada campo y que la autorización de datos venga marcada.
function crearPublico(req, res) {
  return registrar(req, res, { canal: 'web', registradoPor: null });
}

// POST /api/domicilios — HU10: el cajero registra un pedido que llegó por llamada o WhatsApp.
// Quién lo registró sale de la sesión, nunca del body.
function crearPorTelefono(req, res) {
  return registrar(req, res, { canal: 'telefono_whatsapp', registradoPor: req.usuario.id });
}

// GET /api/domicilios/clientes?telefono= — HU10: si el cliente ya pidió antes, sus datos
// se cargan solos. 404 si es un cliente nuevo.
async function buscarCliente(req, res) {
  // matchedData trae el celular ya limpio (sin espacios ni +57); req.query no se modifica
  const { telefono } = matchedData(req, { locations: ['query'] });
  const cliente = await domicilioModel.buscarClientePorTelefono(telefono);
  if (!cliente) {
    return res
      .status(404)
      .json({ error: 'No hay un cliente con ese celular. Es un cliente nuevo.' });
  }
  res.json(cliente);
}

module.exports = { cartaPublica, crearPublico, crearPorTelefono, buscarCliente };
