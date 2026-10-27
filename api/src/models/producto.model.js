const pool = require('../config/db');

const COLUMNAS = `
  p.id, p.categoria_id, c.nombre AS categoria_nombre,
  p.nombre, p.descripcion, p.precio, p.activo, p.agotado_hoy,
  p.creado_en, p.actualizado_en`;

function normalizar(fila) {
  return {
    ...fila,
    activo: Boolean(fila.activo),
    agotado_hoy: Boolean(fila.agotado_hoy),
    precio: Number(fila.precio),
  };
}

// Lista los productos en el orden de la carta (categoría y nombre).
async function listar({ soloActivos = false, soloDisponibles = false, categoriaId = null } = {}) {
  let query = `SELECT ${COLUMNAS} FROM producto p JOIN categoria c ON c.id = p.categoria_id WHERE 1=1`;
  const valores = [];

  if (soloActivos || soloDisponibles) query += ' AND p.activo = TRUE';
  if (soloDisponibles) query += ' AND p.agotado_hoy = FALSE AND c.activa = TRUE';
  if (categoriaId) {
    query += ' AND p.categoria_id = ?';
    valores.push(categoriaId);
  }

  query += ' ORDER BY c.orden ASC, p.id ASC'; // mismo orden de la carta impresa
  const [filas] = await pool.query(query, valores);
  return filas.map(normalizar);
}

async function obtenerPorId(id) {
  const [filas] = await pool.query(
    `SELECT ${COLUMNAS} FROM producto p JOIN categoria c ON c.id = p.categoria_id WHERE p.id = ?`,
    [id],
  );
  return filas[0] ? normalizar(filas[0]) : null;
}

async function crear({ categoriaId, nombre, descripcion, precio }) {
  const [resultado] = await pool.query(
    'INSERT INTO producto (categoria_id, nombre, descripcion, precio) VALUES (?, ?, ?, ?)',
    [categoriaId, nombre, descripcion || null, precio],
  );
  return obtenerPorId(resultado.insertId);
}

// Solo actualiza los campos que llegan.
async function actualizar(id, { categoriaId, nombre, descripcion, precio, activo, agotadoHoy }) {
  const campos = {
    categoria_id: categoriaId,
    nombre,
    descripcion: descripcion === '' ? null : descripcion,
    precio,
    activo,
    agotado_hoy: agotadoHoy,
  };
  const sets = [];
  const valores = [];
  for (const [columna, valor] of Object.entries(campos)) {
    if (valor !== undefined) {
      sets.push(`${columna} = ?`);
      valores.push(valor);
    }
  }
  if (sets.length > 0) {
    await pool.query(`UPDATE producto SET ${sets.join(', ')} WHERE id = ?`, [...valores, id]);
  }
  return obtenerPorId(id);
}

module.exports = { listar, obtenerPorId, crear, actualizar };
