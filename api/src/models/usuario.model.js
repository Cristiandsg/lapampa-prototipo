const pool = require('../config/db');

// Reglas del bloqueo por intentos fallidos (HU01)
const MAX_INTENTOS = 5;
const MINUTOS_BLOQUEO = 10;

const CAMPOS_PUBLICOS = `
  u.id, u.nombre, u.usuario, r.nombre AS rol, u.activo, u.creado_en`;

// Busca la cuenta para el inicio de sesión. La base calcula si está bloqueada
// (así no dependemos de la zona horaria del servidor de la API).
async function buscarParaIngreso(usuario) {
  const [filas] = await pool.query(
    `SELECT u.id, u.nombre, u.usuario, u.contrasena_hash, u.activo, r.nombre AS rol,
            (u.bloqueado_hasta IS NOT NULL AND u.bloqueado_hasta > NOW()) AS bloqueado,
            GREATEST(TIMESTAMPDIFF(SECOND, NOW(), u.bloqueado_hasta), 0) AS segundos_bloqueo
       FROM usuario u
       JOIN rol r ON r.id = u.rol_id
      WHERE u.usuario = ?`,
    [usuario],
  );
  const fila = filas[0];
  if (!fila) return null;
  return { ...fila, activo: Boolean(fila.activo), bloqueado: Boolean(fila.bloqueado) };
}

// Suma un intento fallido. Al llegar a 5 bloquea la cuenta 10 minutos y reinicia
// el contador, para que al desbloquearse tenga otra vez 5 intentos.
// Devuelve true si este intento dejó la cuenta bloqueada.
async function registrarIntentoFallido(id) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const [[fila]] = await conexion.query(
      'SELECT intentos_fallidos FROM usuario WHERE id = ? FOR UPDATE',
      [id],
    );
    const intentos = fila.intentos_fallidos + 1;
    const bloquear = intentos >= MAX_INTENTOS;
    await conexion.query(
      `UPDATE usuario
          SET intentos_fallidos = ?,
              bloqueado_hasta = ${bloquear ? 'NOW() + INTERVAL ? MINUTE' : 'bloqueado_hasta'}
        WHERE id = ?`,
      bloquear ? [0, MINUTOS_BLOQUEO, id] : [intentos, id],
    );
    await conexion.commit();
    return bloquear;
  } catch (err) {
    await conexion.rollback();
    throw err;
  } finally {
    conexion.release();
  }
}

async function reiniciarIntentos(id) {
  await pool.query(
    'UPDATE usuario SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?',
    [id],
  );
}

// Usado por el middleware en cada petición: si la cuenta se desactivó o cambió de rol,
// el cambio aplica de inmediato aunque el token siga vigente.
async function obtenerActivo(id) {
  const [filas] = await pool.query(
    `SELECT ${CAMPOS_PUBLICOS}
       FROM usuario u JOIN rol r ON r.id = u.rol_id
      WHERE u.id = ? AND u.activo = TRUE`,
    [id],
  );
  return filas[0] ? normalizar(filas[0]) : null;
}

async function obtenerPorId(id) {
  const [filas] = await pool.query(
    `SELECT ${CAMPOS_PUBLICOS} FROM usuario u JOIN rol r ON r.id = u.rol_id WHERE u.id = ?`,
    [id],
  );
  return filas[0] ? normalizar(filas[0]) : null;
}

async function listar() {
  const [filas] = await pool.query(
    `SELECT ${CAMPOS_PUBLICOS}
       FROM usuario u JOIN rol r ON r.id = u.rol_id
      ORDER BY u.activo DESC, r.id, u.nombre`,
  );
  return filas.map(normalizar);
}

async function listarRoles() {
  const [filas] = await pool.query('SELECT id, nombre FROM rol ORDER BY id');
  return filas;
}

async function crear({ nombre, usuario, contrasenaHash, rol }) {
  const [resultado] = await pool.query(
    `INSERT INTO usuario (nombre, usuario, contrasena_hash, rol_id)
     SELECT ?, ?, ?, id FROM rol WHERE nombre = ?`,
    [nombre, usuario, contrasenaHash, rol],
  );
  return obtenerPorId(resultado.insertId);
}

// Solo actualiza los campos que llegan. Cambiar la contraseña también desbloquea la cuenta.
async function actualizar(id, { nombre, rol, activo, contrasenaHash }) {
  const sets = [];
  const valores = [];
  if (nombre !== undefined) {
    sets.push('nombre = ?');
    valores.push(nombre);
  }
  if (rol !== undefined) {
    sets.push('rol_id = (SELECT id FROM rol WHERE nombre = ?)');
    valores.push(rol);
  }
  if (activo !== undefined) {
    sets.push('activo = ?');
    valores.push(activo);
  }
  if (contrasenaHash !== undefined) {
    sets.push('contrasena_hash = ?', 'intentos_fallidos = 0', 'bloqueado_hasta = NULL');
    valores.push(contrasenaHash);
  }
  if (sets.length) {
    await pool.query(`UPDATE usuario SET ${sets.join(', ')} WHERE id = ?`, [...valores, id]);
  }
  return obtenerPorId(id);
}

function normalizar(fila) {
  return { ...fila, activo: Boolean(fila.activo) };
}

module.exports = {
  MAX_INTENTOS,
  MINUTOS_BLOQUEO,
  buscarParaIngreso,
  registrarIntentoFallido,
  reiniciarIntentos,
  obtenerActivo,
  obtenerPorId,
  listar,
  listarRoles,
  crear,
  actualizar,
};
