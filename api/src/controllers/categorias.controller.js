const categoriaModel = require('../models/categoria.model');

async function listar(req, res, next) {
  try {
    const soloActivas = req.query.activas === 'true';
    const categorias = await categoriaModel.listar(soloActivas);
    res.json(categorias);
  } catch (error) {
    next(error);
  }
}

async function crear(req, res, next) {
  try {
    const { nombre, orden } = req.body;
    const nuevaCategoria = await categoriaModel.crear({ nombre, orden });
    res.status(201).json(nuevaCategoria);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Ya existe una categoría con ese nombre.' });
    }
    next(error);
  }
}

async function actualizar(req, res, next) {
  try {
    const { id } = req.params;
    const { nombre, orden, activa } = req.body;
    const categoriaActualizada = await categoriaModel.actualizar(id, { nombre, orden, activa });
    if (!categoriaActualizada) {
      return res.status(404).json({ error: 'Categoría no encontrada.' });
    }
    res.json(categoriaActualizada);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Ya existe otra categoría con ese nombre.' });
    }
    next(error);
  }
}

module.exports = {
  listar,
  crear,
  actualizar,
};