const pedidoModel = require('../models/pedido.model');

// Los errores esperados del modelo (404, 409, 400) traen su código; el resto va al manejador general.
async function responder(res, trabajo, status = 200) {
  try {
    res.status(status).json(await trabajo());
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  }
}

// Quién hace el cambio: sale de la sesión, nunca del cuerpo de la petición
const quien = (req) => ({ id: req.usuario.id, nombre: req.usuario.nombre });

// POST /api/pedidos — HU04: registrar un pedido en una mesa libre
function crear(req, res) {
  const { mesaId, items, observaciones } = req.body;
  return responder(
    res,
    () =>
      pedidoModel.crearEnMesa({
        mesaId,
        meseroId: req.usuario.id,
        items,
        observaciones: observaciones?.trim() || null,
      }),
    201,
  );
}

// GET /api/pedidos/:id — ver un pedido con su detalle, su historial y su comanda
async function obtener(req, res) {
  const pedido = await pedidoModel.obtener(Number(req.params.id));
  if (!pedido) return res.status(404).json({ error: 'El pedido no existe.' });
  res.json(pedido);
}

// POST /api/pedidos/:id/items — HU05: el cliente pide algo más
function agregarItems(req, res) {
  return responder(res, () =>
    pedidoModel.agregarItems({
      pedidoId: Number(req.params.id),
      items: req.body.items,
      usuario: quien(req),
    }),
  );
}

// PUT /api/pedidos/:id/items/:itemId — HU05: cambiar cantidad o nota de un producto
function cambiarItem(req, res) {
  const { cantidad, nota, motivo } = req.body ?? {};
  if (cantidad === undefined && nota === undefined) {
    return res.status(400).json({ error: 'Indica la nueva cantidad o la nota.' });
  }
  return responder(res, () =>
    pedidoModel.cambiarItem({
      pedidoId: Number(req.params.id),
      itemId: Number(req.params.itemId),
      cantidad,
      nota,
      motivo: motivo?.trim() || null,
      usuario: quien(req),
    }),
  );
}

// DELETE /api/pedidos/:id/items/:itemId — HU05: quitar un producto (con motivo)
function quitarItem(req, res) {
  return responder(res, () =>
    pedidoModel.quitarItem({
      pedidoId: Number(req.params.id),
      itemId: Number(req.params.itemId),
      motivo: req.body.motivo.trim(),
      usuario: quien(req),
    }),
  );
}

// PATCH /api/pedidos/:id/cerrar — HU06: cerrar el pedido y generar la cuenta
function cerrar(req, res) {
  return responder(res, () =>
    pedidoModel.cerrar({ pedidoId: Number(req.params.id), usuario: quien(req) }),
  );
}

// PATCH /api/pedidos/:id/reabrir — HU06: el cliente pidió algo más después de la cuenta
function reabrir(req, res) {
  return responder(res, () =>
    pedidoModel.reabrir({
      pedidoId: Number(req.params.id),
      motivo: req.body.motivo.trim(),
      usuario: quien(req),
    }),
  );
}

// GET /api/caja/por-cobrar — HU06: bandeja del cajero
async function porCobrar(req, res) {
  res.json(await pedidoModel.listarPorCobrar());
}

module.exports = {
  crear,
  obtener,
  agregarItems,
  cambiarItem,
  quitarItem,
  cerrar,
  reabrir,
  porCobrar,
};
