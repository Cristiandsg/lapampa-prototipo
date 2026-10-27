const pedidoModel = require('../models/pedido.model');
const cajaModel = require('../models/caja.model');

// HU07 y HU08 — Caja. Primera versión: Diana Carolina Dorado (PRU-78, PRU-79, PRU-80,
// PRU-82 a PRU-84); ajustada en la revisión del PR para cumplir los criterios de aceptación.

// GET /api/caja/por-cobrar — HU06: bandeja del cajero
async function porCobrar(req, res) {
  res.json(await pedidoModel.listarPorCobrar());
}

// POST /api/caja/pedidos/:id/pagos — HU07 + HU08: propina confirmada y pagos (mixtos)
async function registrarPago(req, res) {
  const { pagos, propina } = req.body;
  try {
    const pedido = await pedidoModel.cobrar({
      pedidoId: req.params.id,
      propina,
      pagos: pagos.map((p) => ({ ...p, referencia: p.referencia?.trim() || null })),
      // Quién cobró sale de la sesión, nunca del cuerpo de la petición
      cajero: { id: req.usuario.id, nombre: req.usuario.nombre },
    });
    res.status(201).json(pedido);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  }
}

// GET /api/caja/cierre?fecha=AAAA-MM-DD — HU07: cierre de caja (y propinas por mesero, HU08)
async function obtenerCierreCaja(req, res) {
  res.json(await cajaModel.cierre(req.query.fecha));
}

module.exports = { porCobrar, registrarPago, obtenerCierreCaja };
