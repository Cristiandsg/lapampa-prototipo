const pedidoModel = require('../models/pedido.model');

// POST /api/pedidos — HU04: registrar un pedido en una mesa libre
async function crear(req, res) {
  const { mesaId, items, observaciones } = req.body;
  try {
    const pedido = await pedidoModel.crearEnMesa({
      mesaId,
      meseroId: req.usuario.id,
      items,
      observaciones: observaciones?.trim() || null,
    });
    res.status(201).json(pedido);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  }
}

// GET /api/pedidos/:id — ver un pedido con su detalle y su comanda
async function obtener(req, res) {
  const pedido = await pedidoModel.obtener(Number(req.params.id));
  if (!pedido) return res.status(404).json({ error: 'El pedido no existe.' });
  res.json(pedido);
}

module.exports = { crear, obtener };
