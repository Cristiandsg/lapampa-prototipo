const pool = require('../config/db');

// Listar todas las categorías (útil para la carta digital y administración)
async function listar(soloActivas = false) {
  let query = 'SELECT id, nombre, orden, activa FROM categoria';
  if (soloActivas) {
    query += ' WHERE activa = TRUE';
  }
  query += ' ORDER BY orden ASC, nombre ASC';
  const [filas] = await pool.query(query);
  return filas.map(f => ({ ...f, activa: Boolean(f.activa) }));
}

async function obtenerPorId(id) {
  const [filas] = await pool.query(
    'SELECT id, nombre, orden, activa FROM categoria WHERE id = ?',
    [id]
  );
  if (!filas[0]) return null;
  return { ...filas[0], activa: Boolean(filas[0].activa) };
}

async function crear({ nombre, orden = 0 }) {
  const [resultado] = await pool.query(
    'INSERT INTO categoria (nombre, orden) VALUES (?, ?)',
    [nombre, orden]
  );
  return obtenerPorId(resultado.insertId);
}

async function actualizar(id, { nombre, orden, activa }) {
  const sets = [];
  const valores = [];
  if (nombre !== undefined) {
    sets.push('nombre = ?');
    valores.push(nombre);
  }
  if (orden !== undefined) {
    sets.push('orden = ?');
    valores.push(orden);
  }
  if (activa !== undefined) {
    sets.push('activa = ?');
    valores.push(activa);
  }
  if (sets.length > 0) {
    valores.push(id);
    await pool.query(`UPDATE categoria SET ${sets.join(', ')} WHERE id = ?`, valores);
  }
  return obtenerPorId(id);
}

module.exports = {
  listar,
  obtenerPorId,
  crear,
  actualizar,
};