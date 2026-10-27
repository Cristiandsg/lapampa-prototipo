const { validationResult } = require('express-validator');

// Responde 400 con el primer error de validación de express-validator.
function validar(req, res, next) {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    const [primero] = errores.array();
    return res.status(400).json({ error: primero.msg, campo: primero.path });
  }
  next();
}

module.exports = validar;
