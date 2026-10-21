const productoModel = require('../models/producto.model');

async function listar(req, res, next) {
  try {
    const soloActivos = req.query.activos === 'true';
    const categoriaId = req.query.categoria_id ? Number(req.query.categoria_id) : null;
    
    const productos = await productoModel.listar({ soloActivos, categoriaId });
    res.json(productos);
  } catch (error) {
    next(error);
  }
}

async function obtenerPorId(req, res, next) {
  try {
    const { id } = req.params;
    const producto = await productoModel.obtenerPorId(id);
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }
    res.json(producto);
  } catch (error) {
    next(error);
  }
}

async function crear(req, res, next) {
  try {
    const { categoriaId, nombre, descripcion, precio } = req.body;
    
    if (precio <= 0) {
      return res.status(400).json({ error: 'El precio debe ser mayor a cero.' });
    }

    const nuevoProducto = await productoModel.crear({ categoriaId, nombre, descripcion, precio });
    res.status(201).json(nuevoProducto);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Ya existe un producto con ese nombre.' });
    }
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ error: 'La categoría seleccionada no existe.' });
    }
    next(error);
  }
}

async function actualizar(req, res, next) {
  try {
    const { id } = req.params;
    const { categoriaId, nombre, descripcion, precio, activo, agotadoHoy } = req.body;

    if (precio !== undefined && precio <= 0) {
      return res.status(400).json({ error: 'El precio debe ser mayor a cero.' });
    }

    const productoActualizado = await productoModel.actualizar(id, {
      categoriaId,
      nombre,
      descripcion,
      precio,
      activo,
      agotadoHoy,
    });

    if (!productoActualizado) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    res.json(productoActualizado);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Ya existe otro producto con ese nombre.' });
    }
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ error: 'La categoría seleccionada no existe.' });
    }
    next(error);
  }
}

async function eliminar(req, res, next) {
  try {
    const { id } = req.params;
    const eliminado = await productoModel.eliminar(id);

    if (!eliminado) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    res.json({ mensaje: 'Producto eliminado correctamente.' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listar,
  obtenerPorId,
  crear,
  actualizar,
  eliminar,
};