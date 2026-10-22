const categoriaModel = require('../models/categoria.model');

// GET /api/categorias?activas=true
async function listar(req, res) {
  res.json(await categoriaModel.listar(req.query.activas === 'true'));
}

async function crear(req, res) {
  const { nombre, orden } = req.body;
  try {
    res.status(201).json(await categoriaModel.crear({ nombre, orden }));
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe una categoría con ese nombre.' });
    }
    throw error;
  }
}

// PATCH /api/categorias/:id — renombrar, reordenar o activar/desactivar.
// Una categoría desactivada saca sus productos de los pedidos nuevos sin borrarlos.
async function actualizar(req, res) {
  const { nombre, orden, activa } = req.body;
  try {
    const actualizada = await categoriaModel.actualizar(req.params.id, { nombre, orden, activa });
    if (!actualizada) return res.status(404).json({ error: 'Categoría no encontrada.' });
    res.json(actualizada);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe otra categoría con ese nombre.' });
    }
    throw error;
  }
}

// DELETE /api/categorias/:id — solo si está vacía (por ejemplo, una creada por error).
async function eliminar(req, res) {
  try {
    const eliminada = await categoriaModel.eliminar(req.params.id);
    if (!eliminada) return res.status(404).json({ error: 'Categoría no encontrada.' });
    res.json({ mensaje: 'Categoría eliminada.' });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        error: 'La categoría tiene productos: desactívala en lugar de eliminarla.',
      });
    }
    throw error;
  }
}

module.exports = { listar, crear, actualizar, eliminar };
