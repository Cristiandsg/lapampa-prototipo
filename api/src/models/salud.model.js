const pool = require('../config/db');

// Comprueba que la base de datos responde.
async function verificarBaseDeDatos() {
  try {
    await pool.query('SELECT 1');
    return 'conectada';
  } catch {
    return 'sin conexión';
  }
}

module.exports = { verificarBaseDeDatos };
