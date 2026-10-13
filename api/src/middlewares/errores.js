// Ruta no encontrada
function noEncontrado(req, res) {
  res.status(404).json({ error: `No existe la ruta ${req.method} ${req.originalUrl}` });
}

// Manejador central de errores: nunca expone detalles internos al cliente
function manejarErrores(err, _req, res, _next) {
  const estado = err.status || 500;
  if (estado >= 500) console.error(err);
  res.status(estado).json({ error: estado >= 500 ? 'Error interno del servidor' : err.message });
}

module.exports = { noEncontrado, manejarErrores };
