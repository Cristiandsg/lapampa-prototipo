const bcrypt = require('bcryptjs');
const usuarioModel = require('../models/usuario.model');

const RONDAS_BCRYPT = 10;

// GET /api/usuarios
async function listar(_req, res) {
  res.json({ usuarios: await usuarioModel.listar() });
}

// GET /api/usuarios/roles
async function listarRoles(_req, res) {
  res.json({ roles: await usuarioModel.listarRoles() });
}

// POST /api/usuarios
async function crear(req, res) {
  const { nombre, usuario, contrasena, rol } = req.body;
  try {
    const contrasenaHash = await bcrypt.hash(contrasena, RONDAS_BCRYPT);
    const creado = await usuarioModel.crear({ nombre, usuario, contrasenaHash, rol });
    res.status(201).json({ usuario: creado });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: `Ya existe una cuenta con el usuario "${usuario}".` });
    }
    throw err;
  }
}

// PUT /api/usuarios/:id — editar nombre, rol, contraseña o activar/desactivar.
async function actualizar(req, res) {
  const id = Number(req.params.id);
  const existente = await usuarioModel.obtenerPorId(id);
  if (!existente) return res.status(404).json({ error: 'La cuenta no existe.' });

  const { nombre, rol, activo, contrasena } = req.body;
  // El propietario no puede quitarse a sí mismo el acceso (se quedaría sin poder administrar).
  if (id === req.usuario.id && (activo === false || (rol && rol !== 'propietario'))) {
    return res
      .status(400)
      .json({ error: 'No puedes desactivar tu propia cuenta ni quitarte el rol de propietario.' });
  }

  const cambios = { nombre, rol, activo };
  if (contrasena) cambios.contrasenaHash = await bcrypt.hash(contrasena, RONDAS_BCRYPT);
  res.json({ usuario: await usuarioModel.actualizar(id, cambios) });
}

module.exports = { listar, listarRoles, crear, actualizar };
