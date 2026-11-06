const pool = require('../config/db');
const pedidoModel = require('./pedido.model');

const { enTransaccion, encolarImpresion, leer, error } = pedidoModel.interno;

const IMPRESORAS = ['cocina', 'caja'];
// Si el agente no consulta la cola en este tiempo, se considera desconectado
const AGENTE_SIN_SEÑAL_MS = 30 * 1000;

// Última vez que el agente pidió trabajos de cada impresora. Vive en memoria: tras un
// reinicio de la API vuelve a "sin señal" hasta la siguiente consulta (3 segundos).
const ultimaConsulta = new Map();

// HU16 — Trabajos que el agente debe imprimir, en el orden en que se pidieron. Incluye los
// que fallaron (impresora apagada, sin papel): se reintentan hasta que salgan. Los ya
// impresos nunca vuelven a salir por aquí.
async function pendientes(impresoras = IMPRESORAS, limite = 20) {
  for (const i of impresoras) ultimaConsulta.set(i, Date.now());
  const [filas] = await pool.query(
    `SELECT id, tipo, impresora, pedido_id AS pedidoId, contenido, estado, intentos,
            ultimo_error AS ultimoError, creado_en AS creadoEn
       FROM trabajo_impresion
      WHERE estado IN ('pendiente', 'error') AND impresora IN (?)
      ORDER BY creado_en, id
      LIMIT ?`,
    [impresoras, limite],
  );
  return filas;
}

// El agente confirma que la tirilla salió. Es idempotente: si el agente repite la
// confirmación (por ejemplo, porque se cayó internet justo después de imprimir), no pasa
// nada. Devuelve null si el trabajo no existe.
async function marcarImpreso(id) {
  await pool.query(
    `UPDATE trabajo_impresion
        SET estado = 'impreso', impreso_en = NOW(), ultimo_error = NULL
      WHERE id = ? AND estado <> 'impreso'`,
    [id],
  );
  return obtener(id);
}

// El agente avisa que no pudo imprimir: el trabajo sigue en la cola (estado 'error') y se
// reintenta. Si ya estaba impreso, se deja como está.
async function marcarError(id, mensaje) {
  await pool.query(
    `UPDATE trabajo_impresion
        SET estado = 'error', intentos = LEAST(intentos + 1, 255), ultimo_error = ?
      WHERE id = ? AND estado <> 'impreso'`,
    [mensaje.slice(0, 255), id],
  );
  return obtener(id);
}

async function obtener(id) {
  const [[fila]] = await pool.query(
    `SELECT id, tipo, impresora, pedido_id AS pedidoId, estado, intentos,
            ultimo_error AS ultimoError, creado_en AS creadoEn, impreso_en AS impresoEn
       FROM trabajo_impresion WHERE id = ?`,
    [id],
  );
  return fila || null;
}

// Para el aviso en pantalla: cómo va cada impresora y si el agente está conectado.
async function estado() {
  const [filas] = await pool.query(
    `SELECT impresora,
            SUM(estado = 'pendiente') AS pendientes,
            SUM(estado = 'error') AS conError,
            TIMESTAMPDIFF(SECOND, MIN(creado_en), NOW()) AS segundosEsperando
       FROM trabajo_impresion
      WHERE estado IN ('pendiente', 'error')
      GROUP BY impresora`,
  );
  const [errores] = await pool.query(
    `SELECT impresora, ultimo_error AS ultimoError
       FROM trabajo_impresion
      WHERE estado = 'error'
      ORDER BY id DESC`,
  );
  const ahora = Date.now();
  const resultado = {};
  for (const i of IMPRESORAS) {
    const fila = filas.find((f) => f.impresora === i);
    const visto = ultimaConsulta.get(i);
    resultado[i] = {
      pendientes: Number(fila?.pendientes ?? 0),
      conError: Number(fila?.conError ?? 0),
      segundosEsperando: fila ? Number(fila.segundosEsperando) : 0,
      ultimoError: errores.find((e) => e.impresora === i)?.ultimoError ?? null,
      agenteConectado: Boolean(visto && ahora - visto < AGENTE_SIN_SEÑAL_MS),
    };
  }
  return resultado;
}

// Qué se puede reimprimir de un pedido, según en qué va
const DISPONIBLE = {
  comanda: (p) => p.items.length > 0,
  cuenta: (p) => p.estado === 'por_cobrar' || p.estado === 'pagado',
  comprobante: (p) => p.estado === 'pagado',
};
const NO_DISPONIBLE = {
  comanda: 'El pedido no tiene productos: no hay comanda para reimprimir.',
  cuenta: 'La cuenta todavía no se ha generado.',
  comprobante: 'El pedido todavía no está pagado: no hay comprobante.',
};

// Vuelve a encolar la tirilla de un pedido (comanda completa, cuenta o comprobante) con
// el texto de hoy y la marca REIMPRESIÓN, para que nadie la confunda con un pedido nuevo.
async function reimprimir(pedidoId, tipo, usuarioId) {
  return enTransaccion(async (conexion) => {
    const pedido = await leer(conexion, pedidoId);
    if (!pedido) throw error(404, 'El pedido no existe.');
    if (!DISPONIBLE[tipo](pedido)) throw error(409, NO_DISPONIBLE[tipo]);
    const contenido = `*** REIMPRESIÓN ***\n${pedido[tipo]}`;
    const id = await encolarImpresion(conexion, tipo, pedidoId, contenido, usuarioId);
    return { id, tipo, pedidoId, impresora: tipo === 'comanda' ? 'cocina' : 'caja' };
  });
}

// Solo para las pruebas
const reiniciarSeñal = () => ultimaConsulta.clear();

module.exports = {
  IMPRESORAS,
  pendientes,
  marcarImpreso,
  marcarError,
  estado,
  reimprimir,
  reiniciarSeñal,
};
