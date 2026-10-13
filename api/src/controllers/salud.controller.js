const saludModel = require('../models/salud.model');

// GET /api/salud — confirma que la API está arriba y si llega a la base de datos.
async function obtenerSalud(_req, res) {
  const baseDeDatos = await saludModel.verificarBaseDeDatos();
  res.json({
    estado: 'ok',
    servicio: 'lapampa-api',
    baseDeDatos,
    hora: new Date().toISOString(),
  });
}

module.exports = { obtenerSalud };
