const pool = require('../config/db');

// Listar productos (con opción de filtrar solo activos o incluir agotados)
async function listar(filtros = {}) {
  let query = `
    SELECT p.id, p.categoria_id, c.nombre AS categoria_nombre, 
           p.nombre, p.descripcion, p.precio, p.activo, p.agotado_hoy, 
           p.creado_en, p.actualizado_en
    FROM producto p
    JOIN categoria c ON c.id = p.categoria_id
    WHERE 1=1
  `;
  const valores = [];

  if (filtros.soloActivos) {
    query += ' AND p.activo = TRUE';
  }
  if (filtros.categoriaId) {
    query += ' AND p.categoria_id = ?';
    valores.push(filtros.categoriaId);
  }

  query += ' ORDER BY c.orden ASC, p.nombre ASC';
  const [filas] = await pool.query(query, valores);
  return filas.map(f => ({
    ...f,
    activo: Boolean(f.activo),
    agotado_hoy: Boolean(f.agotado_hoy),
    precio: Number(f.precio),
  }));
}

async function obtenerPorId(id) {
  const [filas] = await pool.query(
    `SELECT p.id, p.categoria_id, c.nombre AS categoria_nombre, 
            p.nombre, p.descripcion, p.precio, p.activo, p.agotado_hoy, 
            p.creado_en, p.actualizado_en
     FROM producto p
     JOIN categoria c ON c.id = p.categoria_id
     WHERE p.id = ?`,
    [id]
  );
  if (!filas[0]) return null;
  return {
    ...filas[0],
    activo: Boolean(filas[0].activo),
    agotado_hoy: Boolean(filas[0].agotado_hoy),
    precio: Number(filas[0].precio),
  };
}

async function crear({ categoriaId, nombre, descripcion, precio }) {
  const [resultado] = await pool.query(
    'INSERT INTO producto (categoria_id, nombre, descripcion, precio) VALUES (?, ?, ?, ?)',
    [categoriaId, nombre, descripcion || null, precio]
  );
  return obtenerPorId(resultado.insertId);
}

async function actualizar(id, { categoriaId, nombre, descripcion, precio, activo, agotadoHoy }) {
  const sets = [];
  const valores = [];
  if (categoriaId !== undefined) {
    sets.push('categoria_id = ?');
    valores.push(categoriaId);
  }
  if (nombre !== undefined) {
    sets.push('nombre = ?');
    valores.push(nombre);
  }
  if (descripcion !== undefined) {
    sets.push('descripcion = ?');
    valores.push(descripcion);
  }
  if (precio !== undefined) {
    sets.push('precio = ?');
    valores.push(precio);
  }
  if (activo !== undefined) {
    sets.push('activo = ?');
    valores.push(activo);
  }
  if (agotadoHoy !== undefined) {
    sets.push('agotado_hoy = ?');
    valores.push(agotadoHoy);
  }
  if (sets.length > 0) {
    valores.push(id);
    await pool.query(`UPDATE producto SET ${sets.join(', ')} WHERE id = ?`, valores);
  }
  return obtenerPorId(id);
}

async function eliminar(id) {
  const [resultado] = await pool.query('DELETE FROM producto WHERE id = ?', [id]);
  return resultado.affectedRows > 0;
}

module.exports = {
  listar,
  obtenerPorId,
  crear,
  actualizar,
  eliminar,
};