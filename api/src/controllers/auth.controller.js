const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const usuarioModel = require('../models/usuario.model');

const CREDENCIALES_INVALIDAS = 'Usuario o contraseña incorrectos.';

function minutos(segundos) {
  return Math.max(1, Math.ceil(segundos / 60));
}

// POST /api/auth/login — valida credenciales y devuelve un JWT con el rol.
async function iniciarSesion(req, res) {
  const { usuario, contrasena } = req.body;
  const cuenta = await usuarioModel.buscarParaIngreso(usuario);

  // Mismo mensaje si el usuario no existe o la contraseña está mal:
  // así no se revela qué usuarios existen.
  if (!cuenta) return res.status(401).json({ error: CREDENCIALES_INVALIDAS });

  if (cuenta.bloqueado) {
    const m = minutos(cuenta.segundos_bloqueo);
    return res.status(423).json({
      error: `Cuenta bloqueada por intentos fallidos. Intenta de nuevo en ${m} ${m === 1 ? 'minuto' : 'minutos'}.`,
    });
  }

  const correcta = await bcrypt.compare(contrasena, cuenta.contrasena_hash);
  if (!correcta) {
    const bloqueada = await usuarioModel.registrarIntentoFallido(cuenta.id);
    if (bloqueada) {
      return res.status(423).json({
        error: `Cuenta bloqueada por ${usuarioModel.MAX_INTENTOS} intentos fallidos. Intenta de nuevo en ${usuarioModel.MINUTOS_BLOQUEO} minutos.`,
      });
    }
    return res.status(401).json({ error: CREDENCIALES_INVALIDAS });
  }

  if (!cuenta.activo) {
    return res
      .status(403)
      .json({ error: 'Esta cuenta está desactivada. Habla con el propietario.' });
  }

  await usuarioModel.reiniciarIntentos(cuenta.id);
  const datos = { id: cuenta.id, nombre: cuenta.nombre, usuario: cuenta.usuario, rol: cuenta.rol };
  const token = jwt.sign({ nombre: cuenta.nombre, rol: cuenta.rol }, env.jwt.secreto, {
    subject: String(cuenta.id),
    expiresIn: env.jwt.expira,
  });
  res.json({ token, usuario: datos });
}

// GET /api/auth/yo — quién soy (el frontend lo usa al abrir la app con una sesión guardada).
function quienSoy(req, res) {
  const { id, nombre, usuario, rol } = req.usuario;
  res.json({ usuario: { id, nombre, usuario, rol } });
}

module.exports = { iniciarSesion, quienSoy };
