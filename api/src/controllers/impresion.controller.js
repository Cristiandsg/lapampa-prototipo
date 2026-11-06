const { matchedData } = require('express-validator');
const impresionModel = require('../models/impresion.model');

// ---------- Para el agente de impresión del PC de la caja (clave propia) ----------

// GET /api/impresion/pendientes?impresora=cocina — lo que falta por imprimir, en orden
async function pendientes(req, res) {
  const { impresora } = matchedData(req, { locations: ['query'] });
  const impresoras = impresora ? [impresora] : impresionModel.IMPRESORAS;
  res.json(await impresionModel.pendientes(impresoras));
}

// PATCH /api/impresion/:id — { estado: 'impreso' } o { estado: 'error', error: '...' }
async function actualizar(req, res) {
  const id = Number(req.params.id);
  const trabajo =
    req.body.estado === 'impreso'
      ? await impresionModel.marcarImpreso(id)
      : await impresionModel.marcarError(id, req.body.error);
  if (!trabajo) return res.status(404).json({ error: 'El trabajo de impresión no existe.' });
  res.json(trabajo);
}

// ---------- Para el personal (con sesión) ----------

// GET /api/impresion/estado — para el aviso en pantalla cuando una impresora falla
async function estado(_req, res) {
  res.json(await impresionModel.estado());
}

// POST /api/impresion/reimprimir — { pedidoId, tipo: 'comanda' | 'cuenta' | 'comprobante' }
async function reimprimir(req, res) {
  const { pedidoId, tipo } = req.body;
  try {
    const trabajo = await impresionModel.reimprimir(pedidoId, tipo, req.usuario.id);
    res.status(201).json(trabajo);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  }
}

module.exports = { pendientes, actualizar, estado, reimprimir };
