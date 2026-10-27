const jwt = require('jsonwebtoken');
const env = require('../config/env');
const usuarioModel = require('../models/usuario.model');

// Exige un token válido (encabezado "Authorization: Bearer <token>") y deja en
// req.usuario quién hace la petición, para registrar quién hizo cada operación.
async function verificarToken(req, res, next) {
  const [tipo, token] = (req.headers.authorization || '').split(' ');
  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Debes iniciar sesión.' });
  }
  let datos;
  try {
    datos = jwt.verify(token, env.jwt.secreto);
  } catch {
    return res.status(401).json({ error: 'Tu sesión venció. Vuelve a iniciar sesión.' });
  }
  // Se consulta la cuenta en cada petición: si el propietario la desactiva
  // o le cambia el rol, el cambio aplica de inmediato.
  const usuario = await usuarioModel.obtenerActivo(Number(datos.sub));
  if (!usuario) {
    return res.status(401).json({ error: 'Tu cuenta no está activa. Habla con el propietario.' });
  }
  req.usuario = usuario;
  next();
}

// Deja pasar solo a los roles indicados. Uso: permitirRoles('propietario', 'cajero')
function permitirRoles(...roles) {
  return (req, res, next) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tienes permiso para esta acción.' });
    }
    next();
  };
}

module.exports = { verificarToken, permitirRoles };
