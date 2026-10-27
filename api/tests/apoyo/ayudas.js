const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');

const CLAVE = 'ClaveDePrueba1';

// Crea (o reinicia) una cuenta de prueba con su rol. Devuelve su id.
async function crearCuenta(usuario, rol, { activo = true } = {}) {
  const hash = bcrypt.hashSync(CLAVE, 4);
  await pool.query('DELETE FROM usuario WHERE usuario = ?', [usuario]);
  const [r] = await pool.query(
    `INSERT INTO usuario (nombre, usuario, contrasena_hash, rol_id, activo)
     SELECT ?, ?, ?, id, ? FROM rol WHERE nombre = ?`,
    [`Prueba ${usuario}`, usuario, hash, activo, rol],
  );
  return r.insertId;
}

async function tokenDe(usuario) {
  const res = await request(app).post('/api/auth/login').send({ usuario, contrasena: CLAVE });
  if (res.status !== 200)
    throw new Error(`No se pudo iniciar sesión con ${usuario}: ${res.status}`);
  return res.body.token;
}

function tokenVencido(id) {
  return jwt.sign({ rol: 'mesero' }, process.env.JWT_SECRET, {
    subject: String(id),
    expiresIn: -10,
  });
}

module.exports = { CLAVE, crearCuenta, tokenDe, tokenVencido, app, pool, request };
