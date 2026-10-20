const pool = require('../config/db');

// Comprueba que la base de datos responde.
// Si falla, deja el motivo en los logs del servidor (en Render: pestaña Logs)
// sin mostrarlo en la respuesta pública.
async function verificarBaseDeDatos() {
  try {
    await pool.query('SELECT 1');
    return 'conectada';
  } catch (err) {
    const detalle =
      err.code || err.message || (err.errors || []).map((e) => e.code || e.message).join(', ');
    console.error('[salud] Sin conexión a MySQL:', detalle);
    return 'sin conexión';
  }
}

module.exports = { verificarBaseDeDatos };
