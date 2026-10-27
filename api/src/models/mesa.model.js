const pool = require('../config/db');

// Un pedido "abierto" para la mesa es uno que todavía no se ha pagado ni cancelado.
const PEDIDO_VIGENTE = "pe.estado IN ('abierto', 'por_cobrar')";

function error(status, mensaje) {
  const e = new Error(mensaje);
  e.status = status;
  return e;
}

// Mesas activas de la jornada, con el resumen de su pedido vigente (si tiene).
async function listar() {
  const [filas] = await pool.query(
    `SELECT m.id, m.nombre, m.estado, m.creada_en,
            u.nombre AS creada_por_nombre,
            pe.id AS pedido_id, pe.subtotal AS pedido_total,
            TIMESTAMPDIFF(MINUTE, pe.creado_en, NOW()) AS pedido_minutos
       FROM mesa m
       JOIN usuario u ON u.id = m.creada_por
       LEFT JOIN pedido pe ON pe.mesa_id = m.id AND ${PEDIDO_VIGENTE}
      WHERE m.activa = TRUE
      ORDER BY m.creada_en, m.id`,
  );
  return filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    estado: f.estado,
    creada_en: f.creada_en,
    creada_por: f.creada_por_nombre,
    pedido: f.pedido_id
      ? { id: f.pedido_id, total: Number(f.pedido_total), minutos: f.pedido_minutos }
      : null,
  }));
}

async function obtener(id) {
  const [filas] = await pool.query(
    'SELECT id, nombre, estado, activa, creada_en FROM mesa WHERE id = ? AND activa = TRUE',
    [id],
  );
  return filas[0] || null;
}

async function registrarHistorial(conexion, { mesaId, accion, anterior, nuevo, usuarioId }) {
  await conexion.query(
    `INSERT INTO historial_cambio (entidad, entidad_id, accion, valor_anterior, valor_nuevo, usuario_id)
     VALUES ('mesa', ?, ?, ?, ?, ?)`,
    [mesaId, accion, anterior, nuevo, usuarioId],
  );
}

// Ejecuta fn dentro de una transacción; si algo falla, no queda nada a medias.
async function enTransaccion(fn) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const resultado = await fn(conexion);
    await conexion.commit();
    return resultado;
  } catch (err) {
    await conexion.rollback();
    throw err;
  } finally {
    conexion.release();
  }
}

// Bloquea la mesa (SELECT ... FOR UPDATE) y revisa que no tenga un pedido vigente.
// Así, si otro mesero está abriendo un pedido en ese mismo instante (HU04), uno espera al otro.
async function bloquearMesaLibre(conexion, id, accion) {
  const [[mesa]] = await conexion.query(
    'SELECT id, nombre, estado FROM mesa WHERE id = ? AND activa = TRUE FOR UPDATE',
    [id],
  );
  if (!mesa) throw error(404, 'La mesa no existe o ya fue eliminada.');
  const [[vigente]] = await conexion.query(
    `SELECT COUNT(*) AS n FROM pedido pe WHERE pe.mesa_id = ? AND ${PEDIDO_VIGENTE}`,
    [id],
  );
  if (vigente.n > 0 || mesa.estado !== 'libre') {
    throw error(409, `La mesa "${mesa.nombre}" tiene un pedido abierto: no se puede ${accion}.`);
  }
  return mesa;
}

async function crear(nombre, usuarioId) {
  return enTransaccion(async (conexion) => {
    const [r] = await conexion.query('INSERT INTO mesa (nombre, creada_por) VALUES (?, ?)', [
      nombre,
      usuarioId,
    ]);
    await registrarHistorial(conexion, {
      mesaId: r.insertId,
      accion: 'crear',
      anterior: null,
      nuevo: nombre,
      usuarioId,
    });
    return r.insertId;
  });
}

async function renombrar(id, nombre, usuarioId) {
  return enTransaccion(async (conexion) => {
    const mesa = await bloquearMesaLibre(conexion, id, 'renombrar');
    await conexion.query('UPDATE mesa SET nombre = ? WHERE id = ?', [nombre, id]);
    await registrarHistorial(conexion, {
      mesaId: id,
      accion: 'renombrar',
      anterior: mesa.nombre,
      nuevo: nombre,
      usuarioId,
    });
  });
}

// "Eliminar" es desactivar: la mesa sale de la jornada pero sus pedidos viejos la conservan.
async function eliminar(id, usuarioId) {
  return enTransaccion(async (conexion) => {
    const mesa = await bloquearMesaLibre(conexion, id, 'eliminar');
    await conexion.query('UPDATE mesa SET activa = FALSE WHERE id = ?', [id]);
    await registrarHistorial(conexion, {
      mesaId: id,
      accion: 'eliminar',
      anterior: mesa.nombre,
      nuevo: null,
      usuarioId,
    });
  });
}

// Al cerrar la jornada: quita todas las mesas libres sin pedido vigente. Devuelve cuántas quitó.
async function quitarLibres(usuarioId) {
  return enTransaccion(async (conexion) => {
    const [libres] = await conexion.query(
      `SELECT m.id, m.nombre FROM mesa m
        WHERE m.activa = TRUE AND m.estado = 'libre'
          AND NOT EXISTS (SELECT 1 FROM pedido pe WHERE pe.mesa_id = m.id AND ${PEDIDO_VIGENTE})
        FOR UPDATE`,
    );
    for (const mesa of libres) {
      await conexion.query('UPDATE mesa SET activa = FALSE WHERE id = ?', [mesa.id]);
      await registrarHistorial(conexion, {
        mesaId: mesa.id,
        accion: 'eliminar',
        anterior: mesa.nombre,
        nuevo: null,
        usuarioId,
      });
    }
    return libres.length;
  });
}

module.exports = { listar, obtener, crear, renombrar, eliminar, quitarLibres };
