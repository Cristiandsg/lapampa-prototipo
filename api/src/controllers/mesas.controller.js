const mesaModel = require('../models/mesa.model');

// El nombre es libre ("Terraza 2", "Cumpleaños Andrea"); solo se limpian espacios de más.
const limpiarNombre = (nombre) => nombre.trim().replace(/\s+/g, ' ');

function nombreRepetido(nombre) {
  return {
    status: 409,
    body: { error: `Ya hay una mesa activa llamada "${nombre}". Usa otro nombre.` },
  };
}

// GET /api/mesas
async function listar(_req, res) {
  res.json(await mesaModel.listar());
}

// POST /api/mesas
async function crear(req, res) {
  const nombre = limpiarNombre(req.body.nombre);
  try {
    const id = await mesaModel.crear(nombre, req.usuario.id);
    res.status(201).json(await mesaModel.obtener(id));
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      const r = nombreRepetido(nombre);
      return res.status(r.status).json(r.body);
    }
    throw err;
  }
}

// PATCH /api/mesas/:id — renombrar (solo si no tiene pedido abierto)
async function renombrar(req, res) {
  const nombre = limpiarNombre(req.body.nombre);
  try {
    await mesaModel.renombrar(Number(req.params.id), nombre, req.usuario.id);
    res.json(await mesaModel.obtener(Number(req.params.id)));
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      const r = nombreRepetido(nombre);
      return res.status(r.status).json(r.body);
    }
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  }
}

// DELETE /api/mesas/:id — desactiva la mesa (solo si no tiene pedido abierto)
async function eliminar(req, res) {
  try {
    await mesaModel.eliminar(Number(req.params.id), req.usuario.id);
    res.json({ mensaje: 'Mesa eliminada.' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  }
}

// POST /api/mesas/quitar-libres — al cerrar la jornada
async function quitarLibres(req, res) {
  const cantidad = await mesaModel.quitarLibres(req.usuario.id);
  res.json({ cantidad });
}

module.exports = { listar, crear, renombrar, eliminar, quitarLibres };
