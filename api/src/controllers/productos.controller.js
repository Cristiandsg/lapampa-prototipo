const productoModel = require('../models/producto.model');

// Campos que solo el propietario puede cambiar. El mesero y el cajero
// solo pueden marcar o desmarcar "agotado hoy" (se quedó sin el plato en la jornada).
const CAMPOS_PROPIETARIO = ['categoriaId', 'nombre', 'descripcion', 'precio', 'activo'];

// GET /api/productos?categoria_id=3&activos=true&disponibles=true
//   activos=true     → oculta los desactivados
//   disponibles=true → solo lo que se puede pedir hoy: activo, no agotado y de categoría activa
//                      (lo usan la toma de pedido, HU04, y el formulario de domicilio, HU09)
async function listar(req, res) {
  const productos = await productoModel.listar({
    soloActivos: req.query.activos === 'true',
    soloDisponibles: req.query.disponibles === 'true',
    categoriaId: req.query.categoria_id ? Number(req.query.categoria_id) : null,
  });
  res.json(productos);
}

async function obtenerPorId(req, res) {
  const producto = await productoModel.obtenerPorId(req.params.id);
  if (!producto) return res.status(404).json({ error: 'Producto no encontrado.' });
  res.json(producto);
}

async function crear(req, res) {
  const { categoriaId, nombre, descripcion, precio } = req.body;
  try {
    const nuevo = await productoModel.crear({ categoriaId, nombre, descripcion, precio });
    res.status(201).json(nuevo);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un producto con ese nombre.' });
    }
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ error: 'La categoría seleccionada no existe.' });
    }
    throw error;
  }
}

// PATCH /api/productos/:id — editar, desactivar/activar o marcar agotado hoy.
// Los productos no se borran: desactivarlos los saca de los pedidos nuevos y conserva
// el historial. Un cambio de precio no toca los pedidos ya registrados, porque cada
// detalle_pedido guarda el precio del momento (criterio de aceptación de HU02).
async function actualizar(req, res) {
  const { id } = req.params;
  const esPropietario = req.usuario.rol === 'propietario';
  if (!esPropietario && CAMPOS_PROPIETARIO.some((campo) => req.body[campo] !== undefined)) {
    return res.status(403).json({
      error:
        'Solo el propietario puede cambiar el nombre, el precio, la categoría o desactivar un producto.',
    });
  }

  const { categoriaId, nombre, descripcion, precio, activo, agotadoHoy } = req.body;
  try {
    const actualizado = await productoModel.actualizar(id, {
      categoriaId,
      nombre,
      descripcion,
      precio,
      activo,
      agotadoHoy,
    });
    if (!actualizado) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.json(actualizado);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe otro producto con ese nombre.' });
    }
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ error: 'La categoría seleccionada no existe.' });
    }
    throw error;
  }
}

module.exports = { listar, obtenerPorId, crear, actualizar };
